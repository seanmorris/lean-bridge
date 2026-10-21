/**
 * Authenticate the filtered-Perl-engine owned-refinement import closure.
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
	beforePerlEngineOwnedRefinementClosureSource
	, perlEngineOwnedRefinementClosureChangedPaths
	, perlEngineOwnedRefinementClosureHistoryPath
	, perlEngineOwnedRefinementClosureImplementation
	, perlEngineOwnedRefinementClosureIntegrationPaths
	, perlEngineOwnedRefinementClosurePredecessor
	, reversePerlEngineOwnedRefinementClosureUpdate
} from "./perl-engine-owned-refinement-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("filtered Perl owned-refinement closure history restores every source", async () => {
	const record = JSON.parse(await readFile(
		perlEngineOwnedRefinementClosureHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "perl-engine-owned-refinement-closure-source-v1");
	assert.equal(record.predecessorCommit
		, perlEngineOwnedRefinementClosurePredecessor);
	assert.equal(record.implementationCommit
		, perlEngineOwnedRefinementClosureImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, perlEngineOwnedRefinementClosureChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, perlEngineOwnedRefinementClosureIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforePerlEngineOwnedRefinementClosureSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reversePerlEngineOwnedRefinementClosureUpdate(
			current, update
		);
		assert.equal(previous, sourceAt(
			perlEngineOwnedRefinementClosurePredecessor, update.path
		));
		assert.equal(beforePerlEngineOwnedRefinementClosureSource(
			update.path, current), previous);
		assert.equal(beforePerlEngineOwnedRefinementClosureSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforePerlEngineOwnedRefinementClosureSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforePerlEngineOwnedRefinementClosureSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reversePerlEngineOwnedRefinementClosureUpdate(
			current, update
		), sourceAt(perlEngineOwnedRefinementClosureImplementation
			, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("filtered Perl owned-refinement closure history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		perlEngineOwnedRefinementClosureHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforePerlEngineOwnedRefinementClosureSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reversePerlEngineOwnedRefinementClosureUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() =>
		reversePerlEngineOwnedRefinementClosureUpdate(current, update));
});

test("filtered Perl owned-refinement closure writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-perl-owned-refinement-closure-guard-"
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
		"scripts/update-perl-engine-owned-refinement-closure-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
