/**
 * Authenticate both parents of the PHP-Wasm entry-oracle integration.
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
	beforePhpWasmEntryOracleIntegrationSource
	, phpWasmEntryOracleIntegrationAddedPaths
	, phpWasmEntryOracleIntegrationChangedPaths
	, phpWasmEntryOracleIntegrationCommit
	, phpWasmEntryOracleIntegrationHistoryPath
	, phpWasmEntryOracleIntegrationLeftParent
	, phpWasmEntryOracleIntegrationRightParent
	, reversePhpWasmEntryOracleIntegrationUpdate
} from "./php-wasm-entry-oracle-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git", [
	"show", `${revision}:${path}`
], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry-oracle integration retains both merge parents", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryOracleIntegrationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-entry-oracle-integration-source-v1");
	assert.equal(record.integrationCommit
		, phpWasmEntryOracleIntegrationCommit);
	assert.deepEqual(record.parents, [
		phpWasmEntryOracleIntegrationLeftParent
		, phpWasmEntryOracleIntegrationRightParent
	]);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryOracleIntegrationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryOracleIntegrationAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforePhpWasmEntryOracleIntegrationSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const left = sourceAt(
			phpWasmEntryOracleIntegrationLeftParent, update.path
		);
		const right = sourceAt(
			phpWasmEntryOracleIntegrationRightParent, update.path
		);
		assert.equal(reversePhpWasmEntryOracleIntegrationUpdate(
			current, update, "left"), left, update.path);
		assert.equal(reversePhpWasmEntryOracleIntegrationUpdate(
			current, update, "right"), right, update.path);
		assert.ok(update.rightExpectedSha256.includes(sha256(right))
			, update.path);
		assert.equal(beforePhpWasmEntryOracleIntegrationSource(
			update.path, current, sha256(left)), left, update.path);
		assert.equal(beforePhpWasmEntryOracleIntegrationSource(
			update.path, current, sha256(right)), right, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, sha256(left)), left, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, sha256(right)), right, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
});

test("PHP-Wasm entry-oracle integration is the exact frozen merge", () => {
	assert.deepEqual(execFileSync("git", [
		"show", "-s", "--format=%P", phpWasmEntryOracleIntegrationCommit
	], { encoding: "utf8" }).trim().split(" "), [
		phpWasmEntryOracleIntegrationLeftParent
		, phpWasmEntryOracleIntegrationRightParent
	]);
});

test("PHP-Wasm entry-oracle integration rejects altered parent transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			phpWasmEntryOracleIntegrationHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[3]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforePhpWasmEntryOracleIntegrationSource
		);
		update.right.previousSha256 = "0".repeat(64);
		assert.throws(() => reversePhpWasmEntryOracleIntegrationUpdate(
			current, update, "right"
		));
		assert.throws(() => reversePhpWasmEntryOracleIntegrationUpdate(
			current, update, "unknown"
		));
	}
);

test("PHP-Wasm entry-oracle integration writer refuses an unrelated checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-php-wasm-entry-oracle-integration-"
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
			"scripts/update-php-wasm-entry-oracle-integration-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /integration commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
