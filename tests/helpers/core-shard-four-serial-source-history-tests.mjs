/**
 * Authenticate serial Core shard 4 and the shard memory sampler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreShardFourSerialSource
	, coreShardFourSerialAddedPaths
	, coreShardFourSerialCommits
	, coreShardFourSerialHistoryPath
	, coreShardFourSerialImplementation
	, coreShardFourSerialImplementationPaths
	, coreShardFourSerialIntegrationPaths
	, coreShardFourSerialPredecessor
	, reverseCoreShardFourSerialUpdate
} from "./core-shard-four-serial-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreShardFourSerialHistoryPath, "utf8"
));

test("serial Core shard 4 records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-shard-four-serial-source-v1");
	assert.equal(value.predecessorCommit, coreShardFourSerialPredecessor);
	assert.equal(value.implementationCommit
		, coreShardFourSerialImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreShardFourSerialImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreShardFourSerialIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, coreShardFourSerialAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreShardFourSerialPredecessor}..${coreShardFourSerialImplementation}`]).trim().split("\n")
		, coreShardFourSerialCommits);
});

test("serial Core shard 4 reverses every source transition", async () => {
	const value = await record();
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreShardFourSerialSource);
		const base = value.integrationUpdates.includes(update)
			? coreShardFourSerialImplementation
			: coreShardFourSerialPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreShardFourSerialUpdate(current, update)
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

test("serial Core shard 4 changes one workflow source pin and no profile source", () => {
	const previous = JSON.parse(git(["show"
		, `${coreShardFourSerialPredecessor}:docs/type-surface.v1.json`]));
	const current = JSON.parse(git(["show"
		, `${coreShardFourSerialImplementation}:docs/type-surface.v1.json`]));
	const oldFiles = previous.evidence.flatMap(item => item.files ?? []);
	const newFiles = current.evidence.flatMap(item => item.files ?? []);
	assert.equal(oldFiles.length, newFiles.length);
	const changed = [];
	for(let index = 0; index < oldFiles.length; ++index)
	{
		assert.equal(oldFiles[index].path, newFiles[index].path);
		if(oldFiles[index].sha256 !== newFiles[index].sha256)
			changed.push(oldFiles[index].path);
	}
	assert.deepEqual(changed, [".github/workflows/quality.yml"]);
	for(const path of ["src", "scripts/core-contract-shards.mjs"
		, "src/adoption/test-profiles.mjs", "package.json"])
		assert.equal(git(["rev-parse", `${coreShardFourSerialPredecessor}:${path}`])
			, git(["rev-parse", `${coreShardFourSerialImplementation}:${path}`]), path);
});

test("serial Core shard 4 rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreShardFourSerialImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreShardFourSerialUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseCoreShardFourSerialUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeCoreShardFourSerialSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
