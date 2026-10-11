/**
 * Preserve earlier evidence while requiring WIT consumer source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeWitHistoryCheckoutSource, witHistoryCheckoutChangedPaths, witHistoryCheckoutHistoryPath, witHistoryCheckoutPredecessor, reverseWitHistoryCheckoutUpdate } from "./wit-history-checkout-history.mjs";

test("WIT history checkout authenticates exact changes without changing support claims", async () => {
	const record = JSON.parse(await readFile(witHistoryCheckoutHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "wit-history-checkout-source-v1");
	assert.equal(record.predecessorCommit, witHistoryCheckoutPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), witHistoryCheckoutChangedPaths);
	const original = path => execFileSync("git", ["show", `${witHistoryCheckoutPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeWitHistoryCheckoutSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseWitHistoryCheckoutUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeWitHistoryCheckoutSource(update.path, current), previous);
		assert.equal(beforeWitHistoryCheckoutSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeWitHistoryCheckoutSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeWitHistoryCheckoutSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseWitHistoryCheckoutUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeWitHistoryCheckoutSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
	const expected = JSON.parse(original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 92);
	assert.deepEqual(JSON.parse(await readFile(inventoryPath, "utf8")), expected);
	assert.equal(expected.evidence.length, 472); assert.equal(expected.observations.length, 571);
	const workflowPath = ".github/workflows/consumer-matrix.yml";
	const [earlierJobs, witAndLaterJobs] = original(workflowPath).split("\n  wasi-consumer:\n");
	const checkout = "        with:\n          persist-credentials: false\n      - name: Install Node.js\n";
	const fixed = "        with:\n          fetch-depth: 0\n          persist-credentials: false\n"
		+ "      - name: Require source history before WIT consumer builds\n"
		+ "        run: test \"$(git rev-parse --is-shallow-repository)\" = false\n"
		+ "      - name: Install Node.js\n";
	assert.ok(witAndLaterJobs.includes(checkout));
	assert.equal(await readFile(workflowPath, "utf8"), earlierJobs + "\n  wasi-consumer:\n" + witAndLaterJobs.replace(checkout, fixed));
});

test("WIT history checkout writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-history-checkout-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-wit-history-checkout-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
