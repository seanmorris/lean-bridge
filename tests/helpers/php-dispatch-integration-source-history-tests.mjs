/**
 * Authenticate the PHP dispatch integration without changing earlier support claims.
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
import { beforeReviewedRecordPromotionSource } from "./reviewed-record-promotion-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpDispatchIntegrationSource, phpDispatchIntegrationChangedPaths, phpDispatchIntegrationHistoryPath, phpDispatchIntegrationPredecessor, reversePhpDispatchIntegrationUpdate } from "./php-dispatch-integration-source-history.mjs";
import { phpDispatchSnapshot, phpDispatchSources } from "./php-fin-dispatch-evidence.mjs";

test("PHP dispatch integration restores exact predecessors and refuses unknown source edits", async () => {
	const record = JSON.parse(await readFile(phpDispatchIntegrationHistoryPath, "utf8"));
	assert.deepEqual(Object.keys(record), ["schemaVersion", "milestone", "predecessorCommit", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-dispatch-integration-v1");
	assert.equal(record.predecessorCommit, phpDispatchIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), phpDispatchIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedRecordPromotionSource(update.path, await readFile(update.path, "utf8"));
		const restored = reversePhpDispatchIntegrationUpdate(source, update);
		assert.equal(sha256(restored), update.previousSha256);
		assert.equal(beforePhpDispatchIntegrationSource(update.path, source), restored);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), restored);
		assert.equal(beforePhpDispatchIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforePhpDispatchIntegrationSource(update.path, restored, update.previousSha256), restored);
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforePhpDispatchIntegrationSource(update.path, changed), changed);
		assert.throws(() => reversePhpDispatchIntegrationUpdate(changed, update));
		assert.throws(() => reversePhpDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePhpDispatchIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
		assert.throws(() => reversePhpDispatchIntegrationUpdate(source, { ...update, path: "unregistered.mjs" }));
	}
});

test("PHP dispatch integration refreshes exactly 96 source pins and preserves every earlier claim", async () => {
	const path = "docs/type-surface.v1.json", source = beforeReviewedRecordPromotionSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(source), previous = JSON.parse(beforePhpDispatchIntegrationSource(path, source));
	const record = JSON.parse(await readFile(phpDispatchIntegrationHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(beforeReviewedRecordPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 96);
	assert.equal(document.observations.length, 491);
	assert.equal(document.evidence.length, 266);
	assert.deepEqual(document, previous);
});

test("the PHP dispatch producer test stays byte-identical and stops at its executed digest", async () => {
	const path = "tests/php-fin.test.mjs", source = await readFile(path, "utf8");
	assert.equal(sha256(source), phpDispatchSources[path]);
	assert.equal(source, await readFile(phpDispatchSnapshot(path), "utf8"));
	assert.equal(beforeFinRefinementSource(path, source, phpDispatchSources[path]), source);
	assert.notEqual(beforePhpDispatchIntegrationSource(path, source), source);
	const changed = source + "\n";
	assert.equal(beforeFinRefinementSource(path, changed, phpDispatchSources[path]), changed);
});

test("the PHP dispatch history updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-dispatch-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-php-dispatch-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /PHP dispatch integration history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
