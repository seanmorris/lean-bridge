/**
 * Reverse the exact checked-refinement hosted-gate repair range.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRefinementGateRepairHistoryPath
	= "docs/evidence/checked-refinement-gate-repair-source-history-20261023.json";
export const checkedRefinementGateRepairPredecessor
	= "e85b0d2e90bb15d878e51e4e04a7e5e2e12e307d";
export const checkedRefinementGateRepairImplementation
	= "2ff31b0bdedc91edb5b3cf0debc7ec00ff82c8e9";
export const checkedRefinementGateRepairCommits = Object.freeze([
	"6880c46cbf77b66393dc1ea22bd41a910280e604"
	, "e71d906ab592b838a1c60fe96c77a9f8df56c673"
	, "551aa394301ab9bd8c4272f8651379ba395695fb"
	, "21cba0ef268a5ec21757d0f7354933652a2306a1"
	, "34346df94500c3eb99c40635e3dc020735d10832"
	, "bfbcee921abd17f5e814149f9d882f482d4a78f3"
	, "2cb047df2225c27f2bbc2d7d192baccbee3b0582"
	, "6f6b092b6e32be5e211611bd459fe3d5af73cb57"
	, "b840e3c26d615139d4ff5cef93de90d234539eb5"
	, "6d69d2e7b8e9735f334012b59f45351eedbdb04a"
	, "d3c3a340be2ce0ea76832a3c24b9459923ad6ef2"
	, checkedRefinementGateRepairImplementation
]);
export const checkedRefinementGateRepairImplementationAddedPaths
	= Object.freeze([
		".github/workflows/dependent-checked-record-matrix.yml"
		, "tests/dependent-checked-record-matrix-inventory.test.mjs"
		, "tests/dependent-checked-record-matrix.test.mjs"
		, "tests/helpers/dependent-checked-record-matrix-ci-tests.mjs"
	]);
export const checkedRefinementGateRepairModifiedPaths = Object.freeze([
	"scripts/promote-dependent-checked-record-evidence.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/dependent-checked-record-promotion.test.mjs"
	, "tests/fixtures/onboarding/nominal-subtypes/NominalSubtypes.lean"
	, "tests/helpers/checked-record-value-index-browser-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-browser-tests.mjs"
	, "tests/helpers/dependent-checked-record-promotion.mjs"
	, "tests/helpers/nominal-subtype-dispatch-tests.mjs"
	, "tests/helpers/nominal-subtype-dispatch.mjs"
	, "tests/helpers/nominal-subtype-entry-tests.mjs"
	, "tests/helpers/nominal-subtype-entry.mjs"
	, "tests/helpers/nominal-subtype-native-installed-tests.mjs"
	, "tests/helpers/php-wasm-indexed-refinement-entry-ci-tests.mjs"
	, "tests/owned-subtype-native-packaging.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const checkedRefinementGateRepairImplementationPaths = Object.freeze([
	...checkedRefinementGateRepairImplementationAddedPaths
	, ...checkedRefinementGateRepairModifiedPaths
]);
export const checkedRefinementGateRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRefinementGateRepairNormalizationPaths = Object.freeze([
	...checkedRefinementGateRepairModifiedPaths
	, ...checkedRefinementGateRepairIntegrationPaths
]);
export const checkedRefinementGateRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-checked-refinement-gate-repair-source-history.mjs"
	, "tests/helpers/checked-refinement-gate-repair-source-history-tests.mjs"
	, "tests/helpers/checked-refinement-gate-repair-source-history.mjs"
]);
export const checkedRefinementGateRepairAddedPaths = Object.freeze([
	...checkedRefinementGateRepairImplementationAddedPaths
	, ...checkedRefinementGateRepairHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRefinementGateRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCheckedRefinementGateRepairUpdate = (source, update) => {
	assert.ok(checkedRefinementGateRepairNormalizationPaths.includes(update.path));
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
 * Remove only the exact checked-refinement hosted-gate repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRefinementGateRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRefinementGateRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCheckedRefinementGateRepairUpdate(source, update)
		: source;
};
