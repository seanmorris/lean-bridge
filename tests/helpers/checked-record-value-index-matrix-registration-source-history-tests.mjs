/** Verify the exact contract-profile registration for matrix tests. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import {
	beforeCheckedRecordValueIndexMatrixRegistrationSource
	, checkedRecordValueIndexMatrixRegistrationChangedPaths
	, checkedRecordValueIndexMatrixRegistrationDraftParent
	, checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths
	, checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths
	, checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths
	, checkedRecordValueIndexMatrixRegistrationHistoryPath
	, checkedRecordValueIndexMatrixRegistrationPredecessor
	, reverseCheckedRecordValueIndexMatrixRegistrationUpdate
} from "./checked-record-value-index-matrix-registration-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const expectedTests = [
	"checked-record-value-index-matrix"
	, "checked-record-value-index-matrix-inventory"
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

test("value-index matrix registrations have one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexMatrixRegistrationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-matrix-registration-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexMatrixRegistrationPredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexMatrixRegistrationDraftParent);
	assert.deepEqual(record.foundation.modifiedPaths
		, checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths);
	assert.deepEqual(record.foundation.addedPaths
		, checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexMatrixRegistrationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths);
	assert.deepEqual(record.updates.find(
		update => update.path === "src/adoption/test-profiles.mjs"
	).addedTests, expectedTests);
	for(const name of expectedTests) assert.equal(classifyRepositoryTest(
		`tests/${name}.test.mjs`), "contract");
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
				, beforeCheckedRecordValueIndexMatrixRegistrationSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexMatrixRegistrationPredecessor}:${update.path}`]);
		assert.equal(reverseCheckedRecordValueIndexMatrixRegistrationUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("value-index matrix registrations close their exact tree", () => {
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexMatrixRegistrationPredecessor
		, checkedRecordValueIndexMatrixRegistrationDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths].sort());
	const added = git(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexMatrixRegistrationPredecessor
		, checkedRecordValueIndexMatrixRegistrationDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(added
		, [...checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths].sort());
});

test("value-index matrix registration closes every added source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexMatrixRegistrationHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexMatrixRegistrationPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("value-index matrix registration writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-matrix-registration-guard-"
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
			"scripts/update-checked-record-value-index-matrix-registration-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact registration commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
