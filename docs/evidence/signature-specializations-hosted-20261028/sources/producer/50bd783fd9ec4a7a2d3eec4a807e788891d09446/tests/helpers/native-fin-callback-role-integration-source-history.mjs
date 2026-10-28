/**
 * Reverse central registration of the authenticated native Fin callback-role history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeFinCallbackRoleIntegrationHistoryPath
	= "docs/evidence/native-fin-callback-role-integration-source-history-20261028.json";
export const nativeFinCallbackRoleIntegrationBase
	= "259856990af5be41f2bad2452ed4884c21737e23";
export const nativeFinCallbackRoleIntegrationImplementation
	= "4b1901e876c4cd57a197bf54ec8679c70979fb2e";
export const nativeFinCallbackRoleIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const nativeFinCallbackRoleIntegrationNormalizationPaths
	= nativeFinCallbackRoleIntegrationPaths;
export const nativeFinCallbackRoleIntegrationAddedPaths = Object.freeze([
	"scripts/update-native-fin-callback-role-integration-source-history.mjs"
	, "tests/helpers/native-fin-callback-role-integration-source-history-tests.mjs"
	, "tests/helpers/native-fin-callback-role-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nativeFinCallbackRoleIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseNativeFinCallbackRoleIntegrationUpdate = (
	source, update
) => {
	assert.ok(nativeFinCallbackRoleIntegrationPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeFinCallbackRoleIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nativeFinCallbackRoleIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseNativeFinCallbackRoleIntegrationUpdate(source, update);
};
