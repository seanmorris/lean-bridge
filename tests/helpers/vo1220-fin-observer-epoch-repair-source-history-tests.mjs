/**
 * Verify the strict-host current/historical Fin observer epoch repair and seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220FinObserverEpochRepair
	, beforeVo1220FinObserverEpochRepairSource
	, reverseVo1220FinObserverEpochRepairUpdate
	, vo1220FinObserverEpochRepairBehavior
	, vo1220FinObserverEpochRepairHistoryAdditions
	, vo1220FinObserverEpochRepairHistoryPath
	, vo1220FinObserverEpochRepairImplementation
	, vo1220FinObserverEpochRepairImplementationPaths
	, vo1220FinObserverEpochRepairIntegrationPaths
	, vo1220FinObserverEpochRepairNormalizationPaths
	, vo1220FinObserverEpochRepairPredecessor
} from "./vo1220-fin-observer-epoch-repair-source-history.mjs";

const baseDigest
	= "8ec3837e38f9a5127c54b8da375008f2e5321763481bf384b91292668b6ec64f";
const basePaths = Object.freeze([
	"docs/evidence/fin-container-edge-integration-20261010/source.tap"
	, "docs/evidence/fin-container-edges-measured-20261010/dotnet/report.json"
	, "docs/evidence/fin-container-edges-measured-20261010/php-native/report.json"
	, "docs/evidence/fin-container-edges-measured-20261010/ruby/report.json"
	, "docs/evidence/fin-container-foreign-measured-20261010/dotnet/report.json"
	, "docs/evidence/fin-container-foreign-measured-20261010/php-native/report.json"
	, "docs/evidence/fin-container-foreign-measured-20261010/ruby/report.json"
	, "docs/evidence/fin-dotnet-sdk-installed-20261010/report.json"
]);
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220FinObserverEpochRepairHistoryPath, "utf8"
));

test("Fin observer epoch repair authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-fin-observer-epoch-repair-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220FinObserverEpochRepairPredecessor);
	assert.equal(value.implementationCommit
		, vo1220FinObserverEpochRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220FinObserverEpochRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220FinObserverEpochRepairIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220FinObserverEpochRepairHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of value.updates)
	{
		const current = blob(vo1220FinObserverEpochRepairImplementation
			, update.path);
		const previous = blob(vo1220FinObserverEpochRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220FinObserverEpochRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220FinObserverEpochRepairImplementation
			, update.path);
		assert.equal(reverseVo1220FinObserverEpochRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Fin observer epoch repair preserves support and inventories every base observer", async () => {
	const value = await read();
	assert.deepEqual(value.behavior, vo1220FinObserverEpochRepairBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.measurementSemanticChanges, 0);
	assert.equal(value.behavior.testContractChanges, 1);
	assert.equal(value.behavior.strictHostProfiles, 3);
	assert.equal(value.behavior.observerEpochs, 2);
	assert.equal(value.behavior.uncheckedObserverEpochs, 0);
	assert.deepEqual(value.currentSourcePins, []);
	assert.equal(value.inventorySha256.before, value.inventorySha256.after);
	assert.deepEqual(value.retainedBaseObserver.paths, basePaths);
	assert.equal(value.retainedBaseObserver.sha256, baseDigest);
	for(const path of basePaths)
		assert.ok(blob(vo1220FinObserverEpochRepairImplementation, path)
			.includes(baseDigest), path);
	const sources = Object.fromEntries(
		vo1220FinObserverEpochRepairImplementationPaths.map(path => [
			path, blob(vo1220FinObserverEpochRepairImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220FinObserverEpochRepair(sources)
		, vo1220FinObserverEpochRepairBehavior);
	assert.equal(blob(vo1220FinObserverEpochRepairPredecessor
		, "docs/evidence/vo1220-exact-type-surface-v1.json")
		, blob(vo1220FinObserverEpochRepairImplementation
			, "docs/evidence/vo1220-exact-type-surface-v1.json"));
});

test("Fin observer epoch repair rejects unknown and forged transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220FinObserverEpochRepairImplementation
		, update.path);
	assert.equal(beforeVo1220FinObserverEpochRepairSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220FinObserverEpochRepairSource(
		update.path, current + "unknown"), current + "unknown");
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220FinObserverEpochRepairUpdate(
			current, forged));
	assert.ok(vo1220FinObserverEpochRepairNormalizationPaths
		.includes(update.path));
});

test("Fin observer epoch writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-fin-observer-epoch-guard-`);
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-fin-observer-epoch-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
