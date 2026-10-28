/**
 * Reverse central registration of the installed-signature completion history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionIntegrationHistoryPath
	= "docs/evidence/signature-specialization-completion-integration-source-history-20261028.json";
export const signatureSpecializationCompletionIntegrationBase
	= "d1f4a7a74a1ca63c173f8f2abf3eb25ea03c9e59";
export const signatureSpecializationCompletionIntegrationImplementation
	= "e1d1439a8dced0e01e9ac935abcdc2854a83374c";
export const signatureSpecializationCompletionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const signatureSpecializationCompletionIntegrationNormalizationPaths
	= signatureSpecializationCompletionIntegrationPaths;
export const signatureSpecializationCompletionIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-signature-specialization-completion-integration-source-history.mjs"
		, "tests/helpers/signature-specialization-completion-integration-source-history-tests.mjs"
		, "tests/helpers/signature-specialization-completion-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated central-integration transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionIntegrationUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationCompletionIntegrationPaths.includes(
		update.path));
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
 * Remove only this exact central integration layer.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationCompletionIntegrationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationCompletionIntegrationUpdate(
			source, update);
};
