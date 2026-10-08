/**
 * Native Fin reply promotion integration and the support table preserve earlier source evidence.
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
import { nativeFinReplyPromotionObservation, nativeFinReplyPromotionObservationIds } from "./native-fin-reply-promotion-references.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNodeConsumerBudgetSource } from "./node-consumer-budget-source-history.mjs";
import { beforeNativeFinReplyPromotionSource, nativeFinReplyPromotionChangedPaths, nativeFinReplyPromotionHistoryPath, reverseNativeFinReplyPromotionUpdate } from "./native-fin-reply-promotion-source-history.mjs";

test("Native Fin reply promotion integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinReplyPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ffb7a4478f00a72983d2e8863e73bb0d01e94d9f");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinReplyPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNodeConsumerBudgetSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeFinReplyPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinReplyPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinReplyPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinReplyPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinReplyPromotionUpdate(changed, update));
		assert.throws(() => reverseNativeFinReplyPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native Fin reply promotion preserves older evidence claims and all but the two reconciled observations", async () => {
	const path = "docs/type-surface.v1.json", text = beforeNodeConsumerBudgetSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforeNativeFinReplyPromotionSource(path, text));
	const record = JSON.parse(await readFile(nativeFinReplyPromotionHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeNodeConsumerBudgetSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(document.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.equal(document.evidence.length, previous.evidence.length + 1);
	assert.deepEqual(document.observations, previous.observations.map(item =>
		nativeFinReplyPromotionObservationIds.includes(item.id) ? nativeFinReplyPromotionObservation(item) : item));
});

test("the native Fin reply promotion updater refuses another HEAD before any evidence write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reply-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	for(const script of ["update-native-fin-reply-promotion-history", "promote-native-fin-reply-evidence"])
	{
		const result = spawnSync(process.execPath, [resolve(`scripts/${script}.mjs`)], { cwd: directory, encoding: "utf8", env });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Native Fin reply promotion(?: history)? is draft-only at its exact predecessor/u);
	}
	assert.deepEqual(await readdir(directory), [".git"]);
});
