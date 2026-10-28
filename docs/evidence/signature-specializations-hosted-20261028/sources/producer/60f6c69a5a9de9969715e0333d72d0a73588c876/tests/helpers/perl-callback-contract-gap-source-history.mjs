/**
 * Restore the Perl callback contract transition from 18804049, which no
 * history record carried. The original completed and variant receipts both pin
 * the predecessor version of this contract helper.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCallbackContractGapHistoryPath
	= "docs/evidence/perl-callback-contract-gap-source-history-20261024.json";
export const perlCallbackContractGapPredecessor
	= "ffb893c7e1ab6e1b90f5c8aab323c58947dd985c";
export const perlCallbackContractGapHistoricalPredecessor
	= "308fc6a50dfb37e00e2f97f61c2a7d43efdb68c5";
export const perlCallbackContractGapHistoricalCommit
	= "18804049b371cfe17eaec867c0365fb4b47b8152";
export const perlCallbackContractGapHistoricalPaths = Object.freeze([
	"tests/helpers/owned-perl-callback-result-contract-tests.mjs"
]);
export const perlCallbackContractGapNormalizationPaths
	= perlCallbackContractGapHistoricalPaths;
export const perlCallbackContractGapAddedPaths = Object.freeze([
	"scripts/update-perl-callback-contract-gap-source-history.mjs"
	, "tests/helpers/perl-callback-contract-gap-source-history-tests.mjs"
	, "tests/helpers/perl-callback-contract-gap-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlCallbackContractGapHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reversePerlCallbackContractGapUpdate = (source, update) => {
	assert.ok(perlCallbackContractGapNormalizationPaths.includes(update.path));
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
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized historical transition, stopping at an explicitly
 * requested endpoint and preserving unknown bytes.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforePerlCallbackContractGapSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !perlCallbackContractGapNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().historicalTransitions
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePerlCallbackContractGapUpdate(source, update);
};
