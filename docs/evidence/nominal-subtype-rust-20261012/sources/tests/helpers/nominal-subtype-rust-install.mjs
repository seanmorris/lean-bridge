/**
 * Compile only the Rust consumer, offline, against an authenticated crate handoff.
 * No Lean or C compilation is available in this environment.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { inspectNominalSubtypeRustPackage } from "./nominal-subtype-rust-package.mjs";
import { nominalSubtypeRustModes } from "./nominal-subtype-rust-fixture.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const nominalSubtypeRustTarget = "x86_64-unknown-linux-gnu";
export const nominalSubtypeRustLinker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
export const nominalSubtypeRustInputNames = Object.freeze([
	"first", "second", "combine", "nested", "echo", "event_first", "event_second"
	, "aliases"
	, "inspect_alias_pair"
	, "echo_groups"
	, "echo_pair"
	, "echo_event"
	, "plain_fin"
	, "Pair"
]);
export const nominalSubtypeRustApiProbe = `#[allow(unused_imports)]
use nominalsubtypes::{${nominalSubtypeRustInputNames.join(", ")}};
fn main() {}
`;

/**
 * Distinguish a missing public API from an unrelated compiler or dependency failure.
 *
 * @param run - Complete Cargo JSON diagnostics and exit status.
 * @param mode - Full or result-only API selection.
 */
export const checkNominalSubtypeRustApiProbe = (run, mode) => {
	assert.ok(nominalSubtypeRustModes.includes(mode));
	const messages = run.stdout.trim().split("\n").map(line => JSON.parse(line));
	assert.deepEqual(messages.filter(message => message.reason === "build-finished"), [{ reason: "build-finished", success: mode === "full" }]);
	const errors = messages.filter(message => message.reason === "compiler-message" && message.message.level === "error").map(({ message }) => message);
	if(mode === "full")
	{ assert.equal(run.code, 0); assert.deepEqual(errors, []); return { absent: [], present: [...nominalSubtypeRustInputNames] }; }
	assert.equal(run.code, 101); assert.equal(errors.length, 1);
	const error = errors[0]; assert.equal(error.code?.code, "E0432");
	const primary = error.spans.filter(span => span.is_primary); assert.ok(primary.length > 0);
	assert.ok(primary.every(span => span.file_name === "src/bin/api-probe.rs"));
	assert.deepEqual([...error.message.matchAll(/`nominalsubtypes::([A-Za-z_0-9]+)`/gu)].map(match => match[1]).sort(), [...nominalSubtypeRustInputNames].sort());
	return { absent: [...nominalSubtypeRustInputNames], present: [] };
};

/**
 * Require the exact vendored dependency inventory, including Cargo checksums.
 *
 * @param root - Extracted dependency directory.
 * @param dependencies - Original producer dependency handoff record.
 */
export const verifyNominalSubtypeRustDependencies = async (root, dependencies) => {
	assert.deepEqual((await readdir(root)).sort(), dependencies.packages.map(pkg => pkg.directory).sort());
	const records = [];
	for(const pkg of dependencies.packages)
	{
		assert.match(pkg.directory, /^[a-zA-Z0-9_-]+-[0-9][a-zA-Z0-9._+-]*$/u);
		const directory = join(root, pkg.directory), bytes = await readFile(join(directory, ".cargo-checksum.json"));
		assert.equal(sha256(bytes), pkg.manifestSha256);
		const checksum = JSON.parse(bytes);
		assert.equal(checksum.package, pkg.checksum); assert.equal(Object.keys(checksum.files).length, pkg.files);
		const paths = await nativeArtifactPaths(directory);
		assert.deepEqual(paths, [...Object.keys(checksum.files), ".cargo-checksum.json"].sort());
		for(const [path, hash] of Object.entries(checksum.files)) assert.equal(sha256(await readFile(join(directory, path))), hash, path);
		records.push({ directory: pkg.directory, manifestSha256: sha256(bytes), fileSetSha256: sha256(canonicalJson(paths)) });
	}
	return records;
};

/**
 * Compile the installed crate without network access or author tools.
 *
 * @param options - Original archive handoffs and independently authored caller.
 * @param options.root - Fresh consumer directory.
 * @param options.handoff - Original verified package-set handoff.
 * @param options.dependencyHandoff - Original locked dependency archive directory.
 * @param options.pkg - Verified component package entry.
 * @param options.dependencies - Producer dependency handoff record.
 * @param options.environment - Explicit toolchain paths.
 * @param options.model - Independent reproduced compiler model.
 * @param options.floor - Explicit native glibc floor.
 * @param options.caller - Unchanged public Rust caller.
 * @param options.mode - Full or result-only package selection.
 * @param options.output - Fresh retained-record directory.
 */
