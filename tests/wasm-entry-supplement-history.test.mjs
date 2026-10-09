/**
 * Preserve earlier source identities and the exact three-observation Wasm entry supplement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { beforeArrayRolloutSource } from "./helpers/generic-record-array-rollout-source-history.mjs";
import { supplementWasmEntryInventory, wasmEntrySupplementObservations } from "./helpers/wasm-entry-supplement.mjs";
import { beforeWasmEntrySupplementSource, reverseWasmEntrySupplementUpdate, wasmEntrySupplementChangedPaths, wasmEntrySupplementHistoryPath, wasmEntrySupplementPredecessor } from "./helpers/wasm-entry-supplement-source-history.mjs";

test("Wasm entry supplement history authenticates exact source transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(wasmEntrySupplementHistoryPath));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "wasm-entry-supplement-v1");
	assert.equal(history.predecessorCommit, wasmEntrySupplementPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), wasmEntrySupplementChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeArrayRolloutSource(update.path, await readFile(update.path, "utf8")), previous = reverseWasmEntrySupplementUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeWasmEntrySupplementSource(update.path, current), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeWasmEntrySupplementSource(update.path, changed), changed);
		assert.throws(() => reverseWasmEntrySupplementUpdate(changed, update));
		assert.throws(() => reverseWasmEntrySupplementUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseWasmEntrySupplementUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseWasmEntrySupplementUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Wasm entry inventory adds sixteen reports, preserves older claims and authenticates every pin", async () => {
	const path = "docs/type-surface.v1.json", source = beforeArrayRolloutSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeWasmEntrySupplementSource(path, source));
	const history = JSON.parse(await readFile(wasmEntrySupplementHistoryPath));
	const expected = await supplementWasmEntryInventory(previous);
	let refreshed = 0;
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0); assert.deepEqual(current, expected);
	assert.equal(previous.evidence.length, 294); assert.equal(current.evidence.length, 310);
	assert.equal(current.observations.length, 499); assert.equal(previous.observations.length, 499);
	assert.deepEqual(current.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(previous.observations[index])).map(item => item.id).sort(), [...wasmEntrySupplementObservations].sort());
	for(const entry of current.evidence.slice(previous.evidence.length))
	{
		assert.equal(entry.kind, "test"); assert.deepEqual(entry.artifacts, []);
		assert.match(entry.scope, /package archives and receipt bytes are not retained here/u);
	}
	assert.deepEqual((await readTypeSurface()).document, JSON.parse(await readFile(path, "utf8")));
	const files = new Map();
	for(const entry of (await readTypeSurface()).document.evidence) for(const file of entry.files)
	{
		if(!files.has(file.path)) files.set(file.path, sha256(await readFile(file.path)));
		assert.equal(files.get(file.path), file.sha256, file.path);
	}
});

test("Wasm entry evidence is registered and both author and consumer guides explain the two modes", async () => {
	for(const root of ["wasm-entry-supplement", "wasm-entry-supplement-history"])
		assert.equal(classifyRepositoryTest(`tests/${root}.test.mjs`), "contract");
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("wasm-fin-entry-20261009.md"));
		assert.match(source, /[Uu]nmodified packages/u); assert.match(source, /[Ii]nstrumented packages/u);
	}
	const evidence = await readFile("docs/evidence/wasm-fin-entry-20261009.md", "utf8");
	assert.ok(evidence.includes("Firefox and WebKit ran,"));
	assert.ok(evidence.includes("their versions are not recorded"));
});

test("Wasm entry supplement writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wasm-entry-supplement-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-wasm-entry-supplement-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Wasm entry supplement history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
