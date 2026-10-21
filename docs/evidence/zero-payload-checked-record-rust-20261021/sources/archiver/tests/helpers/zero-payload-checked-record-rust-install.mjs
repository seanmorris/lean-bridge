/**
 * Compile only an independent Rust consumer, offline, against an authenticated
 * zero-payload crate and its complete vendored dependency closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { zeroPayloadBrowserInputNames } from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadRustFeatures, zeroPayloadRustRoutes
} from "./zero-payload-checked-record-rust-fixture.mjs";
import { inspectZeroPayloadRustPackage } from "./zero-payload-checked-record-rust-package.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

export const zeroPayloadRustTarget = "x86_64-unknown-linux-gnu";
export const zeroPayloadRustLinker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
export const zeroPayloadRustPublicInputs = Object.freeze(
	zeroPayloadBrowserInputNames.map(name => name.replace(/([A-Z])/gu, "_$1").toLowerCase())
);
export const zeroPayloadRustApiProbe = `#[allow(unused_imports)]
use zeropayloadcheckedrecords::{${zeroPayloadRustPublicInputs.join(", ")}};
fn main() {}
`;

/**
 * Carry the producer's load ceiling into every offline install phase.
 *
 * @param root - Fresh retained-record directory.
 * @param maxLoad - Exclusive host-load ceiling.
 * @param options - Injectable resource policy.
 * @param options.wait - Resource waiter used by the installer.
 * @param options.notify - Producer diagnostic sink.
 */
export const waitZeroPayloadRustResources = (root, maxLoad, {
	wait = waitNominalSubtypeDotnetResources, notify = console.log
} = {}) => {
	assert.ok(Number.isFinite(maxLoad) && maxLoad > 0, "Rust installer requires a positive finite host-load ceiling");
	return wait(root, { maxLoad, notify });
};

/**
 * Select caller features while keeping Cargo locked and offline.
 *
 * @param route - One exact closed author route.
 */
export const zeroPayloadRustCargoArguments = route => {
	assert.ok(zeroPayloadRustRoutes.includes(route));
	const features = zeroPayloadRustFeatures(route);
	return ["--locked", "--offline", "--target", zeroPayloadRustTarget
		, ...features.length ? ["--features", features.join(",")] : []];
};

/**
 * Distinguish an intentionally absent input API from dependency failures.
 *
 * @param run - Complete Cargo JSON diagnostics and exit status.
 * @param resultOnly - Whether constructor inputs must be absent.
 */
export const checkZeroPayloadRustApiProbe = (run, resultOnly) => {
	assert.equal(typeof resultOnly, "boolean");
	const messages = run.stdout.trim().split("\n").map(line => JSON.parse(line));
	assert.deepEqual(messages.filter(message => message.reason === "build-finished")
		, [{ reason: "build-finished", success: !resultOnly }]);
	const errors = messages.filter(message => message.reason === "compiler-message"
		&& message.message.level === "error").map(({ message }) => message);
	if(!resultOnly)
	{
		assert.equal(run.code, 0); assert.deepEqual(errors, []);
		return { absent: [], present: [...zeroPayloadRustPublicInputs] };
	}
	assert.equal(run.code, 101); assert.equal(errors.length, 1);
	const error = errors[0]; assert.equal(error.code?.code, "E0432");
	const primary = error.spans.filter(span => span.is_primary); assert.ok(primary.length > 0);
	assert.ok(primary.every(span => span.file_name === "src/bin/api-probe.rs"));
	assert.deepEqual([...error.message.matchAll(/`zeropayloadcheckedrecords::([A-Za-z_0-9]+)`/gu)]
		.map(match => match[1]).sort(), [...zeroPayloadRustPublicInputs].sort());
	return { absent: [...zeroPayloadRustPublicInputs], present: [] };
};

/**
 * Authenticate every vendored source and checksum manifest.
 *
 * @param root - Extracted dependency directory.
 * @param dependencies - Original dependency handoff record.
 */