export const installNominalSubtypeRust = async ({ root, handoff, dependencyHandoff, pkg, dependencies, environment, model, floor, caller, mode, output }) => {
	assert.ok(nominalSubtypeRustModes.includes(mode));
	const bin = join(root, "tools"), vendor = join(root, "vendor"), cargoHome = join(root, "cargo-home");
	for(const directory of [bin, vendor, cargoHome]) await mkdir(directory, { recursive: true });
	assert.deepEqual(await readdir(cargoHome), []);
	const rustc = await realpath(environment.LEAN_BRIDGE_RUSTC), cargo = await realpath(environment.LEAN_BRIDGE_CARGO);
	await symlink("/usr/bin/ld", join(bin, "ld"));
	await saveLakeFile(bin, "link-only", nominalSubtypeRustLinker); await chmod(join(bin, "link-only"), 0o755);
	const compile = { ...copiedCleanEnvironment, PATH: bin
		, RUSTC: rustc
		, CARGO_HOME: cargoHome
		, CARGO_TARGET_DIR: join(root, "target")
		, CARGO_NET_OFFLINE: "true"
		, CARGO_BUILD_JOBS: "1"
		, RUSTFLAGS: "-Dwarnings"
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
	const archive = join(handoff, pkg.artifacts[0].path), dependencyArchive = join(dependencyHandoff, dependencies.archive);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	assert.equal(sha256(await readFile(dependencyArchive)), dependencies.sha256);
	for(const path of [archive, dependencyArchive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", path, "-C", vendor], root);
	const installed = join(vendor, `${pkg.name}-${pkg.version}`), dependencyRoot = join(vendor, "dependencies");
	const crate = await inspectNominalSubtypeRustPackage({ installed, archive, pkg, model, floor, output });
	const dependencyClosure = await verifyNominalSubtypeRustDependencies(dependencyRoot, dependencies);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	const config = '[source.crates-io]\nreplace-with = "nominal-vendor"\n[source.nominal-vendor]\ndirectory = "vendor/dependencies"\n';
	const manifest = `[package]\nname = "nominal-consumer"\nversion = "0.0.0"\nedition = "2021"\n[features]\nresult-only = []\n[dependencies]\n${pkg.name} = { path = "vendor/${pkg.name}-${pkg.version}" }\n[profile.dev]\ndebug = 0\nincremental = false\n`;
	await saveLakeFile(root, ".cargo/config.toml", config); await saveLakeFile(root, "Cargo.toml", manifest);
	await saveLakeFile(root, "src/main.rs", caller); await saveLakeFile(root, "src/bin/api-probe.rs", nominalSubtypeRustApiProbe);
	const locked = await runCopied(cargo, ["generate-lockfile", "--offline"], root, compile);
	const metadataRun = await runCopied(cargo, ["metadata", "--locked", "--offline", "--format-version", "1"], root, compile);
	const metadata = JSON.parse(metadataRun.stdout), publicPackage = metadata.packages.find(item => item.name === pkg.name);
	assert.equal(await realpath(publicPackage.manifest_path), join(installed, "Cargo.toml"));
	assert.equal(publicPackage.version, pkg.version);
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort(), dependencies.packages.map(item => item.directory).sort());
	for(const item of registry) assert.equal(await realpath(item.manifest_path), join(dependencyRoot, `${item.name}-${item.version}`, "Cargo.toml"));
	const args = ["--locked", "--offline", "--target", nominalSubtypeRustTarget, ...mode === "result-only" ? ["--features", "result-only"] : []];
	const build = await runCopied(cargo, ["build", ...args, "--bin", "nominal-consumer"], root, compile);
	const apiProbe = await captureCorpusCompiler(cargo, ["check", ...args, "--bin", "api-probe", "--message-format=json"], root, compile);
	const api = checkNominalSubtypeRustApiProbe(apiProbe, mode);
	assert.deepEqual(await verifyFinContainerEdgeArchiveClosure({ profile: "rust"
		, installed
		, archive
		, archiveSha256: pkg.artifacts[0].sha256
		, receiptPath: "lean-bridge/package-receipt.json" }), crate.closure);
	assert.deepEqual(await verifyNominalSubtypeRustDependencies(dependencyRoot, dependencies), dependencyClosure);
	for(const tool of Object.values(tools)) assert.equal(sha256(await readFile(tool.command)), tool.sha256);
	for(const [path, value] of Object.entries({ "toolchain.json": tools
		, "consumer-environment.json": compile
		, "consumer-metadata.json": metadataRun
		, "api-probe.json": apiProbe
		, "consumer-build.json": build }))
		await saveLakeFile(output, path, canonicalJson(value));
	for(const [path, source] of [["consumer.Cargo.toml", manifest]
		, ["consumer.config.toml", config]
		, ["api-probe.rs", nominalSubtypeRustApiProbe]
		, ["link-only", nominalSubtypeRustLinker]
		, ["consumer.Cargo.lock", await readFile(join(root, "Cargo.lock"))]]) await saveLakeFile(output, path, source);
	const executable = `target/${nominalSubtypeRustTarget}/debug/nominal-consumer`;
	const record = { tools
		, locked
		, build
		, api
		, apiProbe
		, linkerControls
		, dependencyClosure
		, executable, executableSha256: sha256(await readFile(join(root, executable)))
		, crateReceiptSha256: crate.receiptSha256
		, crateClosure: crate.closure
		, emptyCargoHome: true
		, offline: true
		, linkOnly: true };
	await saveLakeFile(output, "installation.json", canonicalJson(record));
	return record;
};
