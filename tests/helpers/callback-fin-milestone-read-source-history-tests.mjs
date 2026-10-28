/**
 * Authenticate the callback Fin milestone-read repair history: exact transitions, additions,
 * refusal controls and the newest-first merged hub-order stage.
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
	beforeCallbackFinMilestoneReadSource
	, callbackFinMilestoneReadAddedPaths
	, callbackFinMilestoneReadChangedPaths
	, callbackFinMilestoneReadCommits
	, callbackFinMilestoneReadHistoryPath
	, callbackFinMilestoneReadImplementation
	, callbackFinMilestoneReadImplementationAddedPaths
	, callbackFinMilestoneReadPredecessor
	, reverseCallbackFinMilestoneReadUpdate
} from "./callback-fin-milestone-read-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	callbackFinMilestoneReadHistoryPath, "utf8"
));

test("callback Fin milestone-read repair records exactly its implementation transitions", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions"
		, "implementationCommit", "implementationCommits", "milestone"
		, "predecessorCommit"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-milestone-read-source-v1");
	assert.equal(record.predecessorCommit, callbackFinMilestoneReadPredecessor);
	assert.equal(record.implementationCommit
		, callbackFinMilestoneReadImplementation);
	assert.deepEqual(record.implementationCommits, callbackFinMilestoneReadCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${callbackFinMilestoneReadPredecessor}..${callbackFinMilestoneReadImplementation}`])
		.trim().split("\n"), callbackFinMilestoneReadCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackFinMilestoneReadPredecessor
		, callbackFinMilestoneReadImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...callbackFinMilestoneReadChangedPaths
		, ...callbackFinMilestoneReadImplementationAddedPaths].sort());
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackFinMilestoneReadChangedPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${callbackFinMilestoneReadPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${callbackFinMilestoneReadImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCallbackFinMilestoneReadUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCallbackFinMilestoneReadSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeCallbackFinMilestoneReadSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("callback Fin milestone-read repair additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackFinMilestoneReadAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("callback Fin milestone-read repair rejects altered transitions and unknown content", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${callbackFinMilestoneReadImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseCallbackFinMilestoneReadUpdate(current, changed));
		const shifted = structuredClone(update);
		shifted.edits[0].start += 1;
		assert.throws(() => reverseCallbackFinMilestoneReadUpdate(current, shifted));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeCallbackFinMilestoneReadSource(update.path, unknown), unknown);
		assert.throws(() => reverseCallbackFinMilestoneReadUpdate(unknown, update));
		assert.equal(beforeCallbackFinMilestoneReadSource("docs/unrelated.md", current)
			, current);
	}
});

/**
 * Positions of the named stage calls in the hub's reverse chain.
 *
 * @param hub - Complete hub source text.
 * @param names - Stage reader names.
 */
const stagePositions = (hub, names) => {
	const chain = hub.slice(hub.indexOf("export const beforeFinRefinementSource"));
	return names.map(name => {
		const call = `stage = ${name}(`;
		const first = chain.indexOf(call);
		assert.equal(chain.indexOf(call, first + 1), -1, name);
		return first;
	});
};

test("callback Fin milestone-read repair reverses the merged hub-order integration first", () => {
	const names = ["beforeCoreHubOrderMergedIntegrationSource"
		, "beforeSignatureSpecializationHostedProducerBindingIntegrationSource"
		, "beforeSignatureSpecializationHostedProducerBindingSource"
		, "beforeCoreHubOrderMergedSource"];
	const hub = path => git(["show", `${path}:tests/helpers/fin-refinement-source-history.mjs`]);
	const current = stagePositions(hub(callbackFinMilestoneReadImplementation), names);
	assert.ok(current.every(position => position >= 0));
	assert.deepEqual([...current].sort((a, b) => a - b), current);
	const previous = stagePositions(hub(callbackFinMilestoneReadPredecessor), names);
	assert.ok(previous[0] > previous[1]);
});

test("callback Fin milestone-read repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-fin-milestone-read-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-milestone-read-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
