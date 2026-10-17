/**
 * Authenticate offline recursive Cargo installation and compiler-free execution provenance.
 * Recorded absolute paths describe the original run and are never reopened.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import {
	checkRecursiveCheckedRecordRustDependencyRecords
	, recursiveCheckedRecordRustConsumerLock
	, recursiveCheckedRecordRustDependencyManifests
} from "./recursive-checked-record-rust-dependency-records.mjs";
import {
	recursiveCheckedRecordRustCargoArguments
} from "./recursive-checked-record-rust-install.mjs";
import {
	recursiveCheckedRecordRustFeatures, recursiveCheckedRecordRustPackage
} from "./recursive-checked-record-rust-fixture.mjs";
import {
	checkRecursiveCheckedRecordRustMetadata
} from "./recursive-checked-record-rust-metadata-records.mjs";

const absolute = path => assert.ok(typeof path === "string" && path.startsWith("/")
	&& posix.normalize(path) === path && !/[\0\r\n]/u.test(path));
const runKeys = run => assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);

/**
 * Bind tools, Cargo inputs and the dependency closure to original records.
 *
 * @param options - Verified package and independently selected run scope.
 * @param options.read - Retained original relative byte reader.
 * @param options.json - Canonical original JSON reader.
 * @param options.crate - Verified crate inventory and archive identity.
 * @param options.fixture - Recursive or mutually recursive graph.
 * @param options.route - Ordinary source or reviewed Binding IR.
 * @param options.toolchain - Independently pinned original Rust and Cargo identities.
 */
