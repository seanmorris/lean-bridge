/**
 * Authenticate the complete history-hub fixed-point repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
	beforeCoreHistoryHubFixedPointSource
	, coreHistoryHubFixedPointHistoryAdditions
	, coreHistoryHubFixedPointHistoryPath
	, coreHistoryHubFixedPointImplementation
	, coreHistoryHubFixedPointImplementationPaths
	, coreHistoryHubFixedPointIntegrationPaths
	, coreHistoryHubFixedPointPredecessor
	, reverseCoreHistoryHubFixedPointUpdate
} from "./core-history-hub-fixed-point-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreHistoryHubFixedPointHistoryPath, "utf8"));
const legacyEndpointPattern
	= /const source = (before(?!FinRefinementSource)[A-Za-z0-9_]+Source)\(\s*update\.path\s*,\s*await readFile\(\s*update\.path\s*,\s*"utf8"\s*\)\s*(?:,\s*update\.currentSha256)?\s*\)/gu;

test("history hub fixed point records the complete failure cohort", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-history-hub-fixed-point-source-v1");
	assert.equal(history.predecessorCommit
		, coreHistoryHubFixedPointPredecessor);
	assert.equal(history.implementationCommit
		, coreHistoryHubFixedPointImplementation);
	assert.deepEqual(history.failedRun, {
		workflow: 41170510578
		, jobs: [124447261222, 124447261242]
	});
	assert.equal(history.implementationPaths, 30);
	assert.equal(history.legacyEndpointAdapters, 29);
	assert.equal(history.initialAdapters, 26);
	assert.equal(history.scannerDiscoveredAdapters, 3);
	assert.equal(history.fixedPointReentry, true);
	assert.equal(history.typeSurfaceChanges, 0);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreHistoryHubFixedPointImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreHistoryHubFixedPointIntegrationPaths);
});

test("history hub fixed point reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreHistoryHubFixedPointImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, coreHistoryHubFixedPointImplementation + ":" + update.path]);
		assert.equal(reverseCoreHistoryHubFixedPointUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreHistoryHubFixedPointSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("history hub re-enters until an exact older endpoint is reached"
	, async () => {
		const expected
			= "957bfdc204e97007fa1ed603596e9cbb36b5dca30e54a6d7e193ece5d7c7881d";
		const source = beforeFinRefinementSource(
			"package.json", await readFile("package.json", "utf8"), expected);
		assert.equal(sha256(source), expected);
	}
);

test("every source-history endpoint enters through the complete hub"
	, async () => {
		const directory = new URL("./", import.meta.url);
		const paths = (await readdir(directory)).filter(path =>
			path.endsWith("-source-history-tests.mjs"));
		const sources = await Promise.all(paths.map(async path => [
			path, await readFile(new URL(path, directory), "utf8")
		]));
		const mismatches = sources.flatMap(([path, source]) =>
			[...source.matchAll(legacyEndpointPattern)].map(match => ({
				path, adapter: match[1]
			}))
		);
		assert.deepEqual(mismatches, []);
		const target = sources.find(([, source]) => source.includes(
			"const source = beforeFinRefinementSource(update.path"));
		assert.ok(target);
		const mutant = target[1].replace(
			"const source = beforeFinRefinementSource(update.path"
			, "const source = beforeLegacySource(update.path");
		assert.deepEqual([...mutant.matchAll(legacyEndpointPattern)]
			.map(match => ({ path: target[0], adapter: match[1] })), [{
				path: target[0], adapter: "beforeLegacySource"
			}]
		);
	}
);

test("history hub fixed point preserves the frozen #1220 exact model"
	, async () => {
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		const path = "docs/type-surface.v1.json";
		assert.equal(sha256(git(["show"
			, coreHistoryHubFixedPointPredecessor + ":" + path]))
			, sha256(git(["show"
				, coreHistoryHubFixedPointImplementation + ":" + path])));
	}
);

test("history hub fixed point authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, coreHistoryHubFixedPointHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, coreHistoryHubFixedPointImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseCoreHistoryHubFixedPointUpdate(current, forged));
	}
);

test("history hub fixed-point writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-history-hub-fixed-point-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /core-history-hub-fixed-point-source-history-20261031\.json/u);
});
