/**
 * Authenticate the native-budget lint-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220NativeBudgetLintContractRepairHistoryPath
	= "docs/evidence/vo1220-native-budget-lint-contract-repair-source-history-20261108.json";
export const vo1220NativeBudgetLintContractRepairPredecessor
	= "fff14150f6d2f8ad38b7072253dc8e8827dd558a";
export const vo1220NativeBudgetLintContractRepairImplementation
	= "eeff2a3bfa1da8aac4e06995f6ff4f22908ad0e5";
export const vo1220NativeBudgetLintContractRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/native-consumer-budget-tests.mjs"
	]);
export const vo1220NativeBudgetLintContractRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220NativeBudgetLintContractRepairNormalizationPaths
	= Object.freeze([
		...vo1220NativeBudgetLintContractRepairImplementationPaths
		, ...vo1220NativeBudgetLintContractRepairIntegrationPaths
	]);
export const vo1220NativeBudgetLintContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-native-budget-lint-contract-repair-source-history.mjs"
		, "tests/helpers/vo1220-native-budget-lint-contract-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-native-budget-lint-contract-repair-source-history.mjs"
	]);
export const vo1220NativeBudgetLintContractRepairBehavior = Object.freeze({
	lintErrors: 2, changedSupportCells: 0, runtimeSemanticChanges: 0
	, currentSourcePaths: 0, refreshedPins: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220NativeBudgetLintContractRepairHistoryPath, "utf8"
));

/**
 * Require the exact leading-comma rendering without changing the budget map.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220NativeBudgetLintContractRepair = sources => {
	const source = sources[vo1220NativeBudgetLintContractRepairImplementationPaths[0]];
	assert.equal(typeof source, "string");
	assert.match(source
		, /profiles\.map\(profile => \[profile\n\s+, Number\(profile === "c-family"/u);
	assert.doesNotMatch(source
		, /profiles\.map\(profile => \[profile, Number\(/u);
	assert.match(source
		, /\? expression\[1\] : expression\[2\]\)\n\s+\]\)\);/u);
	return { ...vo1220NativeBudgetLintContractRepairBehavior };
};

/**
 * Reverse one authenticated lint-contract transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220NativeBudgetLintContractRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220NativeBudgetLintContractRepairNormalizationPaths
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
 * Remove only this exact lint-contract repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220NativeBudgetLintContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220NativeBudgetLintContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220NativeBudgetLintContractRepairUpdate(
				current, update);
	}
	return current;
};
