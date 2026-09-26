/**
 * Authenticate private native checks without promoting installed host coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateAddedPaths, ownedAggregateChangedPaths, ownedAggregateBaseline, ownedAggregateExecutionPath, reverseOwnedAggregateUpdate } from "./owned-aggregate-source-history.mjs";
import { witRecursiveCallableHistoryPath } from "./wit-recursive-callable-source-history.mjs";

export const ownedAggregateNativeCommand = "LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-aggregate-contract.test.mjs tests/owned-aggregate-model.test.mjs tests/owned-aggregate-metadata.test.mjs tests/owned-aggregate-native.test.mjs tests/owned-native-values.test.mjs tests/owned-native-scalars.test.mjs";
export const ownedAggregateRegressionCommand = "LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test --test-concurrency=1 tests/binding-ir-contract.test.mjs tests/binding-ir-structured.test.mjs tests/export-configuration.test.mjs tests/elaborated-metadata.test.mjs";
export const ownedAggregateScope = { compiledLean: true
	, privateNativeTransport: true
	, installedPackage: false, wasm: false, reviewedSource: false
	, hostCallbackConstruction: false, promotedCells: 0 };
export const ownedAggregateExecutionSources = [...new Set([
	...ownedAggregateChangedPaths.filter(path => /^(src|schema)\//u.test(path))
	, ...ownedAggregateAddedPaths.filter(path => /^(src|schema|tests\/fixtures)\//u.test(path))
	, "src/backends/native/runtime-broker.mjs", "src/build/native-component.mjs"
	, "src/build/process-runner.mjs", "src/capsule/node.mjs"
	, "tests/helpers/owned-aggregate-fixture.mjs"
	, "tests/helpers/owned-aggregate-native.mjs"
	, ...["contract", "model", "metadata", "native"].map(name => `tests/owned-aggregate-${name}.test.mjs`)
	, "tests/owned-native-values.test.mjs", "tests/owned-native-scalars.test.mjs"
	, ...["binding-ir-contract", "binding-ir-structured", "export-configuration", "elaborated-metadata"].map(name => `tests/${name}.test.mjs`)
])].sort();
const source = async path => readFile(path, "utf8");
const passing = (run, command, expected) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	const count = /^# tests (\d+)$/mu.exec(run.text)?.[1];
	assert.equal(Number(count), expected);
	assert.match(run.text, new RegExp(`^# pass ${count}$`, "mu"));
	for(const name of ["fail", "cancelled", "skipped"])
		assert.match(run.text, new RegExp(`^# ${name} 0$`, "mu"));
};
const leak = baseline => {
	assert.ok(Number.isSafeInteger(baseline.bytes) && baseline.bytes >= 0);
	assert.ok(Number.isSafeInteger(baseline.allocations) && baseline.allocations >= 0);
	assert.doesNotMatch(baseline.report, /ERROR: AddressSanitizer|runtime error:|suppression/iu);
	if(baseline.bytes)
	{
		assert.match(baseline.report, /__gmp_default_allocate/u);
		assert.ok(baseline.report.endsWith(`SUMMARY: AddressSanitizer: ${baseline.bytes} byte(s) leaked in ${baseline.allocations} allocation(s).\n`));
	}
	else assert.equal(baseline.report, "");
};

/**
 * Reconstruct adapters from compiler evidence and require the executed controls.
 *
 * @param record - Frozen native/legacy runs, compiler inputs and probe reports.
 */
