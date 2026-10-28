/**
 * Authenticate the forward reconstruction of re-applied integration states.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreRecordedTransitionRepairSource
	, coreRecordedTransitionRepairAddedPaths
	, coreRecordedTransitionRepairCommits
	, coreRecordedTransitionRepairHistoryPath
	, coreRecordedTransitionRepairImplementation
	, coreRecordedTransitionRepairImplementationAddedPaths
	, coreRecordedTransitionRepairImplementationPaths
	, coreRecordedTransitionRepairIntegrationPaths
	, coreRecordedTransitionRepairPredecessor
	, reverseCoreRecordedTransitionRepairUpdate
} from "./core-recorded-transition-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreRecordedTransitionRepairHistoryPath, "utf8"
));

test("Core recorded-transition repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-recorded-transition-repair-source-v1");
	assert.equal(value.predecessorCommit, coreRecordedTransitionRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreRecordedTransitionRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreRecordedTransitionRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreRecordedTransitionRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, [...coreRecordedTransitionRepairImplementationAddedPaths
			, ...coreRecordedTransitionRepairAddedPaths]);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreRecordedTransitionRepairPredecessor}..${coreRecordedTransitionRepairImplementation}`]).trim().split("\n")
		, coreRecordedTransitionRepairCommits);
});

test("Core recorded-transition repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreRecordedTransitionRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreRecordedTransitionRepairImplementation
			: coreRecordedTransitionRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreRecordedTransitionRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core recorded-transition repair changes no record, support inventory, pin or product source", () => {
	for(const path of ["docs/type-surface.v1.json", "docs/evidence", "src"
		, "scripts", ".github", "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${coreRecordedTransitionRepairPredecessor}:${path}`])
			, git(["rev-parse", `${coreRecordedTransitionRepairImplementation}:${path}`]), path);
});

test("Core recorded-transition repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreRecordedTransitionRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreRecordedTransitionRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCoreRecordedTransitionRepairUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCoreRecordedTransitionRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
