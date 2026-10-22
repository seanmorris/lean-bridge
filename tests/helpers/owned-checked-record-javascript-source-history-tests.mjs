/**
 * Authenticate installed JavaScript owned checked-record evidence and history.
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
	beforeOwnedCheckedRecordJavaScriptSource
	, ownedCheckedRecordJavaScriptAddedPaths
	, ownedCheckedRecordJavaScriptChangedPaths
	, ownedCheckedRecordJavaScriptEvidencePath
	, ownedCheckedRecordJavaScriptHistoryPath
	, ownedCheckedRecordJavaScriptImplementation
	, ownedCheckedRecordJavaScriptImplementationPaths
	, ownedCheckedRecordJavaScriptPredecessor
	, reverseOwnedCheckedRecordJavaScriptUpdate
} from "./owned-checked-record-javascript-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedCheckedRecordJavaScriptPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("installed JavaScript owned checked-record history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordJavaScriptHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "owned-checked-record-javascript-source-v1");
		assert.equal(record.predecessorCommit
			, ownedCheckedRecordJavaScriptPredecessor);
		assert.equal(record.implementationCommit
			, ownedCheckedRecordJavaScriptImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, ownedCheckedRecordJavaScriptChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, ownedCheckedRecordJavaScriptAddedPaths);
		assert.ok(record.refreshedTypeSurfacePointers > 0);
		assert.equal(record.acceptanceEvidence.path
			, ownedCheckedRecordJavaScriptEvidencePath);
		assert.equal(record.acceptanceEvidence.sha256
			, sha256(await readFile(ownedCheckedRecordJavaScriptEvidencePath)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeOwnedCheckedRecordJavaScriptSource
			);
			assert.equal(sha256(current), update.currentSha256, update.path);
			const previous = reverseOwnedCheckedRecordJavaScriptUpdate(
				current, update
			);
			assert.equal(previous, original(update.path));
			assert.equal(beforeOwnedCheckedRecordJavaScriptSource(
				update.path, current), previous);
			assert.equal(beforeOwnedCheckedRecordJavaScriptSource(
				update.path, current, update.currentSha256), current);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			assert.equal(beforeOwnedCheckedRecordJavaScriptSource(
				update.path, `${current}unknown`), `${current}unknown`);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
			)), addition.currentSha256, addition.path);
	}
);

test("installed JavaScript owned checked-record history keeps its implementation edge"
	, () => {
		assert.equal(execFileSync("git", ["rev-parse"
			, `${ownedCheckedRecordJavaScriptImplementation}^`]
		, { encoding: "utf8" }).trim()
		, ownedCheckedRecordJavaScriptPredecessor);
		assert.deepEqual(execFileSync("git", ["diff", "--name-only"
			, ownedCheckedRecordJavaScriptPredecessor
			, ownedCheckedRecordJavaScriptImplementation]
		, { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort()
		, [...ownedCheckedRecordJavaScriptImplementationPaths
			, "tests/helpers/owned-checked-record-javascript-fixture.mjs"
			, "tests/owned-checked-record-javascript-packaging.test.mjs"].sort());
	}
);

test("installed JavaScript owned checked-record evidence authenticates all routes"
	, async () => {
		const evidence = JSON.parse(await readFile(
			ownedCheckedRecordJavaScriptEvidencePath, "utf8"
		));
		assert.equal(evidence.schemaVersion, 1);
		assert.equal(evidence.profile
			, "installed-owned-checked-record-javascript");
		assert.equal(evidence.implementationCommit
			, ownedCheckedRecordJavaScriptImplementation);
		assert.deepEqual(evidence.reports.map(item => item.route), [
			"ordinary-full", "ordinary-result-only"
			, "reviewed-full", "reviewed-result-only"
		]);
		for(const report of evidence.reports)
		{
			const checks = report.mode === "result-only" ? 7 : 30;
			assert.equal(report.installedNode, true);
			assert.equal(report.installedTypeScript, true);
			assert.equal(report.sourceRemovedBeforeInstall, true);
			assert.equal(report.relocatedInstallation, true);
			assert.equal(report.archiveReproduction, true);
			assert.equal(report.observed.checks, checks);
			assert.equal(report.browser.installedSourcesRemoved, true);
			assert.equal(report.browser.externalNetworkBlocked, true);
			assert.equal(report.browser.executions.length, 9);
			assert.deepEqual([...new Set(report.browser.executions.map(
				item => item.engine
			))], ["chromium", "firefox", "webkit"]);
			assert.deepEqual([...new Set(report.browser.executions.map(
				item => item.profile
			))].sort(), ["page", "react", "worker"]);
			assert.ok(report.browser.executions.every(item =>
				item.checks === checks && item.reruns === 2
				&& item.assets.length === 2
			));
		}
	}
);

test("installed JavaScript owned checked-record history rejects altered transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordJavaScriptHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordJavaScriptSource
		);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseOwnedCheckedRecordJavaScriptUpdate(
			current, update));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() => reverseOwnedCheckedRecordJavaScriptUpdate(
			current, update));
	}
);

test("installed JavaScript owned checked-record writer refuses unrelated checkouts"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-owned-checked-javascript-history-guard-"
		));
		t.after(() => rm(root, { recursive: true, force: true }));
		const env = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const git = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env, stdio: "pipe" });
		git(["init", "--quiet"]);
		git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
			, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
			, "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-owned-checked-record-javascript-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
