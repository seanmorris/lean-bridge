/**
 * Exact package-tree controls, including a real Cargo build-script injection.
 * Small synthetic packages test the guard, not Lean or installed Fin acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finContainerEdgeClosedProfiles, verifyFinContainerEdgeArchiveClosure, verifyFinContainerEdgeFileClosure } from "./helpers/fin-container-edge-closure.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const receiptPath = "lean-bridge/package-receipt.json";
const sourceGate = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-file-closure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const installed = join(root, "probe-1.0.0");
	await saveLakeFile(installed, "Cargo.toml", '[package]\nname="probe"\nversion="1.0.0"\nedition="2021"\n');
	await saveLakeFile(installed, "src/lib.rs", "pub fn value() -> u32 { 1 }\n");
	const files = {};
	for(const path of await nativeArtifactPaths(installed))
	{
		const bytes = await readFile(join(installed, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptBytes = Buffer.from(canonicalJson({ name: "probe", version: "1.0.0", files }));
	await saveLakeFile(installed, receiptPath, receiptBytes);
	return { root, installed, receiptPath, receiptBytes };
};

test("exact package closure rejects extra files, links, changed sources and substituted receipts", async t => {
	const options = await fixture(t), { root, installed } = options;
	const expected = await verifyFinContainerEdgeFileClosure(options);
	assert.equal(expected.receiptSha256, sha256(options.receiptBytes));
	assert.equal(expected.packageFileSetSha256, sha256(canonicalJson(await nativeArtifactPaths(installed))));
	assert.deepEqual(finContainerEdgeClosedProfiles, ["c", "cpp", "wit-wasi", "rust"]);
	for(const path of ["build.rs", "src/extra.rs", ".cargo/config.toml", "lib/extra.txt"])
	{
		await saveLakeFile(installed, path, "unrecorded executable input");
		await assert.rejects(verifyFinContainerEdgeFileClosure(options), /unrecorded or missing file/u);
		await rm(join(installed, path));
	}
	const original = await readFile(join(installed, "src/lib.rs"));
	await saveLakeFile(installed, "src/lib.rs", "changed");
	await assert.rejects(verifyFinContainerEdgeFileClosure(options), /native artifact drift/u);
	await saveLakeFile(installed, "src/lib.rs", original);
	await saveLakeFile(installed, receiptPath, options.receiptBytes.toString() + "\n");
	await assert.rejects(verifyFinContainerEdgeFileClosure(options), /receipt must equal/u);
	await saveLakeFile(installed, receiptPath, options.receiptBytes);
	for(const [path, target] of [["extra", "src"], ["extra", "missing"], ["extra.rs", "src/lib.rs"]])
	{
		await symlink(target, join(installed, path));
		await assert.rejects(verifyFinContainerEdgeFileClosure(options), /unsupported native artifact/u);
		await rm(join(installed, path));
	}
	await symlink(installed, join(root, "alias"));
	await assert.rejects(verifyFinContainerEdgeFileClosure({ ...options, installed: join(root, "alias") }), /root must not traverse a symlink/u);
	await rename(join(installed, "src/lib.rs"), join(root, "outside.rs"));
	await symlink(join(root, "outside.rs"), join(installed, "src/lib.rs"));
	await assert.rejects(verifyFinContainerEdgeFileClosure(options), /unsupported native artifact/u);
	await rm(join(installed, "src/lib.rs"));
	await rename(join(root, "outside.rs"), join(installed, "src/lib.rs"));
	assert.deepEqual(await verifyFinContainerEdgeFileClosure(options), expected);
});

test("archive closure authenticates the original receipt and rechecks the archive digest", async t => {
	const options = await fixture(t), { root, installed } = options;
	const archive = join(root, "probe.tar.gz");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-cf", archive, "probe-1.0.0"], root);
	const archived = { profile: "rust", installed, receiptPath, archive, archiveSha256: sha256(await readFile(archive)) };
	assert.deepEqual(await verifyFinContainerEdgeArchiveClosure(archived), await verifyFinContainerEdgeFileClosure(options));
	await assert.rejects(verifyFinContainerEdgeArchiveClosure({ ...archived, archiveSha256: sha256("wrong") }), /archive drift/u);
	await assert.rejects(verifyFinContainerEdgeArchiveClosure({ ...archived, profile: "python" }), /no exact package closure/u);
	const substituted = JSON.parse(options.receiptBytes);
	await saveLakeFile(installed, "build.rs", "fn main() {}\n");
	substituted.files["build.rs"] = { bytes: 13, sha256: sha256("fn main() {}\n") };
	await saveLakeFile(installed, receiptPath, canonicalJson(substituted));
	await assert.rejects(verifyFinContainerEdgeArchiveClosure(archived), /receipt must equal/u);
});

test("installed Rust guard refuses an executable build.rs before Cargo and rechecks clean executions", { skip: !sourceGate }, async t => {
	const { root, installed } = await fixture(t);
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	const rustc = resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc");
	const handoff = join(root, "handoff"), archive = join(handoff, "probe.tar.gz");
	await mkdir(handoff); await mkdir(join(root, "dependencies"));
	const dependenciesPath = join(handoff, "dependencies.tar.gz");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-cf", dependenciesPath, "dependencies"], root);
	const dependencyBytes = await readFile(dependenciesPath);
	const dependencies = { archive: "dependencies.tar.gz", sha256: sha256(dependencyBytes) };
	const marker = join(root, "build-script-executed");
	const buildScript = `fn main() { std::fs::write(${JSON.stringify(marker)}, "executed").unwrap(); }\n`;
	const pack = async () => {
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-cf", archive, "probe-1.0.0"], root);
		const artifact = { path: "probe.tar.gz", sha256: sha256(await readFile(archive)) };
		return [{ role: "component", name: "probe", version: "1.0.0"
			, artifacts: [artifact] }];
	};
	const install = async (name, verifyInstalledPackage, source = 'fn main() { println!("edge-closure-ok:{}", probe::value()); }\n') => {
		const consumer = join(root, name);
		await saveLakeFile(consumer, "dependencies/dependencies.tar.gz", dependencyBytes);
		return installCopiedConsumer({ profile: "rust", consumer, handoff
			, packages: await pack(), dependencies
			, environment: { LEAN_BRIDGE_CARGO: cargo, LEAN_BRIDGE_RUSTC: rustc }
			, fixture: { source: () => source, success: "edge-closure-ok", expectedChecks: 1, verifyInstalledPackage } });
	};
	await saveLakeFile(installed, "build.rs", buildScript);
	await assert.rejects(install("guarded", verifyFinContainerEdgeArchiveClosure), /unrecorded or missing file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await assert.rejects(access(join(root, "guarded/rust/target")), { code: "ENOENT" });
	// Positive control: this exact script really executes through Cargo when no guard is installed.
	assert.equal((await install("unguarded")).checks, 1);
	assert.equal(await readFile(marker, "utf8"), "executed");
	await rm(marker); await rm(join(installed, "build.rs"));
	let checked = 0;
	const guard = async options => { checked++; return verifyFinContainerEdgeArchiveClosure(options); };
	assert.equal((await install("clean", guard)).checks, 1);
	assert.equal(checked, 3, "before Cargo, before consumer execution, after consumer execution");
	await assert.rejects(access(marker), { code: "ENOENT" });
	checked = 0;
	const tamper = 'fn main() { println!("edge-closure-ok:{}", probe::value()); std::fs::write("probe-1.0.0/extra.rs", "unrecorded").unwrap(); }\n';
	await assert.rejects(install("post-run-drift", guard, tamper), /unrecorded or missing file/u);
	assert.equal(checked, 3, "the post-execution guard detects consumer-created files");
});

test("C, C++ and WIT refuse extra package files before tool or compiler setup", async t => {
	const { root } = await fixture(t);
	for(const profile of ["c", "cpp", "wit-wasi"])
	{
		const directory = `probe-1.0.0-${profile}`, archive = join(root, `${profile}.tar.gz`);
		await saveLakeFile(root, `${directory}/payload.txt`, "payload");
		await saveLakeFile(root, `${directory}/lean-bridge-package.json`, canonicalJson({ files: {
			"payload.txt": { bytes: 7, sha256: sha256("payload") } } }));
		await saveLakeFile(root, `${directory}/extra.c`, "unrecorded");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-cf", archive, directory], root);
		const artifact = { path: `${profile}.tar.gz`, sha256: sha256(await readFile(archive)) };
		const packages = [{ role: "component", name: "probe", version: "1.0.0", artifacts: [artifact] }];
		const consumer = join(root, `consumer-${profile}`);
		await assert.rejects(installCopiedConsumer({ profile, consumer, handoff: root
			, packages, environment: {}
			, fixture: { source: () => "synthetic guard fixture", verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure } }), /unrecorded or missing file/u);
		await assert.rejects(access(join(consumer, profile, "tools")), { code: "ENOENT" });
	}
});
