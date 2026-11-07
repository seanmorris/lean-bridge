/**
 * Preserve the final complete-Core shard runtime budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFinalRuntimeBudgetHistoryPath
	= "docs/evidence/core-final-runtime-budget-source-history-20261107.json";
export const coreFinalRuntimeBudgetPredecessor
	= "b6a07b21843913006d2b404403dea30abf7809ed";
export const coreFinalRuntimeBudgetImplementation
	= "13097dc472bf6cc00f0b9a934bc24d4979bc6767";
export const coreFinalRuntimeBudgetImplementationPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
export const coreFinalRuntimeBudgetIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/core-contract-runtime-budget-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFinalRuntimeBudgetHistoryAdditions = Object.freeze([
	"scripts/update-core-final-runtime-budget-source-history.mjs"
	, "tests/helpers/core-final-runtime-budget-source-history-tests.mjs"
	, "tests/helpers/core-final-runtime-budget-source-history.mjs"
]);
export const coreFinalRuntimeBudgetBehavior = Object.freeze({
	previousTimeoutMinutes: 240, currentTimeoutMinutes: 360
	, cancelledAfterJobMinutes: 240
	, completedTestsAtCancellation: 414
	, livePinRefreshes: Object.freeze({
		".github/workflows/quality.yml": 1
	})
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../" + coreFinalRuntimeBudgetHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreFinalRuntimeBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: coreFinalRuntimeBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...coreFinalRuntimeBudgetImplementationPaths
	, ...coreFinalRuntimeBudgetIntegrationPaths
].includes(path);

/**
 * Require the complete Core matrix and its measured whole-job budget.
 *
 * @param {Record<string, string>} sources - Implementation sources by path.
 */
export const assertCoreFinalRuntimeBudget = sources => {
	for(const path of coreFinalRuntimeBudgetImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/quality.yml"];
	const contract = workflow.match(/^ {2}contract:\n([^]*?)(?=^ {2}quality:)/mu)?.[0];
	assert.ok(contract);
	assert.match(contract, /^ {4}name: Contract shard \$\{\{ matrix\.shard \}\}\/12$/mu);
	assert.match(contract, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(contract, /^ {4}timeout-minutes: 360$/mu);
	assert.match(contract, /Run 42344725453 showed that the complete shard-6 history replay was still/u);
	assert.match(contract, /making passing progress after 414 tests when the 240-minute whole-job/u);
	assert.match(contract, /^ {6}fail-fast: false$/mu);
	assert.match(contract, /^ {6}max-parallel: 6$/mu);
	assert.doesNotMatch(contract, /^ {4}(?:if|continue-on-error):/mu);
	const tests = sources["tests/helpers/core-quality-budget-tests.mjs"];
	assert.equal(tests.split(
		"assert.deepEqual(timeouts, [30, 90, 360, 10]"
	).length - 1, 1);
	assert.equal(tests.split(
		'source.replace("timeout-minutes: 360", "timeout-minutes: 90")'
	).length - 1, 1);
	return {
		...coreFinalRuntimeBudgetBehavior
		, livePinRefreshes: {
			...coreFinalRuntimeBudgetBehavior.livePinRefreshes
		}
	};
};

/**
 * Reverse one authenticated final Core-budget transition.
 *
 * @param {string} source - Complete later source.
 * @param {{path:string,currentSha256:string,previousSha256:string,edits:Array}} update - Authenticated transition.
 */
export const reverseCoreFinalRuntimeBudgetUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only authenticated final Core-budget transitions.
 *
 * @param {string} path - Repository-relative path.
 * @param {string|Buffer} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeCoreFinalRuntimeBudgetSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreFinalRuntimeBudgetNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreFinalRuntimeBudgetUpdate(current, update);
	}
	return current;
};
