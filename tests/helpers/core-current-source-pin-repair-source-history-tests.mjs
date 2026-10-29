/**
 * Authenticate the exact current-source pin repair and documentation history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";
import {
	beforeCoreCurrentSourcePinRepairSource
	, coreCurrentSourcePinRepairAddedPaths
	, coreCurrentSourcePinRepairCurrentSourcePaths
	, coreCurrentSourcePinRepairHistoryPath
	, coreCurrentSourcePinRepairImplementation
	, coreCurrentSourcePinRepairImplementationPaths
	, coreCurrentSourcePinRepairIntegrationPaths
	, coreCurrentSourcePinRepairPredecessor
	, coreCurrentSourcePinRepairPreparationCommits
	, coreCurrentSourcePinRepairPreparationPath
	, reverseCoreCurrentSourcePinRepairUpdate
} from "./core-current-source-pin-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreCurrentSourcePinRepairHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("current-source repair records its exact Git and registration boundaries", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-current-source-pin-repair-v1");
	assert.equal(value.predecessorCommit
		, coreCurrentSourcePinRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreCurrentSourcePinRepairImplementation);
	assert.deepEqual(value.preparationUpdates.map(item => item.commit)
		, coreCurrentSourcePinRepairPreparationCommits.map(item => item.commit));
	assert.deepEqual(value.preparationUpdates.map(item => item.path)
		, Array(value.preparationUpdates.length)
			.fill(coreCurrentSourcePinRepairPreparationPath));
	assert.deepEqual(value.implementationUpdates.map(item => item.path)
		, coreCurrentSourcePinRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, coreCurrentSourcePinRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, coreCurrentSourcePinRepairAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreCurrentSourcePinRepairImplementation}^`]).trim()
		, coreCurrentSourcePinRepairPredecessor);
});

test("current-source repair restores all three documentation transitions", async () => {
	const value = await record();
	for(const [index, item] of coreCurrentSourcePinRepairPreparationCommits.entries())
	{
		const update = value.preparationUpdates[index];
		const current = sourceAt(item.commit, update.path);
		const previous = sourceAt(item.previousCommit, update.path);
		assert.equal(reverseCoreCurrentSourcePinRepairUpdate(current, update)
			, previous, item.commit);
	}
	const latest = value.preparationUpdates.at(-1);
	const earliest = value.preparationUpdates[0];
	const current = sourceAt(
		coreCurrentSourcePinRepairPreparationCommits.at(-1).commit, latest.path);
	const previous = sourceAt(
		coreCurrentSourcePinRepairPreparationCommits[0].previousCommit
		, earliest.path);
	assert.equal(beforeCoreCurrentSourcePinRepairSource(
		latest.path, current, earliest.previousSha256), previous);
	assert.equal(beforeFinRefinementSource(
		latest.path, current, earliest.previousSha256), previous);
});

test("current-source repair reverses its implementation and registration", async () => {
	const value = await record();
	for(const update of [...value.implementationUpdates
		, ...value.integrationUpdates]) {
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreCurrentSourcePinRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreCurrentSourcePinRepairImplementation
			: coreCurrentSourcePinRepairPredecessor;
		const previous = sourceAt(base, update.path);
		assert.equal(reverseCoreCurrentSourcePinRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("current-source repair refreshes exactly five paths and 158 pins", async () => {
	const value = await record();
	const before = JSON.parse(sourceAt(
		coreCurrentSourcePinRepairPredecessor, "docs/type-surface.v1.json"));
	assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
		before, coreCurrentSourcePinRepairCurrentSourcePaths).sort()
		, coreCurrentSourcePinRepairCurrentSourcePaths);
	assert.deepEqual(value.currentSourcePaths
		, coreCurrentSourcePinRepairCurrentSourcePaths);
	const reconciled = reconcileDependentCheckedRecordSourcePins(before
		, new Map(value.currentSourceDigests.map(item =>
			[item.path, item.sha256])));
	assert.equal(reconciled.refreshed, 158);
	assert.equal(value.refreshedPins, 158);
	const after = JSON.parse(sourceAt(
		coreCurrentSourcePinRepairImplementation, "docs/type-surface.v1.json"));
	assert.deepEqual(after, reconciled.inventory);
	assert.deepEqual(after.profiles, before.profiles);
	assert.deepEqual(after.observations, before.observations);
});

test("current-source repair rejects forged transitions and unknown source", async () => {
	const update = (await record()).preparationUpdates.at(-1);
	const current = sourceAt(
		coreCurrentSourcePinRepairPreparationCommits.at(-1).commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreCurrentSourcePinRepairUpdate(current, forged));
	assert.equal(beforeCoreCurrentSourcePinRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
