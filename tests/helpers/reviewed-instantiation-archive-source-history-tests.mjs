/**
 * Preserve main history separately from the executed reviewed-record branch identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedInstantiationArchiveSource, reviewedInstantiationArchiveChangedPaths, reviewedInstantiationArchiveHistoryPath, reviewedInstantiationArchivePredecessor, reviewedInstantiationArchiveProducer, reviewedInstantiationArchiveProducerPins, reverseReviewedInstantiationArchiveUpdate } from "./reviewed-instantiation-archive-source-history.mjs";

test("reviewed instantiation archive restores exact main predecessors without accepting unknown edits", async () => {
	const record = JSON.parse(await readFile(reviewedInstantiationArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, reviewedInstantiationArchivePredecessor);
	assert.deepEqual(record.updates.map(update => update.path), reviewedInstantiationArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), restored = reverseReviewedInstantiationArchiveUpdate(source, update);
		assert.equal(sha256(restored), update.previousSha256);
		assert.equal(beforeReviewedInstantiationArchiveSource(update.path, source), restored);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), restored);
		assert.equal(beforeReviewedInstantiationArchiveSource(update.path, source, update.currentSha256), source);
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeReviewedInstantiationArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedInstantiationArchiveUpdate(changed, update));
		assert.throws(() => reverseReviewedInstantiationArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("reviewed native branch intermediates require the explicitly authenticated producer digest", async () => {
	const record = JSON.parse(await readFile(reviewedInstantiationArchiveHistoryPath, "utf8"));
	assert.equal(record.producerCommit, reviewedInstantiationArchiveProducer);
	assert.deepEqual(record.producerUpdates.map(update => update.path), Object.keys(reviewedInstantiationArchiveProducerPins));
	for(const update of record.producerUpdates)
	{
		const source = await readFile(update.path, "utf8"), expected = reviewedInstantiationArchiveProducerPins[update.path];
		assert.equal(update.previousSha256, expected);
		const restored = beforeReviewedInstantiationArchiveSource(update.path, source, expected);
		assert.equal(sha256(restored), expected);
		assert.equal(reverseReviewedInstantiationArchiveUpdate(source, update), restored);
		assert.equal(beforeFinRefinementSource(update.path, source, expected), restored);
		assert.notEqual(beforeReviewedInstantiationArchiveSource(update.path, source), restored);
		assert.equal(beforeReviewedInstantiationArchiveSource(update.path, restored, expected), restored);
		assert.equal(beforeReviewedInstantiationArchiveSource(update.path, source + "\n", expected), source + "\n");
		assert.throws(() => reverseReviewedInstantiationArchiveUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("reviewed instantiation archive refreshes one current source pin without promoting any claim", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const document = JSON.parse(source), previous = JSON.parse(beforeReviewedInstantiationArchiveSource(path, source));
	const record = JSON.parse(await readFile(reviewedInstantiationArchiveHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(await readFile(file.path)), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 1); assert.deepEqual(document, previous);
});

test("the reviewed instantiation archive updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-instantiation-archive-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-instantiation-archive-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Reviewed instantiation archive history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
