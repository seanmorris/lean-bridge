/**
 * Authenticate the two-parent callback/dependent checked-record integration.
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
	beforeCallbackDependentIntegrationSource
	, callbackDependentIntegrationAddedPaths
	, callbackDependentIntegrationChangedPaths
	, callbackDependentIntegrationCommit
	, callbackDependentIntegrationHistoryPath
	, callbackDependentIntegrationLeftParent
	, callbackDependentIntegrationRightParent
	, reverseCallbackDependentIntegrationUpdate
} from "./helpers/callback-dependent-integration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./helpers/fin-refinement-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./helpers/source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback and dependent checked-record histories retain both merge parents"
	, async () => {
		const record = JSON.parse(await readFile(
			callbackDependentIntegrationHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "callback-dependent-integration-source-v1");
		assert.equal(record.integrationCommit
			, callbackDependentIntegrationCommit);
		assert.deepEqual(record.parents, [
			callbackDependentIntegrationLeftParent
			, callbackDependentIntegrationRightParent
		]);
		assert.deepEqual(record.updates.map(item => item.path)
			, callbackDependentIntegrationChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, callbackDependentIntegrationAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeCallbackDependentIntegrationSource
			);
			assert.equal(sha256(current), update.currentSha256, update.path);
			const left = sourceAt(
				callbackDependentIntegrationLeftParent, update.path
			);
			const right = sourceAt(
				callbackDependentIntegrationRightParent, update.path
			);
			assert.equal(reverseCallbackDependentIntegrationUpdate(
				current, update, "left"), left);
			assert.equal(reverseCallbackDependentIntegrationUpdate(
				current, update, "right"), right);
			assert.ok(update.rightExpectedSha256.includes(sha256(right)));
			assert.equal(beforeCallbackDependentIntegrationSource(
				update.path, current, sha256(left)), left);
			assert.equal(beforeCallbackDependentIntegrationSource(
				update.path, current, sha256(right)), right);
			assert.equal(beforeFinRefinementSource(
				update.path, current, sha256(left)), left);
			assert.equal(beforeFinRefinementSource(
				update.path, current, sha256(right)), right);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("callback/dependent integration rejects altered parent transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			callbackDependentIntegrationHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[1]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackDependentIntegrationSource
		);
		update.right.previousSha256 = "0".repeat(64);
		assert.throws(() => reverseCallbackDependentIntegrationUpdate(
			current, update, "right"
		));
		assert.throws(() => reverseCallbackDependentIntegrationUpdate(
			current, update, "unknown"
		));
	}
);

test("callback/dependent integration writer refuses an unrelated checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-callback-dependent-integration-guard-"
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
			"scripts/update-callback-dependent-integration-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /integration commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
