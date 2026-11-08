/**
 * Authenticate the Python corpus runtime-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220PythonCorpusRuntimeBudgetHistoryPath
	= "docs/evidence/vo1220-python-corpus-runtime-budget-source-history-20261108.json";
export const vo1220PythonCorpusRuntimeBudgetPredecessor
	= "5e0e0a33bb66e9a6321eac5da21c3a22db9940b2";
export const vo1220PythonCorpusRuntimeBudgetImplementation
	= "5242ee2a6cada21af7b0279019f1f60f9fa2b0e4";
export const vo1220PythonCorpusRuntimeBudgetImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/helpers/native-consumer-budget-tests.mjs"
		, "tests/helpers/nominal-subtype-rust-ci-workflow.mjs"
	]);
export const vo1220PythonCorpusRuntimeBudgetIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220PythonCorpusRuntimeBudgetHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-python-corpus-runtime-budget-source-history.mjs"
		, "tests/helpers/vo1220-python-corpus-runtime-budget-source-history-tests.mjs"
		, "tests/helpers/vo1220-python-corpus-runtime-budget-source-history.mjs"
	]);
export const vo1220PythonCorpusRuntimeBudgetBehavior = Object.freeze({
	downstreamTimeouts: 1, completedCorpusFailures: 0
	, pythonBudgetMinutes: 360, cFamilyBudgetMinutes: 360
	, rustBudgetMinutes: 240, currentSourcePaths: 1, refreshedPins: 92
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../"
	+ vo1220PythonCorpusRuntimeBudgetHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220PythonCorpusRuntimeBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220PythonCorpusRuntimeBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220PythonCorpusRuntimeBudgetIntegrationPaths)
	])].sort());

/**
 * Require the history-heavy Python and C-family lanes to receive six hours
 * without changing Rust's bounded four-hour lane.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220PythonCorpusRuntimeBudget = sources => {
	const source = sources[".github/workflows/consumer-matrix.yml"];
	assert.equal(typeof source, "string");
	assert.match(source
		, /timeout-minutes: \$\{\{ \(matrix\.profile == 'c-family' \|\| matrix\.profile == 'python'\) && 360 \|\| 240 \}\}/u);
	assert.doesNotMatch(source
		, /timeout-minutes: \$\{\{ matrix\.profile == 'c-family' && 360 \|\| 240 \}\}/u);
	assert.match(source
		, /Run 42435025687 then cut Python off at the same whole-job ceiling/u);
	assert.match(source
		, /the six-hour budget while keeping Rust at 240 minutes/u);
	return { ...vo1220PythonCorpusRuntimeBudgetBehavior };
};

/**
 * Reverse one authenticated runtime-budget transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220PythonCorpusRuntimeBudgetUpdate = (
	source, update
) => {
	assert.ok(vo1220PythonCorpusRuntimeBudgetNormalizationPaths
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
 * Remove only this exact repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220PythonCorpusRuntimeBudgetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220PythonCorpusRuntimeBudgetNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220PythonCorpusRuntimeBudgetUpdate(current, update);
	}
	return current;
};
