/**
 * Preserve the correction from canonical-bundle assumptions to the exact
 * authenticated native-component evidence consumed by native packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNativeEvidenceCorrectionHistoryPath
	= "docs/evidence/direct-proof-erasure-native-evidence-correction-source-history-20261028.json";
export const directProofErasureNativeEvidenceCorrectionPredecessor
	= "ddc31428d44e92eeabcf8d301bf765c826b8bc0b";
export const directProofErasureNativeEvidenceCorrectionImplementation
	= "45e3f7b6138ece05505af9b578c933dd4a79a45f";
export const directProofErasureNativeEvidenceCorrectionCommits = Object.freeze([
	directProofErasureNativeEvidenceCorrectionImplementation
]);
export const directProofErasureNativeEvidenceCorrectionImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure-language-installed.test.mjs"
		, "tests/direct-proof-erasure-managed-installed.test.mjs"
		, "tests/direct-proof-erasure-native-installed.test.mjs"
		, "tests/direct-proof-erasure-wit-installed.test.mjs"
		, "tests/helpers/direct-proof-erasure-fixture.mjs"
		, "tests/helpers/direct-proof-erasure-language-report.mjs"
		, "tests/helpers/direct-proof-erasure-managed-report.mjs"
		, "tests/helpers/direct-proof-erasure-native-report.mjs"
		, "tests/helpers/direct-proof-erasure-packages.mjs"
		, "tests/helpers/direct-proof-erasure-wit-report.mjs"
	]);
export const directProofErasureNativeEvidenceCorrectionIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNativeEvidenceCorrectionNormalizationPaths
	= Object.freeze([
		...directProofErasureNativeEvidenceCorrectionImplementationPaths
		, ...directProofErasureNativeEvidenceCorrectionIntegrationPaths
	]);
export const directProofErasureNativeEvidenceCorrectionAddedPaths
	= Object.freeze([
		"scripts/update-direct-proof-erasure-native-evidence-correction-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-native-evidence-correction-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-native-evidence-correction-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureNativeEvidenceCorrectionHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated correction transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reverseDirectProofErasureNativeEvidenceCorrectionUpdate
	= (source, update) => {
		assert.ok(directProofErasureNativeEvidenceCorrectionNormalizationPaths
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
 * Remove only this correction and its newest-first central registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureNativeEvidenceCorrectionSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !directProofErasureNativeEvidenceCorrectionNormalizationPaths
				.includes(path)) return source;
		const value = record();
		const updates = [...value.integrationUpdates, ...value.updates];
		let current = source;
		for(let count = 0; count < updates.length; ++count)
		{
			const digest = sha256(current);
			if(digest === expected) return current;
			const update = updates.find(item =>
				item.path === path && item.currentSha256 === digest);
			if(update === undefined) return current;
			current = reverseDirectProofErasureNativeEvidenceCorrectionUpdate(
				current, update);
		}
		return current;
	};
