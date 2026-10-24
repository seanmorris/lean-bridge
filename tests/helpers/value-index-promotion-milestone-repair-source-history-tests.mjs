/**
 * Authenticate the explicit Value-index promotion milestone repair.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeValueIndexPromotionMilestoneRepairSource
	, valueIndexPromotionMilestoneRepairAddedPaths
	, valueIndexPromotionMilestoneRepairChangedPaths
	, valueIndexPromotionMilestoneRepairHistoryPath
	, valueIndexPromotionMilestoneRepairImplementation
	, valueIndexPromotionMilestoneRepairIntegrationBase
	, valueIndexPromotionMilestoneRepairIntegrationPaths
	, valueIndexPromotionMilestoneRepairPredecessor
	, reverseValueIndexPromotionMilestoneRepairUpdate
} from "./value-index-promotion-milestone-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Value-index promotion milestone repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		valueIndexPromotionMilestoneRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "value-index-promotion-milestone-repair-source-v1");
	assert.equal(record.predecessorCommit
		, valueIndexPromotionMilestoneRepairPredecessor);
	assert.equal(record.implementationCommit
		, valueIndexPromotionMilestoneRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, valueIndexPromotionMilestoneRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, valueIndexPromotionMilestoneRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, valueIndexPromotionMilestoneRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexPromotionMilestoneRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeValueIndexPromotionMilestoneRepairSource);
		const previous = git(["show"
			, `${valueIndexPromotionMilestoneRepairPredecessor}:${update.path}`]);
		assert.equal(reverseValueIndexPromotionMilestoneRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeValueIndexPromotionMilestoneRepairSource);
		const previous = git(["show"
			, `${valueIndexPromotionMilestoneRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseValueIndexPromotionMilestoneRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Value-index promotion milestone repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${valueIndexPromotionMilestoneRepairImplementation}^`]).trim()
	, valueIndexPromotionMilestoneRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, valueIndexPromotionMilestoneRepairPredecessor
		, valueIndexPromotionMilestoneRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...valueIndexPromotionMilestoneRepairChangedPaths].sort());
});

test("Value-index promotion milestone repair refreshes exactly 40 pins only", async () => {
	const record = JSON.parse(await readFile(
		valueIndexPromotionMilestoneRepairHistoryPath, "utf8"));
	const update = record.integrationUpdates.find(item =>
		item.path === "docs/type-surface.v1.json");
	assert.ok(update);
	const current = JSON.parse(await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256));
	const previous = JSON.parse(git(["show"
		, `${valueIndexPromotionMilestoneRepairIntegrationBase}:${update.path}`]));
	const expected = new Map([
		["tests/helpers/checked-record-value-index-php-wasm-promotion-tests.mjs", 4]
		, ["tests/helpers/checked-record-value-index-php-wasm-promotion.mjs", 4]
		, ["tests/helpers/checked-record-value-index-python-promotion-tests.mjs", 4]
		, ["tests/helpers/checked-record-value-index-python-promotion.mjs", 4]
		, ["tests/helpers/checked-record-value-index-ruby-promotion-tests.mjs", 4]
		, ["tests/helpers/checked-record-value-index-ruby-promotion.mjs", 4]
		, ["tests/helpers/checked-record-value-index-rust-promotion-tests.mjs", 4]
		, ["tests/helpers/checked-record-value-index-rust-promotion.mjs", 4]
		, ["tests/helpers/checked-record-value-index-wit-promotion-tests.mjs", 4]
		, ["tests/helpers/checked-record-value-index-wit-promotion.mjs", 4]
	]);
	const counts = new Map([...expected.keys()].map(path => [path, 0]));
	assert.equal(current.evidence.length, previous.evidence.length);
	for(const [index, evidence] of current.evidence.entries())
	{
		const oldEvidence = previous.evidence[index];
		assert.equal(evidence.files.length, oldEvidence.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = oldEvidence.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				const source = record.updates.find(item => item.path === file.path);
				assert.ok(source);
				assert.equal(old.sha256, source.previousSha256, file.path);
				assert.equal(file.sha256, source.currentSha256, file.path);
				old.sha256 = file.sha256;
				counts.set(file.path, counts.get(file.path) + 1);
			}
			else
			{
				assert.ok(!valueIndexPromotionMilestoneRepairChangedPaths.includes(file.path)
					, `Unexpected source pin requires refresh: ${file.path}`);
				assert.equal(file.sha256, old.sha256, file.path);
			}
		}
	}
	assert.deepEqual(counts, expected);
	assert.deepEqual(current, previous
		, "No support claim or observation may change with this source-pin repair");
});

test("Value-index promotion milestone repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		valueIndexPromotionMilestoneRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeValueIndexPromotionMilestoneRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseValueIndexPromotionMilestoneRepairUpdate(
		current, update));
});

test("Value-index promotion milestone writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-value-index-promotion-milestone-repair-history-"));
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
		"scripts/update-value-index-promotion-milestone-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
