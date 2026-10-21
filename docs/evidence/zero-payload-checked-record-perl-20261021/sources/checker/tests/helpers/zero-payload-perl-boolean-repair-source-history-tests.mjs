/**
 * Authenticate the zero-payload Perl boolean-caller repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeZeroPayloadPerlBooleanRepairSource
	, reverseZeroPayloadPerlBooleanRepairUpdate
	, zeroPayloadPerlBooleanRepairChangedPaths
	, zeroPayloadPerlBooleanRepairHistoryPath
	, zeroPayloadPerlBooleanRepairImplementation
	, zeroPayloadPerlBooleanRepairImplementationPaths
	, zeroPayloadPerlBooleanRepairPredecessor
} from "./zero-payload-perl-boolean-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`]
, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

test("zero-payload Perl boolean repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPerlBooleanRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "zero-payload-perl-boolean-repair-source-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadPerlBooleanRepairPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadPerlBooleanRepairImplementation);
	assert.deepEqual(record.implementationPaths
		, zeroPayloadPerlBooleanRepairImplementationPaths);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadPerlBooleanRepairChangedPaths);
	for(const update of record.updates)
	{
		const latest = await readFile(update.path, "utf8");
		const current = beforeFinRefinementSource(
			update.path, latest, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseZeroPayloadPerlBooleanRepairUpdate(
			current, update
		);
		assert.equal(previous, sourceAt(
			zeroPayloadPerlBooleanRepairPredecessor, update.path
		));
		assert.equal(beforeZeroPayloadPerlBooleanRepairSource(
			update.path, current), previous);
		assert.equal(beforeZeroPayloadPerlBooleanRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeZeroPayloadPerlBooleanRepairSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const path of zeroPayloadPerlBooleanRepairImplementationPaths)
	{
		assert.notEqual(sourceAt(zeroPayloadPerlBooleanRepairPredecessor, path)
			, sourceAt(zeroPayloadPerlBooleanRepairImplementation, path));
		assert.equal(sha256(sourceAt(
			zeroPayloadPerlBooleanRepairImplementation, path
		)), record.updates.find(item => item.path === path).currentSha256);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("zero-payload Perl boolean repair rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPerlBooleanRepairHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const latest = await readFile(update.path, "utf8");
	const current = beforeFinRefinementSource(
		update.path, latest, update.currentSha256
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadPerlBooleanRepairUpdate(
		current, update
	));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadPerlBooleanRepairUpdate(
		current, update
	));
});

test("zero-payload Perl boolean history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-perl-boolean-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-perl-boolean-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
