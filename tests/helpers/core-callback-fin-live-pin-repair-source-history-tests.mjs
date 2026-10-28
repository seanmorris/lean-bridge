/**
 * Authenticate the exact-head callback Fin type-surface source-pin repair:
 * only stale source pins move, each to its exact live blob, and the hub
 * reverses the refresh and its integration exactly.
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
	beforeCoreCallbackFinLivePinRepairSource
	, coreCallbackFinLivePinRepairAddedPaths
	, coreCallbackFinLivePinRepairHistoryPath
	, coreCallbackFinLivePinRepairImplementation
	, coreCallbackFinLivePinRepairImplementationPaths
	, coreCallbackFinLivePinRepairIntegrationPaths
	, coreCallbackFinLivePinRepairPredecessor
	, reverseCoreCallbackFinLivePinRepairUpdate
} from "./core-callback-fin-live-pin-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const readRecord = async () => JSON.parse(await readFile(
	coreCallbackFinLivePinRepairHistoryPath, "utf8"
));
const inventoryPath = "docs/type-surface.v1.json";
const previousDigest
	= "48f8420eee6e8199c5f6ae18b0700f6cbf535030a0b8ddf3c282649989c471d4";
const currentDigest
	= "66d83281beeb842248e610b62b60539f2b0380f329eb1a5d6be63fc66a935ebd";
const pinLine = /^ *"sha256": "([0-9a-f]{64})"\n$/u;
const pathLine = /^ *"path": "([^"\n]+)",\n$/u;

/**
 * Require every edit to replace whole source-pin lines only, each pin to name
 * the exact implementation blob of the path on the line before it.
 *
 * @param current - Complete refreshed inventory text.
 * @param update - Recorded inventory transition.
 */
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
			assert.equal(newer, sha256(git(["show"
				, `${coreCallbackFinLivePinRepairImplementation}:${path}`])), path);
			refreshes.push({ path, older, newer });
			offset += line.length;
		}
	}
	return refreshes;
};

test("callback Fin live-pin repair records exactly its range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-callback-fin-live-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreCallbackFinLivePinRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreCallbackFinLivePinRepairImplementation);
	assert.equal(git(["rev-parse"
		, `${coreCallbackFinLivePinRepairImplementation}^`]).trim()
	, coreCallbackFinLivePinRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreCallbackFinLivePinRepairPredecessor
		, coreCallbackFinLivePinRepairImplementation]).trim().split("\n")
	, coreCallbackFinLivePinRepairImplementationPaths);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreCallbackFinLivePinRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreCallbackFinLivePinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreCallbackFinLivePinRepairAddedPaths);
	const [update] = record.updates;
	assert.equal(update.previousSha256, previousDigest);
	assert.equal(update.currentSha256, currentDigest);
});

test("callback Fin live-pin repair moves only stale pins to exact live blobs", async () => {
	const [update] = (await readRecord()).updates;
	const current = git(["show"
		, `${coreCallbackFinLivePinRepairImplementation}:${inventoryPath}`]);
	assert.equal(sha256(current), currentDigest);
	const refreshes = pinRefreshes(current, update);
	assert.equal(refreshes.length, 226);
	const paths = new Map();
	for(const { path, older, newer } of refreshes)
	{
		const known = paths.get(path);
		assert.ok(known === undefined
			|| known.older === older && known.newer === newer, path);
		paths.set(path, { older, newer });
	}
	assert.equal(paths.size, 26);
	for(const [path, { older }] of paths)
		assert.ok(!current.includes(`"path": "${path}",\n`
			+ ` `.repeat(10) + `"sha256": "${older}"`), path);
	assert.equal(sha256(reverseCoreCallbackFinLivePinRepairUpdate(
		current, update)), previousDigest);
});

test("callback Fin live-pin repair refuses non-pin and non-live edits", async () => {
	const [update] = (await readRecord()).updates;
	const current = git(["show"
		, `${coreCallbackFinLivePinRepairImplementation}:${inventoryPath}`]);
	const [first] = update.edits;
	const line = first.current.split(/(?<=\n)/u)[0];
	const [, digest] = line.match(pinLine);
	const forge = edit => ({ ...update, edits: [edit, ...update.edits.slice(1)] });
	for(const forged of [
		forge({ ...first, previous: first.previous.replace("sha256", "sha512") })
		, forge({ ...first, previous: first.current })
		, forge({ ...first, current: first.current.replace(digest, "0".repeat(64)) })
		, forge({ ...first, start: first.start - 1 })
	])
		assert.throws(() => pinRefreshes(current, forged));
});

test("callback Fin live-pin repair reverses its refresh and integration", async () => {
	const record = await readRecord();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreCallbackFinLivePinRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreCallbackFinLivePinRepairImplementation
			: coreCallbackFinLivePinRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreCallbackFinLivePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("callback Fin live-pin repair rejects altered transitions", async () => {
	const update = (await readRecord()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreCallbackFinLivePinRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreCallbackFinLivePinRepairUpdate(
			current, forged));
	assert.equal(beforeCoreCallbackFinLivePinRepairSource(
		update.path, current + "unknown"), current + "unknown");
});

test("callback Fin live-pin writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-callback-fin-live-pin-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-callback-fin-live-pin-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
