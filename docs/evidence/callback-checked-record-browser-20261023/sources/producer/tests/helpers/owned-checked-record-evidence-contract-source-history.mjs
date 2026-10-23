/**
 * Reverse the owned checked-record evidence-contract repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordEvidenceContractHistoryPath
	= "docs/evidence/owned-checked-record-evidence-contract-source-history-20261022.json";
export const ownedCheckedRecordEvidenceContractPredecessor
	= "a3f8b08082a8e75b3b8f0b5b13070cc0193f9d0c";
export const ownedCheckedRecordEvidenceContractImplementation
	= "f13b7c55db56692f2a262e6053fbbfec66d934db";
export const ownedCheckedRecordEvidenceContractCommits = Object.freeze([
	"43b98052b44081dda169f297e37c21cf6704aece"
	, ownedCheckedRecordEvidenceContractImplementation
]);
export const ownedCheckedRecordEvidenceContractImplementationPaths
	= Object.freeze([
		".github/workflows/owned-checked-record-languages.yml"
		, ".github/workflows/owned-checked-record-managed.yml"
		, ".github/workflows/owned-checked-record-native-perl.yml"
		, "tests/callback-subtype-promotion.test.mjs"
		, "tests/helpers/callback-subtype-documentation.mjs"
		, "tests/helpers/package-set.mjs"
		, "tests/owned-checked-record-language-packaging.test.mjs"
		, "tests/owned-checked-record-managed-packaging.test.mjs"
		, "tests/owned-checked-record-native-packaging.test.mjs"
		, "tests/owned-checked-record-perl-packaging.test.mjs"
		, "tests/package-set-receipt.test.mjs"
	]);
export const ownedCheckedRecordEvidenceContractModifiedPaths
	= ownedCheckedRecordEvidenceContractImplementationPaths;
export const ownedCheckedRecordEvidenceContractIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedCheckedRecordEvidenceContractChangedPaths = Object.freeze([
	...ownedCheckedRecordEvidenceContractModifiedPaths
	, ...ownedCheckedRecordEvidenceContractIntegrationPaths
]);
export const ownedCheckedRecordEvidenceContractAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-evidence-contract-source-history.mjs"
	, "tests/helpers/owned-checked-record-evidence-contract-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-evidence-contract-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordEvidenceContractHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRecordEvidenceContractUpdate
	= (source, update) => {
		assert.ok(ownedCheckedRecordEvidenceContractChangedPaths
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
 * Remove only the exact owned checked-record evidence-contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordEvidenceContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordEvidenceContractChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedCheckedRecordEvidenceContractUpdate(source, update)
		: source;
};
