/**
 * Reverse the Core native-specialization sparse-evidence manifest repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreNativeEvidenceManifestHistoryPath
	= "docs/evidence/core-native-evidence-manifest-source-history-20261028.json";
export const coreNativeEvidenceManifestPredecessor
	= "a0a3ca7fc6d46b57df6f4a55411c2896abe39851";
export const coreNativeEvidenceManifestImplementation
	= "d18a3b88a56f15b429976ffef125e72a1b22e1be";
export const coreNativeEvidenceManifestPaths = Object.freeze([
	"tests/helpers/core-contract-evidence-tests.mjs"
	, "tests/helpers/native-specialization-closure.mjs"
]);
export const coreNativeEvidenceManifestNormalizationPaths
	= coreNativeEvidenceManifestPaths;
export const coreNativeEvidenceManifestAddedPaths = Object.freeze([
	"scripts/update-core-native-evidence-manifest-source-history.mjs"
	, "tests/helpers/core-native-evidence-manifest-source-history-tests.mjs"
	, "tests/helpers/core-native-evidence-manifest-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreNativeEvidenceManifestHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated manifest repair.
 *
 * @param {string} source - Complete current source.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreNativeEvidenceManifestUpdate = (source, update) => {
	assert.ok(coreNativeEvidenceManifestPaths.includes(update.path));
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
 * Remove only the exact manifest repair transition.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeCoreNativeEvidenceManifestSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreNativeEvidenceManifestPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreNativeEvidenceManifestUpdate(source, update);
};
