/**
 * Authenticate offline Cargo installation and compiler-free execution provenance.
 * Recorded absolute paths describe the original run and are never reopened.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { checkNestedCheckedRecordRustDependencyRecords, nestedCheckedRecordRustConsumerLock, nestedCheckedRecordRustDependencyManifests } from "./nested-checked-record-rust-dependency-records.mjs";
import { checkNestedCheckedRecordRustMetadata, checkNestedCheckedRecordRustCompilerRecords } from "./nested-checked-record-rust-metadata-records.mjs";

const absolute = path => assert.ok(typeof path === "string" && path.startsWith("/") && posix.normalize(path) === path && !/[\0\r\n]/u.test(path));
const runKeys = run => assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
const inputNames = ["echo_a", "echo_b", "refuse_unit", "combine"
	, "echo_pair", "echo_event_a", "echo_event_b", "aliases"];

/**
 * Bind tools, Cargo inputs and the complete dependency closure to original records.
 *
 * @param options - Verified package and independently selected run scope.
 * @param options.read - Retained original relative byte reader.
 * @param options.json - Canonical original JSON reader.
 * @param options.crate - Verified crate inventory and archive identity.
 * @param options.mode - Independently selected API mode.
 * @param options.toolchain - Independently pinned tool identities for this evidence run.
 */
