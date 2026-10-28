/**
 * Authenticate the Ruby predecessor-stop repair and central registration.
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
	beforeCoreRubyPredecessorStopSource
	, coreRubyPredecessorStopAddedPaths
	, coreRubyPredecessorStopHistoryPath
	, coreRubyPredecessorStopImplementation
	, coreRubyPredecessorStopImplementationPaths
	, coreRubyPredecessorStopIntegrationPaths
	, coreRubyPredecessorStopPredecessor
	, reverseCoreRubyPredecessorStopUpdate
} from "./core-ruby-predecessor-stop-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreRubyPredecessorStopHistoryPath, "utf8"
));

test("Core Ruby predecessor stop records its exact source range", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationCommit", "integrationUpdates", "milestone"
		, "predecessorCommit", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-ruby-predecessor-stop-source-v1");
	assert.equal(record.predecessorCommit
		, coreRubyPredecessorStopPredecessor);
	assert.equal(record.implementationCommit
		, coreRubyPredecessorStopImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreRubyPredecessorStopImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreRubyPredecessorStopIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreRubyPredecessorStopAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreRubyPredecessorStopImplementation}^`]).trim()
	, coreRubyPredecessorStopPredecessor);
});

test("Core Ruby predecessor stop reverses every source transition", async () => {
	const record = await readRecord();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreRubyPredecessorStopSource);
		const base = record.integrationUpdates.includes(update)
			? coreRubyPredecessorStopImplementation
			: coreRubyPredecessorStopPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreRubyPredecessorStopUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core Ruby predecessor stop names the authenticated target", () => {
	const previous = git(["show"
		, `${coreRubyPredecessorStopPredecessor}:tests/owned-ruby-evidence.test.mjs`]);
	const current = git(["show"
		, `${coreRubyPredecessorStopImplementation}:tests/owned-ruby-evidence.test.mjs`]);
	assert.match(previous
		, /beforeOwnedRuby\(update\.path, source\)\), update\.previousSha256/u);
	assert.match(current
		, /beforeOwnedRuby\(update\.path, source, update\.previousSha256\)\), update\.previousSha256/u);
	assert.match(current, /beforeOwnedRuby\(update\.path, unknown\), unknown/u);
	assert.match(current, /reverseOwnedRubyUpdate\(unknown, update\)/u);
});

test("Core Ruby predecessor stop rejects forged transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${coreRubyPredecessorStopImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreRubyPredecessorStopUpdate(
			current, forged));
	const unknown = `${current}unknown\n`;
	assert.equal(beforeCoreRubyPredecessorStopSource(update.path, unknown)
		, unknown);
});

test("Core Ruby predecessor-stop writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-ruby-predecessor-stop-"
	));
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
		"scripts/update-core-ruby-predecessor-stop-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
