/**
 * Authenticate the primitive-subtype audit branch integration and its live
 * source-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import {
	beforePrimitiveAuditIntegrationSource
	, primitiveAuditIntegrationAddedPaths
	, primitiveAuditIntegrationChangedPaths
	, primitiveAuditIntegrationDraftParent
	, primitiveAuditIntegrationHistoryPath
	, primitiveAuditIntegrationPredecessor
	, reversePrimitiveAuditIntegrationUpdate
} from "./primitive-audit-integration-source-history.mjs";

const show = path => execFileSync("git", ["show"
	, `${primitiveAuditIntegrationPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("primitive audit integration authenticates every current-line transition", async t => {
	const record = JSON.parse(await readFile(
		primitiveAuditIntegrationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "primitive-audit-integration-source-v1");
	assert.equal(record.predecessorCommit
		, primitiveAuditIntegrationPredecessor);
	assert.equal(record.draftParentCommit
		, primitiveAuditIntegrationDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, primitiveAuditIntegrationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, primitiveAuditIntegrationAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	for(const update of record.updates)
	{
		const current = sourceAtHistoryMilestone(
			primitiveAuditIntegrationHistoryPath, update.path
		);
		const previous = show(update.path);
		assert.equal(reversePrimitiveAuditIntegrationUpdate(current, update)
			, previous);
		assert.equal(beforePrimitiveAuditIntegrationSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforePrimitiveAuditIntegrationSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforePrimitiveAuditIntegrationSource(
			update.path, current + "unknown"), current + "unknown");
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const current = JSON.parse(sourceAtHistoryMilestone(
		primitiveAuditIntegrationHistoryPath, inventoryPath
	));
	const previous = JSON.parse(show(inventoryPath));
	assert.deepEqual(current.observations, previous.observations);
	assert.deepEqual(current.evidence.map(entry => entry.id)
		, previous.evidence.map(entry => entry.id));
	assert.ok(record.pinCount > 0);
	t.diagnostic(`${record.pinCount} source pins refreshed; support claims unchanged`);
});

test("primitive audit integration writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-primitive-audit-integration-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const script = resolve(
		"scripts/update-primitive-audit-integration-source-history.mjs"
	);
	const result = spawnSync(process.execPath, [script]
		, { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
