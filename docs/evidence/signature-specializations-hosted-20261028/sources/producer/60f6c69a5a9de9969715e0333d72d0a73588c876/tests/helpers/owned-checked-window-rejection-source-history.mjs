/**
 * Authenticate nested copied-record rejection coverage without changing runtime or support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedWindowRejectionHistoryPath
	= "docs/evidence/owned-checked-window-rejection-source-history-20261025.json";
export const ownedCheckedWindowRejectionPredecessor
	= "45af94285dfe9bd819997bbbcfae3d9b512393e4";
export const ownedCheckedWindowRejectionImplementation
	= "e379b33e15d353e0b1ab257d924906877b78551c";
export const ownedCheckedWindowRejectionIntegrationBase
	= "e379b33e15d353e0b1ab257d924906877b78551c";
export const ownedCheckedWindowRejectionCommits = Object.freeze([
	"e379b33e15d353e0b1ab257d924906877b78551c"
]);
export const ownedCheckedWindowRejectionChangedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-checked-record-installed.c"
	, "tests/fixtures/structured-types/owned-checked-record-installed.cpp"
	, "tests/fixtures/structured-types/owned-checked-record-installed.pl"
	, "tests/fixtures/structured-types/owned-checked-record-python.py"
	, "tests/fixtures/structured-types/owned-checked-record-ruby.rb"
	, "tests/fixtures/structured-types/owned-checked-record-rust.rs"
]);
export const ownedCheckedWindowRejectionImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-window-rejection-20261025.json"
]);
export const ownedCheckedWindowRejectionImplementationPaths = Object.freeze([
	...ownedCheckedWindowRejectionChangedPaths
	, ...ownedCheckedWindowRejectionImplementationAddedPaths
]);
export const ownedCheckedWindowRejectionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedWindowRejectionNormalizationPaths = Object.freeze([
	...ownedCheckedWindowRejectionChangedPaths
	, ...ownedCheckedWindowRejectionIntegrationPaths
]);
export const ownedCheckedWindowRejectionHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-window-rejection-source-history.mjs"
	, "tests/helpers/owned-checked-window-rejection-source-history-tests.mjs"
	, "tests/helpers/owned-checked-window-rejection-source-history.mjs"
]);
export const ownedCheckedWindowRejectionAddedPaths = Object.freeze([
	...ownedCheckedWindowRejectionImplementationAddedPaths
	, ...ownedCheckedWindowRejectionHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedWindowRejectionHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedWindowRejectionUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedWindowRejectionNormalizationPaths
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
 * Remove only the exact Owned checked window rejection.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedWindowRejectionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedWindowRejectionNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedWindowRejectionUpdate(current, update);
	}
	return current;
};