export const checkNestedCheckedRecordRustEnvironment = async ({ read, json, crate, mode, toolchain }) => {
	const installation = await json("installation.json"), dependencies = await json("dependencies.json");
	assert.deepEqual(Object.keys(installation).sort(), ["api", "apiProbe", "build", "crateClosure", "crateReceiptSha256", "dependencyClosure", "emptyCargoHome", "executable", "executableSha256", "linkOnly", "linkerControls", "locked", "offline", "tools"]);
	const tools = await json("toolchain.json"); assert.deepEqual(tools, toolchain); assert.deepEqual(installation.tools, tools);
	assert.deepEqual(Object.keys(tools).sort(), ["cargo", "rustc"]);
	for(const [name, tool] of Object.entries(tools))
	{
		assert.deepEqual(Object.keys(tool).sort(), ["bytes", "command", "run", "sha256"]); absolute(tool.command);
		assert.equal(posix.basename(tool.command), name); assert.ok(Number.isSafeInteger(tool.bytes) && tool.bytes > 0);
		assert.match(tool.sha256, /^[a-f0-9]{64}$/u); runKeys(tool.run);
		assert.equal(tool.run.code, 0); assert.equal(tool.run.stderr, "");
		assert.match(tool.run.stdout, new RegExp(`^${name} 1\\.(?:9\\d|[1-9]\\d{2,})\\.\\d+ \\([a-f0-9]+ [0-9]{4}-[0-9]{2}-[0-9]{2}\\)\\n$`, "u"));
	}
	assert.equal((await json("package/lean-bridge/native-rust.json")).rustc, tools.rustc.run.stdout.trim());
	const environment = await json("consumer-environment.json"), root = posix.dirname(environment.CARGO_HOME);
	absolute(root); assert.equal(posix.basename(root), "consumer");
	assert.match(posix.basename(posix.dirname(root)), /^lean-bridge-nested-checked-record-rust-[A-Za-z0-9]+$/u);
	assert.deepEqual(environment, {
		PATH: root + "/tools", CC: "/unavailable/compiler"
		, CXX: "/unavailable/compiler"
		, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
		, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime"
		, RUSTC: tools.rustc.command
		, CARGO_HOME: root + "/cargo-home"
		, CARGO_TARGET_DIR: root + "/target", CARGO_NET_OFFLINE: "true"
		, CARGO_BUILD_JOBS: "1", RUSTFLAGS: "-Dwarnings"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: root + "/tools/link-only" });
	for(const key of ["emptyCargoHome", "offline", "linkOnly"]) assert.equal(installation[key], true);
	assert.equal((await read("consumer.Cargo.toml")).toString(), '[package]\nname = "nested-consumer"\nversion = "0.0.0"\nedition = "2021"\n[features]\nresult-only = []\nreviewed = []\n[dependencies]\nnestedcheckedrecords = { path = "vendor/nestedcheckedrecords-1.0.0" }\n[profile.dev]\ndebug = 0\nincremental = false\n');
	assert.equal((await read("consumer.config.toml")).toString(), '[source.crates-io]\nreplace-with = "nested-vendor"\n[source.nested-vendor]\ndirectory = "vendor/dependencies"\n');
	assert.equal((await read("link-only")).toString(), '#!/bin/sh\nfor arg do\n  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac\ndone\nexec /usr/bin/cc "$@"\n');
	assert.equal((await read("api-probe.rs")).toString(), `#[allow(unused_imports)]\nuse nestedcheckedrecords::{${inputNames.join(", ")}};\nfn main() {}\n`);
	assert.deepEqual(installation.linkerControls, ["-c", "-S", "-E", "-xc", "-fsyntax-only", "test.c", "test.C", "test.cc", "test.cpp", "test.cxx", "test.s", "test.S", "@args"]);
	const lock = (await read("package/Cargo.lock")).toString();
	assert.equal((await read("consumer.Cargo.lock")).toString(), nestedCheckedRecordRustConsumerLock(lock));
	const dependencyArchive = await read("dependency-handoff/" + dependencies.archive);
	const manifests = nestedCheckedRecordRustDependencyManifests(dependencyArchive, dependencies);
	for(const [path, bytes] of manifests) assert.deepEqual(await read(path), bytes, path);
	const dependencyClosure = await checkNestedCheckedRecordRustDependencyRecords({ dependencies, lock, read });
	assert.deepEqual(installation.dependencyClosure, dependencyClosure);
	assert.deepEqual(installation.locked, { code: 0, stdout: "", stderr: "     Locking 15 packages to latest compatible versions\n" });
	const metadata = await checkNestedCheckedRecordRustMetadata({ run: await json("consumer-metadata.json"), root, lock, read });
	const build = await json("consumer-build.json"); runKeys(build); assert.deepEqual(installation.build, build);
	assert.equal(build.code, 0); assert.equal(build.stdout, "");
	const lines = build.stderr.trimEnd().split("\n"), compiled = [];
	assert.match(lines.pop(), /^ +Finished `dev` profile \[unoptimized\] target\(s\) in [0-9.]+s$/u);
	for(const line of lines)
	{
		const match = line.match(/^ +Compiling ([a-z0-9_-]+) v([0-9.]+)(?: \(([^)]+)\))?$/u); assert.ok(match);
		const pkg = metadata.packages.find(pkg => pkg.name === match[1]); assert.ok(pkg); assert.equal(match[2], pkg.version);
		assert.equal(match[3], pkg.source === null ? posix.dirname(pkg.manifest_path) : undefined); compiled.push(pkg.name);
	}
	// libc belongs to the lock for other targets, but is not compiled on x86_64 Linux.
	assert.deepEqual(compiled.sort(), metadata.packages.filter(pkg => pkg.name !== "libc").map(pkg => pkg.name).sort());
	const apiProbe = await json("api-probe.json"); assert.deepEqual(installation.apiProbe, apiProbe);
	assert.deepEqual(installation.api, checkNestedCheckedRecordRustCompilerRecords({ run: apiProbe, metadata, mode }));
	assert.equal(installation.executable, "target/x86_64-unknown-linux-gnu/debug/nested-consumer");
	assert.match(installation.executableSha256, /^[a-f0-9]{64}$/u);
	assert.equal(installation.crateReceiptSha256, crate.receiptSha256); assert.deepEqual(installation.crateClosure, crate.closure);
	return { root, installation, dependencies, closure: { crate: crate.closure, dependencies: dependencyClosure } };
};
