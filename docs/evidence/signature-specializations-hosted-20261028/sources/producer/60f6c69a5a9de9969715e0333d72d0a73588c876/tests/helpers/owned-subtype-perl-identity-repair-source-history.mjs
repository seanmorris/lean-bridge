/**
 * Reverse the exact owned-Subtype Perl identity-accounting repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePerlIdentityRepairHistoryPath
	= "docs/evidence/owned-subtype-perl-identity-repair-source-history-20261023.json";
export const ownedSubtypePerlIdentityRepairPredecessor
	= "55fd7fda672e0782c2ac71ca40af076952cc03ba";
export const ownedSubtypePerlIdentityRepairImplementation
	= "f9e9dadee8770a41c2d70403ef72d8ffb527877a";
export const ownedSubtypePerlIdentityRepairImplementationPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-perl-subtype.pl"
	, "tests/helpers/owned-subtype-hosted-ci.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
]);
export const ownedSubtypePerlIdentityRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const ownedSubtypePerlIdentityRepairChangedPaths = Object.freeze([
	...ownedSubtypePerlIdentityRepairImplementationPaths
	, ...ownedSubtypePerlIdentityRepairIntegrationPaths
]);
export const ownedSubtypePerlIdentityRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-perl-identity-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-perl-identity-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-perl-identity-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePerlIdentityRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypePerlIdentityRepairUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypePerlIdentityRepairChangedPaths.includes(update.path));
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
 * Remove only the owned-Subtype Perl identity-accounting repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypePerlIdentityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypePerlIdentityRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypePerlIdentityRepairUpdate(source, update) : source;
};
