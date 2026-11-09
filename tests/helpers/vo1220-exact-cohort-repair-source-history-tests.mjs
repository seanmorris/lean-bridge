/**
 * Verify the complete exact-cohort repair, pin refresh and history integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertJsonEqual } from "./bounded-json-equality.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220ExactCohortRepair
	, beforeVo1220ExactCohortRepairSource
	, reverseVo1220ExactCohortRepairUpdate
	, vo1220ExactCohortRepairBehavior
	, vo1220ExactCohortRepairHistoryAdditions
	, vo1220ExactCohortRepairHistoryPath
	, vo1220ExactCohortRepairImplementation
	, vo1220ExactCohortRepairImplementationAdditions
	, vo1220ExactCohortRepairImplementationPaths
	, vo1220ExactCohortRepairIntegrationPaths
	, vo1220ExactCohortRepairNormalizationPaths
	, vo1220ExactCohortRepairPredecessor
} from "./vo1220-exact-cohort-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220ExactCohortRepairHistoryPath, "utf8"
));

test("exact-cohort repair authenticates its complete linear lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "vo1220-exact-cohort-repair-source-v1");
	assert.equal(record.predecessorCommit, vo1220ExactCohortRepairPredecessor);
	assert.equal(record.implementationCommit
		, vo1220ExactCohortRepairImplementation);
	assert.deepEqual(record.implementationCommits, git([
		"rev-list", "--reverse"
		, `${vo1220ExactCohortRepairPredecessor}..${vo1220ExactCohortRepairImplementation}`
	]).trim().split("\n"));
	for(const [index, revision] of record.implementationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? vo1220ExactCohortRepairPredecessor
				: record.implementationCommits[index - 1]);
	assert.deepEqual(record.updates.map(update => update.path)
		, vo1220ExactCohortRepairImplementationPaths);
	assert.deepEqual(record.implementationAdditions.map(addition => addition.path)
		, vo1220ExactCohortRepairImplementationAdditions);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, vo1220ExactCohortRepairIntegrationPaths);
	assert.deepEqual(record.historyAdditions.map(addition => addition.path)
		, vo1220ExactCohortRepairHistoryAdditions);
});

test("exact-cohort repair reverses every changed source to c02 first"
	, async () => {
		const record = await read();
		for(const update of record.updates)
		{
			const current = blob(vo1220ExactCohortRepairImplementation, update.path);
			const previous = blob(vo1220ExactCohortRepairPredecessor, update.path);
			assert.equal(reverseVo1220ExactCohortRepairUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeVo1220ExactCohortRepairSource(
				update.path, current), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(vo1220ExactCohortRepairNormalizationPaths.includes(update.path));
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(vo1220ExactCohortRepairImplementation, update.path);
			assert.equal(reverseVo1220ExactCohortRepairUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("exact-cohort repair authenticates every implementation and history addition"
	, async () => {
		const record = await read();
		for(const addition of record.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${vo1220ExactCohortRepairPredecessor}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(blob(
				vo1220ExactCohortRepairImplementation, addition.path))
				, addition.sha256, addition.path);
		}
		for(const addition of record.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
	}
);

test("exact-cohort repair preserves the exact model and refreshes only 450 live pins"
	, async () => {
		const record = await read();
		assert.deepEqual(record.behavior, vo1220ExactCohortRepairBehavior);
		assert.equal(record.changedSupportCells, 0);
		assert.equal(record.runtimeSemanticChanges, 1);
		const paths = [
			...vo1220ExactCohortRepairImplementationPaths
			, ...vo1220ExactCohortRepairImplementationAdditions
		];
		const sources = Object.fromEntries(paths.map(path => [
			path, blob(vo1220ExactCohortRepairImplementation, path)
		]));
		assert.deepEqual(assertVo1220ExactCohortRepair(sources)
			, vo1220ExactCohortRepairBehavior);
		const exactPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
		const previousExact = blob(vo1220ExactCohortRepairPredecessor, exactPath);
		const currentExact = blob(vo1220ExactCohortRepairImplementation, exactPath);
		assert.equal(currentExact, previousExact);
		assert.equal(record.exactModel.sha256, sha256(currentExact));
		const previous = JSON.parse(blob(
			vo1220ExactCohortRepairImplementation, "docs/type-surface.v1.json"
		));
		const currentSource = await sourceAtFinHistoryMilestone(
			"docs/type-surface.v1.json", record.inventorySha256.after);
		const current = JSON.parse(currentSource);
		assert.equal(record.inventorySha256.before, sha256(blob(
			vo1220ExactCohortRepairImplementation, "docs/type-surface.v1.json"
		)));
		assert.equal(record.inventorySha256.after, sha256(currentSource));
		const pins = new Map(record.currentSourcePins.map(pin => [pin.path, pin]));
		assert.equal(pins.size, vo1220ExactCohortRepairBehavior.currentSourcePaths);
		assert.equal(record.currentSourcePins.reduce(
			(sum, pin) => sum + pin.count, 0
		), vo1220ExactCohortRepairBehavior.refreshedPins);
		const counts = new Map();
		for(const evidence of current.evidence)
			for(const file of evidence.files)
			{
				const pin = pins.get(file.path);
				if(pin === undefined) continue;
				assert.equal(file.sha256, pin.current, file.path);
				file.sha256 = pin.previous;
				counts.set(file.path, (counts.get(file.path) ?? 0) + 1);
			}
		assertJsonEqual(current, previous
			, "Only the exact named current-source pins may change");
		for(const pin of pins.values())
		{
			assert.equal(counts.get(pin.path), pin.count, pin.path);
			assert.equal(pin.current, sha256(blob(
				vo1220ExactCohortRepairImplementation, pin.path)), pin.path);
			assert.equal(pin.previous, sha256(blob(
				vo1220ExactCohortRepairPredecessor, pin.path)), pin.path);
		}
	}
);

test("exact-cohort repair rejects unknown and forged transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220ExactCohortRepairImplementation, update.path);
	assert.equal(beforeVo1220ExactCohortRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeVo1220ExactCohortRepairSource(update.path, unknown)
		, unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }
		, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220ExactCohortRepairUpdate(
			current, forged));
	assert.equal(beforeVo1220ExactCohortRepairSource(
		"unrelated.mjs", current), current);
});

test("exact-cohort repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-exact-cohort-guard-"));
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
		"scripts/update-vo1220-exact-cohort-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr
		, /vo1220ExactCohortRepairImplementation|Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
