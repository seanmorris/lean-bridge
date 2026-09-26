/**
 * Check actual wasm32 ownership, fault recovery and deliberately broken adapters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../src/build/native-callable-graph.mjs";
import { generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "../../src/build/php-wasm-graph-component.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { phpWasmRecursiveProbeSource } from "./php-wasm-recursive-callable-generated.mjs";
import { phpWasmRecursiveOwnershipProbe } from "./php-wasm-recursive-callable-ownership.mjs";

export const phpWasmRecursiveShapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"];
const fixture = name => readFile(`tests/fixtures/structured-callable-consumers/php-wasm-recursive-${name}.php`, "utf8");
const empty = stats => {
	for(const key of ["nativeLive", "zendLive", "identities", "borrowedContexts", "callDepth"])
		assert.equal(stats[key], 0, key);
};
const mutant = (value, name) => {
	assert.match(value.stderr, /"status":2/u); assert.ok(value.stderr.includes(name));
	assert.doesNotMatch(value.stderr, /memory access out of bounds|RuntimeError:|unreachable/u);
};
const pairs = values => Object.fromEntries(phpWasmRecursiveShapes.map((shape, index) => [shape, { native: values[index][0], zend: values[index][1] }]));

/**
 * Recreate generated C and callers, then require every measured fault path.
 *
 * @param report - Unedited generated wasm32 execution report, not a package report.
 */
