/**
 * Authenticate installed owned C packages without overstating host coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPackageExecution, assertOwnedPackageIntegration } from "./helpers/owned-package-evidence.mjs";
import { beforeOwnedPackage, reverseOwnedPackageUpdate, ownedPackageHistoryPath, ownedPackageExecutionPath } from "./helpers/owned-package-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned C packages retain ordinary and reviewed source-free execution", async () => {
	await assertOwnedPackageIntegration(await json(ownedPackageHistoryPath));
});

test("owned C package evidence rejects altered execution and broader support claims", async () => {
	const original = await json(ownedPackageExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("cpp"); }
		, record => { record.scope.hostCallbackConstruction = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.run.text += "changed"; }
		, record => { record.regressions.exitCode = 1; }
		, record => { delete record.sources["src/build/owned-native-model.mjs"]; }
		, record => { record.reports.ordinary.checks.pkgConfig--; }
		, record => { record.reports.reviewed.sourceFreeInstallation = false; }
		, record => { record.reports.reviewed.deterministicReassembly = false; }
		, record => { record.reports.reviewed.forgedHeaderRejected = false; }
		, record => { record.reports.reviewed.adapterReceipt.ownedValues.headerSha256 = "0".repeat(64); }
		, record => { record.reports.reviewed.componentReceipt.modelSha256 = "0".repeat(64); }
		, record => { record.reports.reviewed.manifest.ownedValues.schemaVersion = 2; }
		, record => { record.reports.reviewed.packageSetReceipt.packages[0].target = "cpp"; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedPackageExecution(changed), change.toString());
	}
});

test("owned package source history rejects unknown text and overlapping edits", async () => {
	for(const update of (await json(ownedPackageHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseOwnedPackageUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedPackage(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedPackage(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedPackage(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPackageUpdate(unknown, update));
		assert.throws(() => reverseOwnedPackageUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedPackageUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