export const verifyZeroPayloadRustDependencies = async (root, dependencies) => {
	assert.deepEqual((await readdir(root)).sort(), dependencies.packages.map(pkg => pkg.directory).sort());
	const records = [];
	for(const pkg of dependencies.packages)
	{
		assert.match(pkg.directory, /^[a-zA-Z0-9_-]+-[0-9][a-zA-Z0-9._+-]*$/u);
		const directory = join(root, pkg.directory);
		const bytes = await readFile(join(directory, ".cargo-checksum.json"));
		assert.equal(sha256(bytes), pkg.manifestSha256);
		const checksum = JSON.parse(bytes);
		assert.equal(checksum.package, pkg.checksum);
		assert.equal(Object.keys(checksum.files).length, pkg.files);
		const paths = await nativeArtifactPaths(directory);
		assert.deepEqual(paths, [...Object.keys(checksum.files), ".cargo-checksum.json"].sort());
		for(const [path, hash] of Object.entries(checksum.files))
			assert.equal(sha256(await readFile(join(directory, path))), hash, path);
		records.push({ directory: pkg.directory, manifestSha256: sha256(bytes)
			, fileSetSha256: sha256(canonicalJson(paths)) });
	}
	return records;
};

/**
 * Install, compile, and retain one route without author sources or network.
 *
 * @param options - Original package handoff and independent caller.
 * @param options.root - Fresh consumer directory.
 * @param options.handoff - Verified package-set handoff.
 * @param options.dependencyHandoff - Locked dependency archive directory.
 * @param options.pkg - Verified component package entry.
 * @param options.dependencies - Producer dependency handoff record.
 * @param options.environment - Explicit toolchain paths.
 * @param options.model - Reproduced compiler model.
 * @param options.floor - Explicit native glibc floor.
 * @param options.caller - Unchanged public Rust caller.
 * @param options.route - Exact independent author route.
 * @param options.resultOnly - Whether the package has no input APIs.
 * @param options.output - Fresh retained-record directory.
 * @param options.maxLoad - Exclusive host-load ceiling.
 */
