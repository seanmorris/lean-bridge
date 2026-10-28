/**
 * Authenticate the bounded CI-reliability source sequence and its exact
 * 94-pointer live-source repair.
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
	beforeCoreCiReliabilitySource
	, coreCiReliabilityAddedPaths
	, coreCiReliabilityHistoryPath
	, coreCiReliabilityImplementation
	, coreCiReliabilityImplementationCommits
	, coreCiReliabilityIntegrationPaths
	, coreCiReliabilityNormalizationPaths
	, coreCiReliabilityPredecessor
	, coreCiReliabilityTransitions
	, reverseCoreCiReliabilityUpdate
} from "./core-ci-reliability-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	coreCiReliabilityHistoryPath, "utf8"
));
const inventoryPath = "docs/type-surface.v1.json";
const previousInventoryDigest
	= "d59de3a1b73829e322bc614e9cba29c9d240c471b39aa97bf2ffe9d3e6c1eb5e";
const currentInventoryDigest
	= "c005e32bc3b063c8603ce757c2f3c078204c2d1c3034f5b74d0320f889a03c42";
const pinLine = /^ *"sha256": "([0-9a-f]{64})"\n$/u;
const pathLine = /^ *"path": "([^"\n]+)",\n$/u;
const pinSources = Object.freeze({
	".github/workflows/consumer-matrix.yml": Object.freeze({
		count: 92
		, previousCommit: coreCiReliabilityPredecessor
		, currentCommit: coreCiReliabilityImplementationCommits[0]
	})
	, ".github/workflows/callback-checked-record-languages.yml": Object.freeze({
		count: 1
		, previousCommit: coreCiReliabilityImplementationCommits[0]
		, currentCommit: coreCiReliabilityImplementationCommits[1]
	})
	, "scripts/bootstrap-rust-ci.sh": Object.freeze({
		count: 1
		, previousCommit: coreCiReliabilityImplementationCommits[0]
		, currentCommit: coreCiReliabilityImplementationCommits[1]
	})
});

const pinRefreshes = (current, update) => {
	const refreshes = [];
	for(const edit of update.edits)
	{
		const previous = edit.previous.split(/(?<=\n)/u);
		const next = edit.current.split(/(?<=\n)/u);
		assert.equal(previous.length, next.length);
		let offset = edit.start;
		for(const [index, line] of next.entries())
		{
			const before = current.lastIndexOf("\n", offset - 2) + 1;
			const [, path] = current.slice(before, offset).match(pathLine);
			const [, newer] = line.match(pinLine);
			const [, older] = previous[index].match(pinLine);
			assert.equal(previous[index].replace(older, newer), line);
			assert.notEqual(older, newer, path);
			assert.ok(!path.startsWith("docs/evidence/"), path);
			const source = pinSources[path];
			assert.ok(source, path);
			assert.equal(older, sha256(git(["show"
				, `${source.previousCommit}:${path}`])), path);
			assert.equal(newer, sha256(git(["show"
				, `${source.currentCommit}:${path}`])), path);
			refreshes.push({ path, older, newer });
			offset += line.length;
		}
	}
	return refreshes;
};

test("CI-reliability history records the exact three-commit source sequence", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-ci-reliability-source-v1");
	assert.equal(record.predecessorCommit, coreCiReliabilityPredecessor);
	assert.deepEqual(record.implementationCommits
		, coreCiReliabilityImplementationCommits);
	assert.equal(record.implementationCommit, coreCiReliabilityImplementation);
	let parent = coreCiReliabilityPredecessor;
	for(const [index, transition] of coreCiReliabilityTransitions.entries())
	{
		assert.equal(transition.previousCommit, parent);
		assert.equal(transition.currentCommit
			, coreCiReliabilityImplementationCommits[index]);
		assert.equal(git(["rev-parse", `${transition.currentCommit}^`]).trim()
			, transition.previousCommit);
		assert.deepEqual(names(["diff", "--name-only"
			, transition.previousCommit, transition.currentCommit])
			, [...transition.paths].sort());
		parent = transition.currentCommit;
	}
	assert.deepEqual(record.updates.map(update => update.path)
		, coreCiReliabilityTransitions.flatMap(transition => transition.paths));
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreCiReliabilityIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreCiReliabilityAddedPaths);
});

test("CI-reliability live-pin repair changes exactly 94 exact source pointers", async () => {
	const record = await readRecord();
	const update = record.updates.find(item => item.path === inventoryPath);
	const current = git(["show"
		, `${coreCiReliabilityImplementation}:${inventoryPath}`]);
	assert.equal(update.previousSha256, previousInventoryDigest);
	assert.equal(update.currentSha256, currentInventoryDigest);
	assert.equal(sha256(current), currentInventoryDigest);
	const refreshes = pinRefreshes(current, update);
	assert.equal(refreshes.length, 94);
	const counts = Object.fromEntries(Object.keys(pinSources).map(path => [path, 0]));
	for(const { path } of refreshes) counts[path]++;
	assert.deepEqual(counts, Object.fromEntries(Object.entries(pinSources)
		.map(([path, source]) => [path, source.count])));
	assert.equal(sha256(reverseCoreCiReliabilityUpdate(current, update))
		, previousInventoryDigest);
});

test("CI-reliability pin repair refuses non-pin and non-live edits", async () => {
	const update = (await readRecord()).updates.find(
		item => item.path === inventoryPath);
	const current = git(["show"
		, `${coreCiReliabilityImplementation}:${inventoryPath}`]);
	const [first] = update.edits;
	const line = first.current.split(/(?<=\n)/u)[0];
	const [, digest] = line.match(pinLine);
	const forge = edit => ({ ...update
		, edits: [edit, ...update.edits.slice(1)] });
	for(const forged of [
		forge({ ...first, previous: first.previous.replace("sha256", "sha512") })
		, forge({ ...first, previous: first.current })
		, forge({ ...first
			, current: first.current.replace(digest, "0".repeat(64)) })
		, forge({ ...first, start: first.start - 1 })
	]) assert.throws(() => pinRefreshes(current, forged));
});

test("CI-reliability history reverses every source and integration endpoint", async () => {
	const record = await readRecord();
	for(const [index, update] of record.updates.entries())
	{
		const transition = coreCiReliabilityTransitions.find(item =>
			item.paths.includes(update.path));
		assert.ok(transition, `${index}:${update.path}`);
		const current = git(["show", `${transition.currentCommit}:${update.path}`]);
		const previous = git(["show", `${transition.previousCommit}:${update.path}`]);
		assert.equal(reverseCoreCiReliabilityUpdate(current, update), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeCoreCiReliabilitySource);
		const previous = git(["show"
			, `${coreCiReliabilityImplementation}:${update.path}`]);
		assert.equal(reverseCoreCiReliabilityUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const path of coreCiReliabilityNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("CI-reliability history refuses altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const transition = coreCiReliabilityTransitions.find(item =>
		item.paths.includes(update.path));
	const current = git(["show", `${transition.currentCommit}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreCiReliabilityUpdate(current, forged));
	assert.equal(beforeCoreCiReliabilitySource(
		update.path, current + "unknown"), current + "unknown");
});

test("CI-reliability history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-ci-reliability-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-ci-reliability-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
