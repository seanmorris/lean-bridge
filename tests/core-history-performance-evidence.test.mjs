/**
 * Preserve the full source and installed-evidence contract while speeding checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedWitProjection, ownedWitProjectionHistoricalBytes } from "./helpers/wit-owned-projection-history.mjs";
import { beforeCoreHistoryPerformance, coreHistoryAddedPaths, coreHistoryBaseline
	, coreHistoryChangedPaths, coreHistoryPath, coreHistoryPrevious
	, reverseCoreHistoryUpdate } from "./helpers/core-history-performance-history.mjs";

const read = async () => JSON.parse(await readFile(coreHistoryPath, "utf8"));

test("history optimization authenticates every verifier edit and keeps installed support unchanged", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "core-history-performance");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, coreHistoryBaseline);
	assert.deepEqual(record.previous, coreHistoryPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...coreHistoryAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedWitProjectionHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), coreHistoryChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		assert.match(update.path, /^(?:tests\/|docs\/|src\/adoption\/test-profiles\.mjs$)/u);
		const current = beforeOwnedWitProjection(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(beforeCoreHistoryPerformance(update.path, current)), update.previousSha256);
		assert.equal(beforeCoreHistoryPerformance(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedWitProjection("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeCoreHistoryPerformance("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedWitProjectionHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior);
});

test("optimized history still rejects unknown text, altered predecessors and overlapping edits", async () => {
	const record = await read();
	for(const update of record.updates)
	{
		const current = beforeOwnedWitProjection(update.path, await readFile(update.path, "utf8")), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeCoreHistoryPerformance(update.path, unknown), unknown);
		assert.throws(() => reverseCoreHistoryUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseCoreHistoryUpdate(current, changed));
	}
});

test("history optimization retains complete cache and historical mutation test results", async () => {
	const record = await read();
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(Object.keys(record.runs).sort(), ["cache", "historical"]);
	for(const [name, tests] of [["cache", 5], ["historical", 19]])
	{
		const run = record.runs[name];
		assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, count] of Object.entries({ tests, pass: tests, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	}
	assert.equal(record.runs.cache.command, "node --test tests/source-history-memo.test.mjs");
	assert.equal(record.runs.historical.command, "node --test --test-concurrency=2 tests/php-recursive-callable-evidence.test.mjs tests/jvm-recursive-callable-evidence.test.mjs tests/dotnet-recursive-callable-evidence.test.mjs tests/php-wasm-recursive-callable-evidence.test.mjs");
	for(const phrase of ["recursive PHP acceptance adds exactly four cells"
		, "recursive JVM acceptance adds exactly eight cells"
		, String.raw`recursive C\# acceptance adds exactly four cells`
		, "PHP-Wasm recursive acceptance promotes exactly four cells"])
		assert.ok(record.runs.historical.text.includes(phrase), phrase);
});