export const assertOwnedAggregateExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-aggregate-native-execution");
	assert.equal(record.baselineRevision, ownedAggregateBaseline);
	assert.deepEqual(record.scope, ownedAggregateScope);
	passing(record.native, ownedAggregateNativeCommand, 25);
	passing(record.regressions, ownedAggregateRegressionCommand, 61);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedAggregateExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await source(path)), digest, path);
	assert.deepEqual(Object.keys(record.inputs).sort(), ["aggregates", "scalars"]);
	assert.deepEqual(Object.keys(record.reports).sort(), ["scalars", "transport", "values"]);
	for(const [name, fixture] of [["aggregates", "owned-aggregates"], ["scalars", "owned-scalars"]])
	{
		const input = record.inputs[name], generated = generateOwnedNativeValueAdapters(input);
		const report = record.reports[name === "aggregates" ? "values" : name];
		const text = await source(`tests/fixtures/onboarding/${fixture}/Owned.lean`);
		assert.equal(input.sourceIdentity.modules.length, 1);
		assert.equal(input.sourceIdentity.modules[0].source.sha256, sha256(text));
		assert.equal(input.sourceIdentity.sourceTreeSha256, sha256(text));
		assert.equal(input.sourceIdentity.extractorSha256, record.sources["src/analyze/NativeExports.lean"]);
		assert.equal(report.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
		assert.equal(report.bindingIrSha256, generated.layout.model.bindingIrSha256);
		assert.equal(report.adapterSha256, sha256(generated.source));
		assert.equal(report.result.live, 0); assert.equal(report.result.identities, 0);
		leak(report.startupLeakBaseline);
		if(name === "scalars")
		{
			assert.equal(report.primitives, 19);
			assert.equal(generated.layout.nodes.filter(node => node.kind === "primitive").length, 19);
			assert.deepEqual(report.result, { checks: 371, failures: 10, live: 0, identities: 0 });
			assert.deepEqual(report.directLeanLeakBaseline.repetitions, [1, 100]);
			assert.equal(report.directLeanLeakBaseline.unchangedAfterCalls, true);
			leak(report.directLeanLeakBaseline);
		}
		else
		{
			assert.deepEqual(report.result, { checks: 33262, failures: 92, faultCases: 5, live: 0, identities: 0 });
			assert.deepEqual(report.rejectedMutations, ["missing-arena-release", "failed-commit-leak", "failed-clear-leak", "missing-cycle-check"]);
			assert.equal(report.startupLeakBaseline.unchangedAfterCalls, true);
			assert.equal(record.reports.transport.bindingIrSha256, report.bindingIrSha256);
			assert.equal(record.reports.transport.sourceIdentitySha256, report.sourceIdentitySha256);
		}
		assert.equal(report.probeSha256, sha256(await source(`tests/fixtures/structured-types/owned-native-${name === "aggregates" ? "values" : name}.c`)));
	}
	const transport = record.reports.transport;
	assert.deepEqual(transport.result, { allocationFailures: 96, checks: 111963, depth: 128, exports: 22, liveAllocations: 0, liveIdentities: 0 });
	assert.equal(transport.sanitizer, "address,undefined");
	assert.equal(transport.leaseSourceSha256, sha256(ownedAggregateLeaseSource));
	assert.equal(transport.probeSha256, sha256(await source("tests/fixtures/structured-types/owned-aggregate-carriers.c") + "\n"
		+ await source("tests/fixtures/structured-types/owned-aggregate-leases.c")));
	assert.deepEqual(transport.rejectedMutations, ["missing-retain", "missing-release", "missing-rollback", "reused-thread"]);
	assert.equal(transport.startupLeakBaseline.unchangedAfterCalls, true); leak(transport.startupLeakBaseline);
};

/**
 * Check every predecessor source and keep all installed observations unchanged.
 *
 * @param record - Exact current/prior source identities and immutable execution link.
 */
export const assertOwnedAggregateIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-aggregate-native-integration");
	assert.equal(record.baselineRevision, ownedAggregateBaseline);
	assert.deepEqual(record.scope, ownedAggregateScope);
	assert.equal(record.previous.path, witRecursiveCallableHistoryPath);
	const previousText = await source(record.previous.path);
	assert.equal(sha256(previousText), record.previous.sha256);
	const previous = JSON.parse(previousText);
	assert.equal(record.execution.path, ownedAggregateExecutionPath);
	const executionText = await source(record.execution.path);
	assert.equal(sha256(executionText), record.execution.sha256);
	await assertOwnedAggregateExecution(JSON.parse(executionText));
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedAggregateChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedAggregateAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedAggregateChangedPaths, ...ownedAggregateAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	const updates = new Map(record.updates.map(update => [update.path, update])), restored = {};
	for(const path of paths)
	{
		const current = await readFile(path); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.currentSha256, record.sourceHashes[path]);
			restored[path] = reverseOwnedAggregateUpdate(current.toString("utf8"), update);
		}
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { document, ...contracts } = await readTypeSurface();
	const old = JSON.parse(restored["docs/type-surface.v1.json"]), expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected, "Only authenticated evidence source hashes may change");
	const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(cells, typeSurfaceCells(old, contracts));
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version);
	assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
};
