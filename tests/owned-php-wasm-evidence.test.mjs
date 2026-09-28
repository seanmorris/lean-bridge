/**
 * Preserve frozen PHP history and reject unsupported installed Wasm claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedJavaScriptWasm, ownedJavaScriptWasmHistoricalBytes } from "./helpers/owned-javascript-wasm-source-history.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../src/backends/php/copied-graph-zend.mjs";
import { assertOwnedPhpWasmExecution } from "./helpers/owned-php-wasm-package-evidence.mjs";
import { assertPhpGraphZendEvidence } from "./helpers/php-graph-zend-receipt.mjs";
import { phpStructuredRegressionFixtures } from "./helpers/php-structured-callable-regression.mjs";
import { assertPhpWasmStructuredCodegenRegression } from "./helpers/php-wasm-structured-callable-regression.mjs";
import { beforeOwnedPhpWasmPackages, ownedPhpWasmAddedPaths, ownedPhpWasmBaseline
	, ownedPhpWasmBaselineSources, ownedPhpWasmChangedPaths, ownedPhpWasmHistoricalBytes
	, ownedPhpWasmHistoryPath, ownedPhpWasmPrevious, reverseOwnedPhpWasmUpdate } from "./helpers/owned-php-wasm-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("historical recursive Zend receipts reject current wrappers on both execution paths", async () => {
	const record = await json("docs/evidence/php-wasm-recursive-conversions-20260924.json");
	await assertPhpGraphZendEvidence(record);
	for(const key of ["isolated", "lean"])
	{
		const report = record.reports[key], ir = report.bindingIr ?? report.transport.bindingIr;
		const current = generateCopiedPhpGraphZendAdapter(ir);
		assert.notEqual(sha256(current["src/Internal/Native.php"]), report.generatedSources["src/Internal/Native.php"]);
		const changed = structuredClone(record);
		changed.reports[key].generatedSources = Object.fromEntries(Object.entries(current).map(([path, source]) => [path, sha256(source)]));
		changed.reportHashes[key] = sha256(canonicalJson(changed.reports[key]));
		await assert.rejects(() => assertPhpGraphZendEvidence(changed));
	}
});

test("historical PHP-Wasm wrappers use authenticated predecessor generators and reject current replacements", async () => {
	const record = await json("docs/evidence/php-wasm-structured-codegen-regression-20260925.json");
	await assertPhpWasmStructuredCodegenRegression(record);
	const fixture = record.fixtures[0];
	const current = generateCopiedPhpZendAdapter(phpStructuredRegressionFixtures[fixture.name](), { integerBits: fixture.integerBits });
	const path = "src/Internal/Native.php", source = current[path];
	assert.notEqual(sha256(source), fixture.files[path].sha256);
	for(const mutate of [
		changed => { changed.fixtures[0].files[path] = { bytes: Buffer.byteLength(source), sha256: sha256(source) }; }
		, changed => { changed.fixtures[0].files[path].bytes--; }
		, changed => { changed.fixtures[0].identicalToPredecessor = false; }
		, changed => { changed.fixtures.pop(); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertPhpWasmStructuredCodegenRegression(changed), mutate.toString());
	}
});

test("PHP-Wasm ownership preserves predecessor receipts and authenticates each source change", async () => {
	const record = await json(ownedPhpWasmHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-php-wasm-integration");
	assert.equal(record.baselineRevision, ownedPhpWasmBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmPrevious);
	assert.deepEqual(record.baselineSources, ownedPhpWasmBaselineSources);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(previous.sources), ...ownedPhpWasmChangedPaths
		, ...ownedPhpWasmAddedPaths
	])].sort());
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(ownedJavaScriptWasmHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpWasmChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedPhpWasmBaselineSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedJavaScriptWasm(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedPhpWasmPackages(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedPhpWasmPackages(update.path, prior), prior);
		assert.equal(beforeOwnedPhpWasmPackages(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded PHP-Wasm edit */\n";
		assert.equal(beforeOwnedPhpWasmPackages(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpWasmUpdate(unknown, update));
		assert.throws(() => reverseOwnedPhpWasmUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedPhpWasmUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseOwnedPhpWasmUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedPhpWasmHistoricalBytes("unknown.bin", binary), binary);
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedPhpWasmPackages("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("PHP-Wasm evidence binds installed CLI releases, browser coexistence, cleanup and documentation", async () => {
	await assertOwnedPhpWasmExecution(await json(ownedPhpWasmHistoryPath));
});

test("PHP-Wasm evidence rejects widened scope, omitted cases and altered execution results", async () => {
	const original = await json(ownedPhpWasmHistoryPath);
	await assertOwnedPhpWasmExecution(original);
	for(const mutate of [
		record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.debuggerRepair.before.exitCode = 0; }
		, record => { record.debuggerRepair.after.text += "altered"; }
		, record => { record.debuggerRepair.after = record.debuggerRepair.before; }
		, record => { record.runs.packages.exitCode = 1; }
		, record => { record.runs.layers.command += " --import forged.mjs"; }
		, record => { record.runs.values.text += "\nchanged\n"; }
		, record => { record.reports.packages.runtimeSupplied = true; }
		, record => { record.reports.packages.observations.pop(); }
		, record => { record.reports.packages.observations[0].receipt.ownedGraph.layoutSha256 = "0".repeat(64); }
		, record => { record.reports.packages.observations[0].modelSha256 = "0".repeat(64); }
		, record => { record.reports.packages.observations[0].executions[0].observed.checks--; }
		, record => { record.reports.packages.observations[0].coexistence.executions.pop(); }
		, record => { record.reports.packages.observations[0].coexistence.browser.observations.pop(); }
		, record => { record.reports.packages.observations[0].coexistence.browser.observations[0].executions.pop(); }
		, record => { record.reports.packages.observations[0].coexistence.browser.observations[0].executions[0].cleaned.liveIdentities = 1; }
		, record => { record.reports.multi.observations[0].nativeModel.pointerBits = 32; }
		, record => { record.reports.multi.observations[0].wasmModel.sourceApiSha256 = "0".repeat(64); }
		, record => { record.reports.multi.observations[1].wasmObserved.checks--; }
		, record => { record.reports.documentation.configurationSha256 = "0".repeat(64); }
		, record => { record.reports.documentation.observed.output = "wrong\n"; }
		, record => { record.reports.generatedReviewed.observations[1].nativeFailures--; }
		, record => { record.reports.generated.sourceSha256 = "0".repeat(64); }
		, record => { record.reports.generated.malformed.pop(); }
		, record => { record.reports.lifetime.observations[0].stats.live = 1; }
		, record => { record.reports.fibers.rejectedMutations.pop(); }
		, record => { record.reports.values.observations[0].observation.actualPhpBits = 64; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedPhpWasmExecution(changed), mutate.toString());
	}
});
