/**
 * Authenticate the legacy npm Fin archive repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreLegacyFinArchiveRepairSource
	, coreLegacyFinArchiveRepairAddedPaths
	, coreLegacyFinArchiveRepairCommits
	, coreLegacyFinArchiveRepairHistoryPath
	, coreLegacyFinArchiveRepairImplementation
	, coreLegacyFinArchiveRepairImplementationPaths
	, coreLegacyFinArchiveRepairIntegrationPaths
	, coreLegacyFinArchiveRepairPredecessor
	, reverseCoreLegacyFinArchiveRepairUpdate
} from "./core-legacy-fin-archive-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreLegacyFinArchiveRepairHistoryPath, "utf8"
));

test("legacy Fin archive repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-legacy-fin-archive-repair-source-v1");
	assert.equal(value.predecessorCommit, coreLegacyFinArchiveRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreLegacyFinArchiveRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreLegacyFinArchiveRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreLegacyFinArchiveRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, coreLegacyFinArchiveRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreLegacyFinArchiveRepairPredecessor}..${coreLegacyFinArchiveRepairImplementation}`]).trim().split("\n")
		, coreLegacyFinArchiveRepairCommits);
});

test("legacy Fin archive repair reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreLegacyFinArchiveRepairSource);
		const base = value.integrationUpdates.includes(update)
			? coreLegacyFinArchiveRepairImplementation
			: coreLegacyFinArchiveRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreLegacyFinArchiveRepairUpdate(current, update)
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

test("legacy Fin archive repair refreshes exactly four source pins", () => {
	const previous = JSON.parse(git(["show"
		, `${coreLegacyFinArchiveRepairPredecessor}:docs/type-surface.v1.json`]));
	const current = JSON.parse(git(["show"
		, `${coreLegacyFinArchiveRepairImplementation}:docs/type-surface.v1.json`]));
	const oldFiles = previous.evidence.flatMap(item => item.files ?? []);
	const newFiles = current.evidence.flatMap(item => item.files ?? []);
	assert.equal(oldFiles.length, newFiles.length);
	let changed = 0;
	for(let index = 0; index < oldFiles.length; ++index)
	{
		assert.equal(oldFiles[index].path, newFiles[index].path);
		if(oldFiles[index].sha256 !== newFiles[index].sha256) changed++;
	}
	assert.equal(changed, 4);
});

test("legacy Fin archive repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreLegacyFinArchiveRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreLegacyFinArchiveRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeCoreLegacyFinArchiveRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
