/**
 * Preserve the final owned-JavaScript CI budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJavaScriptCiBudgetRepairHistoryPath
	= "docs/evidence/owned-javascript-ci-budget-repair-source-history-20261106.json";
export const ownedJavaScriptCiBudgetRepairPredecessor
	= "c2eca28ce3957c14e66364767bac90656ec5074e";
export const ownedJavaScriptCiBudgetRepairImplementation
	= "735c2f0464d772c67a60a9048b9a0c6e2c1fdf6c";
export const ownedJavaScriptCiBudgetRepairImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/owned-javascript-wasm-ci.test.mjs"
]);
export const ownedJavaScriptCiBudgetRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const ownedJavaScriptCiBudgetRepairHistoryAdditions = Object.freeze([
	"scripts/update-owned-javascript-ci-budget-repair-source-history.mjs"
	, "tests/helpers/owned-javascript-ci-budget-repair-source-history-tests.mjs"
	, "tests/helpers/owned-javascript-ci-budget-repair-source-history.mjs"
]);
export const ownedJavaScriptCiBudgetRepairBehavior = Object.freeze({
	previousTimeoutMinutes: 90, currentTimeoutMinutes: 150
	, completedStepsBeforeTimeout: 16, requiredStepsStillPending: 2
	, livePinRefreshes: Object.freeze({
		".github/workflows/consumer-matrix.yml": 92
	})
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + ownedJavaScriptCiBudgetRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const ownedJavaScriptCiBudgetRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: ownedJavaScriptCiBudgetRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...ownedJavaScriptCiBudgetRepairImplementationPaths
	, ...ownedJavaScriptCiBudgetRepairIntegrationPaths
].includes(path);

/**
 * Require the complete owned-JavaScript lane and its measured final budget.
 *
 * @param {Record<string, string>} sources - Implementation sources by path.
 */
export const assertOwnedJavaScriptCiBudgetRepair = sources => {
	for(const path of ownedJavaScriptCiBudgetRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/consumer-matrix.yml"];
	const job = workflow.match(/^ {2}owned-javascript-wasm:\n([^]*?)(?=^ {2}[a-z][a-z-]*:)/mu)?.[0];
	assert.ok(job);
	assert.match(job, /^ {4}name: Owned JavaScript and production Wasm runtime$/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 150$/mu);
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	for(const step of [
		"Verify owned JavaScript engine and archive SDK contracts"
		, "Verify reproducible signed owned npm publication"
	]) assert.equal(job.split(`      - name: ${step}\n`).length - 1, 1, step);
	const helper = sources["tests/helpers/owned-javascript-wasm-ci.mjs"];
	assert.equal(helper.split(
		"assert.match(job, /^ {4}timeout-minutes: 150$/mu);").length - 1, 1);
	const regression = sources["tests/owned-javascript-wasm-ci.test.mjs"];
	assert.equal(regression.split(
		'["    timeout-minutes: 150\\n", "    timeout-minutes: 90\\n"]'
	).length - 1, 1);
	return {
		...ownedJavaScriptCiBudgetRepairBehavior
		, livePinRefreshes: {
			...ownedJavaScriptCiBudgetRepairBehavior.livePinRefreshes
		}
	};
};

/**
 * Reverse one authenticated budget-repair transition.
 *
 * @param {string} source - Complete later source.
 * @param {{path:string,currentSha256:string,previousSha256:string,edits:Array}} update - Authenticated transition.
 */
export const reverseOwnedJavaScriptCiBudgetRepairUpdate = (source, update) => {
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
 * Remove only authenticated owned-JavaScript budget transitions.
 *
 * @param {string} path - Repository-relative path.
 * @param {string|Buffer} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeOwnedJavaScriptCiBudgetRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJavaScriptCiBudgetRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOwnedJavaScriptCiBudgetRepairUpdate(current, update);
	}
	return current;
};
