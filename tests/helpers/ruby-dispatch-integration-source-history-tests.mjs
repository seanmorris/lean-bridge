/**
 * Register the Ruby dispatch integration without changing support claims or rewriting earlier evidence.
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
import { beforeRubyDispatchIntegrationSource, rubyDispatchIntegrationChangedPaths, rubyDispatchIntegrationHistoryPath, rubyDispatchIntegrationPredecessor, rubyDispatchIntegrationProducer, rubyDispatchIntegrationProducerPins, reverseRubyDispatchIntegrationUpdate } from "./ruby-dispatch-integration-source-history.mjs";
import { beforeDotnetDispatchIntegrationSource } from "./dotnet-dispatch-integration-source-history.mjs";
import { rubyDispatchSnapshot } from "./ruby-fin-dispatch-evidence.mjs";

test("Ruby dispatch integration history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(rubyDispatchIntegrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "ruby-dispatch-integration-v1");
	assert.equal(record.predecessorCommit, rubyDispatchIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), rubyDispatchIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeDotnetDispatchIntegrationSource(update.path, await readFile(update.path, "utf8")), previous = reverseRubyDispatchIntegrationUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeRubyDispatchIntegrationSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeRubyDispatchIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeRubyDispatchIntegrationSource(update.path, changed), changed);
		assert.throws(() => reverseRubyDispatchIntegrationUpdate(changed, update));
		assert.throws(() => reverseRubyDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseRubyDispatchIntegrationUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseRubyDispatchIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Ruby dispatch integration refreshes exactly 96 source pins without promoting any support cell", async () => {
	const path = "docs/type-surface.v1.json", text = beforeDotnetDispatchIntegrationSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(text), previous = JSON.parse(beforeRubyDispatchIntegrationSource(path, text));
	const record = JSON.parse(await readFile(rubyDispatchIntegrationHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(beforeDotnetDispatchIntegrationSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 96);
	assert.deepEqual(current, previous);
});

test("Ruby history preserves its installed producer only at an explicit exact digest", async () => {
	const record = JSON.parse(await readFile(rubyDispatchIntegrationHistoryPath));
	assert.equal(record.producerCommit, rubyDispatchIntegrationProducer);
	assert.deepEqual(record.producerUpdates.map(item => item.path), Object.keys(rubyDispatchIntegrationProducerPins));
	for(const update of record.producerUpdates)
	{
		const source = beforeDotnetDispatchIntegrationSource(update.path, await readFile(update.path, "utf8")), original = await readFile(rubyDispatchSnapshot(update.path), "utf8");
		assert.equal(update.previousSha256, rubyDispatchIntegrationProducerPins[update.path]);
		assert.equal(reverseRubyDispatchIntegrationUpdate(source, update), original);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), original);
		assert.notEqual(beforeRubyDispatchIntegrationSource(update.path, source), original, "main ancestry stays separate from the producer branch");
		assert.throws(() => reverseRubyDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.notEqual(beforeRubyDispatchIntegrationSource(update.path, source + "\n", update.previousSha256), original);
	}
});

test("the Ruby dispatch integration updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-dispatch-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-ruby-dispatch-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Ruby dispatch integration history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
