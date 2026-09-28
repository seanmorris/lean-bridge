/**
 * Preserve prior observations while checking the complete filtered engine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { ownedPhpWasmHistoricalBytes } from "./helpers/owned-php-wasm-source-history.mjs";
import { assertPhpNixBoundaryExecution, assertPhpNixImportClosure, phpNixBoundaryManifest, phpNixBoundaryModules } from "./helpers/php-nix-boundary-repair-evidence.mjs";
import { beforePhpNixBoundaryRepair, phpNixBoundaryAddedPaths, phpNixBoundaryBaseline
	, phpNixBoundaryChangedPaths, phpNixBoundaryHistoricalBytes, phpNixBoundaryHistoryPath
	, phpNixBoundaryPrevious, reversePhpNixBoundaryUpdate } from "./helpers/php-nix-boundary-repair-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const source = async (path, expected) => ownedPhpWasmHistoricalBytes(path, await readFile(path), expected);

test("PHP Nix boundary repair preserves the exact JVM and earlier receipts", async () => {
	const record = await json(phpNixBoundaryHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-nix-boundary-repair");
	assert.equal(record.baselineRevision, phpNixBoundaryBaseline);
	assert.deepEqual(record.previous, phpNixBoundaryPrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(previous.sources), ...phpNixBoundaryChangedPaths
		, ...phpNixBoundaryAddedPaths
	])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await source(path, hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), phpNixBoundaryChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = (await source(update.path, update.currentSha256)).toString();
		const prior = beforePhpNixBoundaryRepair(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforePhpNixBoundaryRepair(update.path, prior), prior);
		assert.equal(beforePhpNixBoundaryRepair(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded source-filter edit */\n";
		assert.equal(beforePhpNixBoundaryRepair(update.path, unknown), unknown);
		assert.throws(() => reversePhpNixBoundaryUpdate(unknown, update));
		assert.throws(() => reversePhpNixBoundaryUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePhpNixBoundaryUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reversePhpNixBoundaryUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(phpNixBoundaryHistoricalBytes("unknown.bin", binary), binary);
	const current = (await source("docs/type-surface.v1.json", record.sources["docs/type-surface.v1.json"])).toString();
	const prior = JSON.parse(beforePhpNixBoundaryRepair("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await source(file.path, record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
});

test("PHP Nix boundary evidence binds the reproduced failures and both passing runs", async () => {
	await assertPhpNixBoundaryExecution(await json(phpNixBoundaryHistoryPath));
});

test("PHP Nix boundary evidence rejects broader claims and substituted observations", async () => {
	const original = await json(phpNixBoundaryHistoryPath);
	for(const mutate of [
		record => { record.scope.nixBuild = true; }
		, record => { record.scope.installedPackage = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.addedFiles.pop(); }
		, record => { record.runs.before.exitCode = 0; }
		, record => { record.runs.after.command += " --import forged.mjs"; }
		, record => { record.runs.contracts.text += "\nchanged\n"; }
		, record => { record.boundary.includedFiles.pop(); }
		, record => { record.sources[phpNixBoundaryModules[0]] = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertPhpNixBoundaryExecution(changed), mutate.toString());
	}
});

test("filtered Perl source closure requires every newly added PHP module", async () => {
	const original = await json(phpNixBoundaryManifest);
	await assertPhpNixImportClosure(original);
	for(const missing of phpNixBoundaryModules)
	{
		const changed = { ...original, includedFiles: original.includedFiles.filter(path => path !== missing) };
		await assert.rejects(() => assertPhpNixImportClosure(changed), missing);
	}
});
