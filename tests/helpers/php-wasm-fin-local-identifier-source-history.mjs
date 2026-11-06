/**
 * Preserve the PHP-Wasm Fin generated-C local identifier repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmFinLocalIdentifierHistoryPath
	= "docs/evidence/php-wasm-fin-local-identifier-source-history-20261106.json";
export const phpWasmFinLocalIdentifierPredecessor
	= "ff1135274d110efa118d192559dfa54b04fc431d";
export const phpWasmFinLocalIdentifierImplementation
	= "7b20949df43af27db0fc471dbc01e0d6f0a8148d";
export const phpWasmFinLocalIdentifierImplementationPaths = Object.freeze([
	"tests/php-wasm-fin.test.mjs"
]);
export const phpWasmFinLocalIdentifierIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmFinLocalIdentifierHistoryAdditions = Object.freeze([
	"scripts/update-php-wasm-fin-local-identifier-source-history.mjs"
	, "tests/helpers/php-wasm-fin-local-identifier-source-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-local-identifier-source-history.mjs"
]);
export const phpWasmFinLocalIdentifierMarkers = Object.freeze({
	current: Object.freeze([
		'dispatch = nest.indexOf("lean_object *_lb_checked = ");'
		, 'assert.ok(nest.indexOf("_check(arg0, &_lb_budget)") < inner'
	])
	, previous: Object.freeze([
		'dispatch = nest.indexOf("lean_object *checked = ");'
		, 'assert.ok(nest.indexOf("_check(arg0, &budget)") < inner'
	])
	, ordering: "< inner && inner < tag && tag < dispatch, nest);"
});
export const phpWasmFinLocalIdentifierBehavior = Object.freeze({
	identifierRepairs: 2, livePinRefreshes: 0
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + phpWasmFinLocalIdentifierHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const phpWasmFinLocalIdentifierNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: phpWasmFinLocalIdentifierImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...phpWasmFinLocalIdentifierImplementationPaths
	, ...phpWasmFinLocalIdentifierIntegrationPaths
].includes(path);
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Bind both current generated-C locals and the unchanged ordering check.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertPhpWasmFinLocalIdentifierRepair = sources => {
	const source = sources["tests/php-wasm-fin.test.mjs"];
	assert.equal(typeof source, "string", "tests/php-wasm-fin.test.mjs");
	for(const marker of phpWasmFinLocalIdentifierMarkers.current)
		assert.equal(count(source, marker), 1, marker);
	for(const marker of phpWasmFinLocalIdentifierMarkers.previous)
		assert.equal(count(source, marker), 0, marker);
	assert.equal(count(source, phpWasmFinLocalIdentifierMarkers.ordering), 1
		, "ordering check");
	return { ...phpWasmFinLocalIdentifierBehavior };
};

/**
 * Reverse one authenticated identifier transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePhpWasmFinLocalIdentifierUpdate = (source, update) => {
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
 * Remove only authenticated PHP-Wasm Fin identifier transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePhpWasmFinLocalIdentifierSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmFinLocalIdentifierNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePhpWasmFinLocalIdentifierUpdate(current, update);
	}
	return current;
};
