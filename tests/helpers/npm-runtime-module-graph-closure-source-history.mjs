/**
 * Preserve the npm runtime module-graph closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const npmRuntimeModuleGraphClosureHistoryPath
	= "docs/evidence/npm-runtime-module-graph-closure-source-history-20261029.json";
export const npmRuntimeModuleGraphClosurePredecessor
	= "6d949d539d764295f82f2394c0eda0e28fd313d3";
export const npmRuntimeModuleGraphClosureSourceCommit
	= "6679d41ae685f936e627658886e9aee490e21455";
export const npmRuntimeModuleGraphClosureImplementation
	= "03bf4600410a064b4812c19ce0349a0fac8c14e6";
export const npmRuntimeModuleGraphClosureCommits = Object.freeze([
	npmRuntimeModuleGraphClosureSourceCommit
	, npmRuntimeModuleGraphClosureImplementation
]);
export const npmRuntimeModuleGraphClosurePackagePath
	= "src/release/component-npm-package.mjs";
export const npmRuntimeModuleGraphClosureImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, npmRuntimeModuleGraphClosurePackagePath
	, "tests/component-npm-package.test.mjs"
	, "tests/component-runtime-package-identity.test.mjs"
]);
export const npmRuntimeModuleGraphClosureImplementationAdditions = Object.freeze([
	"scripts/refresh-npm-runtime-module-graph-pins.mjs"
]);
export const npmRuntimeModuleGraphClosureIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-native-evidence-repair-source-history-tests.mjs"
]);
export const npmRuntimeModuleGraphClosureHistoryAdditions = Object.freeze([
	"scripts/update-npm-runtime-module-graph-closure-source-history.mjs"
	, "tests/helpers/npm-runtime-module-graph-closure-source-history-tests.mjs"
	, "tests/helpers/npm-runtime-module-graph-closure-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${npmRuntimeModuleGraphClosureHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const npmRuntimeModuleGraphClosureNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: npmRuntimeModuleGraphClosureImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => npmRuntimeModuleGraphClosureImplementationPaths
	.includes(path) || npmRuntimeModuleGraphClosureIntegrationPaths.includes(path);

/**
 * Reverse one exact runtime-module closure transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseNpmRuntimeModuleGraphClosureUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the exact npm runtime module-graph closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeNpmRuntimeModuleGraphClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !npmRuntimeModuleGraphClosureNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNpmRuntimeModuleGraphClosureUpdate(current, update);
	}
	return current;
};
