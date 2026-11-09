/**
 * Authenticate the producer-era Core history-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ProducerContractBudgetRepairHistoryPath
	= "docs/evidence/vo1220-producer-contract-budget-repair-source-history-20261109.json";
export const vo1220ProducerContractBudgetRepairPredecessor
	= "c157725e75f2d6a00e84b01e0e82cb241df83181";
export const vo1220ProducerContractBudgetRepairImplementation
	= "b38eb67e52db14d328aeb297d660c97489155829";
export const vo1220ProducerContractBudgetRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/core-quality-budget-tests.mjs"
		, "tests/hosted-container-inventory.test.mjs"
	]);
export const vo1220ProducerContractBudgetRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ProducerContractBudgetRepairNormalizationPaths
	= Object.freeze([
		...vo1220ProducerContractBudgetRepairImplementationPaths
		, ...vo1220ProducerContractBudgetRepairIntegrationPaths
	]);
export const vo1220ProducerContractBudgetRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-producer-contract-budget-repair-source-history.mjs"
		, "tests/helpers/vo1220-producer-contract-budget-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-producer-contract-budget-repair-source-history.mjs"
	]);
export const vo1220ProducerContractBudgetRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, measurementSemanticChanges: 0, testContractChanges: 1
	, liveContractReaders: 12, producerContractReaders: 1
	, uncheckedContractReaders: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ProducerContractBudgetRepairHistoryPath, "utf8"
));

/**
 * Require the one producer-era reader and the remaining live-contract readers.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220ProducerContractBudgetRepair = sources => {
	for(const path of vo1220ProducerContractBudgetRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const budget = sources["tests/helpers/core-quality-budget-tests.mjs"];
	const hosted = sources["tests/hosted-container-inventory.test.mjs"];
	assert.match(budget
		, /const producerPath = "tests\/hosted-container-inventory[.]test[.]mjs";/u);
	assert.match(budget
		, /historical classification uses producer contracts/u);
	assert.match(budget, /historical classification must not use live contracts/u);
	assert.match(budget, /do not duplicate the producer reader/u);
	assert.match(hosted
		, /import \{ typeSurfaceContractsAtProducer \} from "[.]\/helpers\/producer-source[.]mjs";/u);
	assert.match(hosted
		, /typeSurfaceContractsAtProducer\(\s*hostedContainerInventoryPredecessor\s*\)/u);
	assert.doesNotMatch(hosted, /await readTypeSurface\(\)/u);
	assert.doesNotMatch(hosted, /const contractsAt =/u);
	return { ...vo1220ProducerContractBudgetRepairBehavior };
};

/**
 * Reverse one authenticated producer-contract budget transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220ProducerContractBudgetRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220ProducerContractBudgetRepairNormalizationPaths
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
 * Remove only this producer-contract repair and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ProducerContractBudgetRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ProducerContractBudgetRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ProducerContractBudgetRepairUpdate(
				current, update);
	}
	return current;
};
