/**
 * Original offline Cargo collections, source-free execution and isolated probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdir, readFile, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkRustCollectionTypes } from "./rust-collection-types.mjs";
import { rustCollectionConversionProbe } from "./rust-collection-probes.mjs";

const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
const digest = async path => sha256(await readFile(path));
const snapshot = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => [path, await digest(join(root, path))])));

/**
 * Install original archives without Lean or C compilation and keep them unchanged.
 *
 * @param options - Verified Cargo handoff and exact third-party dependency closure.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.handoff - Original package-set handoff.
 * @param options.packages - Verified package entries.
 * @param options.dependencies - Checksummed vendored dependency archive.
 * @param options.environment - Explicit Rust tools.
 * @param options.projection - Compiler-checked private layout names for probes only.
 */
export const installRustCollections = async ({ consumer, handoff, packages, dependencies, environment, projection }) => {
	const root = join(consumer, "rust"), tools = join(root, "tools");
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.role, "component"); assert.equal(pkg.ecosystem, "cargo");
	await mkdir(tools, { recursive: true });
	await symlink("/usr/bin/ld", join(tools, "ld"));
	await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	const cargoHome = join(root, "cargo-home"); await mkdir(cargoHome);
	assert.deepEqual(await readdir(cargoHome), []);
	const cargo = await realpath(environment.LEAN_BRIDGE_CARGO), rustc = await realpath(environment.LEAN_BRIDGE_RUSTC);
	const env = { ...copiedCleanEnvironment
		, PATH: tools, RUSTC: rustc, RUSTFLAGS: "-Dwarnings"
		, CARGO_HOME: cargoHome, CARGO_NET_OFFLINE: "true"
		, CARGO_INCREMENTAL: "0", CARGO_TARGET_DIR: join(root, "target")
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	const rustcVersion = (await runCopied(rustc, ["--version"], root, env)).stdout.trim();
	const cargoVersion = (await runCopied(cargo, ["--version"], root, env)).stdout.trim();
	const archive = join(handoff, pkg.artifacts[0].path), dependencyArchive = join(consumer, "dependencies", dependencies.archive);
	assert.equal(await digest(archive), pkg.artifacts[0].sha256);
	assert.equal(await digest(dependencyArchive), dependencies.sha256);
	for(const path of [archive, dependencyArchive]) await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", path], root);
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-cargo-package");
	assert.equal(receipt.name, "collections-api"); assert.equal(receipt.name, pkg.name);
	assert.equal(receipt.version, "1.0.0"); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	await verifyNativeFiles(installed, receipt.files);
	const originalFiles = await snapshot(installed);
	assert.equal(originalFiles["Cargo.lock"], dependencies.lockSha256);
	for(const dependency of dependencies.packages)
	{
		const path = join(root, "dependencies", dependency.directory);
		assert.equal(await digest(join(path, ".cargo-checksum.json")), dependency.manifestSha256);
		const checksum = JSON.parse(await readFile(join(path, ".cargo-checksum.json")));
		assert.equal(checksum.package, dependency.checksum);
		for(const [file, hash] of Object.entries(checksum.files)) assert.equal(await digest(join(path, file)), hash);
	}
	const dependencyFiles = await snapshot(join(root, "dependencies"));
	await rm(handoff, { recursive: true, force: true });
	await rm(join(consumer, "dependencies"), { recursive: true, force: true });
	await saveLakeFile(root, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
	await saveLakeFile(root, "Cargo.toml", `[package]\nname="collection-consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[profile.dev]\ndebug=0\nincremental=false\n`);
	await saveLakeFile(root, "src/main.rs", await readFile("tests/fixtures/collection-consumers/rust.rs"));
	await runCopied(cargo, ["generate-lockfile", "--offline"], root, env);
	const metadata = JSON.parse((await runCopied(cargo, ["metadata", "--offline", "--locked", "--format-version", "1"], root, env)).stdout);
	const selected = metadata.packages.find(item => item.name === pkg.name);
	assert.equal(await realpath(selected.manifest_path), join(installed, "Cargo.toml"));
	assert.equal(selected.version, pkg.version);
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort(), dependencies.packages.map(item => item.directory).sort());
	for(const item of registry) assert.equal(await realpath(item.manifest_path), join(root, "dependencies", `${item.name}-${item.version}`, "Cargo.toml"));
	const publicTypes = await checkRustCollectionTypes({ root, cargo, environment: env });
	await runCopied(cargo, ["build", "--offline", "--locked", "--bin", "collection-consumer"], root, env);
	const executable = join(root, "target/debug/collection-consumer");
	const guide = (await readFile("docs/consume/rust.md", "utf8")).split("### Arrays and records\n")[1].split("\n### ")[0];
	const example = guide.match(/```rust\n([^]*?)\n```/)[1] + "\n";
	await saveLakeFile(root, "src/bin/documented-example.rs", example);
	await runCopied(cargo, ["build", "--offline", "--locked", "--bin", "documented-example"], root, env);
	const registries = async () => (await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/.test(name)).sort();
	const before = await registries();
	const execute = async command => {
		const result = await runCopied(command, [], consumer, { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" });
		assert.equal(result.stderr, ""); assert.match(result.stdout, /^collections-rust-ok:\d+:\d+:12\n$/);
		assert.deepEqual(await registries(), before);
		return result.stdout;
	};
	const first = await execute(executable);
	const [checks, calls, rejected] = first.trim().split(":").slice(1).map(Number);
	assert.ok(checks > 100000); assert.ok(calls > 3000); assert.equal(rejected, 12);
	assert.deepEqual(await snapshot(installed), originalFiles);
	const instrumented = join(root, "instrumented-crate");
	await cp(installed, instrumented, { recursive: true });
	assert.deepEqual(await snapshot(instrumented), originalFiles);
	const conversions = await rustCollectionConversionProbe(projection);
	const faults = await readFile("tests/fixtures/collection-consumers/rust-faults.rs", "utf8");
	await saveLakeFile(instrumented, "src/__runtime.rs", `${await readFile(join(instrumented, "src/__runtime.rs"), "utf8")}\n${conversions.probe}\n${faults}`);
	await saveLakeFile(instrumented, "Cargo.toml", `${await readFile(join(instrumented, "Cargo.toml"), "utf8")}\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const tested = await runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--manifest-path", join(instrumented, "Cargo.toml"), "--", "--test-threads=1", "--nocapture"], root, env);
	assert.match(tested.stdout, /5 passed; 0 failed/);
	const conversionCheckpoints = Number(tested.stdout.match(/collection-conversions-checkpoints:(\d+)/)?.[1]);
	const nativeFaultChecks = Number(tested.stdout.match(/collection-native-faults:(\d+)/)?.[1]);
	assert.ok(conversionCheckpoints > 40); assert.ok(nativeFaultChecks > 500);
	assert.deepEqual(await registries(), before);
	assert.deepEqual(await snapshot(installed), originalFiles);
	assert.deepEqual(await snapshot(join(root, "dependencies")), dependencyFiles);
	assert.equal(await execute(executable), first);
	const relocated = join(consumer, "relocated-consumer"); await rename(executable, relocated);
	const exampleExecutable = join(consumer, "relocated-example");
	await rename(join(root, "target/debug/documented-example"), exampleExecutable);
	const exampleExecutableSha256 = await digest(exampleExecutable);
	const executableSha256 = await digest(relocated), lockSha256 = await digest(join(root, "Cargo.lock"));
	await rm(root, { recursive: true, force: true });
	assert.deepEqual((await readdir(consumer)).sort(), ["relocated-consumer", "relocated-example"]);
	for(let repeat = 0; repeat < 2; repeat++) assert.equal(await execute(relocated), first);
	const exampleResult = await runCopied(exampleExecutable, [], consumer, { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" });
	assert.equal(exampleResult.stderr, ""); assert.equal(exampleResult.stdout, "[1, 2, 3]\n42\n");
	assert.deepEqual(await registries(), before);
	assert.equal(await digest(exampleExecutable), exampleExecutableSha256);
	return {
		checks, calls, rejected
		, publicTypes: { ...publicTypes, executed: true }
		, primitiveShapes: 19, recordTypes: 7, fixedArrayDepth: 24
		, threadedCalls: 512, rustcVersion, cargoVersion
		, compilerSha256: await digest(rustc), cargoSha256: await digest(cargo)
		, installedFiles: receipt.files, installedSnapshot: originalFiles
		, installedReceiptSha256: sha256(receiptBytes)
		, nativeLibraries: Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /\.so(?:\.|$)/.test(path)))
		, dependencies, dependencyFilesSha256: sha256(canonicalJson(dependencyFiles))
		, lockSha256, executableSha256, linkerSha256: sha256(linker)
		, faultTests: 5, nativeFaultChecks, conversionCheckpoints
		, conversionProbeSha256: sha256(conversions.probe)
		, faultSourceSha256: sha256(faults)
		, offlineInstall: true, emptyCargoHome: true, linkOnly: true
		, handoffRemovedBeforeExecution: true, compilerFreeExecution: true
		, relocatedExecutable: true, installedSourcesRemoved: true
		, repeatExecution: true, normalExitCleanup: true
		, installedFilesUnchanged: true, isolatedFaultCopy: true
		, documentation: { sourceSha256: sha256(example), stdout: exampleResult.stdout
			, executableSha256: exampleExecutableSha256
			, sourceFreeExecution: true, compilerFreeExecution: true
			, normalExitCleanup: true }
	};
};
