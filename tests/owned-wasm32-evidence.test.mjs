/**
 * Source-bound wasm32 ownership evidence and unchanged native PHP history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedWasm32Ci, assertOwnedWasm32Execution } from "./helpers/owned-wasm32-evidence.mjs";
import { jvmThreadExitHistoricalBytes } from "./helpers/jvm-thread-exit-repair-history.mjs";
import { beforeOwnedWasm32, ownedWasm32Baseline, ownedWasm32HistoryPath
	, ownedWasm32Previous, ownedWasm32ChangedPaths, ownedWasm32AddedPaths
	, ownedWasm32HistoricalBytes, reverseOwnedWasm32Update } from "./helpers/owned-wasm32-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const source = async (path, expected) => jvmThreadExitHistoricalBytes(path, await readFile(path), expected);

test("owned wasm32 history preserves the exact native PHP receipt and all source identities", async () => {
	const record = await json(ownedWasm32HistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-wasm32-transport");
	assert.equal(record.baselineRevision, ownedWasm32Baseline);
	assert.deepEqual(record.previous, ownedWasm32Previous);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(previous.sources), ...ownedWasm32ChangedPaths
		, ...ownedWasm32AddedPaths
	])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await source(path, hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWasm32ChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = (await source(update.path, update.currentSha256)).toString();
		const prior = beforeOwnedWasm32(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedWasm32(update.path, prior), prior);
		assert.equal(beforeOwnedWasm32(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded wasm32 edit */\n";
		assert.equal(beforeOwnedWasm32(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWasm32Update(unknown, update));
		assert.throws(() => reverseOwnedWasm32Update(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedWasm32Update(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseOwnedWasm32Update(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedWasm32HistoricalBytes("unknown.bin", binary), binary);
	const current = (await source("docs/type-surface.v1.json", record.sources["docs/type-surface.v1.json"])).toString();
	const prior = JSON.parse(beforeOwnedWasm32("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await source(file.path, record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
});

test("owned wasm32 evidence binds executed scalars, recursion, failures and native compatibility", async () => {
	await assertOwnedWasm32Execution(await json(ownedWasm32HistoryPath));
});

test("owned wasm32 evidence rejects widened scope, altered source and substituted observations", async () => {
	const original = await json(ownedWasm32HistoryPath);
	for(const mutate of [
		record => { record.scope.installedPackage = true; }
		, record => { record.scope.hostCallbacks = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.runs.wasm.command += " --import forged.mjs"; }
		, record => { record.runs.native.text += "\nchanged\n"; }
		, record => { record.reports["owned-scalars"].executions.pop(); }
		, record => { record.reports["owned-scalars"].executions[0].live = 1; }
		, record => { record.reports["owned-aggregates"].executions[0].identities = 1; }
		, record => { record.reports["owned-scalars"].executions[0].retired = false; }
		, record => { record.reports["owned-scalars"].executions[0].boundaryChecks--; }
		, record => { record.reports["owned-aggregates"].executions[0].failures--; }
		, record => { record.reports["owned-scalars"].inputs.wordBits = 64; }
		, record => { record.reports["owned-scalars"].files["probe.c"] = "0".repeat(64); }
		, record => { record.reports["owned-aggregates"].adapterSha256 = "0".repeat(64); }
		, record => { record.reports["owned-aggregates"].runtimeManifest.pointerBits = 64; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedWasm32Execution(changed), mutate.toString());
	}
});

test("CI executes both owned wasm32 probes, retains the reports and propagates failure", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertOwnedWasm32Ci(workflow);
	for(const fragment of [
		"          LEAN_BRIDGE_OWNED_WASM32_TEST=1 node --test --test-concurrency=1 tests/owned-wasm32-transport.test.mjs\n"
		, "          test -s build/owned-wasm32/owned-scalars.json\n"
		, "          test -s build/owned-wasm32/owned-aggregates.json\n"
		, "            build/owned-wasm32/owned-scalars.json\n"
		, "            build/owned-wasm32/owned-aggregates.json\n"
		, "steps.type_corpus_php_wasm.outcome != 'success'"
	]) assert.throws(() => assertOwnedWasm32Ci(workflow.replace(fragment, "")), fragment);
});
