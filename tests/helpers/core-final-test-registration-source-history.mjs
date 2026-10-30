/**
 * Preserve the final Core test-registration repair exposed by CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFinalTestRegistrationHistoryPath
	= "docs/evidence/core-final-test-registration-source-history-20261030.json";
export const coreFinalTestRegistrationPredecessor
	= "ac8422997bd3a5e97a9f3d19b1ba04b1b2547c86";
export const coreFinalTestRegistrationImplementation
	= "f3bab6f47848b3ad47bee990bc16c51d2f30d559";
export const coreFinalTestRegistrationTests = Object.freeze([
	"dependent-signature-complete-hosted-evidence"
	, "dependent-signature-complete-promotion"
	, "direct-proof-erasure-complete-hosted-evidence"
	, "direct-proof-erasure-complete-promotion"
	, "host-null-complete-hosted-evidence"
	, "host-null-complete-promotion"
	, "optional-parameter-complete-hosted-evidence"
	, "optional-parameter-complete-promotion"
	, "optional-parameter-installed-contract"
]);
export const coreFinalTestRegistrationPins = Object.freeze([
	Object.freeze({
		path: "src/adoption/test-profiles.mjs", count: 98
		, previous: "2e653130378811ecc6b556f208dc4118cb93845cd31bdce3b978c0fe25c63e08"
		, current: "885122af68ebbf3d736453265c5b6ef9b6b857844ae4d42981990af12daa2a06"
	})
	, Object.freeze({
		path: "tests/test-profiles.test.mjs", count: 4
		, previous: "76cae0966e206623d09a6738b0870fc5c41ad35dbb154b54cf56a7728afc54d2"
		, current: "45cceb2be9268b5f4e61e0094ce73e0d70784f827ad6b03b1429754a615cb441"
	})
]);
export const coreFinalTestRegistrationImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const coreFinalTestRegistrationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFinalTestRegistrationHistoryAdditions = Object.freeze([
	"scripts/update-core-final-test-registration-source-history.mjs"
	, "tests/helpers/core-final-test-registration-source-history-tests.mjs"
	, "tests/helpers/core-final-test-registration-source-history.mjs"
]);

const historyUrl = new URL(`../../${coreFinalTestRegistrationHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreFinalTestRegistrationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreFinalTestRegistrationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreFinalTestRegistrationImplementationPaths
	.includes(path) || coreFinalTestRegistrationIntegrationPaths.includes(path);

/**
 * Reverse one exact final-test registration transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreFinalTestRegistrationUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only the authenticated final-test registration repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreFinalTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFinalTestRegistrationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreFinalTestRegistrationUpdate(current, update);
	}
	return current;
};
