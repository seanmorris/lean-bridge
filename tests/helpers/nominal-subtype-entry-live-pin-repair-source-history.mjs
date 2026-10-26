/**
 * Authenticate the nominal Subtype entry publication live-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeEntryLivePinRepairHistoryPath
	= "docs/evidence/nominal-subtype-entry-live-pin-repair-source-history-20261026.json";
export const nominalSubtypeEntryLivePinRepairPredecessor
	= "1b10806737bd0e06a441443f9b6e2741b3b6614c";
// Replaced with the exact implementation commit in the integration commit.
export const nominalSubtypeEntryLivePinRepairImplementation
	= "d6ae0b349473e675dd1dc3c140623d8b171d8e44";

export const nominalSubtypeEntryLivePinRepairPins = Object.freeze([
	Object.freeze({ path: "docs/consume/c.md", count: 1
		, previousSha256: "c83a611277c2292c350b4ac75dbacf85fd4c399b015c1401e304db1c747d709c"
		, currentSha256: "002f2d4ca00317b317de78e21eec41e46f20e6e4ab48e86808f26da2c9b0c4c8" })
	, Object.freeze({ path: "docs/consume/cpp.md", count: 1
		, previousSha256: "127d7044d45e47783f790e70df6829068644a4ca5545fbce4d17f5e2aa58c5af"
		, currentSha256: "f7425cb2e1286f668bc8e235e578e2b9a94e0868bf5c430150ea374e199112d1" })
	, Object.freeze({ path: "docs/lean/existing-package.md", count: 18
		, previousSha256: "0966a145bd1bdda391e63ca43f3d74aaaab1fcee3bb1cd60dbaa693204f1744d"
		, currentSha256: "7c5136da0dde86302ac2d0e3e1cffe5953f8968662f6f5cd6ed8b9ffc58c5f60" })
	, Object.freeze({ path: "src/adoption/test-profiles.mjs", count: 98
		, previousSha256: "c9d875ffc7e5983666e24a169b0f01f01a88f1125a9ba668ebb988b8bacf5d81"
		, currentSha256: "df4e89f141e8a2b5a404805f6bf977391cd6b483e2681580db1505e9c4918bba" })
]);
export const nominalSubtypeEntryLivePinRepairPinCount
	= nominalSubtypeEntryLivePinRepairPins.reduce(
		(sum, pin) => sum + pin.count, 0);
export const nominalSubtypeEntryLivePinRepairImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const nominalSubtypeEntryLivePinRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-live-pin-repair-source-history.mjs"
]);
export const nominalSubtypeEntryLivePinRepairAddedPaths = Object.freeze([
	"scripts/update-nominal-subtype-entry-live-pin-repair-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-live-pin-repair-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-live-pin-repair-source-history.mjs"
]);
export const nominalSubtypeEntryLivePinRepairNormalizationPaths
	= Object.freeze([...new Set([
		...nominalSubtypeEntryLivePinRepairImplementationPaths
		, ...nominalSubtypeEntryLivePinRepairIntegrationPaths
	])]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalSubtypeEntryLivePinRepairHistoryPath, "utf8"));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNominalSubtypeEntryLivePinRepairUpdate = (
	source, update
) => {
	assert.ok(nominalSubtypeEntryLivePinRepairNormalizationPaths
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
 * Reverse every recognized nominal-entry live-pin repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeNominalSubtypeEntryLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalSubtypeEntryLivePinRepairNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseNominalSubtypeEntryLivePinRepairUpdate(current, update);
	}
	return current;
};
