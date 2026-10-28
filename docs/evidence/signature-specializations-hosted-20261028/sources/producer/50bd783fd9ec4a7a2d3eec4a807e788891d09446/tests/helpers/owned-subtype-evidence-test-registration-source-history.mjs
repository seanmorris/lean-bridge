/**
 * Reverse the owned-Subtype hosted-evidence test-registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeEvidenceTestRegistrationHistoryPath
	= "docs/evidence/owned-subtype-evidence-test-registration-source-history-20261023.json";
export const ownedSubtypeEvidenceTestRegistrationPredecessor
	= "c70a657c69b64d4ca53c28e2c9b84cae31dc1c8e";
export const ownedSubtypeEvidenceTestRegistrationImplementation
	= "ea744dc862af089586252e2bb537cc1dc74f2bd8";
export const ownedSubtypeEvidenceTestRegistrationTests = Object.freeze([
	"owned-subtype-hosted-ci"
	, "owned-subtype-retained-packages"
]);
export const ownedSubtypeEvidenceTestRegistrationImplementationPaths
	= Object.freeze([
		"src/adoption/test-profiles.mjs"
		, "tests/test-profiles.test.mjs"
	]);
export const ownedSubtypeEvidenceTestRegistrationIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedSubtypeEvidenceTestRegistrationChangedPaths
	= Object.freeze([
		...ownedSubtypeEvidenceTestRegistrationImplementationPaths
		, ...ownedSubtypeEvidenceTestRegistrationIntegrationPaths
	]);
export const ownedSubtypeEvidenceTestRegistrationAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-evidence-test-registration-source-history.mjs"
	, "tests/helpers/owned-subtype-evidence-test-registration-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-evidence-test-registration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeEvidenceTestRegistrationHistoryPath, "utf8"));

/**
 * Restore one complete authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeEvidenceTestRegistrationUpdate
	= (source, update) => {
		assert.ok(ownedSubtypeEvidenceTestRegistrationChangedPaths
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
 * Remove only the exact evidence-test registration layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeEvidenceTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeEvidenceTestRegistrationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypeEvidenceTestRegistrationUpdate(source, update)
		: source;
};
