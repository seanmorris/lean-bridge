/**
 * Preserve the complete public-pin follow-up to the release-gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseGateSitePinHistoryPath
	= "docs/evidence/vo1220-release-gate-site-pin-source-history-20261112.json";
export const vo1220ReleaseGateSitePinPredecessor
	= "029b27ff5b10a440595601a36fd3648dd0807732";
export const vo1220ReleaseGateSitePinImplementation
	= "1e56c203f7b25d8ccf3a17f164faa942382dd000";
export const vo1220ReleaseGateSitePinImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const vo1220ReleaseGateSitePinIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220ReleaseGateSitePinAddedPaths = Object.freeze([
	"scripts/update-vo1220-release-gate-site-pin-source-history.mjs"
	, "tests/helpers/vo1220-release-gate-site-pin-source-history-tests.mjs"
	, "tests/helpers/vo1220-release-gate-site-pin-source-history.mjs"
]);
export const vo1220ReleaseGateSitePinNormalizationPaths = Object.freeze([
	...vo1220ReleaseGateSitePinImplementationPaths
	, ...vo1220ReleaseGateSitePinIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseGateSitePinHistoryPath, "utf8"));

/**
 * Reverse one authenticated public-pin transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseGateSitePinUpdate = (source, update) => {
	assert.ok(vo1220ReleaseGateSitePinNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated public-pin follow-up.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseGateSitePinSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseGateSitePinNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ReleaseGateSitePinUpdate(current, update);
	}
	return current;
};
