/**
 * Preserve the Perl supplemental Subtype result-projection repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlRefinementResultProjectionRepairHistoryPath
	= "docs/evidence/perl-refinement-result-projection-repair-source-history-20261107.json";
export const perlRefinementResultProjectionRepairPredecessor
	= "56eb7eccc9fdb014ed6f6beb097e16c36b47c5be";
export const perlRefinementResultProjectionRepairImplementation
	= "5a61df8dca4cff28190a77159ab4f301dd981c61";
export const perlRefinementResultProjectionRepairImplementationPaths
	= Object.freeze(["tests/perl-refinements.test.mjs"]);
export const perlRefinementResultProjectionRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const perlRefinementResultProjectionRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-perl-refinement-result-projection-repair-source-history.mjs"
		, "tests/helpers/perl-refinement-result-projection-repair-source-history-tests.mjs"
		, "tests/helpers/perl-refinement-result-projection-repair-source-history.mjs"
	]);
export const perlRefinementResultProjectionRepairMarkers = Object.freeze({
	current: Object.freeze([
		"const projected = { ownership: \"copy\", lifetime: null };"
		, "\"PerlRefinements.wrap32\": { parameters: [plain], result: projected }"
		, "\"PerlRefinements.wrap32\": { parameters: [null], result: { ...checked, constructor: null } }"
		, "test(\"Lean-produced Perl Subtype results project their base without an input constructor\""
		, "assert.deepEqual(perlRefinementContracts[\"PerlRefinements.wrap32\"].result, projected);"
		, "assert.deepEqual(perlRefinementRefinements[\"PerlRefinements.wrap32\"].result, { kind: \"subtype\", constructor: null });"
	])
	, previous: Object.freeze([
		"\"PerlRefinements.wrap32\": { parameters: [plain], result: site(\"PerlRefinements.checkedDigit32\") }"
		, "\"PerlRefinements.wrap32\": { parameters: [null], result: checked }"
	])
});
export const perlRefinementResultProjectionRepairBehavior = Object.freeze({
	projectedResults: 1, regressionAssertions: 2, livePinRefreshes: 0
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + perlRefinementResultProjectionRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const perlRefinementResultProjectionRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: perlRefinementResultProjectionRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...perlRefinementResultProjectionRepairImplementationPaths
	, ...perlRefinementResultProjectionRepairIntegrationPaths
].includes(path);
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Bind the constructor-free produced result and its cheap regression control.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertPerlRefinementResultProjectionRepair = sources => {
	const path = "tests/perl-refinements.test.mjs";
	const source = sources[path];
	assert.equal(typeof source, "string", path);
	for(const marker of perlRefinementResultProjectionRepairMarkers.current)
		assert.equal(count(source, marker), 1, marker);
	for(const marker of perlRefinementResultProjectionRepairMarkers.previous)
		assert.equal(count(source, marker), 0, marker);
	return { ...perlRefinementResultProjectionRepairBehavior };
};

/**
 * Reverse one authenticated Perl result-projection transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePerlRefinementResultProjectionRepairUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only authenticated Perl result-projection transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePerlRefinementResultProjectionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlRefinementResultProjectionRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePerlRefinementResultProjectionRepairUpdate(
				current, update);
	}
	return current;
};