export const assertPhpWasmRecursiveProbes = async report => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.compiledLean, true);
	assert.equal(report.installedPackage, false); assert.equal(report.independentIr, true);
	assert.equal(report.functions, 29); assert.equal(report.callbacks, 16);
	assert.match(report.runtimeIdentity, /^[a-f0-9]{64}$/u);
	const ir = structuredCallableReviewedIr({ recursive: true }), descriptor = createNativeCallableGraphDescriptor(ir);
	const model = { schemaVersion: 4, profile: "php-wasm-copied-v1"
		, pointerBits: 32, byteOrder: "little"
		, bindingIr: ir, copiedGraph: descriptor, component: ir.component
		, exports: ir.declarations.map(item => ({ bindingId: item.id, name: item.source.declaration, module: "Structured" })) };
	const generated = generateCompiledPhpWasmGraph(model, generateCompiledPhpWasmLeanAdapters(model));
	assert.equal(report.probeSha256, sha256(phpWasmRecursiveProbeSource(ir, generated)));
	assert.deepEqual(report.generatedFiles, generated.manifest.files);
	assert.equal(report.layoutSha256, generated.manifest.layoutSha256);
	assert.equal(report.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/structured-callables/Structured.lean")));
	const common = await fixture("wrapper");
	assert.equal(common.split("$tree = new TreeLeaf(Big::of(7));").length, 2);
	const base = common.split("$tree = new TreeLeaf(Big::of(7));")[0]
		.replace("require __DIR__ . '/transport.php';\n", "").replaceAll("$GLOBALS['closed']", "recursive_probe_stats()['closes']");
	assert.equal(report.consumerSha256, sha256(base + await fixture("generated")));
	const ownership = phpWasmRecursiveOwnershipProbe(ir);
	assert.equal(report.ownership.consumerSha256, sha256(base + (await fixture("ownership")).replaceAll("CALLBACK_COUNT", String(ownership.callbacks))));
	assert.equal(report.bailouts.consumerSha256, sha256((await fixture("bailouts")).replaceAll("PRIVATE_ARRAY_CALL", JSON.stringify(ownership.privateArrayCall))));
	for(const name of ["construction", "replies"])
		assert.equal(report[name].consumerSha256, sha256(base.split("$shapes =")[0] + await fixture(name)));
	assert.equal(report.malformed.consumerSha256, sha256(await fixture("malformed")));
	for(const name of ["bailouts", "construction"]) assert.match(report[name].hostSha256, /^[a-f0-9]{64}$/u);
	assert.deepEqual(report.observations.map(run => run.mode), [0, 1]);
	for(const run of report.observations)
	{
		assert.equal(run.actualPhpBits, 32); assert.equal(run.compiledLean, true); assert.equal(run.installedPackage, false);
		assert.equal(run.checks, 12752); assert.equal(run.fiberStartAvailable, false);
		assert.deepEqual(run.faults, pairs([[2, 13], [3, 13], [0, 7], [4, 11], [9, 25], [9, 31], [2, 19], [9, 31], [25, 65]]));
		assert.deepEqual(run.ownedFaults, pairs([[2, 7], [3, 7], [0, 3], [2, 5], [3, 11], [3, 15], [2, 15], [3, 15], [25, 59]]));
		assert.equal(run.capacity, 4096); assert.equal(run.recovered, 8192);
		for(const key of ["foreignResourceRejected", "closedResourceRejected", "wrongSignatureRejected"]) assert.equal(run[key], true);
		empty(run.stats); assert.equal(run.stats.closes, 12622);
		assert.equal(run.stats.retirements, 0); assert.equal(run.stats.poisoned, 0);
	}
	for(const name of ["ownership", "bailouts", "construction", "replies"])
		assert.deepEqual(report[name].observations.map(run => run.strict), [0, 1], name);
	for(const run of report.ownership.observations)
	{
		assert.equal(run.actualPhpBits, 32); assert.equal(run.checks, 647);
		assert.equal(run.contextChecks, 327); assert.equal(run.stats.contextChecks, 327);
		assert.equal(run.staleGenerationChecks, 6); assert.equal(run.tokenHighBitsPreserved, true);
		assert.equal(run.activeClose, 2); assert.equal(run.contextExhaustionRejections, 3);
		assert.equal(run.stats.contextsExhausted, true); assert.equal(run.stats.closes, 41); empty(run.stats);
	}
	for(const run of report.bailouts.observations)
	{
		assert.deepEqual(run.observations.map(item => [item.mode, item.status]), [[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]]);
		for(const item of run.observations)
		{
			empty(item.before); empty(item.after);
			assert.equal(item.before.closes, item.mode >= 2 ? 1 : 0);
			assert.equal(item.after.closes, item.before.closes);
			assert.ok(item.after.nativeAttempts > item.before.nativeAttempts);
			assert.ok(item.after.zendAttempts > item.before.zendAttempts);
		}
	}
	const constructors = [[9, 3], [21, 7], [6, 2], [9, 3], [15, 5], [30, 10], [12, 4], [30, 10], [225, 75]];
	for(const run of report.construction.observations)
	{
		assert.equal(run.failures, 476);
		assert.deepEqual(run.observations.map(item => [item.shape, item.owned, item.failures]), phpWasmRecursiveShapes.flatMap((shape, index) => [false, true].map((owned, mode) => [shape, owned, constructors[index][mode]])));
		let aborted = 0;
		for(const item of run.observations)
		{
			aborted += item.failures;
			assert.equal(item.recovered.shape, item.shape); assert.equal(item.recovered.owned, item.owned);
			assert.equal(item.recovered.attempts, item.failures);
			for(const phase of ["before", "after"])
			{ empty(item.recovered[phase]); assert.equal(item.recovered[phase].constructionBailouts, aborted); }
			assert.equal(item.recovered.after.closes - item.recovered.before.closes, item.owned ? 1 : 0);
		}
	}
	for(const run of report.replies.observations)
	{
		assert.equal(run.actualPhpBits, 32); assert.equal(run.checks, 15); assert.equal(run.checkedBeforeLeanCopy, true);
		assert.equal(run.stats.replyChecks, 18); assert.equal(run.stats.replyFailures, 0); empty(run.stats);
	}
	assert.equal(report.replies.mutant.rejectedBeforeLeanCopy, true);
	mutant(report.replies.mutant, "callback_reply_storage_expired");
	assert.deepEqual(report.malformed.observations.map(run => [run.strict, run.mode]), [0, 1].flatMap(strict => Array.from({ length: 8 }, (_, index) => [strict, index + 1])));
	for(const run of report.malformed.observations)
	{
		assert.equal(run.actualPhpBits, 32); assert.equal(run.compiledLean, true); assert.equal(run.installedPackage, false);
		assert.equal(run.checks, 15); empty(run.stats);
		assert.equal(run.stats.poisoned, 1); assert.equal(run.stats.retirements, run.mode === 3 ? 0 : 1);
		assert.equal(run.stats.closes, 1);
	}
	assert.equal(report.malformed.mutant.rejected, true);
	mutant(report.malformed.mutant, "malformed_output_retires_runtime");
};
