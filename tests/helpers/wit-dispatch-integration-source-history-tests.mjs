/**
 * Authenticate the WIT dispatch integration without changing earlier support claims.
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
import { beforeWitDispatchIntegrationSource, witDispatchIntegrationChangedPaths, witDispatchIntegrationHistoryPath, witDispatchIntegrationPredecessor, reverseWitDispatchIntegrationUpdate } from "./wit-dispatch-integration-source-history.mjs";
import { witDispatchSnapshot, witDispatchSources } from "./wit-fin-dispatch-evidence.mjs";

test("WIT dispatch integration restores exact predecessors and refuses unknown source edits", async () => {
	const record = JSON.parse(await readFile(witDispatchIntegrationHistoryPath, "utf8"));
	assert.deepEqual(Object.keys(record), ["schemaVersion", "milestone", "predecessorCommit", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "wit-dispatch-integration-v1");
	assert.equal(record.predecessorCommit, witDispatchIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), witDispatchIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		const restored = reverseWitDispatchIntegrationUpdate(source, update);
		assert.equal(sha256(restored), update.previousSha256);
		assert.equal(beforeWitDispatchIntegrationSource(update.path, source), restored);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), restored);
		assert.equal(beforeWitDispatchIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeWitDispatchIntegrationSource(update.path, restored, update.previousSha256), restored);
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeWitDispatchIntegrationSource(update.path, changed), changed);
		assert.throws(() => reverseWitDispatchIntegrationUpdate(changed, update));
		assert.throws(() => reverseWitDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseWitDispatchIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
		assert.throws(() => reverseWitDispatchIntegrationUpdate(source, { ...update, path: "unregistered.mjs" }));
	}
});

test("WIT dispatch integration refreshes exactly 97 source pins and preserves every earlier claim", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const document = JSON.parse(source), previous = JSON.parse(beforeWitDispatchIntegrationSource(path, source));
	const record = JSON.parse(await readFile(witDispatchIntegrationHistoryPath, "utf8"));
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
	assert.equal(pins, 97);
	assert.equal(document.observations.length, 493);
	assert.equal(document.evidence.length, 268);
	assert.deepEqual(document, previous);
});

test("the WIT dispatch producer test stays byte-identical and stops at its executed digest", async () => {
	const path = "tests/wit-fin.test.mjs", source = await readFile(path, "utf8");
	assert.equal(sha256(source), witDispatchSources[path]);
	assert.equal(source, await readFile(witDispatchSnapshot(path), "utf8"));
	assert.equal(beforeFinRefinementSource(path, source, witDispatchSources[path]), source);
	assert.notEqual(beforeWitDispatchIntegrationSource(path, source), source);
	const changed = source + "\n";
	assert.equal(beforeFinRefinementSource(path, changed, witDispatchSources[path]), changed);
});

test("the WIT dispatch history updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-dispatch-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-wit-dispatch-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /WIT dispatch integration history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
