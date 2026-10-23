/**
 * Reverse the callback Subtype documentation-readiness transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeDocumentationReadinessHistoryPath
	= "docs/evidence/callback-subtype-documentation-readiness-source-history-20261022.json";
export const callbackSubtypeDocumentationReadinessPredecessor
	= "1ffffd2c385d695dd862fe43b60d6de74d054769";
export const callbackSubtypeDocumentationReadinessImplementation
	= "9c86c096fe3c3f457c0175b0ff3fca641d2b44e5";
export const callbackSubtypeDocumentationReadinessCommits = Object.freeze([
	"4ba6bf439f8dbed3fe362f805effabc4d2b9328b"
	, callbackSubtypeDocumentationReadinessImplementation
]);
export const callbackSubtypeDocumentationReadinessImplementationPaths
	= Object.freeze([
		"scripts/generate-type-docs.mjs"
		, "scripts/promote-callback-subtype-evidence.mjs"
		, "tests/callback-subtype-promotion.test.mjs"
		, "tests/helpers/callback-subtype-documentation.mjs"
	]);
export const callbackSubtypeDocumentationReadinessModifiedPaths
	= Object.freeze([
		"scripts/generate-type-docs.mjs"
		, "scripts/promote-callback-subtype-evidence.mjs"
		, "tests/callback-subtype-promotion.test.mjs"
	]);
export const callbackSubtypeDocumentationReadinessIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackSubtypeDocumentationReadinessChangedPaths
	= Object.freeze([
		...callbackSubtypeDocumentationReadinessModifiedPaths
		, ...callbackSubtypeDocumentationReadinessIntegrationPaths
	]);
export const callbackSubtypeDocumentationReadinessAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-documentation-readiness-source-history.mjs"
	, "tests/helpers/callback-subtype-documentation.mjs"
	, "tests/helpers/callback-subtype-documentation-readiness-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-documentation-readiness-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeDocumentationReadinessHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeDocumentationReadinessUpdate
	= (source, update) => {
		assert.ok(callbackSubtypeDocumentationReadinessChangedPaths
			.includes(update.path));
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
 * Remove only the exact callback Subtype documentation-readiness transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeDocumentationReadinessSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeDocumentationReadinessChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeDocumentationReadinessUpdate(source, update)
		: source;
};
