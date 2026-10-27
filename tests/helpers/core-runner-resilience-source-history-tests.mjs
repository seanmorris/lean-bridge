/**
 * Prove the Core runner-resilience transition and its unchanged coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	collectCoreContractTestPaths, coreContractShardLabels
	, coreContractShardManifest, verifyCoreContractShardManifests
} from "../../scripts/core-contract-shards.mjs";
import {
	beforeCoreRunnerResilienceSource
	, coreRunnerResilienceAddedPaths
	, coreRunnerResilienceChangedPaths
	, coreRunnerResilienceCommits
	, coreRunnerResilienceHistoryPath
	, coreRunnerResilienceImplementation
	, coreRunnerResilienceImplementationPaths
	, coreRunnerResilienceIntegrationBase
	, coreRunnerResilienceIntegrationPaths
	, coreRunnerResiliencePredecessor
	, reverseCoreRunnerResilienceUpdate
} from "./core-runner-resilience-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceHistoryTransition } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	coreRunnerResilienceHistoryPath, "utf8"
));

test("Core runner resilience records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-runner-resilience-source-v1");
	assert.equal(record.predecessorCommit, coreRunnerResiliencePredecessor);
	assert.equal(record.implementationCommit, coreRunnerResilienceImplementation);
	assert.equal(record.integrationBaseCommit, coreRunnerResilienceIntegrationBase);
	assert.deepEqual(record.implementationCommits, coreRunnerResilienceCommits);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreRunnerResilienceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreRunnerResilienceIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreRunnerResilienceAddedPaths);
	for(const [index, revision] of coreRunnerResilienceCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? coreRunnerResiliencePredecessor
				: coreRunnerResilienceCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, coreRunnerResiliencePredecessor
		, coreRunnerResilienceImplementation]).trim().split("\n")
	, [...coreRunnerResilienceImplementationPaths].sort());
});

test("Core runner resilience reverses every source transition", async () => {
	const record = await read();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.deepEqual(await gitSourceHistoryTransition(update.path
				, coreRunnerResiliencePredecessor
				, coreRunnerResilienceImplementation), update);
			continue;
		}
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreRunnerResilienceSource);
		const prior = record.integrationUpdates.includes(update)
			? coreRunnerResilienceIntegrationBase
			: coreRunnerResiliencePredecessor;
		const previous = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseCoreRunnerResilienceUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Core runner resilience keeps the complete contract in bounded jobs", async () => {
	const paths = await collectCoreContractTestPaths();
	const manifests = coreContractShardLabels.map(label =>
		coreContractShardManifest(paths, label));
	assert.ok(paths.length > 0);
	assert.equal(manifests.length, 12);
	const counts = manifests.map(item => item.selection.count);
	assert.equal(counts.reduce((total, count) => total + count, 0), paths.length);
	assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
	assert.deepEqual(verifyCoreContractShardManifests(paths, manifests), {
		schemaVersion: 1, partition: "sorted-index-modulo-v1", shards: 12
		, contractFiles: paths.length
		, contractSha256: manifests[0].contract.sha256
	});
	const workflow = await readFile(".github/workflows/quality.yml", "utf8");
	assert.match(workflow, /max-parallel: 6/u);
	assert.match(workflow, /shard: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/u);
	assert.match(workflow, /--shard "\$\{\{ matrix\.shard \}\}\/12"/u);
	const runner = await readFile("scripts/run-test-profile.mjs", "utf8");
	assert.match(runner, /"--test-concurrency=2"/u);
	assert.match(runner, /"--max-old-space-size=4096"/u);
	for(const path of ["src", "site", "docs/consume", "docs/lean"
		, "docs/publish", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse"
			, `${coreRunnerResiliencePredecessor}:${path}`])
			, git(["rev-parse"
				, `${coreRunnerResilienceImplementation}:${path}`]), path);
});

test("Core runner resilience refreshes only its workflow source pin", async () => {
	const record = await read();
	const update = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	assert.ok(update);
	assert.equal(update.edits.length, 1);
	const previous = sha256(git(["show"
		, `${coreRunnerResiliencePredecessor}:.github/workflows/quality.yml`]));
	const current = sha256(git(["show"
		, `${coreRunnerResilienceImplementation}:.github/workflows/quality.yml`]));
	assert.equal(update.edits[0].previous
		, `          "sha256": "${previous}"\n`);
	assert.equal(update.edits[0].current
		, `          "sha256": "${current}"\n`);
});

test("Core runner resilience rejects unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeCoreRunnerResilienceSource);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreRunnerResilienceUpdate(current, forged));
	assert.equal(beforeCoreRunnerResilienceSource(
		update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeCoreRunnerResilienceSource(
		"unrelated.mjs", current), current);
});

test("Core runner-resilience writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-runner-resilience-history-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-runner-resilience-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
