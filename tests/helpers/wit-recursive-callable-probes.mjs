/**
 * Distinguish real Lean transport checks from synthetic allocation probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { compileCallableWitGraphModel } from "../../src/backends/wit/callable-graph-model.mjs";
import { renderWitGraphCallableHostSource } from "../../src/backends/wit/callable-graph-host.mjs";
import { nativeRecursiveCallableReviewedIr } from "./native-recursive-callable-fixture.mjs";
import { witRecursiveCallableValues } from "./wit-recursive-callable-values.mjs";
import { witRecursiveCallableFaults } from "./wit-recursive-callable-faults.mjs";
import { assertWitRecursiveCompilerReceipt, witRecursiveTypedObservation, witRecursiveValueObservation } from "./wit-recursive-callable-receipt.mjs";

const flags = ["-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-sanitize-recover=all", "-no-pie"];
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const sanitizer = (run, expected) => {
	assert.deepEqual(run.sanitized, expected); assert.deepEqual(run.sanitizerFlags, flags);
	assert.deepEqual(run.sanitizerEnvironment, {
		ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1"
	});
	const { cold, exercised } = run.sanitizerRuns;
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), expected);
	assert.equal(cold.stderr, exercised.stderr);
	assert.equal(run.startupLeakBaseline.report, cold.stderr);
	assert.equal(run.startupLeakBaseline.unchangedAfterCalls, true);
	assert.equal(run.startupLeakBaseline.bytes, 128); assert.equal(run.startupLeakBaseline.allocations, 12);
	assert.match(cold.stderr, /__gmp_default_allocate/u);
	assert.match(cold.stderr, /SUMMARY: AddressSanitizer: 128 byte\(s\) leaked in 12 allocation\(s\)/u);
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
};

/**
 * Reconstruct the exact generated host and consumers used with compiled Lean.
 *
 * @param record - Both authoring paths and their unsuppressed sanitizer controls.
 */
export const assertWitRecursiveNativeProbes = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.installedPackage, false);
	assert.deepEqual(record.observations.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const raw = await readFile("tests/fixtures/structured-callable-consumers/wit-recursive-native.c", "utf8");
	const typed = await readFile("tests/fixtures/structured-callable-consumers/wit-recursive-typed.c", "utf8");
	const expected = { callbacks: 6, releases: 1, nativeIdentities: 0
		, recursive: true, owned: true, recovery: true, activeClose: true
		, wrongThread: true, expiredContexts: true, independentResult: true };
	for(const run of record.observations)
	{
		assertWitRecursiveCompilerReceipt(run);
		const model = compileCallableWitGraphModel(run.model.bindingIr);
		assert.equal(model.functions.length, 33); assert.equal(model.callbacks.size, 18);
		assert.equal(run.bindingIrSha256, model.manifest.bindingIrSha256);
		assert.equal(run.nativeLibrarySha256, run.receipt.nativeLibrary.sha256);
		assert.equal(run.runtimeIdentity, run.receipt.runtimeIdentity);
		const component = Buffer.from(run.componentBase64, "base64");
		assert.equal(component.toString("base64"), run.componentBase64); assert.equal(sha256(component), run.componentSha256);
		assert.equal(run.hostSourceSha256, sha256(renderWitGraphCallableHostSource(model, component)));
		const tree = model.nodes.find(node => node.ref.id === "lean:Structured.Tree");
		const callback = model.functions.find(fn => fn.field === "call_recursive").parameters[1];
		const owned = model.functions.find(fn => fn.field === "make_recursive").result;
		const bindings = `#define fixture_encode lb_graph_encode_${tree.index}\n#define fixture_decode lb_graph_decode_${tree.index}\n#define fixture_direct_callback lb_graph_callback_${model.wire.resources.indexOf(callback.resource) + 1}\nstatic const char fixture_callback_name[] = ${JSON.stringify(callback.resource.witName)};\nstatic const char fixture_owned_invoke[] = ${JSON.stringify("invoke-" + owned.resource.witName)};`;
		assert.equal(run.consumerSourceSha256, sha256(raw.replace("/* GENERATED_BINDINGS */", bindings)));
		const typedBindings = `#define fixture_callback_create ${model.prefix}_wasmtime_callback_${callback.publicName.slice(model.prefix.length + 1)}_create\n#define fixture_owned_call ${model.prefix}_wasmtime_function_${owned.publicName.slice(model.prefix.length + 1)}_call`;
		assert.equal(run.typed.sourceSha256, sha256(typed.replace("/* GENERATED_BINDINGS */", typedBindings)));
		assert.equal(run.values.sourceSha256, sha256(witRecursiveCallableValues(model)));
		for(const [probe, observation] of [[run, expected], [run.typed, witRecursiveTypedObservation], [run.values, witRecursiveValueObservation]])
		{
			assert.deepEqual(probe.observed, observation); sanitizer(probe, observation);
			hash(probe.executableSha256);
		}
	}
};

/**
 * Require allocation cleanup and the intended failure from each ownership mutant.
 *
 * @param record - Synthetic native boundary observations, not installed execution.
 */
export const assertWitRecursiveFaultProbes = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.compiledLean, false); assert.equal(record.installedPackage, false);
	const model = compileCallableWitGraphModel(nativeRecursiveCallableReviewedIr());
	const host = renderWitGraphCallableHostSource(model, new Uint8Array([0]));
	assert.equal(record.hostSha256, sha256(host)); assert.equal(record.probeSha256, sha256(witRecursiveCallableFaults(model)));
	const expected = { checks: 730344, successes: 5904, failures: 10904, injected: 7756, live: 0, retired: 0 };
	assert.deepEqual(record.observed, expected); assert.deepEqual(record.sanitized, expected);
	assert.deepEqual(record.diagnostics, { normal: "", sanitized: "" });
	assert.deepEqual(record.sanitizerFlags, flags);
	assert.deepEqual(record.sanitizerEnvironment, { ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" });
	assert.equal(record.prematureReplyReleaseRejected, true); assert.equal(record.missingReplyOwnerRejected, true);
	assert.deepEqual(record.mutants.map(run => run.name), ["premature-reply-release", "missing-reply-owner"]);
	for(const [index, replacement, diagnostic] of [
		[0, "lb_scope_close(&owner->scope); converted._bridge_owner = owner;", /heap-use-after-free/u]
		, [1, "converted._bridge_owner = NULL;", /!live && !sample_live/u]
	]) {
		const mutant = record.mutants[index];
		assert.equal(mutant.sourceSha256, sha256(host.replaceAll("converted._bridge_owner = owner;", replacement)));
		assert.match(mutant.stderr, diagnostic); assert.equal(mutant.stdout, "");
	}
};
