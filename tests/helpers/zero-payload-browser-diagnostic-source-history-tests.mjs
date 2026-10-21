/**
 * Authenticate the zero-payload browser reviewed-diagnostic repair.
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
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadBrowserDiagnosticSource
	, reverseZeroPayloadBrowserDiagnosticUpdate
	, zeroPayloadBrowserDiagnosticChangedPaths
	, zeroPayloadBrowserDiagnosticHistoryPath
	, zeroPayloadBrowserDiagnosticImplementation
	, zeroPayloadBrowserDiagnosticIntegrationPaths
	, zeroPayloadBrowserDiagnosticPredecessor
} from "./zero-payload-browser-diagnostic-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload browser diagnostic history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadBrowserDiagnosticHistoryPath, "utf8"));
	assert.equal(record.milestone, "zero-payload-browser-diagnostic-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadBrowserDiagnosticPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadBrowserDiagnosticImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadBrowserDiagnosticChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadBrowserDiagnosticIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadBrowserDiagnosticSource);
		assert.equal(reverseZeroPayloadBrowserDiagnosticUpdate(current, update)
			, sourceAt(zeroPayloadBrowserDiagnosticPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadBrowserDiagnosticPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadBrowserDiagnosticSource);
		assert.equal(reverseZeroPayloadBrowserDiagnosticUpdate(current, update)
			, sourceAt(zeroPayloadBrowserDiagnosticImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256
			, addition.path);
});

test("zero-payload browser diagnostic history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadBrowserDiagnosticHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeZeroPayloadBrowserDiagnosticSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadBrowserDiagnosticUpdate(current, update));
});

test("zero-payload browser diagnostic writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-browser-diagnostic-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-browser-diagnostic-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
