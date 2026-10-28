/**
 * Authenticate the local Perl codegen replay join.
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
	beforePerlCodegenMergedSource, perlCodegenMergedAddedPaths
	, perlCodegenMergedHistoryPath, perlCodegenMergedImplementation
	, perlCodegenMergedPaths, perlCodegenMergedPredecessor
	, reversePerlCodegenMergedUpdate
} from "./perl-codegen-merged-source-history.mjs";
import { perlCodegenProducerReplayHistoryPath } from "./perl-codegen-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	perlCodegenMergedHistoryPath, "utf8"));

test("merged Perl codegen replay restores its exact local predecessor", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.predecessorCommit, perlCodegenMergedPredecessor);
	assert.equal(record.implementationCommit, perlCodegenMergedImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, perlCodegenMergedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, perlCodegenMergedAddedPaths);
	assert.deepEqual(record.upstreamHistory, {
		path: perlCodegenProducerReplayHistoryPath
		, sha256: sha256(await readFile(perlCodegenProducerReplayHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${perlCodegenMergedImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${perlCodegenMergedPredecessor}:${update.path}`]);
		assert.equal(reversePerlCodegenMergedUpdate(current, update), previous);
		assert.equal(beforePerlCodegenMergedSource(update.path, current
			, update.previousSha256), previous);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	const inventory = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	assert.equal(inventory.edits.length, 7);
});

test("merged Perl codegen replay rejects altered and unknown content", async () => {
	const record = await readRecord();
	const update = record.updates[1];
	const current = git(["show"
		, `${perlCodegenMergedImplementation}:${update.path}`]);
	assert.throws(() => reversePerlCodegenMergedUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforePerlCodegenMergedSource(update.path, `${current}x`)
		, `${current}x`);
});

test("merged Perl codegen history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-perl-codegen-merged-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-perl-codegen-merged-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
