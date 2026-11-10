/**
 * Verify historical Core profile isolation and its reversible seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220HistoricalCoreProfileIsolation
	, beforeVo1220HistoricalCoreProfileIsolationSource
	, reverseVo1220HistoricalCoreProfileIsolationUpdate
	, vo1220HistoricalCoreProfileIsolationBehavior
	, vo1220HistoricalCoreProfileIsolationHistoryAdditions
	, vo1220HistoricalCoreProfileIsolationHistoryPath
	, vo1220HistoricalCoreProfileIsolationImplementation
	, vo1220HistoricalCoreProfileIsolationImplementationPaths
	, vo1220HistoricalCoreProfileIsolationIntegrationPaths
	, vo1220HistoricalCoreProfileIsolationPredecessor
} from "./vo1220-historical-core-profile-isolation-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const guardPath
	= "tests/helpers/vo1220-historical-core-profile-isolation-source-history-tests.mjs";
const history = async () => JSON.parse(await readFile(
	vo1220HistoricalCoreProfileIsolationHistoryPath, "utf8"));
const helperSources = async (directory = "tests/helpers") => {
	const values = [];
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = join(directory, entry.name).replaceAll("\\", "/");
		if(entry.isDirectory()) values.push(...await helperSources(path));
		else if(entry.isFile() && path.endsWith(".mjs"))
			values.push([path, await readFile(path, "utf8")]);
	}
	return values;
};

test("historical Core profile isolation records one exact implementation boundary"
	, async () => {
		const value = await history();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "vo1220-historical-core-profile-isolation-source-v1");
		assert.equal(value.predecessorCommit
			, vo1220HistoricalCoreProfileIsolationPredecessor);
		assert.equal(value.implementationCommit
			, vo1220HistoricalCoreProfileIsolationImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, vo1220HistoricalCoreProfileIsolationImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, vo1220HistoricalCoreProfileIsolationIntegrationPaths);
		assert.deepEqual(value.behavior
			, vo1220HistoricalCoreProfileIsolationBehavior);
	}
);

test("historical Core profile isolation reverses every authenticated source"
	, async () => {
		const value = await history();
		for(const update of value.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				vo1220HistoricalCoreProfileIsolationImplementation, update.path)
				, update), true, update.path);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				vo1220HistoricalCoreProfileIsolationImplementation, update.path);
			assert.equal(reverseVo1220HistoricalCoreProfileIsolationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeVo1220HistoricalCoreProfileIsolationSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("historical Core profiles never feed the live cost manifest", async () => {
	const sources = Object.fromEntries(
		vo1220HistoricalCoreProfileIsolationImplementationPaths.map(path => [
			path, blob(vo1220HistoricalCoreProfileIsolationImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220HistoricalCoreProfileIsolation(sources), {
		...vo1220HistoricalCoreProfileIsolationBehavior
		, historicalContractFiles: [1093, 1094]
	});
	const offenders = (await helperSources()).filter(([path, source]) =>
		path !== guardPath && source.includes("groupRepositoryTests")
		&& source.includes("ls-tree")
		&& source.includes("coreContractShardManifest"))
		.map(([path]) => path).sort();
	assert.deepEqual(offenders, []);
});

test("historical Core profile isolation authenticates additions and rejects forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, vo1220HistoricalCoreProfileIsolationHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates[0];
		const current = blob(
			vo1220HistoricalCoreProfileIsolationImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220HistoricalCoreProfileIsolationUpdate(current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-vo1220-historical-core-profile-isolation-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
