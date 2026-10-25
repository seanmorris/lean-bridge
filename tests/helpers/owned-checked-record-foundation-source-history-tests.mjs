/**
 * Authenticate the owned checked-record source foundation and its refreshed
 * current-source pointers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedRecordFoundationSource
	, ownedCheckedRecordFoundationChangedPaths
	, ownedCheckedRecordFoundationHistoryPath
	, ownedCheckedRecordFoundationImplementation
	, ownedCheckedRecordFoundationPredecessor
	, reverseOwnedCheckedRecordFoundationUpdate
} from "./owned-checked-record-foundation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedCheckedRecordFoundationPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

// The old writer refreshed inventory pins in its history commit, after the
// implementation commit. Authenticate that exact later blob without rebuilding
// every subsequent inventory in memory.
const inventoryRevision = "d5b2b31e640de6be9dc00188de8c793b126b2136";

test("owned checked-record foundation lane history restores every source and pointer", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordFoundationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-record-foundation-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordFoundationPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordFoundationImplementation);
	assert.equal(execFileSync("git", ["show", "-s", "--format=%P", inventoryRevision]
		, { encoding: "utf8" }).trim(), ownedCheckedRecordFoundationImplementation);
	assert.deepEqual(JSON.parse(execFileSync("git", ["show"
		, `${inventoryRevision}:${ownedCheckedRecordFoundationHistoryPath}`]
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })), record);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordFoundationChangedPaths);
	for(const update of record.updates)
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				inventoryRevision, update.path
			), update), true);
			const previous = createHash("sha256");
			for await(const chunk of gitSourceBytes(
				ownedCheckedRecordFoundationPredecessor, update.path
			)) previous.update(chunk);
			assert.equal(previous.digest("hex"), update.previousSha256);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			continue;
		}
		const milestone = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordFoundationSource
		);
		assert.equal(sha256(milestone), update.currentSha256, update.path);
		const previous = reverseOwnedCheckedRecordFoundationUpdate(
			milestone, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeOwnedCheckedRecordFoundationSource(
			update.path, milestone), previous);
		assert.equal(beforeOwnedCheckedRecordFoundationSource(
			update.path, milestone, update.currentSha256), milestone);
		assert.equal(beforeFinRefinementSource(
			update.path, milestone, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeOwnedCheckedRecordFoundationSource(
			update.path, milestone + "unknown"), milestone + "unknown");
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	for(const pin of record.pinContainers)
	{
		assert.equal(pin.path, "docs/type-surface.v1.json");
		const replacements = [...pin.replacements].reverse();
		for(const replacement of replacements)
		{
			assert.match(replacement.current, /^[a-f0-9]{64}$/u);
			assert.match(replacement.previous, /^[a-f0-9]{64}$/u);
		}
		const counts = new Map(replacements.map(replacement => [replacement.sourcePath, 0]));
		const current = createHash("sha256"), previous = createHash("sha256");
		const input = Readable.from(gitSourceBytes(
			inventoryRevision, pin.path
		));
		input.on("data", chunk => current.update(chunk));
		for await(const line of createInterface({ input, crlfDelay: Infinity }))
		{
			let restored = line;
			for(const replacement of replacements)
			{
				counts.set(replacement.sourcePath, counts.get(replacement.sourcePath)
					+ restored.split(replacement.current).length - 1);
				restored = restored.replaceAll(replacement.current, replacement.previous);
			}
			previous.update(restored + "\n");
		}
		assert.equal(current.digest("hex"), pin.currentSha256, pin.path);
		assert.equal(previous.digest("hex"), pin.previousSha256, pin.path);
		for(const replacement of replacements)
			assert.equal(counts.get(replacement.sourcePath)
				, replacement.count, `${pin.path}: ${replacement.sourcePath}`);
	}
});

test("owned checked-record foundation inventory stream rejects changed endpoints and spans", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordFoundationHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === "docs/type-surface.v1.json");
	for(const change of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }
		, { ...update, edits: [
			{ ...update.edits[0], current: "changed" + update.edits[0].current }
			, ...update.edits.slice(1)
		] }
	])
		await assert.rejects(() => authenticateSourceHistoryReverse(gitSourceBytes(
			inventoryRevision, update.path
		), change));
});

test("owned checked-record foundation lane history rejects altered transitions"
	, async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordFoundationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[1]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeOwnedCheckedRecordFoundationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedCheckedRecordFoundationUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseOwnedCheckedRecordFoundationUpdate(
		current, update));
	}
);

test("owned checked-record foundation history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-owned-checked-record-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-checked-record-foundation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
