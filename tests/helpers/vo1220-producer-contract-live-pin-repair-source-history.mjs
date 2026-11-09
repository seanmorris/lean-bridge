/**
 * Authenticate the producer-contract current live-source pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ProducerContractLivePinRepairHistoryPath
	= "docs/evidence/vo1220-producer-contract-live-pin-repair-source-history-20261109.json";
export const vo1220ProducerContractLivePinRepairPredecessor
	= "bb9a0c343d0d18635be5c7474d7b330c4cd83b76";
export const vo1220ProducerContractLivePinRepairImplementation
	= "af677126739a1cc1c0714c7dafdab97f282d5589";
export const vo1220ProducerContractLivePinRepairImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const vo1220ProducerContractLivePinRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ProducerContractLivePinRepairNormalizationPaths
	= Object.freeze([
		...vo1220ProducerContractLivePinRepairImplementationPaths
		, ...vo1220ProducerContractLivePinRepairIntegrationPaths
	]);
export const vo1220ProducerContractLivePinRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-producer-contract-live-pin-repair-source-history.mjs"
		, "tests/helpers/vo1220-producer-contract-live-pin-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-producer-contract-live-pin-repair-source-history.mjs"
	]);
export const vo1220ProducerContractLivePinRepairPreviousDigest
	= "17aef10b9acd76d68d1927bad0286d457283a87cc8ce96a9f9706a8a3d5c5072";
export const vo1220ProducerContractLivePinRepairCurrentDigest
	= "27fb73f08fc9cb2d947be8113ee5a1b8325f641eba74b4afa6e1d17f79e76bf7";
export const vo1220ProducerContractLivePinRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, measurementSemanticChanges: 0, testContractChanges: 0
	, changedSourcePaths: 1, refreshedCitations: 4, staleCitations: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ProducerContractLivePinRepairHistoryPath, "utf8"
));

/**
 * Require exactly four current citations for the repaired producer reader.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220ProducerContractLivePinRepair = sources => {
	const inventory = sources["docs/type-surface.v1.json"];
	assert.equal(typeof inventory, "string");
	const path = "tests/hosted-container-inventory.test.mjs";
	assert.equal(inventory.split(`"path": "${path}"`).length - 1, 4);
	assert.equal(inventory.split(vo1220ProducerContractLivePinRepairCurrentDigest)
		.length - 1, 4);
	assert.equal(inventory.includes(
		vo1220ProducerContractLivePinRepairPreviousDigest), false);
	return { ...vo1220ProducerContractLivePinRepairBehavior };
};

/**
 * Reverse one authenticated live-source pin transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220ProducerContractLivePinRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220ProducerContractLivePinRepairNormalizationPaths
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
 * Remove only this live-source pin repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ProducerContractLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ProducerContractLivePinRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ProducerContractLivePinRepairUpdate(
				current, update);
	}
	return current;
};
