/**
 * Compile only the recursive Rust consumer, offline, from authenticated handoffs.
 * No Lean or C compiler is available in this environment.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import {
	nestedCheckedRecordRustLinker, nestedCheckedRecordRustTarget
	, verifyNestedCheckedRecordRustDependencies
} from "./nested-checked-record-rust-install.mjs";
import {
	recursiveCheckedRecordRustFeatures, recursiveCheckedRecordRustFixtures
	, recursiveCheckedRecordRustRoutes
} from "./recursive-checked-record-rust-fixture.mjs";
import { inspectRecursiveCheckedRecordRustPackage } from "./recursive-checked-record-rust-package.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

/**
 * Carry the selected load ceiling into each offline installation phase.
 *
 * @param root - Fresh retained-record directory.
 * @param maxLoad - Exclusive host-load ceiling.
 * @param options - Injectable policy dependencies for isolated controls.
 * @param options.wait - Resource waiter used by the real installer.
 * @param options.notify - Producer diagnostic sink.
 */
export const waitRecursiveCheckedRecordRustResources = (root, maxLoad, {
	wait = waitNominalSubtypeDotnetResources, notify = console.log
} = {}) => {
	assert.ok(Number.isFinite(maxLoad) && maxLoad > 0
		, "Rust installer requires a positive finite host-load ceiling");
	return wait(root, { maxLoad, notify });
};

/**
 * Select the caller graph and route without changing the dependency crate.
 *
 * @param fixture - Recursive or mutually recursive graph.
 * @param route - Ordinary source or independently reviewed Binding IR.
 */
export const recursiveCheckedRecordRustCargoArguments = (fixture, route) => {
	assert.ok(recursiveCheckedRecordRustFixtures.includes(fixture));
	assert.ok(recursiveCheckedRecordRustRoutes.includes(route));
	const features = recursiveCheckedRecordRustFeatures(route, fixture);
	return [
		"--locked", "--offline", "--target", nestedCheckedRecordRustTarget
		, ...features.length ? ["--features", features.join(",")] : []
	];
};

/**
 * Compile the installed crate and unchanged caller without author tools or networking.
 *
 * @param options - Original archive handoffs and independently authored caller.
 * @param options.root - Fresh consumer directory.
 * @param options.handoff - Original verified package-set handoff.
 * @param options.dependencyHandoff - Original dependency archive directory.
 * @param options.pkg - Verified component package entry.
 * @param options.dependencies - Producer dependency handoff record.
 * @param options.environment - Explicit toolchain paths.
 * @param options.model - Independently reproduced compiler model.
 * @param options.floor - Explicit native glibc floor.
 * @param options.caller - Unchanged public Rust caller.
 * @param options.fixture - Recursive or mutually recursive graph.
 * @param options.route - Ordinary or reviewed source route.
 * @param options.output - Fresh retained-record directory.
 * @param options.maxLoad - Exclusive host-load ceiling.
 */
