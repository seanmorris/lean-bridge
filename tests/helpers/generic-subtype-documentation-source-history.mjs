/**
 * Preserve the exact handwritten generic-Subtype documentation renderer and
 * its live inventory pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeDocumentationHistoryPath
	= "docs/evidence/generic-subtype-documentation-source-history-20261023.json";
export const genericSubtypeDocumentationPredecessor
	= "f18361a76cc70d3f067c7d9c92459687274ba056";
export const genericSubtypeDocumentationImplementation
	= "8a09b61ae62d8ca84a6037522c88f1ecd55ec5d4";
export const genericSubtypeDocumentationModifiedPaths = Object.freeze([
	"scripts/promote-generic-subtype-evidence.mjs"
	, "tests/helpers/generic-subtype-promotion-tests.mjs"
]);
export const genericSubtypeDocumentationImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/generic-subtype-documentation.mjs"
	]);
export const genericSubtypeDocumentationImplementationPaths = Object.freeze([
	...genericSubtypeDocumentationModifiedPaths
	, ...genericSubtypeDocumentationImplementationAddedPaths
]);
export const genericSubtypeDocumentationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/generic-subtype-native-perl.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeDocumentationNormalizationPaths = Object.freeze([
	...new Set([
		...genericSubtypeDocumentationModifiedPaths
		, ...genericSubtypeDocumentationIntegrationPaths
	])
]);
export const genericSubtypeDocumentationHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-documentation-source-history.mjs"
	, "tests/helpers/generic-subtype-documentation-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-documentation-source-history.mjs"
]);
export const genericSubtypeDocumentationAddedPaths = Object.freeze([
	...genericSubtypeDocumentationImplementationAddedPaths
	, ...genericSubtypeDocumentationHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeDocumentationHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseGenericSubtypeDocumentationUpdate = (source, update) => {
	assert.ok(genericSubtypeDocumentationNormalizationPaths
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
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
 * Remove one authenticated documentation transition. A recognized update is
 * always reversed; the central hub owns milestone stop decisions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Exact digest whose stop is owned by the central hub.
 */
export const beforeGenericSubtypeDocumentationSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !genericSubtypeDocumentationNormalizationPaths.includes(path))
		return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeDocumentationUpdate(source, update);
};
