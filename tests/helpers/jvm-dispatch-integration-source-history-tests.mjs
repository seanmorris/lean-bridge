/**
 * Register the JVM dispatch integration without changing support claims or rewriting earlier evidence.
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
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeJvmDispatchIntegrationSource, jvmDispatchIntegrationChangedPaths, jvmDispatchIntegrationHistoryPath, jvmDispatchIntegrationPredecessor, reverseJvmDispatchIntegrationUpdate } from "./jvm-dispatch-integration-source-history.mjs";

test("JVM dispatch integration history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(jvmDispatchIntegrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "jvm-dispatch-integration-v1");
	assert.equal(record.predecessorCommit, jvmDispatchIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), jvmDispatchIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseJvmDispatchIntegrationUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeJvmDispatchIntegrationSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeJvmDispatchIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeJvmDispatchIntegrationSource(update.path, changed), changed);
		assert.throws(() => reverseJvmDispatchIntegrationUpdate(changed, update));
		assert.throws(() => reverseJvmDispatchIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseJvmDispatchIntegrationUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseJvmDispatchIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("JVM dispatch integration refreshes exactly 132 source pins without promoting any support cell", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeJvmDispatchIntegrationSource(path, text));
	const record = JSON.parse(await readFile(jvmDispatchIntegrationHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(await readFile(file.path)), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 132);
	assert.deepEqual(current, previous);
});

test("JVM dispatch integration retains its producer source and runs archived evidence in core contracts", async () => {
	const digests = {
		"tests/jvm-fin.test.mjs": "fbeb8f84f2f99308cca0a27f1b5f2d0c6a1d0ee5748a85f637831b3fb2903d72"
		, "tests/helpers/native-fin-dispatch-gdb-extracted.mjs": "6647ea82c4fb21408474947032fbf77a025fa0380de0803fa05eda40df64166f"
	};
	for(const [path, digest] of Object.entries(digests)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.equal(classifyRepositoryTest("tests/jvm-fin-dispatch-evidence.test.mjs"), "contract");
});

test("the JVM dispatch integration updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-dispatch-integration-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-jvm-dispatch-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /JVM dispatch integration history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
