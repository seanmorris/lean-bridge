/**
 * Preserve the exact corpus sampler trap repair, the restored Performance build checkout, their workflow pin
 * refresh and their central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const corpusTrapBuildCheckoutRepairHistoryPath
	= "docs/evidence/corpus-trap-build-checkout-repair-source-history-20261029.json";
export const corpusTrapBuildCheckoutRepairPredecessor
	= "4a71d74462ff3fee62fe2e6d2f9e7d1a0389c19a";
export const corpusTrapBuildCheckoutRepairImplementation
	= "500857ee508f8d3b2193299c4e8853d9284518d4";
export const corpusTrapBuildCheckoutRepairWorkflowCommit
	= "86b0d14cfdd366113b08540bf4074f83a4b3bc0d";
export const corpusTrapBuildCheckoutRepairCommits = Object.freeze([
	corpusTrapBuildCheckoutRepairWorkflowCommit
	, corpusTrapBuildCheckoutRepairImplementation
]);
// The Performance build job checkout returns to these bytes, last committed before the sparse repair.
export const corpusTrapBuildCheckoutRepairBuildBaseline
	= "e8ac811e6b6b4d320fcd0fe44e5d021bae340c9e";
export const corpusTrapBuildCheckoutRepairTypeSurfacePath = "docs/type-surface.v1.json";
export const corpusTrapBuildCheckoutRepairCorpusWorkflowPath = ".github/workflows/consumer-matrix.yml";
export const corpusTrapBuildCheckoutRepairPerformanceWorkflowPath = ".github/workflows/performance.yml";
export const corpusTrapBuildCheckoutRepairTestPath = "tests/performance-reproducibility.test.mjs";
export const corpusTrapBuildCheckoutRepairPinCounts = Object.freeze({
	[corpusTrapBuildCheckoutRepairCorpusWorkflowPath]: 92
	, [corpusTrapBuildCheckoutRepairPerformanceWorkflowPath]: 1
});
export const corpusTrapBuildCheckoutRepairSourcePaths = Object.freeze([
	corpusTrapBuildCheckoutRepairCorpusWorkflowPath
	, corpusTrapBuildCheckoutRepairPerformanceWorkflowPath
	, corpusTrapBuildCheckoutRepairTestPath
]);
export const corpusTrapBuildCheckoutRepairImplementationPaths = Object.freeze([
	corpusTrapBuildCheckoutRepairCorpusWorkflowPath
	, corpusTrapBuildCheckoutRepairPerformanceWorkflowPath
	, corpusTrapBuildCheckoutRepairTypeSurfacePath
	, corpusTrapBuildCheckoutRepairTestPath
]);
export const corpusTrapBuildCheckoutRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const corpusTrapBuildCheckoutRepairNormalizationPaths = Object.freeze([
	...corpusTrapBuildCheckoutRepairImplementationPaths
	, ...corpusTrapBuildCheckoutRepairIntegrationPaths
]);
export const corpusTrapBuildCheckoutRepairAddedPaths = Object.freeze([
	"scripts/update-corpus-trap-build-checkout-repair-source-history.mjs"
	, "tests/helpers/corpus-trap-build-checkout-repair-source-history-tests.mjs"
	, "tests/helpers/corpus-trap-build-checkout-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	corpusTrapBuildCheckoutRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reverseCorpusTrapBuildCheckoutRepairUpdate = (source, update) => {
	assert.ok(corpusTrapBuildCheckoutRepairNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized trap and build checkout repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCorpusTrapBuildCheckoutRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !corpusTrapBuildCheckoutRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCorpusTrapBuildCheckoutRepairUpdate(current, update);
	}
	return current;
};
