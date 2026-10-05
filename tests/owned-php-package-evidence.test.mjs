/**
 * Preserve predecessor receipts and reject substituted native PHP acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPhpExecution } from "./helpers/owned-php-package-evidence.mjs";
import { ownedWasm32HistoricalBytes } from "./helpers/owned-wasm32-source-history.mjs";
import { beforeOwnedPhpPackages, ownedPhpBaseline, ownedPhpHistoryPath
	, ownedPhpPrevious, ownedPhpChangedPaths, ownedPhpAddedPaths
	, ownedPhpHistoricalBytes, reverseOwnedPhpUpdate } from "./helpers/owned-php-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const source = async (path, expected) => ownedWasm32HistoricalBytes(path, await readFile(path), expected);

test("owned PHP preserves complete predecessor identities and rejects unrecorded changes", async () => {
	const record = await json(ownedPhpHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-php-package-integration");
	assert.equal(record.baselineRevision, ownedPhpBaseline);
	assert.deepEqual(record.previous, ownedPhpPrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.equal(previous.previous.sha256, "a05b1678b37823a6fa9ab2956055969a26948cc2643706e08b2b7191d6d05f17");
	const perlBytes = await readFile(previous.previous.path), perl = JSON.parse(perlBytes);
	assert.equal(sha256(perlBytes), previous.previous.sha256);
	const baseline = { ...perl.sources, ...previous.sources };
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(baseline), ...ownedPhpChangedPaths, ...ownedPhpAddedPaths
	])].sort());
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(await source(path, hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, baseline[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = (await source(update.path, update.currentSha256)).toString();
		const prior = beforeOwnedPhpPackages(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedPhpPackages(update.path, prior), prior);
		assert.equal(beforeOwnedPhpPackages(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded PHP edit */\n";
		assert.equal(beforeOwnedPhpPackages(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpUpdate(unknown, update));
		assert.throws(() => reverseOwnedPhpUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedPhpUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseOwnedPhpUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedPhpHistoricalBytes("unknown.bin", binary), binary);
	const current = (await source("docs/type-surface.v1.json", record.sources["docs/type-surface.v1.json"])).toString();
	const prior = JSON.parse(beforeOwnedPhpPackages("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files)
		file.sha256 = sha256(await source(file.path, record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
});

test("owned PHP evidence binds CLI releases, source-free execution, cleanup and documentation", async () => {
	await assertOwnedPhpExecution(await json(ownedPhpHistoryPath));
});

test("owned PHP evidence rejects widened scope and forged execution reports", async () => {
	const original = await json(ownedPhpHistoryPath);
	for(const mutate of [
		record => { record.scope.wasm = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.runs.core.command += " --import forged.mjs"; }
		, record => { record.runs.packages.text += "\nchanged\n"; }
		, record => { record.packages.ordinary.cliAdmission = false; }
		, record => { record.packages.reviewed.sourceFreeInstallation = false; }
		, record => { record.packages.ordinary.observations[0].observed.checks--; }
		, record => { record.packages.ordinary.observations.pop(); }
		, record => { record.packages.reviewed.observations[0].observed.primitives--; }
		, record => { record.packages.ordinary.loader.liveIdentities = 1; }
		, record => { record.packages.reviewed.loader.privateGmp = false; }
		, record => { record.packages.ordinary.adapterReceipt.phpValues.callbackLifetime = "retained"; }
		, record => { record.packages.ordinary.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.ordinary.installation.offline = false; }
		, record => { record.packages.ordinary.packageSetReceipt.packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, record => { record.packages.ordinary.loaderRejected.pop(); }
		, record => { record.calls.reviewed.observation.nativeFailures--; }
		, record => { record.runtime.ordinary.observations.pop(); }
		, record => { record.conversions["composition-reviewed"].observation.live = 1; }
		, record => { record.values.observations[0].observation.compiledLean = true; }
		, record => { record.documentation.sourceHashes.example = "0".repeat(64); }
		, record => { record.documentation.observed.stdout = "wrong\n"; }
		, record => { record.coexistence.reproduced.independentNativeCompilation = false; }
		, record => { record.coexistence.cliIntegrated = false; }
		, record => { record.coexistence.observations[0].observed.liveIdentities = 1; }
		, record => { record.coexistence.observations[0].observed.foreignRejections--; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedPhpExecution(changed), mutate.toString());
	}
});
