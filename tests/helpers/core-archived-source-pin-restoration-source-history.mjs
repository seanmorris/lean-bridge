/**
 * Preserve the restoration of immutable archived source snapshot pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreArchivedSourcePinRestorationHistoryPath
	= "docs/evidence/core-archived-source-pin-restoration-source-history-20261030.json";
export const coreArchivedSourcePinRestorationPredecessor
	= "fa6be4f9714e47cdb331063dff009ca4e1d6aa35";
export const coreArchivedSourcePinRestorationImplementation
	= "7a7e45d584737f964f7bef628a3592d0ddb1b453";
export const coreArchivedSourcePinRestorationBaseline
	= "39c8e1d5a362565f8f2daf8f0a7bf547fe1da9b3";
export const coreArchivedSourcePinRestorationCount = 1090;
export const coreArchivedSourcePinRestorationTransitions = Object.freeze([
	Object.freeze({
		path: "src/build/compile-jvm-sources.mjs"
		, liveCount: 18, archivedCount: 474
		, archivedSha256: "3006f6fd85211daf7c21e5e79b6373d46b2952f1b7d9d0fea04e98e533da6402"
		, liveSha256: "46bd3f9240c302814c20299155252eab6e486977150f6013b446f29a04ad16a3"
	})
	, Object.freeze({
		path: "tests/helpers/copied-fixture-php-wasm.mjs"
		, liveCount: 6, archivedCount: 616
		, archivedSha256: "eb2a38bc4ed3acab22277d871d036fa25a8e32986f29f87b2ad4f6c13cd1e579"
		, liveSha256: "9afc409736a716196eb988b4389f7bebc9db18a2528ad598b86313cad0640e85"
	})
]);
export const coreArchivedSourcePinRestorationImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const coreArchivedSourcePinRestorationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreArchivedSourcePinRestorationHistoryAdditions = Object.freeze([
	"scripts/update-core-archived-source-pin-restoration-source-history.mjs"
	, "tests/helpers/core-archived-source-pin-restoration-source-history-tests.mjs"
	, "tests/helpers/core-archived-source-pin-restoration-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${coreArchivedSourcePinRestorationHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreArchivedSourcePinRestorationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreArchivedSourcePinRestorationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreArchivedSourcePinRestorationImplementationPaths
	.includes(path) || coreArchivedSourcePinRestorationIntegrationPaths
	.includes(path);

/**
 * Reverse one exact archived-pin restoration transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreArchivedSourcePinRestorationUpdate = (
	source, update
) => {
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
 * Remove only the authenticated archived-pin restoration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreArchivedSourcePinRestorationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreArchivedSourcePinRestorationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreArchivedSourcePinRestorationUpdate(current, update);
	}
	return current;
};
