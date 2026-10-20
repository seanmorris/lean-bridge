/**
 * Authenticate the downstream Fin CI repair and the two historical
 * .gitattributes transitions needed for exact source reachability.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const downstreamFinCiRepairHistoryPath
	= "docs/evidence/downstream-fin-ci-repair-source-history-20261018.json";
export const downstreamFinCiRepairPredecessor
	= "0003ef0eb244df62ebcbec6f464f468af54db654";
export const downstreamFinCiRepairDraftParent
	= "0003ef0eb244df62ebcbec6f464f468af54db654";
export const downstreamFinCiRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "src/abi/component-structured-callables.mjs"
	, "src/abi/refinements.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/backends/javascript/copied-validators.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-fin-guards.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/component-refinement-mirrors-source-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-consumer-ci-repair-source-history-tests.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
]);
export const downstreamFinCiRepairAddedPaths = Object.freeze([
	"scripts/update-downstream-fin-ci-repair-history.mjs"
	, "tests/helpers/downstream-fin-ci-repair-source-history.mjs"
]);
export const downstreamFinCiRepairHistoricalPaths = Object.freeze([
	".gitattributes"
]);
export const downstreamFinCiRepairRerunEvidence = Object.freeze([
	"npm-callback-fin-installed", "npm-nominal-fin-installed"
]);
export const downstreamFinCiRepairPriorPinRepairs = Object.freeze([{
	path: "tests/perl-copied-graph-conversions.test.mjs"
	, previousSha256: "4864ffb7cfef8ee0d9b048f91bfaecc62b5c99105050362f40f51af4706de397"
	, currentSha256: "9f013a12ec3c380175b7ba751dac5206a73633633fd163265ae6de68a4c3926f"
}]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	downstreamFinCiRepairHistoryPath, "utf8"
));

const reverseEdits = (source, update) => {
	assert.equal(sha256(source), update.currentSha256);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256);
	return previous;
};

/**
 * Reverse one exact current-source transition from this repair.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseDownstreamFinCiRepairUpdate = (source, update) => {
	assert.ok(downstreamFinCiRepairChangedPaths.includes(update.path));
	return reverseEdits(source, update);
};

/**
 * Remove only this exact downstream CI repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDownstreamFinCiRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !downstreamFinCiRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDownstreamFinCiRepairUpdate(source, update)
		: source;
};

/**
 * Reverse the exact historical .gitattributes transitions at their required
 * position in the global source-history chain.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDownstreamFinCiRepairHistoricalSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !downstreamFinCiRepairHistoricalPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	for(const transition of record().historicalTransitions)
	{
		const update = transition.updates.find(item => item.path === path);
		if(update?.currentSha256 === sha256(source))
			source = reverseEdits(source, update);
		if(sha256(source) === expected) return source;
	}
	return source;
};
