/**
 * Reverse the installed generic, implicit and instance signature completion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const signatureSpecializationCompletionHistoryPath
	= "docs/evidence/signature-specialization-completion-source-history-20261028.json";
export const signatureSpecializationCompletionPredecessor
	= "bb5235e37634d9744e9222e971ae769762a0ec44";
export const signatureSpecializationCompletionImplementation
	= "6cded5e9724bee0209b36c84cabdeaddb2373e75";
export const signatureSpecializationCompletionCommits = Object.freeze([
	"83fdd17a81fc6146d17f3830f9f53515d1c216a5"
	, "6cded5e9724bee0209b36c84cabdeaddb2373e75"
]);
export const signatureSpecializationCompletionChangedPaths = Object.freeze([
	".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "docs/type-surface.v1.json"
	, "scripts/run-generic-subtype-dotnet-ci.sh"
	, "scripts/run-generic-subtype-jvm-ci.sh"
	, "scripts/run-generic-subtype-perl-ci.sh"
	, "scripts/run-generic-subtype-php-ci.sh"
	, "scripts/run-generic-subtype-python-ci.sh"
	, "scripts/run-generic-subtype-ruby-ci.sh"
	, "scripts/run-generic-subtype-rust-ci.sh"
	, "scripts/run-generic-subtype-wit-ci.sh"
	, "tests/reviewed-specializations.test.mjs"
]);
export const signatureSpecializationCompletionImplementationAdditions
	= Object.freeze([
		"tests/fixtures/specialization-consumers/javascript.mjs"
		, "tests/helpers/signature-specialization-browser.mjs"
		, "tests/helpers/signature-specialization-php-wasm.mjs"
	]);
export const signatureSpecializationCompletionNormalizationPaths
	= signatureSpecializationCompletionChangedPaths;
export const signatureSpecializationCompletionAddedPaths = Object.freeze([
	"scripts/update-signature-specialization-completion-source-history.mjs"
	, "tests/helpers/signature-specialization-completion-source-history-tests.mjs"
	, "tests/helpers/signature-specialization-completion-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	signatureSpecializationCompletionHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseSignatureSpecializationCompletionUpdate = (
	source, update
) => {
	assert.ok(signatureSpecializationCompletionNormalizationPaths.includes(
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
 * Remove only the recognized installed-signature completion layer.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeSignatureSpecializationCompletionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !signatureSpecializationCompletionNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseSignatureSpecializationCompletionUpdate(source, update);
};
