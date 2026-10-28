/**
 * Authenticate the nine Core milestone-read and checker repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreReadSiteRepairSource
	, coreReadSiteRepairAddedPaths
	, coreReadSiteRepairCommits
	, coreReadSiteRepairHistoryPath
	, coreReadSiteRepairImplementation
	, coreReadSiteRepairImplementationPaths
	, coreReadSiteRepairIntegrationPaths
	, coreReadSiteRepairPredecessor
	, reverseCoreReadSiteRepairUpdate
} from "./core-read-site-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreReadSiteRepairHistoryPath, "utf8"
));

test("Core read-site repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-read-site-repair-source-v1");
	assert.equal(value.predecessorCommit, coreReadSiteRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreReadSiteRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreReadSiteRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreReadSiteRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, coreReadSiteRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreReadSiteRepairPredecessor}..${coreReadSiteRepairImplementation}`]).trim().split("\n")
		, coreReadSiteRepairCommits);
});

test("Core read-site repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreReadSiteRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreReadSiteRepairImplementation
			: coreReadSiteRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreReadSiteRepairUpdate(current, update)
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

test("Core read-site repair changes no support inventory, pin or product source", () => {
	for(const path of ["docs/type-surface.v1.json", "src", "scripts", ".github"
		, "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${coreReadSiteRepairPredecessor}:${path}`])
			, git(["rev-parse", `${coreReadSiteRepairImplementation}:${path}`]), path);
});

test("Core read-site repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreReadSiteRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreReadSiteRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCoreReadSiteRepairUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCoreReadSiteRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
