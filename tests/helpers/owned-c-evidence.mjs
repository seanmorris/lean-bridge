/**
 * Bind public C projection and fork-safety evidence to actual compiled executions.
 * No installed support cell is promoted by this development-stage evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateHistoryPath } from "./owned-aggregate-source-history.mjs";
import { ownedAggregateExecutionSources, assertOwnedAggregateIntegration } from "./owned-aggregate-evidence.mjs";
import { ownedCBaseline, ownedCChangedPaths, ownedCAddedPaths, ownedCExecutionPath, reverseOwnedCUpdate } from "./owned-c-source-history.mjs";
import { beforeOwnedReviewed, ownedReviewedChangedPaths } from "./owned-reviewed-source-history.mjs";
import { ownedPackageChangedPaths } from "./owned-package-source-history.mjs";
import { ownedHostChangedPaths } from "./owned-host-source-history.mjs";

export const ownedCCommand = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test --test-concurrency=1 tests/owned-aggregate-contract.test.mjs tests/owned-aggregate-model.test.mjs tests/owned-aggregate-metadata.test.mjs tests/owned-aggregate-native.test.mjs tests/owned-native-values.test.mjs tests/owned-native-scalars.test.mjs tests/owned-c-values.test.mjs tests/native-runtime-retirement.test.mjs";
export const ownedCScope = { compiledLean: true, nativeTransport: true
	, publicCValues: true, forkSafeRuntime: true, installedPackage: false
	, wasm: false, reviewedSource: false
	, hostCallbackConstruction: false, promotedCells: 0 };
export const ownedCExecutionSources = [...new Set([
	...ownedAggregateExecutionSources
	, ...ownedCChangedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, ...ownedCAddedPaths.filter(path => /^(src|tests\/fixtures)\//u.test(path))
	, "tests/owned-c-values.test.mjs", "tests/native-runtime-retirement.test.mjs"
])].sort();
const source = async path => beforeOwnedReviewed(path, await readFile(path, "utf8"));
const historicalBytes = async path => {
	const bytes = await readFile(path);
	return ownedReviewedChangedPaths.includes(path) || ownedPackageChangedPaths.includes(path) || ownedHostChangedPaths.includes(path)
		? beforeOwnedReviewed(path, bytes.toString("utf8")) : bytes;
};
const checkLeak = report => {
	assert.doesNotMatch(report, /ERROR: AddressSanitizer|runtime error:|suppression/iu);
	if(report)
	{
		assert.match(report, /__gmp_default_allocate/u);
		assert.match(report, /SUMMARY: AddressSanitizer: \d+ byte\(s\) leaked in \d+ allocation\(s\)\.\n$/u);
	}
};

/**
 * Reconstruct both C adapters from retained compiler inputs and inspect all
 * executed controls. Original package receipts are not substituted for these.
 *
 * @param record - Immutable native/public execution and source identities.
 */
