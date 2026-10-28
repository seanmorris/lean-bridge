/**
 * Preserve the exact owned-Subtype Perl archive source-path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePerlSourcePathRepairHistoryPath
	= "docs/evidence/owned-subtype-perl-source-path-repair-source-history-20261023.json";
export const ownedSubtypePerlSourcePathRepairPredecessor
	= "a07f85b3bbb884225bb82c09ec143dbebbac8d7e";
export const ownedSubtypePerlSourcePathRepairImplementation
	= "6a0be732bef0b931eea4f47005e1a3ae4a021023";
export const ownedSubtypePerlSourcePathRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-subtype-hosted-evidence-sources.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
]);
export const ownedSubtypePerlSourcePathRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
]);
export const ownedSubtypePerlSourcePathRepairNormalizationPaths
	= Object.freeze([...new Set([
		...ownedSubtypePerlSourcePathRepairModifiedPaths
		, ...ownedSubtypePerlSourcePathRepairIntegrationPaths
	])]);
export const ownedSubtypePerlSourcePathRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-perl-source-path-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-perl-source-path-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-perl-source-path-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePerlSourcePathRepairHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseOwnedSubtypePerlSourcePathRepairUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypePerlSourcePathRepairNormalizationPaths
		.includes(update.path));
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
 * Remove one recognized repair transition. The central hub owns stopping.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Exact digest whose stop is owned by the central hub.
 */
export const beforeOwnedSubtypePerlSourcePathRepairSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedSubtypePerlSourcePathRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedSubtypePerlSourcePathRepairUpdate(source, update);
};