export const installRecursiveCheckedRecordRust = async ({
	root, handoff, dependencyHandoff, pkg, dependencies, environment, model, floor
	, caller, fixture, route, output, maxLoad
}) => {
	assert.ok(recursiveCheckedRecordRustFixtures.includes(fixture));
	assert.ok(recursiveCheckedRecordRustRoutes.includes(route));
	const ready = () => waitRecursiveCheckedRecordRustResources(output, maxLoad);
	await ready();
	const bin = join(root, "tools"), vendor = join(root, "vendor");
	const cargoHome = join(root, "cargo-home");
	for(const directory of [bin, vendor, cargoHome]) await mkdir(directory, { recursive: true });
	assert.deepEqual(await readdir(cargoHome), []);
	const rustc = await realpath(environment.LEAN_BRIDGE_RUSTC);
	const cargo = await realpath(environment.LEAN_BRIDGE_CARGO);
	await symlink("/usr/bin/ld", join(bin, "ld"));
	await saveLakeFile(bin, "link-only", nestedCheckedRecordRustLinker);
	await chmod(join(bin, "link-only"), 0o755);
	const compile = {
		...copiedCleanEnvironment, PATH: bin, RUSTC: rustc, CARGO_HOME: cargoHome
		, CARGO_TARGET_DIR: join(root, "target"), CARGO_NET_OFFLINE: "true"
		, CARGO_BUILD_JOBS: "1", RUSTFLAGS: "-Dwarnings"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(bin, "link-only")
	};
	const tools = {};
	for(const [name, command] of [["rustc", rustc], ["cargo", cargo]])
	{
		const bytes = await readFile(command);
		const run = await runCopied(command, ["--version"], root, compile);
		assert.equal(run.stderr, "");
		assert.match(run.stdout, new RegExp(`^${name} 1\\.(?:9\\d|[1-9]\\d{2,})\\.\\d+ `, "u"));
		tools[name] = { command, bytes: bytes.length, sha256: sha256(bytes), run };
	}
	const linkerControls = [];
	for(const arg of [
		"-c", "-S", "-E", "-xc", "-fsyntax-only", "test.c", "test.C"
		, "test.cc", "test.cpp", "test.cxx", "test.s", "test.S", "@args"
	]) {
		const run = await captureCorpusCompiler(join(bin, "link-only"), [arg], root, compile);
		assert.deepEqual(run, { code: 65, stdout: "", stderr: "" });
		linkerControls.push(arg);
	}
	const archive = join(handoff, pkg.artifacts[0].path);
	const dependencyArchive = join(dependencyHandoff, dependencies.archive);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	assert.equal(sha256(await readFile(dependencyArchive)), dependencies.sha256);
	for(const path of [archive, dependencyArchive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip"
			, "-xf", path, "-C", vendor], root);
	const installed = join(vendor, `${pkg.name}-${pkg.version}`);
	const dependencyRoot = join(vendor, "dependencies");
	const crate = await inspectRecursiveCheckedRecordRustPackage({
		installed, archive, pkg, model, floor, fixture, output
	});
	const dependencyClosure = await verifyNestedCheckedRecordRustDependencies(
		dependencyRoot, dependencies);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	const config = '[source.crates-io]\nreplace-with = "recursive-vendor"\n[source.recursive-vendor]\ndirectory = "vendor/dependencies"\n';
	const manifest = `[package]\nname = "recursive-consumer"\nversion = "0.0.0"\nedition = "2021"\n[features]\nmutual = []\nreviewed = []\n[dependencies]\ncheckedrecords = { package = "${pkg.name}", path = "vendor/${pkg.name}-${pkg.version}" }\n[profile.dev]\ndebug = 0\nincremental = false\n`;
	await saveLakeFile(root, ".cargo/config.toml", config);
	await saveLakeFile(root, "Cargo.toml", manifest);
	await saveLakeFile(root, "src/main.rs", caller);
	const args = recursiveCheckedRecordRustCargoArguments(fixture, route);
	const features = recursiveCheckedRecordRustFeatures(route, fixture);
	const metadataArguments = [
		"metadata", "--locked", "--offline", "--format-version", "1"
		, ...features.length ? ["--features", features.join(",")] : []
	];
	await ready();
	const locked = await runCopied(cargo, ["generate-lockfile", "--offline"], root, compile);
	const metadataRun = await runCopied(cargo, metadataArguments, root, compile);
	const metadata = JSON.parse(metadataRun.stdout);
	const publicPackage = metadata.packages.find(item => item.name === pkg.name);
	assert.equal(await realpath(publicPackage.manifest_path), join(installed, "Cargo.toml"));
	assert.equal(publicPackage.version, pkg.version);
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort()
		, dependencies.packages.map(item => item.directory).sort());
	for(const item of registry)
		assert.equal(await realpath(item.manifest_path)
			, join(dependencyRoot, `${item.name}-${item.version}`, "Cargo.toml"));
	await ready();
	const build = await runCopied(cargo, ["build", ...args, "--bin", "recursive-consumer"]
		, root, compile);
	assert.deepEqual(await verifyFinContainerEdgeArchiveClosure({
		profile: "rust", installed, archive, archiveSha256: pkg.artifacts[0].sha256
		, receiptPath: "lean-bridge/package-receipt.json"
	}), crate.closure);
	assert.deepEqual(await verifyNestedCheckedRecordRustDependencies(dependencyRoot, dependencies)
		, dependencyClosure);
	for(const tool of Object.values(tools))
		assert.equal(sha256(await readFile(tool.command)), tool.sha256);
	for(const [path, value] of Object.entries({
		"toolchain.json": tools, "consumer-environment.json": compile
		, "consumer-metadata.json": metadataRun, "consumer-build.json": build
	})) await saveLakeFile(output, path, canonicalJson(value));
	for(const [path, source] of [
		["consumer.Cargo.toml", manifest], ["consumer.config.toml", config]
		, ["link-only", nestedCheckedRecordRustLinker]
		, ["consumer.Cargo.lock", await readFile(join(root, "Cargo.lock"))]
	]) await saveLakeFile(output, path, source);
	const executable = `target/${nestedCheckedRecordRustTarget}/debug/recursive-consumer`;
	const record = {
		tools, locked, build, arguments: args, metadataArguments
		, linkerControls, dependencyClosure, executable
		, executableSha256: sha256(await readFile(join(root, executable)))
		, crateReceiptSha256: crate.receiptSha256, crateClosure: crate.closure
		, emptyCargoHome: true, offline: true, linkOnly: true
	};
	await saveLakeFile(output, "installation.json", canonicalJson(record));
	return record;
};