export const assertOwnedCExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-c-projection-execution");
	assert.equal(record.baselineRevision, ownedCBaseline); assert.deepEqual(record.scope, ownedCScope);
	assert.equal(record.run.command, ownedCCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(sha256(record.run.text), record.run.sha256);
	assert.match(record.run.text, /^# tests 31$/mu); assert.match(record.run.text, /^# pass 31$/mu);
	for(const status of ["fail", "cancelled", "skipped"]) assert.match(record.run.text, new RegExp(`^# ${status} 0$`, "mu"));
	assert.deepEqual(Object.keys(record.sources).sort(), ownedCExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await historicalBytes(path)), digest, path);
	assert.deepEqual(Object.keys(record.inputs).sort(), ["aggregates", "scalars"]);
	assert.deepEqual(Object.keys(record.reports).sort(), ["public-c", "public-c-scalars", "scalars", "transport", "values"]);
	for(const [name, fixture] of [["aggregates", "owned-aggregates"], ["scalars", "owned-scalars"]])
	{
		const input = record.inputs[name], generated = generateOwnedCPackage(input);
		const publicName = name === "aggregates" ? "public-c" : "public-c-scalars", report = record.reports[publicName];
		const native = record.reports[name === "aggregates" ? "values" : "scalars"];
		const text = await source(`tests/fixtures/onboarding/${fixture}/Owned.lean`);
		assert.equal(input.sourceIdentity.sourceTreeSha256, sha256(text));
		assert.equal(input.sourceIdentity.modules.length, 1);
		assert.equal(input.sourceIdentity.modules[0].source.sha256, sha256(text));
		assert.equal(input.sourceIdentity.extractorSha256, record.sources["src/analyze/NativeExports.lean"]);
		assert.equal(report.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
		assert.equal(report.bindingIrSha256, generated.layout.model.bindingIrSha256);
		assert.equal(native.bindingIrSha256, report.bindingIrSha256);
		assert.equal(native.sourceIdentitySha256, report.sourceIdentitySha256);
		assert.equal(native.adapterSha256, sha256(generateOwnedNativeValueAdapters(input).source));
		assert.equal(native.probeSha256, sha256(await source(`tests/fixtures/structured-types/owned-native-${name === "aggregates" ? "values" : "scalars"}.c`)));
		assert.equal(report.headerSha256, sha256(generated.publicHeader));
		assert.equal(report.adapterSha256, sha256(generated.source));
		assert.equal(report.probeSha256, sha256(await source(`tests/fixtures/structured-types/owned-public-${name === "aggregates" ? "values" : "scalars"}.c`)));
		assert.equal(report.result.live, 0); assert.equal(report.result.identities, 0);
		checkLeak(report.startupLeakBaseline);
		assert.equal(report.startupLeakBaseline, native.startupLeakBaseline.report);
		if(name === "aggregates")
		{
			assert.deepEqual(report.result, { checks: 2046, failures: 48, live: 0, identities: 0 });
			assert.deepEqual(report.rejectedMutations, ["public-arena-leak", "public-native-leak", "public-failed-result-leak", "public-cycle-check"]);
			assert.equal(report.malformedResultRetiresRuntime, true); assert.equal(report.cppHeaderCompiled, true);
			assert.deepEqual(native.result, { checks: 33262, failures: 92, faultCases: 5, live: 0, identities: 0 });
			assert.deepEqual(native.rejectedMutations, ["missing-arena-release", "failed-commit-leak", "failed-clear-leak", "missing-cycle-check"]);
			assert.equal(native.startupLeakBaseline.unchangedAfterCalls, true);
		}
		else
		{
			assert.equal(report.primitives, 19);
			assert.deepEqual(report.result, { primitives: 19, checks: 745, failures: 17, live: 0, identities: 0 });
			assert.equal(generated.values.nodes.filter(node => node.kind === "primitive").length, 19);
			assert.deepEqual(report.directLeanLeakBaseline.repetitions, [1, 100]); checkLeak(report.directLeanLeakBaseline.report);
			assert.equal(report.directLeanLeakBaseline.report, native.directLeanLeakBaseline.report);
			assert.deepEqual(native.directLeanLeakBaseline.repetitions, [1, 100]);
			assert.equal(native.directLeanLeakBaseline.unchangedAfterCalls, true);
			assert.deepEqual(native.result, { checks: 371, failures: 10, live: 0, identities: 0 });
		}
		assert.equal(native.result.live, 0); assert.equal(native.result.identities, 0);
	}
	const transport = record.reports.transport;
	assert.equal(transport.bindingIrSha256, record.reports.values.bindingIrSha256);
	assert.equal(transport.sourceIdentitySha256, record.reports.values.sourceIdentitySha256);
	assert.deepEqual(transport.result, { allocationFailures: 96, checks: 111963, depth: 128, exports: 22, liveAllocations: 0, liveIdentities: 0 });
	assert.equal(transport.leaseSourceSha256, sha256(ownedAggregateLeaseSource));
	assert.equal(transport.probeSha256, sha256(await source("tests/fixtures/structured-types/owned-aggregate-carriers.c") + "\n" + await source("tests/fixtures/structured-types/owned-aggregate-leases.c")));
	assert.equal(transport.sanitizer, "address,undefined");
	assert.deepEqual(transport.rejectedMutations, ["missing-retain", "missing-release", "missing-rollback", "reused-thread"]);
	checkLeak(transport.startupLeakBaseline.report); assert.equal(transport.startupLeakBaseline.unchangedAfterCalls, true);
	const fork = await source("tests/native-runtime-retirement.test.mjs");
	for(const marker of ['"fork-cold"', '"unguarded-ready"', '"unguarded-callback"', "ulimit -c 0"])
		assert.ok(fork.includes(marker), marker);
	assert.match(record.run.text, /ok \d+ - shared native retirement rejects cached components and callbacks but preserves owned cleanup/u);
};

/**
 * Check the complete prior source set, the reversible transition, and unchanged
 * installed observations. Validate the original native milestone independently.
 *
 * @param record - Frozen integration record linked to the native predecessor.
 */
export const assertOwnedCIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-c-projection-integration");
	assert.equal(record.baselineRevision, ownedCBaseline); assert.deepEqual(record.scope, ownedCScope);
	assert.equal(record.previous.path, ownedAggregateHistoryPath);
	const previousText = await source(record.previous.path); assert.equal(sha256(previousText), record.previous.sha256);
	const previous = JSON.parse(previousText);
	assert.equal(record.execution.path, ownedCExecutionPath);
	const execution = await source(record.execution.path); assert.equal(sha256(execution), record.execution.sha256);
	await assertOwnedCExecution(JSON.parse(execution));
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedCChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedCAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedCChangedPaths, ...ownedCAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	const updates = new Map(record.updates.map(item => [item.path, item])), restored = {};
	for(const path of paths)
	{
		const current = await historicalBytes(path); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.currentSha256, record.sourceHashes[path]);
			restored[path] = reverseOwnedCUpdate(current.toString("utf8"), update);
		}
		if(previous.sourceHashes[path]) assert.equal(sha256(restored[path] ?? current), previous.sourceHashes[path], path);
		if(record.additions[path]) assert.equal(record.additions[path], record.sourceHashes[path], path);
	}
	const { document: currentDocument, ...contracts } = await readTypeSurface();
	assert.ok(currentDocument);
	const document = JSON.parse(await source("docs/type-surface.v1.json"));
	const old = JSON.parse(restored["docs/type-surface.v1.json"]), expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected, "Only exact evidence source digests may change");
	const cells = typeSurfaceCells(document, contracts); assert.deepEqual(cells, typeSurfaceCells(old, contracts));
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version);
	assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
	await assertOwnedAggregateIntegration(previous);
};
