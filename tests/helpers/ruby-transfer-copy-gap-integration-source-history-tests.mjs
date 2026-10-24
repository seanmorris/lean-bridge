/**
 * Authenticate the explicit Ruby gap integration repair.
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
	beforeRubyTransferCopyGapIntegrationSource
	, rubyTransferCopyGapIntegrationAddedPaths
	, rubyTransferCopyGapIntegrationImplementationPaths
	, rubyTransferCopyGapIntegrationChangedPaths
	, rubyTransferCopyGapIntegrationCommits
	, rubyTransferCopyGapIntegrationHistoryPath
	, rubyTransferCopyGapIntegrationImplementation
	, rubyTransferCopyGapIntegrationIntegrationBase
	, rubyTransferCopyGapIntegrationIntegrationPaths
	, rubyTransferCopyGapIntegrationPredecessor
	, reverseRubyTransferCopyGapIntegrationUpdate
} from "./ruby-transfer-copy-gap-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { rubyTransferCopyGapHistoryPath } from "./ruby-transfer-copy-gap-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Ruby gap integration repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		rubyTransferCopyGapIntegrationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "ruby-transfer-copy-gap-integration-source-v1");
	assert.equal(record.predecessorCommit
		, rubyTransferCopyGapIntegrationPredecessor);
	assert.equal(record.implementationCommit
		, rubyTransferCopyGapIntegrationImplementation);
	assert.deepEqual(record.implementationCommits, rubyTransferCopyGapIntegrationCommits);
	assert.equal(record.integrationBaseCommit
		, rubyTransferCopyGapIntegrationIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, rubyTransferCopyGapIntegrationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, rubyTransferCopyGapIntegrationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, rubyTransferCopyGapIntegrationAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeRubyTransferCopyGapIntegrationSource);
		const previous = git(["show"
			, `${rubyTransferCopyGapIntegrationPredecessor}:${update.path}`]);
		assert.equal(reverseRubyTransferCopyGapIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeRubyTransferCopyGapIntegrationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeRubyTransferCopyGapIntegrationSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeRubyTransferCopyGapIntegrationSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeRubyTransferCopyGapIntegrationSource);
		const previous = git(["show"
			, `${rubyTransferCopyGapIntegrationIntegrationBase}:${update.path}`]);
		assert.equal(reverseRubyTransferCopyGapIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeRubyTransferCopyGapIntegrationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeRubyTransferCopyGapIntegrationSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeRubyTransferCopyGapIntegrationSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Ruby gap integration repair retains the exact implementation commit", () => {
	const predecessor = rubyTransferCopyGapIntegrationPredecessor;
	const implementation = rubyTransferCopyGapIntegrationImplementation;
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${predecessor}..${implementation}`]).trim().split("\n")
	, rubyTransferCopyGapIntegrationCommits);
	for(const [index, revision] of rubyTransferCopyGapIntegrationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : rubyTransferCopyGapIntegrationCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, rubyTransferCopyGapIntegrationPredecessor
		, rubyTransferCopyGapIntegrationImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...rubyTransferCopyGapIntegrationImplementationPaths].sort());
});

test("Ruby gap integration repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		rubyTransferCopyGapIntegrationHistoryPath, "utf8"));
	const original = record.integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeRubyTransferCopyGapIntegrationSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseRubyTransferCopyGapIntegrationUpdate(
		current, update));
});

test("Ruby gap integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-ruby-transfer-copy-gap-integration-history-"));
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
		"scripts/update-ruby-transfer-copy-gap-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("Ruby gap integration reaches both original test boundaries", async () => {
	const record = JSON.parse(await readFile(rubyTransferCopyGapHistoryPath, "utf8"));
	for(const update of record.historicalTransitions)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show", update.previousCommit + ":" + update.path]);
		assert.equal(sha256(current), update.currentSha256);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.currentSha256), current);
		const unknown = current + "\nunknown";
		assert.equal(beforeFinRefinementSource(update.path, unknown
			, update.previousSha256), unknown);
	}
});
