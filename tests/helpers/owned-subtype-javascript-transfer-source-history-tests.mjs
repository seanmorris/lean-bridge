/**
 * Authenticate retained and transferred JavaScript owned-Subtype acceptance.
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
	beforeOwnedSubtypeJavaScriptTransferSource
	, ownedSubtypeJavaScriptTransferChangedPaths
	, ownedSubtypeJavaScriptTransferEvidencePath
	, ownedSubtypeJavaScriptTransferHistoryPath
	, ownedSubtypeJavaScriptTransferImplementation
	, ownedSubtypeJavaScriptTransferPredecessor
	, reverseOwnedSubtypeJavaScriptTransferUpdate
} from "./owned-subtype-javascript-transfer-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedSubtypeJavaScriptTransferPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("retained and transferred JavaScript owned Subtype history restores every source", async () => {
	const history = JSON.parse(await readFile(
		ownedSubtypeJavaScriptTransferHistoryPath, "utf8"
	));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "owned-subtype-javascript-transfer-source-v1");
	assert.equal(history.predecessorCommit
		, ownedSubtypeJavaScriptTransferPredecessor);
	assert.equal(history.implementationCommit
		, ownedSubtypeJavaScriptTransferImplementation);
	assert.ok(history.reconciledTypeSurfacePointers > 0);
	assert.equal(history.acceptanceEvidence.path
		, ownedSubtypeJavaScriptTransferEvidencePath);
	assert.equal(history.acceptanceEvidence.sha256
		, sha256(await readFile(ownedSubtypeJavaScriptTransferEvidencePath)));
	assert.deepEqual(history.updates.map(item => item.path)
		, ownedSubtypeJavaScriptTransferChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseOwnedSubtypeJavaScriptTransferUpdate(
			current, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedSubtypeJavaScriptTransferSource(
			update.path, current), previous);
		assert.equal(beforeOwnedSubtypeJavaScriptTransferSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const addition of history.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("retained and transferred JavaScript evidence authenticates every installed lane", async () => {
	const evidence = JSON.parse(await readFile(
		ownedSubtypeJavaScriptTransferEvidencePath, "utf8"
	));
	assert.equal(evidence.schemaVersion, 1);
	assert.equal(evidence.profile, "installed-owned-subtype-javascript-transfer");
	assert.equal(evidence.implementationCommit
		, ownedSubtypeJavaScriptTransferImplementation);
	assert.deepEqual(evidence.reports.map(item => item.reviewed), [false, true]);
	for(const report of evidence.reports)
	{
		assert.equal(report.installedNode, true);
		assert.equal(report.installedTypeScript, true);
		assert.equal(report.sourceRemovedBeforeInstall, true);
		assert.equal(report.relocatedInstallation, true);
		assert.equal(report.archiveReproduction, true);
		assert.equal(report.transferredInputCheckedBeforeHandoff, true);
		assert.deepEqual(report.observed, { checks: 18, first: true
			, retainedRejected: true, second: true, serial: "41"
			, transferRejected: true, transferred: true });
		assert.equal(report.browser.installedSourcesRemoved, true);
		assert.equal(report.browser.externalNetworkBlocked, true);
		assert.equal(report.browser.executions.length, 9);
		assert.deepEqual([...new Set(report.browser.executions.map(item => item.engine))]
			, ["chromium", "firefox", "webkit"]);
		assert.deepEqual([...new Set(report.browser.executions.map(item => item.profile))].sort()
			, ["page", "react", "worker"]);
		assert.ok(report.browser.executions.every(item => item.checks === 18
			&& item.reruns === 2 && item.assets.length === 2));
	}
});

test("retained and transferred JavaScript history rejects altered transitions", async () => {
	const history = JSON.parse(await readFile(
		ownedSubtypeJavaScriptTransferHistoryPath, "utf8"
	));
	const update = structuredClone(history.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeJavaScriptTransferUpdate(
		current, update
	));
	update.currentSha256 = sha256(current); update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseOwnedSubtypeJavaScriptTransferUpdate(
		current, update
	));
});

test("retained and transferred JavaScript writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-owned-subtype-transfer-history-guard-"
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
		"scripts/update-owned-subtype-javascript-transfer-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