export const installZeroPayloadRust = async ({
	root, handoff, dependencyHandoff, pkg, dependencies, environment, model, floor
	, caller, route, resultOnly, output, maxLoad
}) => {
	assert.ok(zeroPayloadRustRoutes.includes(route)); assert.equal(typeof resultOnly, "boolean");
	const ready = () => waitZeroPayloadRustResources(output, maxLoad);
	await ready();
	const bin = join(root, "tools"), vendor = join(root, "vendor"), cargoHome = join(root, "cargo-home");
	for(const directory of [bin, vendor, cargoHome]) await mkdir(directory, { recursive: true });
	assert.deepEqual(await readdir(cargoHome), []);
	const rustc = await realpath(environment.LEAN_BRIDGE_RUSTC);
	const cargo = await realpath(environment.LEAN_BRIDGE_CARGO);
	await symlink("/usr/bin/ld", join(bin, "ld"));
	await saveLakeFile(bin, "link-only", zeroPayloadRustLinker);
	await chmod(join(bin, "link-only"), 0o755);
	const compile = { ...copiedCleanEnvironment
		, PATH: bin
		, RUSTC: rustc
		, CARGO_HOME: cargoHome
		, CARGO_TARGET_DIR: join(root, "target"), CARGO_NET_OFFLINE: "true"
		, CARGO_BUILD_JOBS: "1", RUSTFLAGS: "-Dwarnings"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(bin, "link-only") };
	const tools = {};
	for(const [name, command] of [["rustc", rustc], ["cargo", cargo]])
	{
		const bytes = await readFile(command), run = await runCopied(command, ["--version"], root, compile);
		assert.equal(run.stderr, "");
		assert.match(run.stdout, new RegExp(`^${name} 1\\.(?:9\\d|[1-9]\\d{2,})\\.\\d+ `, "u"));
		tools[name] = { command, bytes: bytes.length, sha256: sha256(bytes), run };
	}
	const linkerControls = [];
	for(const arg of ["-c", "-S", "-E", "-xc", "-fsyntax-only", "test.c", "test.C", "test.cc", "test.cpp", "test.cxx", "test.s", "test.S", "@args"])
	{
		const run = await captureCorpusCompiler(join(bin, "link-only"), [arg], root, compile);
		assert.deepEqual(run, { code: 65, stdout: "", stderr: "" }); linkerControls.push(arg);
	}
	const archive = join(handoff, pkg.artifacts[0].path);
	const dependencyArchive = join(dependencyHandoff, dependencies.archive);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	assert.equal(sha256(await readFile(dependencyArchive)), dependencies.sha256);
	for(const path of [archive, dependencyArchive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", path, "-C", vendor], root);
	const installed = join(vendor, `${pkg.name}-${pkg.version}`);
	const dependencyRoot = join(vendor, "dependencies");
	const crate = await inspectZeroPayloadRustPackage({ installed, archive, pkg, model, floor, output });
	const dependencyClosure = await verifyZeroPayloadRustDependencies(dependencyRoot, dependencies);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	const config = '[source.crates-io]\nreplace-with = "zero-payload-vendor"\n[source.zero-payload-vendor]\ndirectory = "vendor/dependencies"\n';
	const manifest = `[package]\nname = "zero-payload-consumer"\nversion = "0.0.0"\nedition = "2021"\n[features]\nresult-only = []\nreviewed = []\n[dependencies]\n${pkg.name} = { path = "vendor/${pkg.name}-${pkg.version}" }\n[profile.dev]\ndebug = 0\nincremental = false\n`;
	await saveLakeFile(root, ".cargo/config.toml", config);
	await saveLakeFile(root, "Cargo.toml", manifest);
	await saveLakeFile(root, "src/main.rs", caller);
	await saveLakeFile(root, "src/bin/api-probe.rs", zeroPayloadRustApiProbe);
	await ready();
	const locked = await runCopied(cargo, ["generate-lockfile", "--offline"], root, compile);
	const metadataRun = await runCopied(cargo, ["metadata", "--locked", "--offline", "--format-version", "1"], root, compile);
	const metadata = JSON.parse(metadataRun.stdout);
	const publicPackage = metadata.packages.find(item => item.name === pkg.name);
	assert.equal(await realpath(publicPackage.manifest_path), join(installed, "Cargo.toml"));
	assert.equal(publicPackage.version, pkg.version);
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort()
		, dependencies.packages.map(item => item.directory).sort());
	for(const item of registry)
		assert.equal(await realpath(item.manifest_path), join(dependencyRoot, `${item.name}-${item.version}`, "Cargo.toml"));
	const args = zeroPayloadRustCargoArguments(route);
	await ready();
	const build = await runCopied(cargo, ["build", ...args, "--bin", "zero-payload-consumer"], root, compile);
	await ready();
	const apiProbe = await captureCorpusCompiler(cargo
		, ["check", ...args, "--bin", "api-probe", "--message-format=json"], root, compile);
	const api = checkZeroPayloadRustApiProbe(apiProbe, resultOnly);
	assert.deepEqual(await verifyFinContainerEdgeArchiveClosure({ profile: "rust"
		, installed
		, archive
		, archiveSha256: pkg.artifacts[0].sha256
		, receiptPath: "lean-bridge/package-receipt.json" }), crate.closure);
	assert.deepEqual(await verifyZeroPayloadRustDependencies(dependencyRoot, dependencies), dependencyClosure);
	for(const tool of Object.values(tools)) assert.equal(sha256(await readFile(tool.command)), tool.sha256);
	for(const [path, value] of Object.entries({ "toolchain.json": tools
		, "consumer-environment.json": compile, "consumer-metadata.json": metadataRun
		, "api-probe.json": apiProbe, "consumer-build.json": build }))
		await saveLakeFile(output, path, canonicalJson(value));
	for(const [path, source] of [["consumer.Cargo.toml", manifest]
		, ["consumer.config.toml", config]
		, ["api-probe.rs", zeroPayloadRustApiProbe]
		, ["link-only", zeroPayloadRustLinker]
		, ["consumer.Cargo.lock", await readFile(join(root, "Cargo.lock"))]])
		await saveLakeFile(output, path, source);
	const executable = `target/${zeroPayloadRustTarget}/debug/zero-payload-consumer`;
	const record = { tools
		, locked
		, build
		, api
		, apiProbe
		, linkerControls
		, dependencyClosure
		, executable, executableSha256: sha256(await readFile(join(root, executable)))
		, crateReceiptSha256: crate.receiptSha256, crateClosure: crate.closure
		, emptyCargoHome: true, offline: true, linkOnly: true };
	await saveLakeFile(output, "installation.json", canonicalJson(record));
	return record;
};
