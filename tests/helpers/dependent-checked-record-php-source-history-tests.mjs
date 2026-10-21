/**
 * Authenticate the dependent checked-record native PHP source milestone.
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
	beforeDependentCheckedRecordPhpSource
	, dependentCheckedRecordPhpChangedPaths
	, dependentCheckedRecordPhpHistoryPath
	, dependentCheckedRecordPhpImplementation
	, dependentCheckedRecordPhpIntegrationPaths
	, dependentCheckedRecordPhpPredecessor
	, reverseDependentCheckedRecordPhpUpdate
} from "./dependent-checked-record-php-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent checked-record native PHP history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-php-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPhpPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPhpImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordPhpChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPhpIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpSource);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseDependentCheckedRecordPhpUpdate(
			current, update);
		assert.equal(previous, sourceAt(
			dependentCheckedRecordPhpPredecessor, update.path));
		assert.equal(beforeDependentCheckedRecordPhpSource(
			update.path, current), previous);
		assert.equal(beforeDependentCheckedRecordPhpSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpSource);
		assert.equal(reverseDependentCheckedRecordPhpUpdate(
			current, update), sourceAt(
			dependentCheckedRecordPhpImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("dependent checked-record native PHP history rejects altered transitions"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPhpSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPhpUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseDependentCheckedRecordPhpUpdate(
		current, update));
	}
);

test("dependent checked-record native PHP history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-checked-record-php-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-php-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
