/**
 * Reverse the dependent generic-Subtype recurring-CI transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentGenericSubtypeCiHistoryPath
	= "docs/evidence/dependent-generic-subtype-ci-source-history-20261021.json";
export const dependentGenericSubtypeCiPredecessor
	= "67178c2c8c24323bd5cdb305da630b6f2e0a5c61";
export const dependentGenericSubtypeCiImplementation
	= "01aad0d0f089e3a255a9d6d74227815538a4d14f";
export const dependentGenericSubtypeCiChangedPaths = Object.freeze([
	".github/workflows/generic-subtype-native-perl.yml"
]);
export const dependentGenericSubtypeCiIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentGenericSubtypeCiHistoryPath, "utf8"));

/**
 * Restore one authenticated recurring-CI transition.
 *
 * @param source - Complete source at the transition endpoint.
 * @param update - Authenticated transition record.
 */
export const reverseDependentGenericSubtypeCiUpdate = (source, update) => {
	assert.ok([...dependentGenericSubtypeCiChangedPaths
		, ...dependentGenericSubtypeCiIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the exact dependent generic-Subtype CI layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentGenericSubtypeCiSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...dependentGenericSubtypeCiChangedPaths
		, ...dependentGenericSubtypeCiIntegrationPaths].includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentGenericSubtypeCiUpdate(source, update) : source;
};
