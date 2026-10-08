/**
 * Native reply review integration and the support table preserve earlier source evidence.
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
import { clarifyNativeReplyEvidence, clarifyNativeReplyObservation, nativeReplyReviewObservationIds, nativeReplyReviewValidator } from "./native-fin-reply-review-notes.mjs";
import { nativeFinReplyPromotionId } from "./native-fin-reply-promotion-references.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeScalarFinSourceEntryIntegrationSource } from "./scalar-fin-source-entry-integration-source-history.mjs";
import { beforeNativeReplyReviewSource, nativeReplyReviewChangedPaths, nativeReplyReviewHistoryPath, reverseNativeReplyReviewUpdate } from "./native-reply-review-source-history.mjs";

test("Native reply review integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeReplyReviewHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "f8a1b5daa350f0584c64dd4d2922ae57574bf1aa");
	assert.deepEqual(record.updates.map(update => update.path), nativeReplyReviewChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeScalarFinSourceEntryIntegrationSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeReplyReviewUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeReplyReviewSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeReplyReviewSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeReplyReviewSource(update.path, changed), changed);
		assert.throws(() => reverseNativeReplyReviewUpdate(changed, update));
		assert.throws(() => reverseNativeReplyReviewUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native reply review records only four wording clarifications and its bounded reproduction selector", async () => {
	const path = "docs/type-surface.v1.json", text = beforeScalarFinSourceEntryIntegrationSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforeNativeReplyReviewSource(path, text));
	const record = JSON.parse(await readFile(nativeReplyReviewHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeScalarFinSourceEntryIntegrationSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	previous.observations = previous.observations.map(item => nativeReplyReviewObservationIds.includes(item.id) ? clarifyNativeReplyObservation(item) : item);
	const index = previous.evidence.findIndex(item => item.id === nativeFinReplyPromotionId);
	previous.evidence[index] = clarifyNativeReplyEvidence(previous.evidence[index], sha256(await readFile(nativeReplyReviewValidator)));
	assert.deepEqual(document, previous);
});

test("the Native reply review updater refuses another HEAD before any evidence write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-reply-review-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-reply-review-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Native reply review history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
