/**
 * Reverse the generic-Subtype host-suite registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeTestRegistrationHistoryPath
	= "docs/evidence/generic-subtype-test-registration-source-history-20261021.json";
export const genericSubtypeTestRegistrationPredecessor
	= "7f155ee0f9748b2e159cd9b833e0aa5395ee70a7";
export const genericSubtypeTestRegistrationImplementation
	= "f6e4ec820e4512937bfb857edad47e225097ac78";
export const genericSubtypeTestRegistrationAddedTests = Object.freeze([
	"generic-subtype-languages"
	, "generic-subtype-managed-wit"
	, "generic-subtype-native-perl"
]);
export const genericSubtypeTestRegistrationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
]);
export const genericSubtypeTestRegistrationIntegrationPaths = Object.freeze([
	"tests/generic-subtype-managed-wit.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeTestRegistrationHistoryPath, "utf8"));

/**
 * Restore one authenticated registration transition.
 *
 * @param source - Complete source at the transition endpoint.
 * @param update - Authenticated transition record.
 */
export const reverseGenericSubtypeTestRegistrationUpdate = (source, update) => {
	assert.ok([...genericSubtypeTestRegistrationChangedPaths
		, ...genericSubtypeTestRegistrationIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact registration layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeTestRegistrationSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...genericSubtypeTestRegistrationChangedPaths
		, ...genericSubtypeTestRegistrationIntegrationPaths].includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseGenericSubtypeTestRegistrationUpdate(source, update) : source;
};
