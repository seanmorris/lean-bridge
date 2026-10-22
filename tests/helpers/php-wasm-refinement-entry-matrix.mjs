/**
 * Closed cross-lane topology for PHP-Wasm refinement entry promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	phpWasmCallbackEntryFamilies, phpWasmCallbackEntryRoutes
} from "./php-wasm-callback-entry-source-fixtures.mjs";
import {
	phpWasmIndexedRefinementEntryFamilies
} from "./php-wasm-indexed-refinement-entry-fixtures.mjs";
import {
	phpWasmOwnedRefinementEntryFamilies
	, phpWasmOwnedRefinementEntryRoutes
} from "./php-wasm-owned-refinement-entry-fixtures.mjs";
import {
	phpWasmRefinementEntryRoutes, phpWasmRefinementEntrySourceFamilies
} from "./php-wasm-refinement-entry-source-fixtures.mjs";

assert.deepEqual(phpWasmCallbackEntryRoutes, phpWasmRefinementEntryRoutes);
assert.deepEqual(phpWasmOwnedRefinementEntryRoutes, phpWasmRefinementEntryRoutes);

const copiedFamilies = phpWasmRefinementEntrySourceFamilies
	.filter(family => !phpWasmIndexedRefinementEntryFamilies.includes(family));
assert.deepEqual(copiedFamilies, [
	"nominal-full", "nominal-result-only"
	, "recursive-subtype", "recursive-checked-record"
]);

const groups = Object.freeze([
	Object.freeze({
		kind: "copied", ownerNode: 1824
		, workflow: "php-wasm-refinement-entry"
		, artifactPrefix: "php-wasm-refinement-entry"
		, families: Object.freeze(copiedFamilies)
	})
	, Object.freeze({
		kind: "owned", ownerNode: 1825
		, workflow: "php-wasm-owned-refinement-entry"
		, artifactPrefix: "php-wasm-owned-refinement-entry"
		, families: phpWasmOwnedRefinementEntryFamilies
	})
	, Object.freeze({
		kind: "callback", ownerNode: 1826
		, workflow: "php-wasm-callback-entry"
		, artifactPrefix: "php-wasm-callback-entry"
		, families: phpWasmCallbackEntryFamilies
	})
	, Object.freeze({
		kind: "indexed", ownerNode: 1827
		, workflow: "php-wasm-indexed-refinement-entry"
		, artifactPrefix: "php-wasm-indexed-refinement-entry"
		, families: phpWasmIndexedRefinementEntryFamilies
	})
]);

const cell = (group, family, route) => Object.freeze({
	id: `${group.kind}/${family}/${route}`
	, kind: group.kind, family, route
	, ownerNode: group.ownerNode, workflow: group.workflow
	, artifactPrefix: group.artifactPrefix
	, checker: group.kind === "callback" ? "callback" : "entry"
	, recordPath: group.kind === "callback"
		? `${family}/${route}` : `${route}/${family}`
});

export const phpWasmRefinementEntryMatrix = Object.freeze(groups.flatMap(group =>
	group.families.flatMap(family => phpWasmRefinementEntryRoutes.map(route =>
		cell(group, family, route)))));

const exact = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields`);
};
const positive = (value, label) => assert.ok(Number.isSafeInteger(value)
	&& value > 0, label);
const nonnegative = (value, label) => assert.ok(Number.isSafeInteger(value)
	&& value >= 0, label);
const producer = value => assert.match(value, /^[a-f0-9]{40}$/u);

/**
 * Resolve exact artifact and record identities for one producer revision.
 *
 * @param item - Closed matrix cell.
 * @param producerCommit - Full producer Git revision.
 */
export const phpWasmRefinementEntryMatrixLocation = (item, producerCommit) => {
	assert.ok(phpWasmRefinementEntryMatrix.includes(item));
	producer(producerCommit);
	const suffix = item.kind === "callback"
		? `${item.family}-${producerCommit}`
		: `${item.family}-${item.route}-${producerCommit}`;
	return Object.freeze({
		artifact: `${item.artifactPrefix}-${suffix}`
		, workflow: `.github/workflows/${item.workflow}.yml`
		, recordPath: item.recordPath
		, checkPath: `${item.recordPath}.check.json`
	});
};

const checkEntryResult = (cell_, result, producerCommit) => {
	exact(result, [
		"schemaVersion", "family", "route", "producerCommit"
		, "records", "executions", "calls", "counts"
	], `${cell_.id} entry result`);
	assert.equal(result.schemaVersion, 1);
	assert.equal(result.family, cell_.family); assert.equal(result.route, cell_.route);
	assert.equal(result.producerCommit, producerCommit);
	positive(result.records, `${cell_.id} records`);
	assert.equal(result.executions, 12);
	positive(result.calls, `${cell_.id} calls`);
	exact(result.counts, ["validator", "constructor", "adapter", "source"]
		, `${cell_.id} counts`);
	for(const [name, value] of Object.entries(result.counts))
		nonnegative(value, `${cell_.id} ${name}`);
};

const checkCallbackResult = (cell_, result, producerCommit) => {
	exact(result, [
		"schemaVersion", "family", "route", "producerCommit"
		, "records", "executions", "controls"
	], `${cell_.id} callback result`);
	assert.equal(result.schemaVersion, 1);
	assert.equal(result.family, cell_.family); assert.equal(result.route, cell_.route);
	assert.equal(result.producerCommit, producerCommit);
	positive(result.records, `${cell_.id} records`);
	assert.equal(result.executions, 12);
	positive(result.controls, `${cell_.id} controls`);
};

/**
 * Close the ordered results supplied by every independent per-cell verifier.
 * This consistency gate rejects a missing, reordered or widened selection; the
 * hosted artifact summary reruns the verifiers over retained bytes first.
 *
 * @param producerCommit - Full common producer revision.
 * @param observations - Ordered per-cell verifier outputs and archive locations.
 */
export const checkPhpWasmRefinementEntryMatrix = (
	producerCommit, observations
) => {
	producer(producerCommit);
	assert.ok(Array.isArray(observations));
	assert.equal(observations.length, phpWasmRefinementEntryMatrix.length);
	const artifacts = new Set(), workflows = new Set();
	let records = 0, executions = 0, calls = 0, controls = 0;
	for(const [index, item] of observations.entries())
	{
		const expected = phpWasmRefinementEntryMatrix[index];
		exact(item, [
			"cell", "artifact", "workflow", "recordPath", "checkPath", "result"
		]
		, `matrix observation ${index}`);
		assert.equal(item.cell, expected.id);
		const location = phpWasmRefinementEntryMatrixLocation(expected, producerCommit);
		assert.equal(item.artifact, location.artifact);
		assert.equal(item.workflow, location.workflow);
		assert.equal(item.recordPath, location.recordPath);
		assert.equal(item.checkPath, location.checkPath);
		if(expected.checker === "callback")
		{
			checkCallbackResult(expected, item.result, producerCommit);
			controls += item.result.controls;
		}
		else
		{
			checkEntryResult(expected, item.result, producerCommit);
			calls += item.result.calls;
		}
		records += item.result.records; executions += item.result.executions;
		artifacts.add(item.artifact); workflows.add(item.workflow);
	}
	assert.equal(artifacts.size, 26
		, "callback routes intentionally share one family artifact");
	assert.equal(workflows.size, 4);
	return Object.freeze({
		schemaVersion: 1, scope: "separate-instrumented-probe", producerCommit
		, cells: observations.length, artifacts: artifacts.size
		, workflows: workflows.size, records, executions, calls, controls
	});
};
