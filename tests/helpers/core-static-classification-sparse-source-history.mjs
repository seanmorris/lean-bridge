/**
 * Preserve the sparse Core static-classification repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreStaticClassificationSparseHistoryPath
	= "docs/evidence/core-static-classification-sparse-source-history-20261031.json";
export const coreStaticClassificationSparsePredecessor
	= "29a1e6fd07a06a6f1c345526ba1453189dd26834";
export const coreStaticClassificationSparseImplementation
	= "fdc08862356813f569a659b30625fa28ee45287d";
export const coreStaticClassificationSparsePins = Object.freeze([
	Object.freeze({
		path: "package.json", count: 25
		, previous: "9eaac1127c51ee17ad1e194cb43ea8b9bd29192450e58cbbf04e2c63a3ef13f2"
		, current: "829bfad1606cc9661bf6c9852ffeec929328e62f27726c65990b990e03697817"
	})
	, Object.freeze({
		path: "tests/test-profiles.test.mjs", count: 4
		, previous: "58c3f06ff0e055286894bb4742bd2d69838b81919188f597ee516532827ca512"
		, current: "56d4a9122797d0ea77940302975b6a58b2e9320e91a8f7ccd949ea023dbc0fd3"
	})
]);
export const coreStaticClassificationSparseImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json", "package.json"
		, "tests/checked-javascript.test.mjs"
		, "tests/test-profiles.test.mjs"
	]);
export const coreStaticClassificationSparseIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreStaticClassificationSparseHistoryAdditions = Object.freeze([
	"scripts/update-core-static-classification-sparse-source-history.mjs"
	, "tests/helpers/core-static-classification-sparse-source-history-tests.mjs"
	, "tests/helpers/core-static-classification-sparse-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + coreStaticClassificationSparseHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreStaticClassificationSparseNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreStaticClassificationSparseImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreStaticClassificationSparseImplementationPaths
	.includes(path) || coreStaticClassificationSparseIntegrationPaths.includes(path);

/**
 * Reverse one exact sparse static-classification transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreStaticClassificationSparseUpdate = (source, update) => {
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
 * Remove only the authenticated sparse static-classification transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreStaticClassificationSparseSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreStaticClassificationSparseNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreStaticClassificationSparseUpdate(current, update);
	}
	return current;
};
