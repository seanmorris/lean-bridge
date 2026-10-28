/**
 * Authenticate exact Core inventory and documentation endpoints.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreInventoryEndpointRepairHistoryPath
	= "docs/evidence/core-inventory-endpoint-repair-source-history-20261024.json";
export const coreInventoryEndpointRepairPredecessor
	= "4054ef148ec14c4bc9b557dfe2fb4de464e09cee";
export const coreInventoryEndpointRepairImplementation
	= "ea5dff93ce189cf2f9f343f1ace2a7e7e0edce2b";
export const coreInventoryEndpointRepairIntegrationBase
	= "ea5dff93ce189cf2f9f343f1ace2a7e7e0edce2b";
export const coreInventoryEndpointRepairCommits = Object.freeze([
	"ea5dff93ce189cf2f9f343f1ace2a7e7e0edce2b"
]);
export const coreInventoryEndpointRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/nested-checked-record-dotnet-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-native-promotion-tests.mjs"
	, "tests/helpers/owned-cpp-evidence.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/php-wasm-structured-callable-evidence.mjs"
	, "tests/jvm-thread-exit-repair-evidence.test.mjs"
	, "tests/managed-ci-isolation-evidence.test.mjs"
	, "tests/owned-cpp-evidence.test.mjs"
	, "tests/owned-cpp-receiver-evidence.test.mjs"
	, "tests/owned-dotnet-receiver-evidence.test.mjs"
	, "tests/owned-javascript-engine-evidence.test.mjs"
	, "tests/owned-jvm-borrow-evidence.test.mjs"
	, "tests/owned-jvm-receiver-evidence.test.mjs"
	, "tests/owned-perl-receiver-evidence.test.mjs"
	, "tests/owned-php-receiver-evidence.test.mjs"
	, "tests/owned-php-wasm-receiver-evidence.test.mjs"
	, "tests/owned-php-wasm-transfer-evidence.test.mjs"
	, "tests/owned-python-receiver-evidence.test.mjs"
	, "tests/owned-ruby-borrow-evidence.test.mjs"
	, "tests/owned-ruby-transfer-evidence.test.mjs"
	, "tests/wit-owned-build-repair-evidence.test.mjs"
]);
export const coreInventoryEndpointRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/core-inventory-endpoint-tests.mjs"
]);
export const coreInventoryEndpointRepairImplementationPaths = Object.freeze([
	...coreInventoryEndpointRepairChangedPaths
	, ...coreInventoryEndpointRepairImplementationAddedPaths
]);
export const coreInventoryEndpointRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreInventoryEndpointRepairNormalizationPaths = Object.freeze([
	...coreInventoryEndpointRepairChangedPaths
	, ...coreInventoryEndpointRepairIntegrationPaths
]);
export const coreInventoryEndpointRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-inventory-endpoint-repair-source-history.mjs"
	, "tests/helpers/core-inventory-endpoint-repair-source-history-tests.mjs"
	, "tests/helpers/core-inventory-endpoint-repair-source-history.mjs"
]);
export const coreInventoryEndpointRepairAddedPaths = Object.freeze([
	...coreInventoryEndpointRepairImplementationAddedPaths
	, ...coreInventoryEndpointRepairHistoryAddedPaths
]);
export const coreInventoryEndpointRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/php-wasm-structured-callable-evidence.mjs"
		, count: 3
		, previousSha256: "6cd3a75ef38b81e04bef4674e1460c64a453afebbe0a8407c541d51e8068c921"
		, currentSha256: "78fe1ccfbac2c304fdbb5dba37af6510753fa09373a4bc767fe3f0fc06cd43cd"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-native-promotion-tests.mjs"
		, count: 4
		, previousSha256: "2dc76d318767515898954e9c6db523c695ae41fbc738295eb79af2c3b8999ae0"
		, currentSha256: "b30d624382ae6f551a8f69285de1ea46baeecd32105ebd1f9bbb1d154d464822"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-dotnet-promotion-tests.mjs"
		, count: 4
		, previousSha256: "bc0820ef0d792db1ee820f6883860d0fed2b393856b6617b72f8866592eeb034"
		, currentSha256: "bf30a67e555c97cc878023d3f95cce69cc80cdc4d9f98e6fc71b95768506a2a0"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreInventoryEndpointRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreInventoryEndpointRepairUpdate = (
	source, update
) => {
	assert.ok(coreInventoryEndpointRepairNormalizationPaths
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
 * Remove only the exact Core inventory endpoint repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreInventoryEndpointRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreInventoryEndpointRepairNormalizationPaths.includes(path))
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
		current = reverseCoreInventoryEndpointRepairUpdate(current, update);
	}
	return current;
};