export const checkRecursiveCheckedRecordRustEnvironment = async ({
	read, json, crate, fixture, route, toolchain
}) => {
	const installation = await json("installation.json");
	const dependencies = await json("dependencies.json");
	assert.deepEqual(Object.keys(installation).sort(), [
		"arguments", "build", "crateClosure", "crateReceiptSha256"
		, "dependencyClosure", "emptyCargoHome", "executable", "executableSha256"
		, "linkOnly", "linkerControls", "locked", "metadataArguments"
		, "offline", "tools"
	]);
	const tools = await json("toolchain.json");
	assert.deepEqual(tools, toolchain);
	assert.deepEqual(installation.tools, tools);
	assert.deepEqual(Object.keys(tools).sort(), ["cargo", "rustc"]);
	for(const [name, tool] of Object.entries(tools))
	{
		assert.deepEqual(Object.keys(tool).sort(), ["bytes", "command", "run", "sha256"]);
		absolute(tool.command);
		assert.equal(posix.basename(tool.command), name);
		assert.ok(Number.isSafeInteger(tool.bytes) && tool.bytes > 0);
		assert.match(tool.sha256, /^[a-f0-9]{64}$/u);
		runKeys(tool.run);
		assert.equal(tool.run.code, 0);
		assert.equal(tool.run.stderr, "");
		assert.match(tool.run.stdout
			, new RegExp(`^${name} 1\\.(?:9\\d|[1-9]\\d{2,})\\.\\d+ \\([a-f0-9]+ [0-9]{4}-[0-9]{2}-[0-9]{2}\\)\\n$`, "u"));
	}
	assert.equal((await json("package/lean-bridge/native-rust.json")).rustc
		, tools.rustc.run.stdout.trim());
	const environment = await json("consumer-environment.json");
	const root = posix.dirname(environment.CARGO_HOME);
	absolute(root);
	assert.equal(posix.basename(root), "consumer");
	assert.match(posix.basename(posix.dirname(root))
		, /^lean-bridge-recursive-checked-record-rust-[A-Za-z0-9]+$/u);
	assert.deepEqual(environment, {
		PATH: root + "/tools"
		, CC: "/unavailable/compiler"
		, CXX: "/unavailable/compiler"
		, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
		, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime"
		, RUSTC: tools.rustc.command, CARGO_HOME: root + "/cargo-home"
		, CARGO_TARGET_DIR: root + "/target", CARGO_NET_OFFLINE: "true"
		, CARGO_BUILD_JOBS: "1", RUSTFLAGS: "-Dwarnings"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: root + "/tools/link-only"
	});
	for(const key of ["emptyCargoHome", "offline", "linkOnly"])
		assert.equal(installation[key], true, key);
	const pkg = recursiveCheckedRecordRustPackage(fixture);
	assert.equal((await read("consumer.Cargo.toml")).toString()
		, `[package]\nname = "recursive-consumer"\nversion = "0.0.0"\nedition = "2021"\n[features]\nmutual = []\nreviewed = []\n[dependencies]\ncheckedrecords = { package = "${pkg.name}", path = "vendor/${pkg.name}-${pkg.version}" }\n[profile.dev]\ndebug = 0\nincremental = false\n`);
	assert.equal((await read("consumer.config.toml")).toString()
		, '[source.crates-io]\nreplace-with = "recursive-vendor"\n[source.recursive-vendor]\ndirectory = "vendor/dependencies"\n');
	assert.equal((await read("link-only")).toString()
		, '#!/bin/sh\nfor arg do\n  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac\ndone\nexec /usr/bin/cc "$@"\n');
	assert.deepEqual(installation.linkerControls, [
		"-c", "-S", "-E", "-xc", "-fsyntax-only", "test.c", "test.C", "test.cc"
		, "test.cpp", "test.cxx", "test.s", "test.S", "@args"
	]);
	const arguments_ = recursiveCheckedRecordRustCargoArguments(fixture, route);
	assert.deepEqual(installation.arguments, arguments_);
	const selectedFeatures = recursiveCheckedRecordRustFeatures(route, fixture);
	assert.deepEqual(installation.metadataArguments, [
		"metadata", "--locked", "--offline", "--format-version", "1"
		, ...selectedFeatures.length ? ["--features", selectedFeatures.join(",")] : []
	]);
	const lock = (await read("package/Cargo.lock")).toString();
	assert.equal((await read("consumer.Cargo.lock")).toString()
		, recursiveCheckedRecordRustConsumerLock(lock, fixture));
	const dependencyArchive = await read("dependency-handoff/" + dependencies.archive);
	const manifests = recursiveCheckedRecordRustDependencyManifests(
		dependencyArchive, dependencies);
	for(const [path, bytes] of manifests) assert.deepEqual(await read(path), bytes, path);
	const dependencyClosure = await checkRecursiveCheckedRecordRustDependencyRecords({
		dependencies, lock, read, fixture
	});
	assert.deepEqual(installation.dependencyClosure, dependencyClosure);
	assert.deepEqual(installation.locked, {
		code: 0
		, stdout: ""
		, stderr: "     Locking 15 packages to latest compatible versions\n"
	});
	const metadata = await checkRecursiveCheckedRecordRustMetadata({
		run: await json("consumer-metadata.json"), root, lock, read, fixture, route
	});
	const build = await json("consumer-build.json");
	runKeys(build);
	assert.deepEqual(installation.build, build);
	assert.equal(build.code, 0);
	assert.equal(build.stdout, "");
	const lines = build.stderr.trimEnd().split("\n");
	assert.match(lines.pop()
		, /^ +Finished `dev` profile \[unoptimized\] target\(s\) in [0-9.]+s$/u);
	const compiled = [];
	for(const line of lines)
	{
		const match = line.match(/^ +Compiling ([a-z0-9_-]+) v([0-9.]+)(?: \(([^)]+)\))?$/u);
		assert.ok(match);
		const item = metadata.packages.find(candidate => candidate.name === match[1]);
		assert.ok(item);
		assert.equal(match[2], item.version);
		assert.equal(match[3], item.source === null ? posix.dirname(item.manifest_path) : undefined);
		compiled.push(item.name);
	}
	assert.deepEqual(compiled.sort(), metadata.packages
		.filter(item => item.name !== "libc").map(item => item.name).sort());
	assert.equal(installation.executable
		, "target/x86_64-unknown-linux-gnu/debug/recursive-consumer");
	assert.match(installation.executableSha256, /^[a-f0-9]{64}$/u);
	assert.equal(installation.crateReceiptSha256, crate.receiptSha256);
	assert.deepEqual(installation.crateClosure, crate.closure);
	return {
		root, installation, dependencies
		, closure: { crate: crate.closure, dependencies: dependencyClosure }
	};
};
