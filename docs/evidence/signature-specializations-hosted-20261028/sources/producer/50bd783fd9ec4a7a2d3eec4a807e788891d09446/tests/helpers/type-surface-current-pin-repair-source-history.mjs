/**
 * Reverse the current-source type-surface pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const typeSurfaceCurrentPinRepairHistoryPath
	= "docs/evidence/type-surface-current-pin-repair-source-history-20261024.json";
export const typeSurfaceCurrentPinRepairPredecessor
	= "7603e11e58745ad47aaa617081692df32ee2e7dd";
export const typeSurfaceCurrentPinRepairImplementation
	= "46f221c995121664656834c566a6819bfd9b070a";
export const typeSurfaceCurrentPinRepairIntegrationBase
	= "523ef62011b53c38444f01a9056392bfe3ed1d9a";
export const typeSurfaceCurrentPinRepairFinalizationPredecessor
	= "dd1c15fb96abc80b8add14303225682f1c46140d";
export const typeSurfaceCurrentPinRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const typeSurfaceCurrentPinRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-subtype-test-profile-pin-repair-source-history-tests.mjs"
]);
export const typeSurfaceCurrentPinRepairNormalizationPaths = Object.freeze([
	...typeSurfaceCurrentPinRepairChangedPaths
	, ...typeSurfaceCurrentPinRepairIntegrationPaths
]);
export const typeSurfaceCurrentPinRepairAddedPaths = Object.freeze([
	"scripts/update-type-surface-current-pin-repair-source-history.mjs"
	, "tests/helpers/type-surface-current-pin-repair-source-history-tests.mjs"
	, "tests/helpers/type-surface-current-pin-repair-source-history.mjs"
]);
export const typeSurfaceCurrentPinRepairPinTransitions = Object.freeze([
	Object.freeze({
		path: "src/adoption/test-profiles.mjs", count: 98
		, previousSha256: "a61f10d548f706386965331b76f5e7a9ca695ac867e7aaf419124aedaa397651"
		, currentSha256: "e01087e1dd31c675a739ee26a727a86a864d7d921a2396e9f178fd78199e9fee"
	})
	, Object.freeze({
		path: "tests/component-array-contract.test.mjs", count: 3
		, previousSha256: "76b8fd1565425cad2757477293e23392a040a50856ee0bb6aaa2e4e05f615d4e"
		, currentSha256: "cb0cfd5cab02cfcafea0c60fdadcdb55b79225dfad9c4218771f426d66eb0199"
	})
	, Object.freeze({
		path: "tests/component-array-contract.test.mjs", count: 3
		, previousSha256: "cb0cfd5cab02cfcafea0c60fdadcdb55b79225dfad9c4218771f426d66eb0199"
		, currentSha256: "9c8cfc7b1b986cc98d646943ac6e18afe15fa058997bb475bb9babf3af1634dd"
	})
	, Object.freeze({
		path: "tests/helpers/type-corpus-php-wasm-install.mjs", count: 5
		, previousSha256: "f4edf1e0ab1de52a9943d01f52d969cee162bda3f03b9cedc13bc303a10c77b9"
		, currentSha256: "cd87e41eed51ff1d71241a0960e82ae0216866df8ef63e80672723a7efae8dcf"
	})
	, Object.freeze({
		path: "src/build/component-structured-callable-adapters.mjs", count: 4
		, previousSha256: "3f9d3fdcda0de3b24b740d24cb56de38996e015d16d07a472f509723a7779a04"
		, currentSha256: "90a83b2c26cd0cf6a59aac9824bcc12e0535db07ef80aaf79ff8e8b0588d704f"
	})
	, Object.freeze({
		path: "tests/component-structured-callable-contract.test.mjs", count: 3
		, previousSha256: "c9c06af016ec73bf8ea52bf9fa9f2e8141106bd4f97b6657da28de9528f0d180"
		, currentSha256: "04ffa1818c588cf6a7e1eb5b37c6c5ffa5cc3332966a329d96f4f2ad716823ac"
	})
	, Object.freeze({
		path: "scripts/check-checked-record-value-index-browser-ci.mjs", count: 4
		, previousSha256: "86ddec57b703caacaba1f4ca54a5c07fc9f2aed5deebe8dc7173d04f3e49d329"
		, currentSha256: "9211f3d3f70d236deab902c22c759c8eaa227d28d5412aae76f7cd8cbd8099d2"
	})
	, Object.freeze({
		path: "tests/helpers/checked-record-value-index-browser-ci-report.mjs"
		, count: 4
		, previousSha256: "039fddc40bebf4a35a6f3ca0c66c7521e6c5ca2de56bb0d8882fc90613718ef1"
		, currentSha256: "4f38f50a3fe8fe45a9245d58933d262e73f1c041d2f0b1b56de890ed032051da"
	})
	, Object.freeze({
		path: "tests/helpers/checked-record-value-index-browser-evidence.mjs"
		, count: 4
		, previousSha256: "8d6e20b89bde40f63780e08c8889d8226ece1fe5e08eed217719770fdcdf0824"
		, currentSha256: "d847a104220034ba611c27de8484454b1efbf5043a04c8815de4bedee5c3f22a"
	})
]);
export const typeSurfaceCurrentPinRepairLivePins = Object.freeze([
	typeSurfaceCurrentPinRepairPinTransitions[0]
	, ...typeSurfaceCurrentPinRepairPinTransitions.slice(2)
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	typeSurfaceCurrentPinRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseTypeSurfaceCurrentPinRepairUpdate = (source, update) => {
	assert.ok(typeSurfaceCurrentPinRepairNormalizationPaths
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
 * Remove only the exact current-source pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeTypeSurfaceCurrentPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !typeSurfaceCurrentPinRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		if(update === undefined) return current;
		current = reverseTypeSurfaceCurrentPinRepairUpdate(current, update);
	}
};
