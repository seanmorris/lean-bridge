/**
 * Authenticate the frozen pre-Box report recount repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCorePreBoxRecountRepairSource
	, corePreBoxRecountRepairAddedPaths
	, corePreBoxRecountRepairCommits
	, corePreBoxRecountRepairHistoryPath
	, corePreBoxRecountRepairImplementation
	, corePreBoxRecountRepairImplementationPaths
	, corePreBoxRecountRepairIntegrationPaths
	, corePreBoxRecountRepairPredecessor
	, reverseCorePreBoxRecountRepairUpdate
} from "./core-pre-box-recount-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	corePreBoxRecountRepairHistoryPath, "utf8"
));

test("pre-Box recount repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-pre-box-recount-repair-source-v1");
	assert.equal(value.predecessorCommit, corePreBoxRecountRepairPredecessor);
	assert.equal(value.implementationCommit, corePreBoxRecountRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, corePreBoxRecountRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, corePreBoxRecountRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, corePreBoxRecountRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${corePreBoxRecountRepairPredecessor}..${corePreBoxRecountRepairImplementation}`]).trim().split("\n")
		, corePreBoxRecountRepairCommits);
});

test("pre-Box recount repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCorePreBoxRecountRepairSource);
		const base = value.integrationUpdates.includes(update)
			? corePreBoxRecountRepairImplementation
			: corePreBoxRecountRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCorePreBoxRecountRepairUpdate(current, update)
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

test("pre-Box recount repair changes no runtime or inventory source", () => {
	for(const path of ["src", "docs/type-surface.v1.json"
		, "scripts/core-contract-shards.mjs", "package.json"])
		assert.equal(git(["rev-parse"
			, `${corePreBoxRecountRepairPredecessor}:${path}`])
		, git(["rev-parse"
			, `${corePreBoxRecountRepairImplementation}:${path}`]), path);
});

test("pre-Box recount repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${corePreBoxRecountRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCorePreBoxRecountRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCorePreBoxRecountRepairUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCorePreBoxRecountRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
