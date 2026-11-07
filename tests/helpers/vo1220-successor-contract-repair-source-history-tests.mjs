/**
 * Verify the successor contract repair, pin refresh and history integration.
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
	assertVo1220SuccessorContractRepair
	, beforeVo1220SuccessorContractRepairSource
	, reverseVo1220SuccessorContractRepairUpdate
	, vo1220SuccessorContractRepairBehavior
	, vo1220SuccessorContractRepairHistoryAdditions
	, vo1220SuccessorContractRepairHistoryPath
	, vo1220SuccessorContractRepairImplementation
	, vo1220SuccessorContractRepairImplementationPaths
	, vo1220SuccessorContractRepairIntegrationPaths
	, vo1220SuccessorContractRepairNormalizationPaths
	, vo1220SuccessorContractRepairPredecessor
} from "./vo1220-successor-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220SuccessorContractRepairHistoryPath, "utf8"
));

test("successor contract repair authenticates and reverses every transition"
	, async () => {
		const record = await read();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "vo1220-successor-contract-repair-source-v1");
		assert.equal(record.predecessorCommit
			, vo1220SuccessorContractRepairPredecessor);
		assert.equal(record.implementationCommit
			, vo1220SuccessorContractRepairImplementation);
		assert.deepEqual(record.updates.map(update => update.path)
			, vo1220SuccessorContractRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(update => update.path)
			, vo1220SuccessorContractRepairIntegrationPaths);
		assert.deepEqual(record.historyAdditions.map(addition => addition.path)
			, vo1220SuccessorContractRepairHistoryAdditions);
		for(const addition of record.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256))
				, addition.sha256, addition.path);
		for(const update of record.updates)
		{
			const current = blob(vo1220SuccessorContractRepairImplementation
				, update.path);
			const previous = blob(vo1220SuccessorContractRepairPredecessor
				, update.path);
			assert.equal(reverseVo1220SuccessorContractRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(vo1220SuccessorContractRepairImplementation
				, update.path);
			assert.equal(reverseVo1220SuccessorContractRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("successor contract repair preserves the exact model and support claims"
	, async () => {
		const record = await read();
		assert.deepEqual(record.behavior, vo1220SuccessorContractRepairBehavior);
		assert.equal(record.changedSupportCells, 0);
		assert.equal(record.runtimeSemanticChanges, 0);
		const sources = Object.fromEntries(
			vo1220SuccessorContractRepairImplementationPaths.map(path => [
				path, blob(vo1220SuccessorContractRepairImplementation, path)
			])
		);
		assert.deepEqual(assertVo1220SuccessorContractRepair(sources)
			, vo1220SuccessorContractRepairBehavior);
		const exactPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
		const previousExact = blob(
			vo1220SuccessorContractRepairPredecessor, exactPath);
		const currentExact = blob(
			vo1220SuccessorContractRepairImplementation, exactPath);
		assert.equal(currentExact, previousExact);
		assert.equal(record.exactModel.sha256, sha256(currentExact));
		const before = JSON.parse(blob(
			vo1220SuccessorContractRepairImplementation
			, "docs/type-surface.v1.json"));
		const afterSource = await sourceAtFinHistoryMilestone(
			"docs/type-surface.v1.json", record.inventorySha256.after);
		const after = JSON.parse(afterSource);
		const pins = new Map(record.currentSourcePins.map(pin => [pin.path, pin]));
		assert.equal(pins.size
			, vo1220SuccessorContractRepairBehavior.currentSourcePaths);
		assert.equal(record.currentSourcePins.reduce(
			(sum, pin) => sum + pin.count, 0)
			, vo1220SuccessorContractRepairBehavior.refreshedPins);
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

test("successor contract repair rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(vo1220SuccessorContractRepairImplementation
			, update.path);
		assert.equal(beforeVo1220SuccessorContractRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220SuccessorContractRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseVo1220SuccessorContractRepairUpdate(
				current, forged));
		assert.ok(vo1220SuccessorContractRepairNormalizationPaths
			.includes(update.path));
	}
);

test("successor contract repair writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-successor-contract-guard-`);
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
		"scripts/update-vo1220-successor-contract-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
