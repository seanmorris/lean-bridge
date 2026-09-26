/**
 * Authenticate fresh reviewed-v4 C execution without promoting installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { validateReviewedOwnedSource } from "../../src/analyze/reviewed-owned-source.mjs";
import { ownedCExecutionSources, assertOwnedCIntegration } from "./owned-c-evidence.mjs";
import { ownedCHistoryPath } from "./owned-c-source-history.mjs";
import { ownedReviewedBaseline, ownedReviewedChangedPaths, ownedReviewedAddedPaths, ownedReviewedExecutionPath, reverseOwnedReviewedUpdate } from "./owned-reviewed-source-history.mjs";

export const ownedReviewedCommand = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/reviewed-owned-source.test.mjs tests/reviewed-source.test.mjs tests/reviewed-callables.test.mjs tests/owned-c-values.test.mjs";
export const ownedReviewedScope = { compiledLean: true, publicCValues: true
	, reviewedSource: true, installedPackage: false, wasm: false
	, hostCallbackConstruction: false, promotedCells: 0 };
export const ownedReviewedExecutionSources = [...new Set([
	...ownedCExecutionSources, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "tests/reviewed-owned-source.test.mjs"
	, "tests/reviewed-source.test.mjs", "tests/reviewed-callables.test.mjs"
])].sort();
const source = path => readFile(path, "utf8");

/**
 * Regenerate the real reviewed adapters and require native execution controls.
 *
 * @param record - Retained fresh compiler inputs, native report and enabled run.
 */
export const assertOwnedReviewedExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-reviewed-projection-execution");
	assert.equal(record.baselineRevision, ownedReviewedBaseline); assert.deepEqual(record.scope, ownedReviewedScope);
	assert.equal(record.run.command, ownedReviewedCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(sha256(record.run.text), record.run.sha256);
	assert.match(record.run.text, /^# tests 52$/mu); assert.match(record.run.text, /^# pass 52$/mu);
	for(const status of ["fail", "cancelled", "skipped"]) assert.match(record.run.text, new RegExp(`^# ${status} 0$`, "mu"));
	assert.deepEqual(Object.keys(record.sources).sort(), ownedReviewedExecutionSources);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(Object.keys(record.inputs).sort(), ["reviewed", "shapeNegative"]);
	const input = record.inputs.reviewed, generated = generateOwnedCPackage(input), report = record.report;
	const review = validateReviewedOwnedSource(input.sourceIdentity.reviewedBindingIr);
	assert.equal(report.reviewedSourceSha256, input.sourceIdentity.reviewedBindingIr.sourceSha256);
	assert.equal(report.reviewedSemanticSha256, input.sourceIdentity.reviewedBindingIr.semanticSha256);
	assert.notEqual(report.reviewedSemanticSha256, report.bindingIrSha256);
	assert.equal(report.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
	assert.equal(report.bindingIrSha256, generated.layout.model.bindingIrSha256);
	assert.equal(report.headerSha256, sha256(generated.publicHeader));
	assert.equal(report.adapterSha256, sha256(generated.source));
	assert.equal(report.probeSha256, sha256(await source("tests/fixtures/structured-types/owned-public-values.c")));
	assert.deepEqual(report.checks, { checks: 2046, failures: 48, live: 0, identities: 0 });
	assert.equal(report.staleReviewRejected, true); assert.equal(report.orderedShapeDriftRejected, true);
	assert.match(report.startupLeakBaseline, /__gmp_default_allocate/u);
	assert.match(report.startupLeakBaseline, /SUMMARY: AddressSanitizer: 128 byte\(s\) leaked in 12 allocation\(s\)\.\n$/u);
	assert.doesNotMatch(report.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:|suppression/iu);
	const actual = generated.layout.model.bindingIr;
	assert.deepEqual(actual.documentation, review.documentation);
	assert.deepEqual(actual.types.find(item => item.name === "Choice").cases, review.types.find(item => item.name === "Choice").cases);
	assert.equal(actual.declarations.find(item => item.name === "echoRecord").parameters[0].name, "bundle");
	const authoredCallback = review.types.find(item => item.kind === "callback");
	assert.equal(actual.types.find(item => item.id === authoredCallback.id).callable.parameters[0].name, "incoming");
	assert.ok(actual.declarations.find(item => item.name === "bundle").source.extensions["lean-lang.org/theorem-references"].includes("Owned.primary_bundle"));
	assert.notDeepEqual(actual.producers, review.producers);
	for(const input of Object.values(record.inputs))
	{
		const identity = input.sourceIdentity;
		assert.equal(identity.sourceTreeSha256, record.sources["tests/fixtures/onboarding/owned-aggregates/Owned.lean"]);
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].source.sha256, identity.sourceTreeSha256);
		assert.equal(identity.extractorSha256, record.sources["src/analyze/NativeExports.lean"]);
	}
	const changed = validateReviewedOwnedSource(record.inputs.shapeNegative.sourceIdentity.reviewedBindingIr);
	const original = structuredClone(review);
	original.types.find(item => item.name === "Choice").cases.reverse();
	assert.deepEqual(changed, original);
	assert.notEqual(record.inputs.shapeNegative.sourceIdentity.request.metadata.invocationIdentitySha256
		, input.sourceIdentity.request.metadata.invocationIdentitySha256);
	assert.throws(() => generateOwnedAggregateCarriers(record.inputs.shapeNegative), { code: "reviewed-ir-source-mismatch" });
	const workflow = await source(".github/workflows/consumer-matrix.yml");
	const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/reviewed-owned-source.test.mjs";
	assert.ok(workflow.includes("          " + command + "\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	assert.ok(workflow.includes("test -s build/owned-aggregate-native/reviewed-public-c.json"));
	assert.ok(workflow.includes("            build/owned-aggregate-native/reviewed-public-c.json\n"));
};

/**
 * Preserve earlier installed receipts and verify the reversible source transition.
 *
 * @param record - Frozen integration record linked to the public C predecessor.
 */
export const assertOwnedReviewedIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-reviewed-projection-integration");
	assert.equal(record.baselineRevision, ownedReviewedBaseline); assert.deepEqual(record.scope, ownedReviewedScope);
	assert.equal(record.previous.path, ownedCHistoryPath);
	const previousText = await source(record.previous.path); assert.equal(sha256(previousText), record.previous.sha256);
	const previous = JSON.parse(previousText);
	assert.equal(record.execution.path, ownedReviewedExecutionPath);
	const execution = await source(record.execution.path); assert.equal(sha256(execution), record.execution.sha256);
	await assertOwnedReviewedExecution(JSON.parse(execution));
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedReviewedChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), ownedReviewedAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...ownedReviewedChangedPaths, ...ownedReviewedAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	const updates = new Map(record.updates.map(item => [item.path, item])), restored = {};
	for(const path of paths)
	{
		const current = await readFile(path); assert.equal(sha256(current), record.sourceHashes[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.currentSha256, record.sourceHashes[path]);
			restored[path] = reverseOwnedReviewedUpdate(current.toString("utf8"), update);
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
	assert.deepEqual(document, expected, "Only authenticated source digests may change");
	const cells = typeSurfaceCells(document, contracts); assert.deepEqual(cells, typeSurfaceCells(old, contracts));
	assert.deepEqual(record.inventory, { version: "0.107.0", installed: 4830, total: 6562, promoted: 0 });
	assert.equal(document.contractVersion, record.inventory.version);
	assert.equal(cells.length, record.inventory.total);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, record.inventory.installed);
	await assertOwnedCIntegration(previous);
};
