/**
 * Keep WIT build regressions fixed without replacing installed acceptance evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpNixImportClosure } from "./helpers/php-nix-boundary-repair-evidence.mjs";
import { assertOwnedWitBuildRepairExecution, ownedWitBuildRepairManifest, ownedWitBuildRepairModules } from "./helpers/wit-owned-build-repair-evidence.mjs";
import { beforeOwnedWitBuildRepair, ownedWitBuildRepairAddedPaths, ownedWitBuildRepairBaseline
	, ownedWitBuildRepairChangedPaths, ownedWitBuildRepairHistoricalBytes, ownedWitBuildRepairPath
	, ownedWitBuildRepairPrevious, reverseOwnedWitBuildRepairUpdate } from "./helpers/wit-owned-build-repair-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitBuildRepairPath, "utf8"));

test("owned WIT build repair authenticates sources without changing earlier installed receipts", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-build-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitBuildRepairBaseline);
	assert.deepEqual(record.previous, ownedWitBuildRepairPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedWitBuildRepairAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitBuildRepairChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedWitBuildRepair(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedWitBuildRepair(update.path, prior), prior);
		assert.equal(beforeOwnedWitBuildRepair(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedWitBuildRepair("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "Regression repair does not promote installed support");
});

test("owned WIT build repair history rejects unknown text, forged ancestors and overlapping spans", async () => {
	for(const update of (await read()).updates)
	{
		const current = await readFile(update.path, "utf8"), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeOwnedWitBuildRepair(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitBuildRepairUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitBuildRepairUpdate(current, changed));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedWitBuildRepairHistoricalBytes("unknown.bin", binary), binary);
});

test("owned WIT build repair binds eight reproduced failures and both passing runs", async () => {
	await assertOwnedWitBuildRepairExecution(await read());
});

test("owned WIT build repair rejects substituted observations and unsupported acceptance claims", async () => {
	const original = await read();
	for(const mutate of [
		...["nixBuild", "installedPackage", "transferredInputs", "anchoredBorrowedResults"].map(key => record => { record.scope[key] = true; })
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.addedFiles.pop(); }
		, record => { record.runs.before.exitCode = 0; }
		, record => { record.runs.after.command += " --import forged.mjs"; }
		, record => { record.runs.after.text += "unrecorded"; }
		, record => { record.runs.after.text = record.runs.after.text.replace("# pass 8", "# pass 7"); record.runs.after.sha256 = sha256(record.runs.after.text); }
		, record => { record.runs.contracts.text = record.runs.contracts.text.replace("# skipped 1", "# skipped 0"); record.runs.contracts.sha256 = sha256(record.runs.contracts.text); }
		, record => { record.boundary.includedFiles.pop(); }
		, record => { record.sources[ownedWitBuildRepairModules[0]] = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedWitBuildRepairExecution(changed), mutate.toString());
	}
});

test("filtered Perl builder requires every added owned WIT dependency", async () => {
	const boundary = JSON.parse(await readFile(ownedWitBuildRepairManifest, "utf8"));
	await assertPhpNixImportClosure(boundary);
	for(const missing of ownedWitBuildRepairModules)
		await assert.rejects(() => assertPhpNixImportClosure({ ...boundary, includedFiles: boundary.includedFiles.filter(path => path !== missing) }), missing);
});
