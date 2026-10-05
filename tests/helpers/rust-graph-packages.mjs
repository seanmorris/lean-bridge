/**
 * Installed recursive Cargo archives with offline compilation and relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { packageOrdinaryCargo } from "../../src/release/native-cargo.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { ordinaryRustEvidence } from "../../src/build/native-rust-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { prepareRustCorpusDependencies, captureRustCompiler } from "./type-corpus-rust.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const target = "x86_64-unknown-linux-gnu";
const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;

const faults = `
#[cfg(test)] mod installed_graph_tests {
    use super::*;
    #[test] fn allocation_unwind_and_retirement() {
        let tree = Tree::Branch { children: vec![Tree::Branch { children: vec![] }] };
        let envelope = Envelope { tree: tree.clone(), alternatives: vec![vec![tree.clone()]], fallback: Some(tree.clone()),
            outcome: Box::new(Err("error\\0🌿".into())), marker: Some(Some(())) };
        assert_eq!(crate::envelope(&envelope).unwrap(), envelope);
        let count = GRAPH_FAULT.with(|state| state.get().1); assert!(count > 10);
        let hook = std::panic::take_hook(); std::panic::set_hook(Box::new(|_| {}));
        for panic in [false, true] {
            for checkpoint in 1..=count {
                GRAPH_FAULT.with(|state| state.set((checkpoint, 0, panic)));
                let result = std::panic::catch_unwind(|| crate::envelope(&envelope));
                GRAPH_FAULT.with(|state| state.set((0, 0, false)));
                assert_eq!(GRAPH_LIVE.with(|live| live.get()), 0);
                if panic { assert!(result.is_err()); }
                else { assert_eq!(result.unwrap(), Err(Error::Allocation)); }
                assert_eq!(crate::envelope(&envelope).unwrap(), envelope);
                assert_eq!(GRAPH_LIVE.with(|live| live.get()), 0);
            }
        }
        std::panic::set_hook(hook);
        let owned = crate::envelope(&envelope).unwrap();
        let runtime = graph_runtime().unwrap(); unsafe { (runtime.lifecycle.retire)(); }
        GRAPH_FAULT.with(|state| state.set((0, 0, false)));
        assert!(matches!(crate::envelope(&envelope), Err(Error::Native { code: 5, .. })));
        assert_eq!(GRAPH_FAULT.with(|state| state.get().1), 0);
        assert_eq!(GRAPH_LIVE.with(|live| live.get()), 0);
        assert_eq!(owned, envelope);
        drop(owned);
        println!("installed-rust-graph-checkpoints:{count}");
    }
}
`;

const prepare = async ({ author, handoff, environment, reviewed, diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release");
	const ir = nativeRecursiveReviewedIr();
	await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: ["Recursive"]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { cargo: { name: "recursive-api", version: "1.0.0" } } }));
	if(reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building Cargo-only recursive release`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const receipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(receipt.packages.length, 1); assert.equal(receipt.packages[0].target, "cargo");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime");
	const adapterRoot = join(outputRoot, "native/c-binding"), rustRoot = join(outputRoot, "native/rust");
	const model = await json(join(nativeRoot, "model.json")), component = await json(join(nativeRoot, "native-component.json"));
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	const releaseOptions = { working: join(author, "repackaged")
		, nativeRoot, runtimeRoot, adapterRoot, rustRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: { name: "recursive-api", version: "1.0.0" }
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" };
	const repeated = await packageOrdinaryCargo(releaseOptions);
	assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryRustEvidence({ nativeRoot, runtimeRoot, adapterRoot }), /Rust C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	// A re-signed inventory is insufficient when generated sources no longer
	// match the checked model. Reassembly must reconstruct those sources too.
	const compiled = await json(join(rustRoot, "native-rust.json")), original = await readFile(join(rustRoot, "src/lib.rs"), "utf8");
	const changed = `${original}\n// drift\n`;
	await saveLakeFile(rustRoot, "src/lib.rs", changed);
	await saveLakeFile(rustRoot, "native-rust.json", canonicalJson({ ...compiled, files: { ...compiled.files, "src/lib.rs": { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
	await assert.rejects(() => packageOrdinaryCargo(releaseOptions), /Generated Rust source differs/);
	await saveLakeFile(rustRoot, "src/lib.rs", original);
	await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(compiled));
	const dependencies = await prepareRustCorpusDependencies({ rustRoot, directory: author, handoff, environment });
	return { pkg: receipt.packages[0], dependencies
		, provenance: { exports: model.exports.length
			, bindingIrSha256: built.bindingIrSha256
			, binarySha256: component.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, adapterSha256: sha256(canonicalJson(adapter))
			, publicSourceSha256: sha256(original)
			, deterministicReassembly: true, checkedSourceUnchanged: true
			, rejectsGraphReceiptDrift: 3, rejectsRegeneratedSourceDrift: true
			, cargoOnly: true } };
};

const preparePeer = async ({ author, handoff, environment }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release");
	await saveLakeFile(projectRoot, "Peer.lean", "namespace Peer\ndef answer : UInt32 := 42\nend Peer\n");
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "peer"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Peer"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: ["Peer"], exports: ["Peer.answer"]
		, targets: { cargo: { name: "peer-api", version: "1.0.0" } } }));
	await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment });
	const receipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	return receipt.packages[0];
};

const install = async ({ consumer, handoff, peerHandoff, peer, pkg, dependencies, environment, diagnostic }) => {
	const project = join(consumer, "project"), vendor = join(project, "vendor"), tools = join(project, "tools");
	await mkdir(vendor, { recursive: true }); await mkdir(tools);
	const unpack = path => runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", path, "-C", vendor], consumer);
	await unpack(join(handoff, pkg.artifacts[0].path));
	await unpack(join(peerHandoff, peer.artifacts[0].path));
	assert.equal(peer.runtimeIdentity, pkg.runtimeIdentity);
	const peerReceipt = await json(join(vendor, `${peer.name}-${peer.version}`, "lean-bridge/package-receipt.json"));
	await verifyNativeFiles(join(vendor, `${peer.name}-${peer.version}`), peerReceipt.files);
	assert.equal(await digest(join(handoff, dependencies.archive)), dependencies.sha256);
	await unpack(join(handoff, dependencies.archive));
	const installed = join(vendor, `${pkg.name}-${pkg.version}`);
	const receipt = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	await verifyNativeFiles(installed, receipt.files);
	assert.equal(await digest(join(installed, "Cargo.lock")), dependencies.lockSha256);
	for(const dependency of dependencies.packages)
	{
		const root = join(vendor, "dependencies", dependency.directory), checksum = await json(join(root, ".cargo-checksum.json"));
		assert.equal(await digest(join(root, ".cargo-checksum.json")), dependency.manifestSha256);
		for(const [file, hash] of Object.entries(checksum.files)) assert.equal(await digest(join(root, file)), hash);
	}
	await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	await symlink("/usr/bin/ld", join(tools, "ld"));
	const cargoHome = join(project, "cargo-home"); await mkdir(cargoHome);
	assert.deepEqual(await readdir(cargoHome), []);
	const env = { ...copiedCleanEnvironment, PATH: tools
		, RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: cargoHome
		, RUSTFLAGS: "-Dwarnings", CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
		, CARGO_TARGET_DIR: join(project, "target")
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, project, env);
	await saveLakeFile(project, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="vendor/dependencies"\n');
	await saveLakeFile(project, "Cargo.toml", `[package]\nname="recursive-consumer"\nversion="1.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="vendor/${pkg.name}-${pkg.version}"}\n${peer.name}={path="vendor/${peer.name}-${peer.version}"}\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = (await readFile("tests/fixtures/structured-types/recursive-installed.rs", "utf8"))
		.replace("__WIDE_FIELDS__", Array.from({ length: 255 }, (_, i) => `field${i}: ${i},`).join(" "));
	assert.doesNotMatch(source, /unsafe|extern|__WIDE_FIELDS__/);
	await saveLakeFile(project, "src/main.rs", source);
	const composition = await readFile("tests/fixtures/structured-types/recursive-composition.rs", "utf8");
	await saveLakeFile(project, "src/bin/composition.rs", composition);
	const guide = (await readFile("docs/consume/rust.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
	const documentation = guide.match(/```rust\n([^]*?)\n```/)[1] + "\n";
	await saveLakeFile(project, "src/bin/documentation.rs", documentation);
	await rm(handoff, { recursive: true, force: true });
	await rm(peerHandoff, { recursive: true, force: true });
	diagnostic("Compiling installed Cargo consumer offline with an empty cache and link-only C tool");
	await cargo(["generate-lockfile", "--offline"]);
	const args = ["--locked", "--offline", "--target", target];
	const metadata = JSON.parse((await cargo(["metadata", "--locked", "--offline", "--format-version", "1"])).stdout);
	assert.equal(metadata.packages.find(item => item.name === pkg.name).manifest_path, join(installed, "Cargo.toml"));
	assert.deepEqual(metadata.packages.filter(item => item.source !== null).map(item => `${item.name}-${item.version}`).sort(), dependencies.packages.map(item => item.directory).sort());
	await cargo(["build", ...args, "--bin", "recursive-consumer"]);
	await cargo(["build", ...args, "--bin", "composition"]);
	await cargo(["build", ...args, "--bin", "documentation"]);
	const negatives = [
		["api::tree(&7)", "E0308"]
		, ["api::Tree::Leaf { payload: 0 }", "E0308"]
		, ["api::Spine::Next { value: api::Spine::Leaf { value: 1 } }", "E0308"]
		, ["api::Tree::Missing", "E0599"]
		, ["api::Tree::Leaf {}", "E0063"]
		, ["api::word_max(-1i64)", "E0308"] ];
	const rejected = [];
	for(const [index, [expression, expected]] of negatives.entries())
	{
		const name = `invalid${index}`, file = `src/bin/${name}.rs`, source = `use recursive_api as api; fn main() { let _ = ${expression}; }\n`;
		await saveLakeFile(project, file, source);
		const result = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", ...args, "--bin", name, "--message-format=json"], project, env);
		assert.equal(result.code, 101, result.stderr);
		const errors = result.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(errors.length > 0);
		for(const { message } of errors)
		{
			assert.equal(message.code?.code, expected);
			assert.ok(message.spans.some(span => span.is_primary && span.file_name === file));
		}
		rejected.push({ sourceSha256: sha256(source), diagnostic: expected });
	}
	const deployed = join(consumer, "relocated-consumer");
	await rename(join(project, "target", target, "debug/recursive-consumer"), deployed);
	const composed = join(consumer, "relocated-composition");
	await rename(join(project, "target", target, "debug/composition"), composed);
	const documented = join(consumer, "relocated-documentation");
	await rename(join(project, "target", target, "debug/documentation"), documented);
	const original = await readFile(join(installed, "src/__runtime.rs"), "utf8");
	await saveLakeFile(installed, "src/__runtime.rs", original + faults);
	// Run inside the consumer to retain its offline dependency replacement.
	const tested = await cargo(["test", ...args, "--lib", "-p", pkg.name, "--", "--nocapture", "--test-threads=1"]);
	assert.match(tested.stdout, /1 passed; 0 failed/);
	const checkpoints = Number(tested.stdout.match(/installed-rust-graph-checkpoints:(\d+)/)?.[1]);
	assert.ok(checkpoints > 10);
	await saveLakeFile(installed, "src/__runtime.rs", original);
	// Changing embedded bytes must fail before invoking the native adapter.
	const library = join(installed, "native/linux-x64/librecursive.so"), libraryBytes = await readFile(library);
	const corrupt = Buffer.from(libraryBytes); corrupt[corrupt.length - 1] ^= 1;
	await saveLakeFile(installed, "native/linux-x64/librecursive.so", corrupt);
	await cargo(["build", ...args, "--bin", "recursive-consumer"]);
	await assert.rejects(() => runCopied(join(project, "target", target, "debug/recursive-consumer"), [], project), error => /differs from compiled evidence/.test(error.details?.stderr));
	await saveLakeFile(installed, "native/linux-x64/librecursive.so", libraryBytes);
	const info = { packageReceiptSha256: sha256(canonicalJson(receipt))
		, compiledProjectionSha256: receipt.compiledProjectionSha256
		, consumerSourceSha256: sha256(source)
		, executableSha256: await digest(deployed)
		, dependencies, rejected, checkpoints, faultProbeSha256: sha256(faults)
		, publicSourceSha256: await digest(join(installed, "src/lib.rs"))
		, conversionSourceSha256: sha256(original)
		, loaderSourceSha256: await digest(join(installed, "src/assets.rs"))
		, lockSha256: await digest(join(project, "Cargo.lock"))
		, linkerSha256: sha256(linker)
		, rustc: (await runCopied(environment.LEAN_BRIDGE_RUSTC, ["--version"], project, env)).stdout.trim()
		, composition: { package: peer, consumerSha256: sha256(composition)
			, executableSha256: await digest(composed), componentCount: 2 }
		, documentation: { sourceSha256: sha256(documentation)
			, executableSha256: await digest(documented) }
		, rejectsTamperedAssets: true
		, offline: true, emptyCargoHome: true, linkOnly: true };
	await rm(project, { recursive: true, force: true });
	assert.deepEqual((await readdir(consumer)).sort(), ["relocated-composition", "relocated-consumer", "relocated-documentation"]);
	const runtimeEnv = { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" };
	const runRelocated = async binary => {
		// exec preserves the shell PID. Check only this process's registry;
		// concurrent Rust acceptance jobs own unrelated registry directories.
		const result = await runCopied("/bin/sh", ["-c", 'printf "%s\\n" "$$"; exec "$1"', "lean-bridge-runtime-probe", binary], consumer, runtimeEnv);
		const separator = result.stdout.indexOf("\n"), pid = result.stdout.slice(0, separator);
		assert.match(pid, /^[1-9][0-9]*$/);
		assert.deepEqual((await readdir("/tmp")).filter(name => name.startsWith(`lean-bridge-rust-v1-${process.getuid()}-${pid}-`)), []);
		return { ...result, stdout: result.stdout.slice(separator + 1) };
	};
	const result = await runRelocated(deployed);
	const repeated = await runRelocated(deployed);
	const together = await runRelocated(composed);
	const documentedRun = await runRelocated(documented);
	assert.equal(documentedRun.stderr, ""); assert.equal(documentedRun.stdout, "");
	assert.equal(together.stderr, "");
	assert.equal(together.stdout, "recursive-composition-ok:shared-runtime,fork-rejection,retirement,owned-cleanup\n");
	assert.equal(result.stderr, ""); assert.deepEqual(repeated, result);
	assert.match(result.stdout, /^recursive-installed-ok:\d+\n$/);
	return { ...info, checks: Number(result.stdout.match(/:(\d+)/)[1])
		, sharedRuntime: true, forkRejection: true, crossCrateRetirement: true
		, installedSourcesRemoved: true, authorSourcesRemoved: true
		, handoffRemoved: true, compilerFreeExecution: true, normalExitCleanup: true
		, stdout: result.stdout };
};

/**
 * Build and install both ordinary and independently reviewed graph contracts.
 *
 * @param directory - Fresh task-owned temporary root.
 * @param diagnostic - Test progress callback.
 */
export const checkInstalledRustGraphs = async (directory, diagnostic = () => {}) => {
	const environment = { ...nativeFixtureEnvironment(["rust"])
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary");
		const author = join(root, "author"), consumer = join(root, "consumer"), handoff = join(consumer, "handoff");
		const prepared = await prepare({ author, handoff, environment, reviewed, diagnostic });
		await rm(author, { recursive: true, force: true });
		const peerAuthor = join(root, "peer-author"), peerHandoff = join(consumer, "peer-handoff");
		const peer = await preparePeer({ author: peerAuthor, handoff: peerHandoff, environment });
		await rm(peerAuthor, { recursive: true, force: true });
		const installed = await install({ consumer, handoff, peerHandoff, peer, environment, ...prepared, diagnostic });
		assert.equal(installed.publicSourceSha256, prepared.provenance.publicSourceSha256);
		observations.push({ reviewed, ...prepared.provenance, package: prepared.pkg, ...installed });
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: ${installed.checks} source-free checks; ${installed.checkpoints} allocation/unwind checkpoints`);
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, installedPackage: true, observations };
};
