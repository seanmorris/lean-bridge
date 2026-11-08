/**
 * Verify the exact-head retained-contract repair and its source-history seal.
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
	assertVo1220ExactHeadRetainedContractRepair
	, beforeVo1220ExactHeadRetainedContractRepairSource
	, reverseVo1220ExactHeadRetainedContractRepairUpdate
	, vo1220ExactHeadRetainedContractRepairBehavior
	, vo1220ExactHeadRetainedContractRepairHistoryAdditions
	, vo1220ExactHeadRetainedContractRepairHistoryPath
	, vo1220ExactHeadRetainedContractRepairImplementation
	, vo1220ExactHeadRetainedContractRepairImplementationPaths
	, vo1220ExactHeadRetainedContractRepairIntegrationPaths
	, vo1220ExactHeadRetainedContractRepairNormalizationPaths
	, vo1220ExactHeadRetainedContractRepairPredecessor
} from "./vo1220-exact-head-retained-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220ExactHeadRetainedContractRepairHistoryPath, "utf8"
));

test("exact-head retained repair authenticates and reverses every transition"
	, async () => {
		const record = await read();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "vo1220-exact-head-retained-contract-repair-source-v1");
		assert.equal(record.predecessorCommit
			, vo1220ExactHeadRetainedContractRepairPredecessor);
		assert.equal(record.implementationCommit
			, vo1220ExactHeadRetainedContractRepairImplementation);
		assert.deepEqual(record.updates.map(update => update.path)
			, vo1220ExactHeadRetainedContractRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(update => update.path)
			, vo1220ExactHeadRetainedContractRepairIntegrationPaths);
		assert.deepEqual(record.historyAdditions.map(addition => addition.path)
			, vo1220ExactHeadRetainedContractRepairHistoryAdditions);
		for(const addition of record.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		for(const update of record.updates)
		{
			const current = blob(
				vo1220ExactHeadRetainedContractRepairImplementation, update.path);
			const previous = blob(
				vo1220ExactHeadRetainedContractRepairPredecessor, update.path);
			assert.equal(reverseVo1220ExactHeadRetainedContractRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				vo1220ExactHeadRetainedContractRepairImplementation, update.path);
			assert.equal(reverseVo1220ExactHeadRetainedContractRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("exact-head retained repair preserves the exact model and support claims"
	, async () => {
		const record = await read();
		assert.deepEqual(record.behavior
			, vo1220ExactHeadRetainedContractRepairBehavior);
		assert.equal(record.changedSupportCells, 0);
		assert.equal(record.runtimeSemanticChanges, 0);
		const sources = Object.fromEntries(
			vo1220ExactHeadRetainedContractRepairImplementationPaths.map(path => [
				path, blob(vo1220ExactHeadRetainedContractRepairImplementation, path)
			])
		);
		assert.deepEqual(assertVo1220ExactHeadRetainedContractRepair(sources)
			, vo1220ExactHeadRetainedContractRepairBehavior);
		const exactPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
		const previousExact = blob(
			vo1220ExactHeadRetainedContractRepairPredecessor, exactPath);
		const currentExact = blob(
			vo1220ExactHeadRetainedContractRepairImplementation, exactPath);
		assert.equal(currentExact, previousExact);
		assert.equal(record.exactModel.sha256, sha256(currentExact));
		const before = JSON.parse(blob(
			vo1220ExactHeadRetainedContractRepairImplementation
			, "docs/type-surface.v1.json"));
		const afterSource = await sourceAtFinHistoryMilestone(
			"docs/type-surface.v1.json", record.inventorySha256.after);
		const after = JSON.parse(afterSource);
		const pins = new Map(record.currentSourcePins.map(pin => [pin.path, pin]));
		assert.equal(pins.size
			, vo1220ExactHeadRetainedContractRepairBehavior.currentSourcePaths);
		assert.equal(record.currentSourcePins.reduce(
			(sum, pin) => sum + pin.count, 0)
			, vo1220ExactHeadRetainedContractRepairBehavior.refreshedPins);
		for(const evidence of after.evidence) for(const file of evidence.files)
		{
			const pin = pins.get(file.path);
			if(pin === undefined) continue;
			assert.equal(file.sha256, pin.current, file.path);
			file.sha256 = pin.previous;
		}
		assert.deepEqual(after, before
			, "Only named current-source pins may change");
	}
);

test("exact-head retained repair rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(
			vo1220ExactHeadRetainedContractRepairImplementation, update.path);
		assert.equal(beforeVo1220ExactHeadRetainedContractRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220ExactHeadRetainedContractRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220ExactHeadRetainedContractRepairUpdate(current, forged));
		assert.ok(vo1220ExactHeadRetainedContractRepairNormalizationPaths
			.includes(update.path));
	}
);

test("exact-head retained repair writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-exact-head-retained-guard-`);
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
		"scripts/update-vo1220-exact-head-retained-contract-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
