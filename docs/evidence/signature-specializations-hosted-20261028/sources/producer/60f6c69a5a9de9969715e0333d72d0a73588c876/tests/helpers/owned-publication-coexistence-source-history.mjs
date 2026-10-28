/**
 * Authenticate coexistence of separately accepted owned publications.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedPublicationCoexistenceHistoryPath
	= "docs/evidence/owned-publication-coexistence-source-history-20261025.json";
export const ownedPublicationCoexistencePredecessor
	= "ac83585983bda8b424224e7470d77d6faea9908f";
export const ownedPublicationCoexistenceImplementation
	= "aceaf8286737091de930baf44c6c872d3ac93e66";
export const ownedPublicationCoexistenceIntegrationBase
	= "aceaf8286737091de930baf44c6c872d3ac93e66";
export const ownedPublicationCoexistenceCommits = Object.freeze([
	"aceaf8286737091de930baf44c6c872d3ac93e66"
]);
export const ownedPublicationCoexistenceChangedPaths = Object.freeze([
	"tests/helpers/owned-checked-record-published-matrix-tests.mjs"
]);
export const ownedPublicationCoexistenceImplementationAddedPaths = Object.freeze([]);
export const ownedPublicationCoexistenceImplementationPaths = Object.freeze([
	...ownedPublicationCoexistenceChangedPaths
	, ...ownedPublicationCoexistenceImplementationAddedPaths
]);
export const ownedPublicationCoexistenceIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedPublicationCoexistenceNormalizationPaths = Object.freeze([
	...ownedPublicationCoexistenceChangedPaths
	, ...ownedPublicationCoexistenceIntegrationPaths
]);
export const ownedPublicationCoexistenceHistoryAddedPaths = Object.freeze([
	"docs/evidence/owned-publication-coexistence-20261025.json"
	, "scripts/update-owned-publication-coexistence-source-history.mjs"
	, "tests/helpers/owned-publication-coexistence-source-history-tests.mjs"
	, "tests/helpers/owned-publication-coexistence-source-history.mjs"
]);
export const ownedPublicationCoexistenceAddedPaths = Object.freeze([
	...ownedPublicationCoexistenceImplementationAddedPaths
	, ...ownedPublicationCoexistenceHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedPublicationCoexistenceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedPublicationCoexistenceUpdate = (
	source, update
) => {
	assert.ok(ownedPublicationCoexistenceNormalizationPaths
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
 * Reverse only the authenticated publication-baseline repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedPublicationCoexistenceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedPublicationCoexistenceNormalizationPaths.includes(path))
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
		current = reverseOwnedPublicationCoexistenceUpdate(current, update);
	}
	return current;
};
