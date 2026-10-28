/**
 * Authenticate the local callback Fin Perl integration join.
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
	beforeCallbackFinPerlLocalJoinSource
	, callbackFinPerlLocalJoinAddedPaths
	, callbackFinPerlLocalJoinChangedPaths
	, callbackFinPerlLocalJoinCommits
	, callbackFinPerlLocalJoinHistoryPath
	, callbackFinPerlLocalJoinImplementation
	, callbackFinPerlLocalJoinImplementationAddedPaths
	, callbackFinPerlLocalJoinPredecessor
	, reverseCallbackFinPerlLocalJoinUpdate
} from "./callback-fin-perl-local-join-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	callbackFinPerlLocalJoinHistoryPath, "utf8"
));

test("callback Fin Perl local join records its exact range", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationCommit", "implementationCommits"
		, "integrationUpdates", "milestone", "predecessorCommit"
		, "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-perl-local-join-source-v1");
	assert.equal(record.predecessorCommit
		, callbackFinPerlLocalJoinPredecessor);
	assert.equal(record.implementationCommit
		, callbackFinPerlLocalJoinImplementation);
	assert.deepEqual(record.implementationCommits
		, callbackFinPerlLocalJoinCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${callbackFinPerlLocalJoinPredecessor}..${callbackFinPerlLocalJoinImplementation}`])
		.trim().split("\n"), callbackFinPerlLocalJoinCommits);
	assert.deepEqual(record.updates.map(update => update.path)
		, callbackFinPerlLocalJoinChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, callbackFinPerlLocalJoinChangedPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, callbackFinPerlLocalJoinAddedPaths);
});

test("callback Fin Perl local join reverses both merged transitions", async () => {
	const record = await readRecord();
	for(const path of callbackFinPerlLocalJoinChangedPaths)
	{
		const integration = record.integrationUpdates.find(
			update => update.path === path);
		const implementation = record.updates.find(update => update.path === path);
		const current = await sourceAtFinHistoryMilestone(
			path, integration.currentSha256
			, beforeCallbackFinPerlLocalJoinSource);
		const implementationSource = git(["show"
			, `${callbackFinPerlLocalJoinImplementation}:${path}`]);
		const previous = git(["show"
			, `${callbackFinPerlLocalJoinPredecessor}:${path}`]);
		assert.equal(reverseCallbackFinPerlLocalJoinUpdate(
			current, integration), implementationSource, path);
		assert.equal(reverseCallbackFinPerlLocalJoinUpdate(
			implementationSource, implementation), previous, path);
		assert.equal(beforeFinRefinementSource(
			path, current, implementation.previousSha256), previous, path);
		assert.ok(finRefinementNormalizationPaths.includes(path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Fin Perl local join retains original integration additions", async () => {
	const record = await readRecord();
	for(const path of callbackFinPerlLocalJoinImplementationAddedPaths)
	{
		const addition = record.additions.find(item => item.path === path);
		assert.ok(addition, path);
		assert.equal(sha256(git(["show"
			, `${callbackFinPerlLocalJoinImplementation}:${path}`]))
		, addition.currentSha256, path);
	}
});

test("callback Fin Perl local join rejects forged transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${callbackFinPerlLocalJoinImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCallbackFinPerlLocalJoinUpdate(
			current, forged));
	const unknown = `${current}unknown\n`;
	assert.equal(beforeCallbackFinPerlLocalJoinSource(update.path, unknown)
		, unknown);
});

test("callback Fin Perl local-join writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-fin-perl-local-join-"
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
		"scripts/update-callback-fin-perl-local-join-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
