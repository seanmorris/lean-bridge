/**
 * Authenticate the owned checked-record semantic join and its registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedSemanticAuditHistoryPath
	= "docs/evidence/owned-checked-record-semantic-audit-source-history-20261026.json";
export const ownedCheckedSemanticAuditPredecessor
	= "5d21a53e63676c6844639e41f86d5a8084563e00";
export const ownedCheckedSemanticAuditImplementation
	= "c2939439e1d73ada29ac2a44f2b21b868f9bcdad";
export const ownedCheckedSemanticAuditIntegrationBase
	= ownedCheckedSemanticAuditImplementation;
export const ownedCheckedSemanticAuditChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
]);
export const ownedCheckedSemanticAuditImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-record-semantic-audit-20261026.json"
	, "scripts/check-owned-checked-record-semantics.mjs"
	, "tests/helpers/owned-checked-record-semantic-audit-tests.mjs"
	, "tests/helpers/owned-checked-record-semantic-audit.mjs"
]);
export const ownedCheckedSemanticAuditImplementationPaths = Object.freeze([
	...ownedCheckedSemanticAuditChangedPaths
	, ...ownedCheckedSemanticAuditImplementationAddedPaths
]);
export const ownedCheckedSemanticAuditIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedSemanticAuditNormalizationPaths = Object.freeze([
	...new Set([
		...ownedCheckedSemanticAuditChangedPaths
		, ...ownedCheckedSemanticAuditIntegrationPaths
	])
]);
export const ownedCheckedSemanticAuditHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-semantic-audit-source-history.mjs"
	, "tests/helpers/owned-checked-record-semantic-audit-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-semantic-audit-source-history.mjs"
]);
export const ownedCheckedSemanticAuditAddedPaths = Object.freeze([
	...ownedCheckedSemanticAuditImplementationAddedPaths
	, ...ownedCheckedSemanticAuditHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedSemanticAuditHistoryPath, "utf8"
));

/**
 * Reverse one exact semantic-audit transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated source transition.
 */
export const reverseOwnedCheckedSemanticAuditUpdate = (source, update) => {
	assert.ok(ownedCheckedSemanticAuditNormalizationPaths.includes(update.path));
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
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only authenticated semantic-audit transitions, newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedSemanticAuditSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedCheckedSemanticAuditNormalizationPaths.includes(path)) return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedSemanticAuditUpdate(current, update);
	}
	return current;
};
