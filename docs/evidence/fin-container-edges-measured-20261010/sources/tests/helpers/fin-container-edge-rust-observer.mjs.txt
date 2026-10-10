/**
 * Observe the complete Rust caller compiled offline against a receipt-verified relocated crate.
 * Native code is prebuilt. Only Rust code and test-only C instrumentation are compiled here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, realpath, symlink } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeEntries, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { finContainerEdgeRustProbe, readFinContainerEdgeRust } from "./fin-container-edge-rust.mjs";
import { finContainerEdgeRustInterposer } from "./fin-container-edge-rust-loader.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const digest = /^[a-f0-9]{64}$/u;
const target = "x86_64-unknown-linux-gnu";
const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
const hashFile = async path => sha256(await readFile(path));

/**
 * Authenticate every vendored source against the original locked dependency handoff.
 *
 * @param options - Relocated dependency directory and authenticated handoff metadata.
 * @param options.installed - Receipt-verified crate containing its original Cargo.lock.
 * @param options.dependencyRoot - Relocated directory extracted from the handoff archive.
 * @param options.dependencyArchive - Unchanged original dependency handoff archive.
 * @param options.dependencies - Metadata returned by prepareRustCorpusDependencies.
 */
export const verifyFinContainerEdgeRustDependencies = async ({ installed, dependencyRoot, dependencyArchive, dependencies }) => {
	assert.match(dependencies.sha256, digest); assert.match(dependencies.lockSha256, digest);
	assert.equal(await realpath(dependencyRoot), resolve(dependencyRoot));
	assert.equal(await hashFile(dependencyArchive), dependencies.sha256, "Rust dependency archive drift");
	assert.equal(await hashFile(join(installed, "Cargo.lock")), dependencies.lockSha256, "Rust package lock drift");
	assert.ok(Array.isArray(dependencies.packages) && dependencies.packages.length > 0);
	const names = dependencies.packages.map(pkg => pkg.directory);
	assert.equal(new Set(names).size, names.length);
	for(const name of names) assert.match(name, /^[A-Za-z0-9][A-Za-z0-9_.+-]*$/u);
	assert.deepEqual((await readdir(dependencyRoot)).sort(), [...names].sort(), "Rust dependency closure changed");
	const inventory = {};
	for(const pkg of dependencies.packages)
	{
		assert.match(pkg.manifestSha256, digest); assert.match(pkg.checksum, digest);
		const root = join(dependencyRoot, pkg.directory), path = join(root, ".cargo-checksum.json");
		assert.equal(await realpath(root), root, "Rust dependency directory must not be a symlink");
		assert.equal(await hashFile(path), pkg.manifestSha256, "Rust dependency checksum manifest drift");
		const checksum = JSON.parse(await readFile(path, "utf8"));
		assert.equal(checksum.package, pkg.checksum);
		assert.ok(checksum.files && typeof checksum.files === "object" && !Array.isArray(checksum.files));
		assert.equal(Object.keys(checksum.files).length, pkg.files);
		assert.deepEqual(await nativeArtifactPaths(root), [...Object.keys(checksum.files), ".cargo-checksum.json"].sort(), "Rust dependency file set drift");
		for(const [file, hash] of Object.entries(checksum.files))
		{
			assert.ok(!isAbsolute(file) && !file.includes("\\") && file.split("/").every(part => part && part !== "." && part !== ".."));
			assert.match(hash, digest);
			assert.equal(await hashFile(join(root, file)), hash, `Rust dependency file drift: ${pkg.directory}/${file}`);
		}
		inventory[pkg.directory] = checksum;
	}
	return { archiveSha256: dependencies.sha256
		, packageLockSha256: dependencies.lockSha256
		, inventorySha256: sha256(canonicalJson(inventory))
		, packages: dependencies.packages };
};

