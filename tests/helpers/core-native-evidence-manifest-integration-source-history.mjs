/**
 * Reverse integration of the Core native evidence-manifest repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreNativeEvidenceManifestIntegrationHistoryPath
	= "docs/evidence/core-native-evidence-manifest-integration-source-history-20261028.json";
export const coreNativeEvidenceManifestIntegrationBase
	= "b43b2d1e8b1d1597643bc766842ec881aefb67ac";
export const coreNativeEvidenceManifestIntegrationImplementation
	= "6cbc45393cea3807fe12c5bbb446a7a7c59ce915";
export const coreNativeEvidenceManifestIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const coreNativeEvidenceManifestIntegrationNormalizationPaths
	= coreNativeEvidenceManifestIntegrationPaths;
export const coreNativeEvidenceManifestIntegrationAddedPaths = Object.freeze([
	"scripts/update-core-native-evidence-manifest-integration-source-history.mjs"
	, "tests/helpers/core-native-evidence-manifest-integration-source-history-tests.mjs"
	, "tests/helpers/core-native-evidence-manifest-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreNativeEvidenceManifestIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param {string} source - Complete current source.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreNativeEvidenceManifestIntegrationUpdate = (
	source, update
) => {
	assert.ok(coreNativeEvidenceManifestIntegrationPaths.includes(update.path));
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
 * Remove only the exact manifest integration transition.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeCoreNativeEvidenceManifestIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreNativeEvidenceManifestIntegrationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreNativeEvidenceManifestIntegrationUpdate(source, update);
};
