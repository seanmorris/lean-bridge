/**
 * Authenticate the remaining recorded Core inventory endpoints.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreInventoryFollowupRepairHistoryPath
	= "docs/evidence/core-inventory-followup-repair-source-history-20261024.json";
export const coreInventoryFollowupRepairPredecessor
	= "d6674dfa35467863a2f201690abfb2ba82565f00";
export const coreInventoryFollowupRepairImplementation
	= "732cfe4af1bfe5da6d068e30ad06927fafe049e4";
export const coreInventoryFollowupRepairIntegrationBase
	= "732cfe4af1bfe5da6d068e30ad06927fafe049e4";
export const coreInventoryFollowupRepairCommits = Object.freeze([
	"732cfe4af1bfe5da6d068e30ad06927fafe049e4"
]);
export const coreInventoryFollowupRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/jvm-recursive-callable-evidence.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/jvm-recursive-callable-evidence.test.mjs"
	, "tests/managed-close-evidence.test.mjs"
	, "tests/owned-c-evidence.test.mjs"
	, "tests/owned-cpp-borrow-evidence.test.mjs"
	, "tests/owned-cpp-transfer-evidence.test.mjs"
	, "tests/owned-dotnet-transfer-evidence.test.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
	, "tests/owned-jvm-package-evidence.test.mjs"
	, "tests/owned-jvm-receiver-gc-evidence.test.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
	, "tests/owned-php-borrow-evidence.test.mjs"
	, "tests/owned-php-package-evidence.test.mjs"
	, "tests/owned-python-borrow-evidence.test.mjs"
	, "tests/owned-python-callback-result-history.test.mjs"
]);
export const coreInventoryFollowupRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/core-inventory-followup-endpoint-tests.mjs"
]);
export const coreInventoryFollowupRepairImplementationPaths = Object.freeze([
	...coreInventoryFollowupRepairChangedPaths
	, ...coreInventoryFollowupRepairImplementationAddedPaths
]);
export const coreInventoryFollowupRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreInventoryFollowupRepairNormalizationPaths = Object.freeze([
	...coreInventoryFollowupRepairChangedPaths
	, ...coreInventoryFollowupRepairIntegrationPaths
]);
export const coreInventoryFollowupRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-inventory-followup-repair-source-history.mjs"
	, "tests/helpers/core-inventory-followup-repair-source-history-tests.mjs"
	, "tests/helpers/core-inventory-followup-repair-source-history.mjs"
]);
export const coreInventoryFollowupRepairAddedPaths = Object.freeze([
	...coreInventoryFollowupRepairImplementationAddedPaths
	, ...coreInventoryFollowupRepairHistoryAddedPaths
]);
export const coreInventoryFollowupRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/jvm-recursive-callable-evidence.mjs"
		, count: 2
		, previousSha256: "1008c98fc81fb04c579016592264ef3d370ab7adf06b9a6a1afa828be3092fcc"
		, currentSha256: "1ac69b2ab4599a17b34bea9ad781c119df8cd4aa8832bc7f827a51a8a8304b35"
	})
	, Object.freeze({
		path: "tests/jvm-recursive-callable-evidence.test.mjs"
		, count: 2
		, previousSha256: "5ea94a83c46b37d2e08026cb9ae5c419336f2ba8387e58ecd5a42315d665a9d9"
		, currentSha256: "21e3750733812970af8674ecd90417e1f80b642e59cfc61eeada26fc387c5f43"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreInventoryFollowupRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreInventoryFollowupRepairUpdate = (
	source, update
) => {
	assert.ok(coreInventoryFollowupRepairNormalizationPaths
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
 * Remove only the exact Core inventory follow-up repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreInventoryFollowupRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreInventoryFollowupRepairNormalizationPaths.includes(path))
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
		current = reverseCoreInventoryFollowupRepairUpdate(current, update);
	}
	return current;
};
