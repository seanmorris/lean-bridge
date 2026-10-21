/**
 * Authenticate the generic-Subtype composition transition.
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
	beforeGenericSubtypeCompositionSource
	, genericSubtypeCompositionChangedPaths
	, genericSubtypeCompositionHistoryPath
	, genericSubtypeCompositionImplementation
	, genericSubtypeCompositionPredecessor
	, reverseGenericSubtypeCompositionUpdate
} from "./generic-subtype-composition-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${genericSubtypeCompositionPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("generic Subtype composition history restores every source", async () => {
	const record = JSON.parse(await readFile(
		genericSubtypeCompositionHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-composition-source-v1");
	assert.equal(record.predecessorCommit
		, genericSubtypeCompositionPredecessor);
	assert.equal(record.implementationCommit
		, genericSubtypeCompositionImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, genericSubtypeCompositionChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeGenericSubtypeCompositionSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseGenericSubtypeCompositionUpdate(
			current, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeGenericSubtypeCompositionSource(
			update.path, current), previous);
		assert.equal(beforeGenericSubtypeCompositionSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeGenericSubtypeCompositionSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("generic Subtype composition history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		genericSubtypeCompositionHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeGenericSubtypeCompositionSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseGenericSubtypeCompositionUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() =>
		reverseGenericSubtypeCompositionUpdate(current, update));
});

test("generic Subtype composition history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-generic-subtype-composition-history-guard-"
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
		"scripts/update-generic-subtype-composition-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
