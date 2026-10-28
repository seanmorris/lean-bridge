/**
 * Authenticate the reviewed Fin Box entry-harness accounting repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreReviewedFinBoxHarnessRepairSource
	, coreReviewedFinBoxHarnessRepairAddedPaths
	, coreReviewedFinBoxHarnessRepairCommits
	, coreReviewedFinBoxHarnessRepairHistoryPath
	, coreReviewedFinBoxHarnessRepairImplementation
	, coreReviewedFinBoxHarnessRepairImplementationPaths
	, coreReviewedFinBoxHarnessRepairIntegrationPaths
	, coreReviewedFinBoxHarnessRepairPredecessor
	, reverseCoreReviewedFinBoxHarnessRepairUpdate
} from "./core-reviewed-fin-box-harness-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreReviewedFinBoxHarnessRepairHistoryPath, "utf8"
));

test("reviewed Fin Box harness repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "core-reviewed-fin-box-harness-repair-source-v1");
	assert.equal(value.predecessorCommit
		, coreReviewedFinBoxHarnessRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreReviewedFinBoxHarnessRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreReviewedFinBoxHarnessRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreReviewedFinBoxHarnessRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, coreReviewedFinBoxHarnessRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreReviewedFinBoxHarnessRepairPredecessor}..${coreReviewedFinBoxHarnessRepairImplementation}`]).trim().split("\n")
		, coreReviewedFinBoxHarnessRepairCommits);
});

test("reviewed Fin Box harness repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreReviewedFinBoxHarnessRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreReviewedFinBoxHarnessRepairImplementation
			: coreReviewedFinBoxHarnessRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreReviewedFinBoxHarnessRepairUpdate(current, update)
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

test("reviewed Fin Box harness repair is scoped to harness accounting", () => {
	assert.deepEqual(coreReviewedFinBoxHarnessRepairImplementationPaths
		, ["tests/reviewed-fin-wasm-entry-harness.test.mjs"]);
	for(const path of ["src", "scripts/core-contract-shards.mjs"
		, "src/adoption/test-profiles.mjs", "package.json"])
		assert.equal(git(["rev-parse"
			, `${coreReviewedFinBoxHarnessRepairPredecessor}:${path}`])
		, git(["rev-parse"
			, `${coreReviewedFinBoxHarnessRepairImplementation}:${path}`]), path);
});

test("reviewed Fin Box harness repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreReviewedFinBoxHarnessRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreReviewedFinBoxHarnessRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCoreReviewedFinBoxHarnessRepairUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCoreReviewedFinBoxHarnessRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
