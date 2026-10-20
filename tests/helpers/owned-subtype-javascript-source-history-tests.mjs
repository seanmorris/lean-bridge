/**
 * Authenticate the installed JavaScript owned-Subtype transition.
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
import { beforeOwnedSubtypeHostRegistrationSource } from "./owned-subtype-host-registration-source-history.mjs";
import { beforeOwnedSubtypeJavaScriptTransferSource } from "./owned-subtype-javascript-transfer-source-history.mjs";
import {
	beforeOwnedSubtypeJavaScriptHistoricalSource
	, beforeOwnedSubtypeJavaScriptSource
	, ownedSubtypeJavaScriptChangedPaths
	, ownedSubtypeJavaScriptEvidencePath
	, ownedSubtypeJavaScriptHistoryPath
	, ownedSubtypeJavaScriptImplementation
	, ownedSubtypeJavaScriptPredecessor
	, reverseOwnedSubtypeJavaScriptUpdate
} from "./owned-subtype-javascript-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedSubtypeJavaScriptPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("installed JavaScript owned Subtype history restores every source", async () => {
	const history = JSON.parse(await readFile(
		ownedSubtypeJavaScriptHistoryPath, "utf8"
	));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "owned-subtype-javascript-source-v1");
	assert.equal(history.predecessorCommit, ownedSubtypeJavaScriptPredecessor);
	assert.equal(history.implementationCommit, ownedSubtypeJavaScriptImplementation);
	assert.ok(history.reconciledTypeSurfacePointers > 0);
	assert.equal(history.acceptanceEvidence.path
		, ownedSubtypeJavaScriptEvidencePath);
	assert.equal(history.acceptanceEvidence.sha256
		, sha256(await readFile(ownedSubtypeJavaScriptEvidencePath)));
	assert.deepEqual(history.updates.map(item => item.path)
		, ownedSubtypeJavaScriptChangedPaths);
	assert.deepEqual(history.historicalCorrections.map(item => [
		item.currentCommit, item.previousCommit, item.path
	]), [
		["526e9642f0facd00a4b6dc49dedb585471cf8a38"
			, "4d4c810ab4b8cc64a60286a3ed4d3292d76fda02"
			, "docs/type-surface.v1.json"]
		, ["f34d7fe555c63889f7344b6a88ebfc17140c8a32"
			, "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec"
			, "docs/type-surface.v1.json"]
		, ["f34d7fe555c63889f7344b6a88ebfc17140c8a32"
			, "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec"
			, "tests/helpers/fin-refinement-source-history.mjs"]
	]);
	let corrected = execFileSync("git", ["show"
		, "526e9642f0facd00a4b6dc49dedb585471cf8a38:docs/type-surface.v1.json"]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	corrected = beforeOwnedSubtypeJavaScriptHistoricalSource(
		"docs/type-surface.v1.json", corrected
	);
	assert.equal(corrected, execFileSync("git", ["show"
		, "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec:docs/type-surface.v1.json"]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
	const historicalFin = execFileSync("git", ["show"
		, "f34d7fe555c63889f7344b6a88ebfc17140c8a32:tests/helpers/fin-refinement-source-history.mjs"]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	assert.equal(beforeOwnedSubtypeJavaScriptHistoricalSource(
		"tests/helpers/fin-refinement-source-history.mjs", historicalFin
	), execFileSync("git", ["show"
		, "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec:tests/helpers/fin-refinement-source-history.mjs"]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
	for(const update of history.updates)
	{
		const registered = beforeOwnedSubtypeHostRegistrationSource(
			update.path, await readFile(update.path, "utf8")
			, update.currentSha256
		);
		const current = beforeOwnedSubtypeJavaScriptTransferSource(
			update.path, registered
			, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseOwnedSubtypeJavaScriptUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedSubtypeJavaScriptSource(
			update.path, current), previous);
		assert.equal(beforeOwnedSubtypeJavaScriptSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const addition of history.additions)
	{
		const registered = beforeOwnedSubtypeHostRegistrationSource(
			addition.path, await readFile(addition.path, "utf8")
			, addition.currentSha256
		);
		const current = beforeOwnedSubtypeJavaScriptTransferSource(
			addition.path, registered
			, addition.currentSha256
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
});

test("installed JavaScript owned Subtype evidence authenticates every browser lane", async () => {
	const evidence = JSON.parse(await readFile(
		ownedSubtypeJavaScriptEvidencePath, "utf8"
	));
	assert.equal(evidence.schemaVersion, 1);
	assert.equal(evidence.profile, "installed-owned-subtype-javascript");
	assert.equal(evidence.implementationCommit
		, ownedSubtypeJavaScriptImplementation);
	assert.equal(evidence.reports.length, 2);
	assert.deepEqual(evidence.reports.map(item => item.reviewed), [false, true]);
	for(const report of evidence.reports)
	{
		assert.equal(report.installedNode, true);
		assert.equal(report.installedTypeScript, true);
		assert.equal(report.sourceRemovedBeforeInstall, true);
		assert.equal(report.archiveReproduction, true);
		assert.equal(report.browser.installedSourcesRemoved, true);
		assert.equal(report.browser.externalNetworkBlocked, true);
		assert.equal(report.browser.executions.length, 9);
		assert.deepEqual([...new Set(report.browser.executions.map(item => item.engine))]
			, ["chromium", "firefox", "webkit"]);
		assert.deepEqual([...new Set(report.browser.executions.map(item => item.profile))].sort()
			, ["page", "react", "worker"]);
		assert.ok(report.browser.executions.every(item => item.checks === 6
			&& item.reruns === 2 && item.assets.length === 2));
	}
});

test("installed JavaScript owned Subtype history rejects altered transitions", async () => {
	const history = JSON.parse(await readFile(
		ownedSubtypeJavaScriptHistoryPath, "utf8"
	));
	const update = structuredClone(history.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeJavaScriptUpdate(current, update));
	update.currentSha256 = sha256(current); update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseOwnedSubtypeJavaScriptUpdate(current, update));
});

test("installed JavaScript owned Subtype writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-owned-subtype-javascript-history-guard-"
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
		"scripts/update-owned-subtype-javascript-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
