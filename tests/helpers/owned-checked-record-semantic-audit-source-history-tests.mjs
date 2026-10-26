/**
 * Check the exact semantic-audit source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedSemanticAuditSource
	, ownedCheckedSemanticAuditAddedPaths
	, ownedCheckedSemanticAuditChangedPaths
	, ownedCheckedSemanticAuditHistoryPath
	, ownedCheckedSemanticAuditImplementation
	, ownedCheckedSemanticAuditImplementationPaths
	, ownedCheckedSemanticAuditIntegrationBase
	, ownedCheckedSemanticAuditIntegrationPaths
	, ownedCheckedSemanticAuditPredecessor
	, reverseOwnedCheckedSemanticAuditUpdate
} from "./owned-checked-record-semantic-audit-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	ownedCheckedSemanticAuditHistoryPath, "utf8"));

test("owned checked-record semantic audit authenticates its exact lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-record-semantic-audit-source-v1");
	assert.equal(record.predecessorCommit, ownedCheckedSemanticAuditPredecessor);
	assert.equal(record.implementationCommit, ownedCheckedSemanticAuditImplementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedSemanticAuditIntegrationBase);
	assert.deepEqual(record.updates.map(update => update.path)
		, ownedCheckedSemanticAuditChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, ownedCheckedSemanticAuditIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, ownedCheckedSemanticAuditAddedPaths);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedSemanticAuditPredecessor
		, ownedCheckedSemanticAuditImplementation]).trim().split("\n")
		, [...ownedCheckedSemanticAuditImplementationPaths].sort());
});

test("owned checked-record semantic audit reverses both registration layers", async () => {
	const record = await read();
	for(const update of [...record.integrationUpdates, ...record.updates])
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedCheckedSemanticAuditSource);
		const previous = reverseOwnedCheckedSemanticAuditUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
});

test("owned checked-record semantic audit binds every addition", async () => {
	const record = await read();
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
	const receipt = JSON.parse(await readFile(
		"docs/evidence/owned-checked-record-semantic-audit-20261026.json", "utf8"));
	assert.equal(receipt.kind, "owned-checked-record-semantic-audit-v1");
	assert.deepEqual(receipt.coverage, { consumerSources: 25, executedCells: 52
		, lanes: 11, profiles: 17, routes: 44 });
	assert.match(receipt.boundary, /does not claim recursive owned graphs/u);
});

test("owned checked-record semantic audit rejects forged history", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedCheckedSemanticAuditSource);
	assert.equal(beforeOwnedCheckedSemanticAuditSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeOwnedCheckedSemanticAuditSource(
		update.path, current + "\nunknown"), current + "\nunknown");
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseOwnedCheckedSemanticAuditUpdate(current, forged));
});

test("owned checked-record semantic history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-semantic-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-checked-record-semantic-audit-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("owned checked-record semantic receipt remains canonical", async () => {
	const path = "docs/evidence/owned-checked-record-semantic-audit-20261026.json";
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), canonicalJson(JSON.parse(bytes)));
});
