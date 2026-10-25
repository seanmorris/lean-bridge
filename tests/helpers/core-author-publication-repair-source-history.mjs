/**
 * Authenticate the Core author-publication repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreAuthorPublicationRepairHistoryPath
	= "docs/evidence/core-author-publication-repair-source-history-20261025.json";
export const coreAuthorPublicationRepairPredecessor
	= "f52e87af22c65d21c526c2b7fe58a9c7fe3c8ea8";
export const coreAuthorPublicationRepairImplementation
	= "d8980f1026e9e021ef87d880f36163ad42a71582";
export const coreAuthorPublicationRepairIntegrationBase
	= "d8980f1026e9e021ef87d880f36163ad42a71582";
export const coreAuthorPublicationRepairCommits = Object.freeze([
	"d8980f1026e9e021ef87d880f36163ad42a71582"
]);
export const coreAuthorPublicationRepairChangedPaths = Object.freeze([
	"tests/helpers/author-refinement-consistency-tests.mjs"
	, "tests/lean-author-documentation.test.mjs"
]);
export const coreAuthorPublicationRepairImplementationAddedPaths = Object.freeze([
	"docs/evidence/core-author-publication-repair-20261025/acceptance.json"
	, "docs/evidence/core-author-publication-repair-20261025/author.tap"
	, "docs/evidence/core-author-publication-repair-20261025/diagnostics.json"
	, "docs/evidence/core-author-publication-repair-20261025/owned-publication.tap"
	, "docs/evidence/core-author-publication-repair-20261025/probe-publication.tap"
	, "docs/evidence/core-author-publication-repair-20261025/reproduction.tap"
]);
export const coreAuthorPublicationRepairImplementationPaths = Object.freeze([
	...coreAuthorPublicationRepairChangedPaths
	, ...coreAuthorPublicationRepairImplementationAddedPaths
]);
export const coreAuthorPublicationRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreAuthorPublicationRepairNormalizationPaths = Object.freeze([
	...coreAuthorPublicationRepairChangedPaths
	, ...coreAuthorPublicationRepairIntegrationPaths
]);
export const coreAuthorPublicationRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-author-publication-repair-source-history.mjs"
	, "tests/helpers/core-author-publication-repair-source-history-tests.mjs"
	, "tests/helpers/core-author-publication-repair-source-history.mjs"
]);
export const coreAuthorPublicationRepairAddedPaths = Object.freeze([
	...coreAuthorPublicationRepairImplementationAddedPaths
	, ...coreAuthorPublicationRepairHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreAuthorPublicationRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreAuthorPublicationRepairUpdate = (
	source, update
) => {
	assert.ok(coreAuthorPublicationRepairNormalizationPaths
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
 * Remove only the exact Core author-publication repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreAuthorPublicationRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreAuthorPublicationRepairNormalizationPaths.includes(path))
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
		current = reverseCoreAuthorPublicationRepairUpdate(current, update);
	}
	return current;
};
