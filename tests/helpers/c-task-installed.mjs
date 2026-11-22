/**
 * Compile a C app against two independently built, verified, relocated release archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { exerciseInstalledCTask } from "./c-task-consumer.mjs";

const exec = promisify(execFile), cli = resolve("scripts/lean-bridge.mjs"), fixture = resolve("tests/fixtures/c-lean-tasks");
const pr = name => ({ kind: "primitive", name });
const base = { name: "pulse", modules: ["Pulse"], componentIdentity: "0".repeat(64) };
test("the packaged CLI and isolated engine include the C notification and compiler inputs", async () => {
	const cliFiles = JSON.parse(await readFile("config/cli-package.v1.json")).files;
	const engine = JSON.parse(await readFile("nix/perl-engine-source-boundary.json")).includedFiles;
	const paths = ["src/backends/c/task-delivery.h"
		, "src/backends/c/task-exports.mjs"
		, "src/backends/c/task-values.mjs"
		, "src/backends/native/task-notification.h"
		, "src/backends/native/pull-entry.mjs"
		, "src/release/c-task-package.mjs"
		, "src/analyze/HostExports.lean"];
	for(const path of paths)
	{
		assert.ok(cliFiles.includes(path), `missing from CLI: ${path}`);
		assert.ok(engine.includes(path), `missing from engine: ${path}`);
	}
});

test("C task generation rejects unsupported carrier widths and colliding or foreign APIs", () => {
	const entry = { name: "work", declaration: "Pulse.work", effect: "pure", delivery: "task", parameters: [], result: pr("uint64") };
	const build = entries => generateCTaskExports({ ...base, entries });
	const g = build([entry]);
	assert.match(g.header, /uint64_t \*out/u); assert.doesNotMatch(g.header, /lean_object|lean\/lean\.h/u);
	assert.match(g.entryLean, /IO \(_root_\.Task _root_\.UInt64\)/u);
	for(const name of ["int", "nat"]) assert.throws(() => build([{ ...entry, result: pr(name) }]), /no implicit narrowing/u);
	assert.throws(() => build([entry, entry]), /duplicate/u);
	assert.throws(() => build([{ ...entry, hostMembers: ["Other.read"] }]), /Invalid/u);
});

test("original C task archives replay without their producer or a Lean build", {
	skip: !process.env.LEAN_BRIDGE_C_TASK_REPLAY_DIR, timeout: 180_000
}, async t => {
	const evidence = resolve(process.env.LEAN_BRIDGE_C_TASK_REPLAY_DIR);
	const root = await mkdtemp(join(tmpdir(), "c-task-replay-")); t.after(() => rm(root, { recursive: true, force: true }));
	const run = async (cmd, args, options) => (await exec(cmd, args, { cwd: root, ...options })).stdout;
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(evidence, route), prior = JSON.parse(await readFile(join(dir, "acceptance.json")));
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
		assert.deepEqual(receipt.profiles.map(v => v.id), ["native-c-task-v1"]);
		const [pkg] = receipt.packages; assert.deepEqual(pkg.artifacts, [prior.archive]);
		assert.equal(prior.route, route); assert.equal(prior.result, "passed");
		assert.equal(sha256(await readFile(join(dir, "consumer.c"))), prior.consumerSha256);
		const prefix = join(root, `installed-${route}`); await mkdir(prefix);
		await run("tar", ["-xzf", join(dir, prior.archive.path), "--strip-components=1", "-C", prefix]);
		await exerciseInstalledCTask({ root, prefix, fixture: dir, route, run });
	}
});

test("ordinary and reviewed C task archives run a nonblocking installed consumer after relocation", {
	skip: process.env.LEAN_BRIDGE_C_TASK_TEST !== "1", timeout: 900_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "c-lean-tasks-")), retain = process.env.LEAN_BRIDGE_C_TASK_EVIDENCE_DIR;
	t.after(() => rm(root, { recursive: true, force: true }));
	const run = async (command, args, options = {}) => {
		try
		{
			return (await exec(command, args, { cwd: root, ...options })).stdout;
		}
		catch(e)
		{
			throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`, { cause: e });
		}
	};
	const bridge = async (...args) => JSON.parse(await run(process.execPath, [cli, ...args, "--format", "json"]));
	let prior;
	for(const route of ["ordinary", "reviewed"])
	{
		const project = join(root, `source-${route}`), out = join(root, `release-${route}`);
		await mkdir(project);
		const inputs = ["Pulse.lean", "lean-toolchain", "lakefile.toml", "lean-bridge.exports.json"];
		for(const f of inputs) await copyFile(join(fixture, f), join(project, f));
		if(prior)
		{
			inputs.push("pulse.binding-ir.json"); await writeFile(join(project, inputs.at(-1)), canonicalJson(prior));
		}
		await bridge("build", "--project", project, "--target", "c", "--output", out);
		const receiptPath = join(out, "package-set-receipt.json");
		assert.equal((await bridge("verify", "--receipt", receiptPath)).result.archives, 1);
		const receipt = JSON.parse(await readFile(receiptPath));
		const [pkg] = receipt.packages, [artifact] = pkg.artifacts;
		assert.deepEqual([pkg.target, pkg.profile, pkg.role, pkg.runtimeDelivery], ["c", "native-c-task-v1", "component", "embedded"]);
		const api = JSON.parse(await readFile(join(out, "binding-ir.json"))), digest = hashBindingIr(api);
		assert.equal(receipt.profiles[0].bindingIrSha256, digest);
		const evidence = JSON.parse(await readFile(join(out, "host-export-evidence.json")));
		assert.equal(evidence.reviewedSourceSha256, prior ? sha256(canonicalJson(prior)) : null);
		assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256);
		if(prior) assert.deepEqual(api, prior); prior = api;
		assert.equal(api.declarations.find(d => d.name === "series").resultMode, "async-iterator");
		const keep = retain ? join(resolve(retain), route) : null;
		if(keep)
		{
			await mkdir(resolve(retain), { recursive: true }); await mkdir(keep);
			await mkdir(join(keep, "archives")); await mkdir(join(keep, "source"));
			for(const f of inputs) await copyFile(join(project, f), join(keep, "source", f), constants.COPYFILE_EXCL);
			for(const f of [artifact.path, "binding-ir.json", "host-export-evidence.json", "native-release.json", "package-set-receipt.json", "package-set-receipt.json.sha256"])
				await copyFile(join(out, f), join(keep, f), constants.COPYFILE_EXCL);
		}
		await rm(project, { recursive: true }); // No producer source or interfaces when the app is built.
		const extract = join(root, `unpacked-${route}`), prefix = join(root, `moved-${route}`);
		await mkdir(extract); await run("tar", ["-xzf", join(out, artifact.path), "-C", extract]);
		await rename(join(extract, basename(artifact.path, ".tar.gz")), prefix);
		const manifest = JSON.parse(await readFile(join(prefix, "lean-bridge-package.json")));
		assert.equal(manifest.runtimeIdentity, pkg.runtimeIdentity); assert.equal(manifest.bindingIrSha256, digest);
		for(const [path, record] of Object.entries(manifest.files))
		{
			const bytes = await readFile(join(prefix, path)); assert.equal(bytes.length, record.bytes); assert.equal(sha256(bytes), record.sha256);
			if(path === "lib/liblbc_pulse.so") assert.ok(!bytes.includes(Buffer.from(root)), "no private release path in installed adapter");
		}
		const { app, cmake } = await exerciseInstalledCTask({ root, prefix, fixture, route, run });
		if(keep)
		{
			await copyFile(join(fixture, "consumer.c"), join(keep, "consumer.c"));
			await copyFile(join(fixture, "CMakeLists.txt"), join(keep, "CMakeLists.txt"));
			await writeFile(join(keep, "acceptance.json"), canonicalJson({ route
				, archive: artifact
				, bindingIrSha256: digest
				, runtimeIdentity: pkg.runtimeIdentity
				, componentIdentity: manifest.componentIdentity
				, consumerSha256: sha256(await readFile(join(fixture, "consumer.c")))
				, consumerBinarySha256: sha256(await readFile(app))
				, compiler: (await run("cc", ["--version"])).split("\n")[0]
				, cmake: (await run(cmake, ["--version"])).split("\n")[0]
				, installedUsing: ["pkg-config", "CMake"]
				, result: "passed" }), { flag: "wx" });
		}
	}
});
