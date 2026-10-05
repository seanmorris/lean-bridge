/**
 * Execute Rust callback-local owners against freshly compiled Lean and C.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../src/backends/rust/owned-callables.mjs";
import { generateOwnedRustPackage } from "../src/backends/rust/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustCallbackResultConfiguration as ownedCallbackResultConfiguration
	, ownedRustCallbackResultReviewedIr as ownedCallbackResultReviewedIr
	, ownedRustCallbackResultSource as ownedCallbackResultSource
	, ownedRustCallbackResultCombinedConfiguration as ownedCallbackResultCombinedConfiguration
	, ownedRustCallbackResultCombinedReviewedIr as ownedCallbackResultCombinedReviewedIr
	, ownedRustCallbackResultCombinedSource as ownedCallbackResultCombinedSource } from "./helpers/owned-rust-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedRustCallbackMutations } from "./helpers/owned-rust-callback-result-mutations.mjs";
import { assertOwnedRustCallbackRuntime } from "./helpers/owned-rust-callback-result-evidence.mjs";

const variants = [
	{ name: "no-host", hostCallbacks: false, combined: false }
	, { name: "host", hostCallbacks: true, combined: false }
	, { name: "combined", hostCallbacks: true, combined: true }
];
for(const mode of ["ordinary", "reviewed"]) for(const { name, hostCallbacks, combined } of variants)
test(`Rust callback-result owners execute ${mode}-${name}`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const configuration = combined ? ownedCallbackResultCombinedConfiguration : ownedCallbackResultConfiguration;
	const reviewedIr = combined ? ownedCallbackResultCombinedReviewedIr : ownedCallbackResultReviewedIr;
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewedIr() }
		, hostCallbacks
		, sourceSuffix: combined ? ownedCallbackResultCombinedSource : ownedCallbackResultSource
		, evidenceName: `rust-callback-result-${mode}-${name}-inputs.json`
	});
	const options = { hostCallbacks, callbackResultAnchors: true, valueCopies: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, ...options };
	const native = generateOwnedCPackage(input);
	const generated = generateOwnedRustCallables(native.layout.model.bindingIr, options);
	assert.equal(generated.c.header, native.publicHeader);
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	assert.equal(native.source.split(handoff).length, combined ? 2 : 1);
	const implementation = `#include <stddef.h>
#include <stdlib.h>
static size_t live, handoffs; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${combined ? native.source.replace(handoff, handoff + "\n  ++handoffs;") : native.source}
size_t owned_test_live(void) { return live; }
size_t owned_test_handoffs(void) { return handoffs; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
void owned_test_sanitizer_fault(size_t index) { volatile char *value = malloc(1); value[index] = 1; free((void *)value); }
int owned_test_undefined_fault(int shift) { volatile int value = 1; return value << shift; }
`;
	for(const [path, source] of Object.entries(native.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const environment = { PATH: "/usr/bin:/bin" };
	const compileNative = sanitized => runCopied("/usr/bin/cc", [
		"-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, ...sanitized ? ["-fsanitize=address,undefined", "-fno-omit-frame-pointer"] : []
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
		, ...hostCallbacks ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", `libowned-rust-callback-results${sanitized ? "-sanitized" : ""}.so`]
			, compiled.directory, environment);
	await compileNative(false);
	const template = await readFile("tests/fixtures/structured-types/owned-rust-callback-results.rs", "utf8");
	await saveLakeFile(compiled.directory, "Cargo.toml", '[package]\nname="owned-rust-callback-results"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n[features]\nhost=[]\ncombined=["host"]\n[profile.dev]\ndebug=0\nincremental=false\n');
	const suffixes = { "src/lib.rs": "\nmod owned_values;\n"
		, "src/owned_values.rs": `\n#[cfg(test)] mod tests { use super::*;\n${template}\n#[test] fn callbacks() { main(); }\n}` };
	const sources = { "src/lib.rs": generated.apiSource, "src/owned_values.rs": generated.source };
	const restore = async () => {
		for(const [path, source] of Object.entries(sources))
			await saveLakeFile(compiled.directory, path, source + suffixes[path]);
	};
	await restore();
	const env = { ...environment
		, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=owned-rust-callback-results -Clink-arg=-Wl,-rpath,${compiled.directory}`
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
	};
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	await runCopied(cargo, ["generate-lockfile", "--offline"], compiled.directory, env);
	const args = ["test", "--offline", "--locked", "--lib"
		, ...hostCallbacks ? ["--features", combined ? "combined" : "host"] : []];
	const run = () => runCopied(cargo, [...args, "--", "--nocapture", "--test-threads=1"], compiled.directory, env);
	const parse = observed => {
		assert.match(observed.stdout, /1 passed; 0 failed/u, observed.stderr);
		const match = observed.stdout.match(/owned-rust-callback-results:(\{[^\n]+\})/u); assert.ok(match, observed.stdout);
		return JSON.parse(match[1]);
	};
	const result = parse(await run()); assert.ok(result.checks > 100);
	for(const key of ["rustFaults", "nativeFaults", "panicFaults", "before"]) assert.ok(result[key] > 0, key);
	assert.equal(result.after > 0, combined); assert.equal(result.live, 0); assert.equal(result.identities, 0);
	await compileNative(true);
	const sanitizedEnv = { ...env, CARGO_TARGET_DIR: join(compiled.directory, "target-sanitized")
		, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=asan -ldylib=ubsan -ldylib=owned-rust-callback-results-sanitized -Clink-arg=-Wl,-rpath,${compiled.directory} -Clink-arg=-no-pie` };
	const artifacts = await runCopied(cargo, [...args, "--no-run", "--message-format=json"], compiled.directory, sanitizedEnv);
	const executables = artifacts.stdout.split("\n").filter(Boolean).map(line => JSON.parse(line))
		.filter(item => item.reason === "compiler-artifact" && item.profile.test && item.executable);
	assert.equal(executables.length, 1);
	// GCC's sanitizer destroys Rust's malloc-backed alternate signal stack with
	// munmap at test-thread exit. Leave signal-stack ownership with Rust; address,
	// leak and undefined-behavior detection remain enabled and are probed below.
	const sanitizerEnvironment = { ...environment
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1:use_sigaltstack=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		, LSAN_OPTIONS: "exitcode=0"
	};
	const sanitize = extra => runCopied("/bin/sh", [
		"-c", 'ulimit -c 0\nexec "$@"', "rust-callback-results"
		, executables[0].executable, "--nocapture", "--test-threads=1"
	], compiled.directory, { ...sanitizerEnvironment, ...extra });
	const cold = await sanitize({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), exercised = await sanitize({});
	assert.doesNotMatch(cold.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.deepEqual(parse(cold), { cold: true }); assert.deepEqual(parse(exercised), result);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const sanitizerProbes = [];
	for(const [fault, diagnostic] of [
		["address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
		, ["undefined", /runtime error: shift exponent 40 is too large/u]
	]) {
		const observed = await sanitize({ LEAN_BRIDGE_OWNED_SANITIZER_FAULT: fault
			, ...fault === "address" ? { UBSAN_OPTIONS: "halt_on_error=0" } : {} })
			.catch(error => { assert.equal(error.code, "build-command-failed"); return error.details; });
		assert.match(observed.stderr, diagnostic); assert.doesNotMatch(observed.stdout, /1 passed; 0 failed/u);
		sanitizerProbes.push({ fault, rejected: true, diagnostic: normalize(observed.stderr) });
	}
	const mutations = [];
	if(name !== "host") for(const mutation of ownedRustCallbackMutations(generated, combined))
	{
		t.diagnostic(`${mode}-${name}: compile and reject ${mutation.name}`);
		await saveLakeFile(compiled.directory, mutation.path, mutation.source + suffixes[mutation.path]);
		try
		{
			await runCopied(cargo, [...args, "--no-run"], compiled.directory, env);
			await assert.rejects(run, error => {
				assert.equal(error.code, "build-command-failed");
				assert.match(error.details.stdout, /test owned_values::tests::callbacks \.\.\. FAILED/u);
				mutations.push({ name: mutation.name, path: mutation.path
					, occurrences: mutation.occurrences, sourceSha256: sha256(mutation.source)
					, compiled: true, semanticRejection: true
					, diagnostic: error.details.stdout });
				return true;
			}, mutation.name);
		}
		finally
		{ await restore(); }
	}
	const restored = parse(await run()); assert.deepEqual(restored, result);
	const package_ = generateOwnedRustPackage(native.layout.model.bindingIr, null, {}, options);
	const report = {
		mode, name, hostCallbacks, combined, input, result
		, contract: package_.contract
		, probeSha256: sha256(template), sourceSha256: sha256(native.source)
		, rustApiSha256: sha256(generated.apiSource)
		, rustSourceSha256: sha256(generated.source)
		, nativeSanitizers: ["address", "undefined"]
		, startupLeakBaseline: normalize(cold.stderr)
		, sanitizerProbes, sanitizerEnvironment
		, mutations, restored
	};
	await assertOwnedRustCallbackRuntime(report);
	await saveLakeFile("build/owned-rust-callback-results", `${mode}-${name}.json`, canonicalJson(report));
	t.diagnostic(JSON.stringify({ mode, name, ...result }));
});
