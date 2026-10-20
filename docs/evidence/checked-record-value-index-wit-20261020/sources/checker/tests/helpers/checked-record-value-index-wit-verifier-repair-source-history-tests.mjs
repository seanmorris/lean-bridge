/**
 * Preserve every predecessor through the WIT value-index verifier shadowing
 * repair.
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
	beforeCheckedRecordValueIndexWitVerifierRepairSource
	, checkedRecordValueIndexWitVerifierRepairAddedPaths
	, checkedRecordValueIndexWitVerifierRepairChangedPaths
	, checkedRecordValueIndexWitVerifierRepairDraftParent
	, checkedRecordValueIndexWitVerifierRepairHistoryPath
	, checkedRecordValueIndexWitVerifierRepairPredecessor
	, reverseCheckedRecordValueIndexWitVerifierRepairUpdate
} from "./checked-record-value-index-wit-verifier-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("WIT value-index verifier repair has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitVerifierRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-wit-verifier-repair-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexWitVerifierRepairPredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexWitVerifierRepairDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexWitVerifierRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexWitVerifierRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexWitVerifierRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
				, beforeCheckedRecordValueIndexWitVerifierRepairSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexWitVerifierRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexWitVerifierRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexWitVerifierRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexWitVerifierRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeCheckedRecordValueIndexWitVerifierRepairSource(
			update.path, unknown), unknown, update.path);
	}
	const model = record.updates.find(update => update.path.endsWith(
		"checked-record-value-index-wit-model-records.mjs"
	));
	assert.ok(model);
	const current = await sourceAtFinHistoryMilestone(
		model.path, model.currentSha256
		, beforeCheckedRecordValueIndexWitVerifierRepairSource
	);
	assert.match(current, /let request = configuration;/u);
	assert.doesNotMatch(current, /let selection = configuration;/u);
});

test("WIT value-index verifier repair closes every addition", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitVerifierRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeCheckedRecordValueIndexWitVerifierRepairSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexWitVerifierRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("WIT value-index verifier history writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-wit-verifier-history-guard-"
		));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const localGit = args => execFileSync("git", args, {
			cwd: root, env: environment, stdio: "pipe"
		});
		localGit(["init", "--quiet"]);
		localGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-checked-record-value-index-wit-verifier-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact repair commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
