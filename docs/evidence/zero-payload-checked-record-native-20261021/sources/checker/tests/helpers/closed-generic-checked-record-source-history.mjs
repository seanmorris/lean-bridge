/**
 * Authenticate the extractor correction that preserves the concrete record
 * behind a closed generic checked-record alias.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const closedGenericCheckedRecordHistoryPath
	= "docs/evidence/closed-generic-checked-record-source-history-20261017.json";
export const closedGenericCheckedRecordPredecessor
	= "cfb5534b43e62a6459f65638edd55af415b27263";
export const closedGenericCheckedRecordChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/analyze/NativeExports.lean"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	closedGenericCheckedRecordHistoryPath, "utf8"
));

/**
 * Reverse one complete, exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated replacement transition.
 */
export const reverseClosedGenericCheckedRecordUpdate = (source, update) => {
	assert.ok(closedGenericCheckedRecordChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.replacements) && update.replacements.length > 0);
	for(const replacement of [...update.replacements].reverse())
	{
		assert.equal(typeof replacement.previous, "string");
		assert.equal(typeof replacement.current, "string");
		assert.notEqual(replacement.previous, replacement.current);
		assert.ok(Number.isSafeInteger(replacement.count) && replacement.count > 0);
		assert.equal(source.split(replacement.current).length - 1
			, replacement.count, update.path);
		source = source.replaceAll(replacement.current, replacement.previous);
	}
	assert.equal(sha256(source), update.previousSha256, update.path);
	return source;
};

/**
 * Remove only this correction at its exact recorded source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeClosedGenericCheckedRecordSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !closedGenericCheckedRecordChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseClosedGenericCheckedRecordUpdate(source, update) : source;
};
