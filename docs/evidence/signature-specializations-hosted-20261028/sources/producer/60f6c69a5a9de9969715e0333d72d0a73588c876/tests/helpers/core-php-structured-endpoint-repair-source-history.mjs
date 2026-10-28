/**
 * Authenticate the PHP structured callback endpoint repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const corePhpStructuredEndpointRepairHistoryPath
	= "docs/evidence/core-php-structured-endpoint-repair-source-history-20261024.json";
export const corePhpStructuredEndpointRepairPredecessor
	= "4ac1f5cddaec9d476f3a6dc554b5a69db33d067a";
export const corePhpStructuredEndpointRepairImplementation
	= "cbaf3cdcb6c0858dba9e7d482b03292f3d7155f7";
export const corePhpStructuredEndpointRepairIntegrationBase
	= "cbaf3cdcb6c0858dba9e7d482b03292f3d7155f7";
export const corePhpStructuredEndpointRepairCommits = Object.freeze([
	"cbaf3cdcb6c0858dba9e7d482b03292f3d7155f7"
]);
export const corePhpStructuredEndpointRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/php-structured-callable-evidence.mjs"
	, "tests/php-structured-callable-evidence.test.mjs"
	, "tests/php-wasm-structured-callable-evidence.test.mjs"
]);
export const corePhpStructuredEndpointRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/core-php-structured-endpoint-tests.mjs"
]);
export const corePhpStructuredEndpointRepairImplementationPaths = Object.freeze([
	...corePhpStructuredEndpointRepairChangedPaths
	, ...corePhpStructuredEndpointRepairImplementationAddedPaths
]);
export const corePhpStructuredEndpointRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const corePhpStructuredEndpointRepairNormalizationPaths = Object.freeze([
	...corePhpStructuredEndpointRepairChangedPaths
	, ...corePhpStructuredEndpointRepairIntegrationPaths
]);
export const corePhpStructuredEndpointRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-php-structured-endpoint-repair-source-history.mjs"
	, "tests/helpers/core-php-structured-endpoint-repair-source-history-tests.mjs"
	, "tests/helpers/core-php-structured-endpoint-repair-source-history.mjs"
]);
export const corePhpStructuredEndpointRepairAddedPaths = Object.freeze([
	...corePhpStructuredEndpointRepairImplementationAddedPaths
	, ...corePhpStructuredEndpointRepairHistoryAddedPaths
]);
export const corePhpStructuredEndpointRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/php-structured-callable-evidence.mjs"
		, count: 4
		, previousSha256: "f7bdb62299eb16f492f74cb1299178b3a594eb41c64e154552c8ca89d76e6cb4"
		, currentSha256: "2cef8269b2b767664bc04f2f89eab1ac5494210af33ec6626cba23c244fa9005"
	})
	, Object.freeze({
		path: "tests/php-structured-callable-evidence.test.mjs"
		, count: 4
		, previousSha256: "a43bc433a8edefce7c5018e100dee93084501c9f6f79d72975709db211d1a0de"
		, currentSha256: "1a9bf67461e76fafc531a7b431f90fb3b7720a9e23fdf2e8280ad9a84c026498"
	})
	, Object.freeze({
		path: "tests/php-wasm-structured-callable-evidence.test.mjs"
		, count: 3
		, previousSha256: "78869c605d02e2f842ec656ab4909b93792c7f2aa127250bc49ad82199d965c9"
		, currentSha256: "791237521a6ab1d8d31f07e59e57ab5abf672826bd42a2e54fc2c0c707cbd08b"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	corePhpStructuredEndpointRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCorePhpStructuredEndpointRepairUpdate = (
	source, update
) => {
	assert.ok(corePhpStructuredEndpointRepairNormalizationPaths
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
 * Remove only the exact Core PHP structured endpoint repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCorePhpStructuredEndpointRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !corePhpStructuredEndpointRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCorePhpStructuredEndpointRepairUpdate(current, update);
	}
	return current;
};
