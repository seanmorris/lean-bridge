/**
 * Authenticate the Python corpus runtime-budget contract closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220PythonCorpusRuntimeBudgetClosureHistoryPath
	= "docs/evidence/vo1220-python-corpus-runtime-budget-closure-source-history-20261108.json";
export const vo1220PythonCorpusRuntimeBudgetClosurePredecessor
	= "f5b1e16a140acf4b082574a2ce90b8c309af190d";
export const vo1220PythonCorpusRuntimeBudgetClosureImplementation
	= "b2bbc16ccae3657ceb86546437b6cb6912da028a";
export const vo1220PythonCorpusRuntimeBudgetClosureImplementationPaths
	= Object.freeze([
		"tests/documentation.test.mjs"
		, "tests/helpers/fin-container-edge-ci.mjs"
		, "tests/helpers/fin-container-entry-ci.mjs"
	]);
export const vo1220PythonCorpusRuntimeBudgetClosureIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220PythonCorpusRuntimeBudgetClosureHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-python-corpus-runtime-budget-closure-source-history.mjs"
		, "tests/helpers/vo1220-python-corpus-runtime-budget-closure-source-history-tests.mjs"
		, "tests/helpers/vo1220-python-corpus-runtime-budget-closure-source-history.mjs"
	]);
export const vo1220PythonCorpusRuntimeBudgetClosureBehavior = Object.freeze({
	staleContractTables: 2, historicalOverrides: 1
	, currentSourcePaths: 1, refreshedPins: 25
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../"
	+ vo1220PythonCorpusRuntimeBudgetClosureHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220PythonCorpusRuntimeBudgetClosureNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220PythonCorpusRuntimeBudgetClosureImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220PythonCorpusRuntimeBudgetClosureIntegrationPaths)
	])].sort());

const budget
	= "${{ (matrix.profile == 'c-family' || matrix.profile == 'python') && 360 || 240 }}";
const historical = "${{ matrix.profile == 'c-family' && 360 || 240 }}";

/**
 * Require every live table to match the workflow while preserving the exact
 * earlier expression only in the historical replay override.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220PythonCorpusRuntimeBudgetClosure = sources => {
	const edge = sources["tests/helpers/fin-container-edge-ci.mjs"];
	const entry = sources["tests/helpers/fin-container-entry-ci.mjs"];
	const documentation = sources["tests/documentation.test.mjs"];
	for(const source of [edge, entry, documentation])
		assert.equal(typeof source, "string");
	assert.equal(edge.split(budget).length, 2);
	assert.equal(entry.split(budget).length, 2);
	assert.doesNotMatch(edge, /matrix\.profile == 'c-family' && 360 \|\| 240/u);
	assert.doesNotMatch(entry, /matrix\.profile == 'c-family' && 360 \|\| 240/u);
	assert.match(documentation
		, /"native-consumers": "\$\{\{ matrix\.profile == 'c-family' && 360 \|\| 240 \}\}"/u);
	assert.equal(documentation.split(historical).length, 2);
	return { ...vo1220PythonCorpusRuntimeBudgetClosureBehavior };
};

/**
 * Reverse one authenticated closure transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220PythonCorpusRuntimeBudgetClosureUpdate = (
	source, update
) => {
	assert.ok(vo1220PythonCorpusRuntimeBudgetClosureNormalizationPaths
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
 * Remove only this exact closure and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220PythonCorpusRuntimeBudgetClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220PythonCorpusRuntimeBudgetClosureNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220PythonCorpusRuntimeBudgetClosureUpdate(
				current, update);
	}
	return current;
};