/**
 * Compile only a new host caller and observer; use the unchanged installed crate and library bytes.
 *
 * @param options - Original archive identities and moved crate/dependencies.
 * @param options.installed - Relocated receipt-verified crate directory.
 * @param options.receiptPath - Relative receipt path.
 * @param options.receiptBytes - Authenticated original archive member bytes.
 * @param options.expectedModelSha256 - Original producer model digest.
 * @param options.probeRoot - Fresh directory outside the installation and dependency closure.
 * @param options.dependencyRoot - Relocated vendored dependencies.
 * @param options.dependencyArchive - Original verified dependency archive.
 * @param options.dependencies - Locked dependency metadata from the producer.
 * @param options.environment - Explicit absolute Cargo and rustc paths.
 */
export const observeFinContainerEdgeRust = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, dependencyRoot, dependencyArchive, dependencies, environment }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	await assertFinContainerEdgeProbeLocation(dependencyRoot, probeRoot);
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure: true };
	const before = await verifyFinContainerEdgeDeployment(options);
	const modules = ["Cargo.toml", "Cargo.lock", "src/lib.rs", "src/__runtime.rs", "src/assets.rs"];
	for(const path of modules) assert.ok(Object.hasOwn(before.receipt.files, path), `Rust input is not receipt-pinned: ${path}`);
	assert.match(before.receipt.name, /^[A-Za-z][A-Za-z0-9_-]*$/u);
	assert.match(before.receipt.version, /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.+-]+)?$/u);
	const dependencyOptions = { installed, dependencyRoot, dependencyArchive, dependencies };
	const closure = await verifyFinContainerEdgeRustDependencies(dependencyOptions);
	for(const path of [environment.LEAN_BRIDGE_CARGO, environment.LEAN_BRIDGE_RUSTC])
		assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	const cargo = await realpath(environment.LEAN_BRIDGE_CARGO), rustc = await realpath(environment.LEAN_BRIDGE_RUSTC);
	const definitions = await finContainerEdgeDefinitions(before, { publicWire: true });
	const source = await finContainerEdgeRustProbe(before.model, before.receipt.component);
	const instrument = finContainerEdgeRustInterposer(before.model, before.receipt.component, {
		libraries: Object.keys(before.libraries).map(name => join(before.directory, name))
		, definitions });
	await mkdir(probeRoot);
	const tools = join(probeRoot, "tools"), cargoHome = join(probeRoot, "cargo-home");
	await mkdir(tools); await mkdir(cargoHome); assert.deepEqual(await readdir(cargoHome), []);
	await symlink("/usr/bin/ld", join(tools, "ld"));
	await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	await saveLakeFile(probeRoot, ".cargo/config.toml", `[source.crates-io]\nreplace-with="edge-vendor"\n[source.edge-vendor]\ndirectory=${JSON.stringify(dependencyRoot)}\n`);
	await saveLakeFile(probeRoot, "Cargo.toml", `[package]\nname="fin-edge-public-rust"\nversion="0.0.0"\nedition="2021"\n[workspace]\n[dependencies]\nfincontainers={package=${JSON.stringify(before.receipt.name)},path=${JSON.stringify(installed)}}\n[profile.dev]\ndebug=0\nincremental=false\n`);
	await saveLakeFile(probeRoot, "src/main.rs", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const compile = { ...copiedCleanEnvironment
		, PATH: tools, RUSTC: rustc, CARGO_HOME: cargoHome
		, CARGO_NET_OFFLINE: "true", CARGO_TARGET_DIR: join(probeRoot, "target")
		, RUSTFLAGS: "-D warnings"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	const rustcVersion = (await runCopied(rustc, ["--version"], probeRoot, compile)).stdout.trim();
	const cargoVersion = (await runCopied(cargo, ["--version"], probeRoot, compile)).stdout.trim();
	assert.match(rustcVersion, /^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u);
	await runCopied(cargo, ["generate-lockfile", "--offline"], probeRoot, compile);
	const lockSha256 = await hashFile(join(probeRoot, "Cargo.lock"));
	const metadata = JSON.parse((await runCopied(cargo, ["metadata", "--locked", "--offline", "--format-version", "1"], probeRoot, compile)).stdout);
	const publicPackages = metadata.packages.filter(item => item.name === before.receipt.name);
	assert.equal(publicPackages.length, 1);
	assert.equal(publicPackages[0].version, before.receipt.version);
	assert.equal(await realpath(publicPackages[0].manifest_path), join(installed, "Cargo.toml"));
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort(), dependencies.packages.map(item => item.directory).sort());
	for(const item of registry) assert.equal(await realpath(item.manifest_path), join(dependencyRoot, `${item.name}-${item.version}`, "Cargo.toml"));
	assert.deepEqual(metadata.packages.filter(item => item.source === null).map(item => item.name).sort(), [before.receipt.name, "fin-edge-public-rust"].sort());
	await runCopied(cargo, ["build", "--locked", "--offline", "--target", target, "--bin", "fin-edge-public-rust"], probeRoot, compile);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "Rust compilation must not alter installed files");
	assert.equal(await hashFile(join(probeRoot, "Cargo.lock")), lockSha256);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libedge.so"], probeRoot, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const command = join(probeRoot, "target", target, "debug/fin-edge-public-rust"), executableSha256 = await hashFile(command);
	const clean = { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable", LEAN_NUM_THREADS: "1" };
	const registryFiles = async () => (await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/u.test(name)).sort();
	const previousRegistry = await registryFiles();
	await assert.rejects(() => runCopied(command, [], probeRoot, clean)
		, error => /exited with status 2:/u.test(error.message) && error.details.stdout === "" && error.details.stderr === "edge interposer is not loaded\n");
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "negative Rust run must not alter installed files");
	const runtime = { ...clean, LD_PRELOAD: join(probeRoot, "libedge.so") };
	const observed = await runCopied(command, [], probeRoot, runtime);
	assert.equal(observed.stderr, ""); const observations = readFinContainerEdgeRust(observed.stdout);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "first Rust run must not alter installed files");
	const repeated = await runCopied(command, [], probeRoot, runtime);
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout, observed.stdout);
	assert.deepEqual(await registryFiles(), previousRegistry, "Rust loader must clean its own extraction and registry files");
	assert.equal(await hashFile(command), executableSha256);
	assert.deepEqual(await verifyFinContainerEdgeDeployment(options), before, "Rust observation must not alter installed files");
	assert.deepEqual(await verifyFinContainerEdgeRustDependencies(dependencyOptions), closure, "Rust observation must not alter dependencies");
	return { kind: "fin-container-edge-public-rust-v1"
		, observed: true, profile: "rust"
		, caller: "The complete original-plus-edge public Rust consumer compiled against the relocated crate"
		, instrument: "LD_PRELOAD with extracted-library byte and owning-symbol-address checks"
		, checks: 14078, measuredCalls: observations.length, observations
		, componentId: before.model.component.id, columns: before.columns
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgeWireSymbols, packageDirectory: installed
		, libraryDirectory: before.directory, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, moduleDigests: Object.fromEntries(modules.map(path => [path, before.receipt.files[path].sha256]))
		, ...before.identity
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, stdoutSha256: sha256(observed.stdout), executableSha256
		, rustcVersion, cargoVersion
		, compilerSha256: await hashFile(rustc), cargoSha256: await hashFile(cargo)
		, dependencyRoot, dependencies: closure
		, consumerLockSha256: lockSha256
		, metadataSha256: sha256(canonicalJson(metadata))
		, linkerSha256: sha256(linker)
		, emptyCargoHome: true, offline: true, linkOnly: true
		, missingInstrumentRefused: true, installedFilesUnchanged: true
		, dependenciesUnchanged: true, runtimeDefinitionsChecked: true
		, extractionCleanupUnchanged: true, repeatedColdProcess: true };
};
