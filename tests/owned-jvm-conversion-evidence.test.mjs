/**
 * Reject unsupported host claims, changed generated code and missing cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJvmConversions, ownedJvmConversionReceipt } from "./helpers/owned-jvm-conversion-evidence.mjs";

test("JVM conversion evidence binds all four real Lean runs and original lifetimes", async () => {
	await assertOwnedJvmConversions(JSON.parse(await readFile(ownedJvmConversionReceipt, "utf8")));
});

test("JVM conversion evidence rejects missing cases, changed code and broader support claims", async () => {
	const original = JSON.parse(await readFile(ownedJvmConversionReceipt, "utf8"));
	for(const change of [
		record => { record.scope.installedMaven = true; }
		, record => { record.scope.kotlinValues = true; }
		, record => { record.scope.hostUpcalls = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.scope.scalarKinds = 18; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { delete record.sources["src/backends/jvm/owned-scalars.mjs"]; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.run.text += "not ok 6 - missing\n"; }
		, record => { delete record.reports.reviewed; }
		, record => { record.reports.reviewed = record.reports.ordinary; }
		, record => { record.reports.ordinary.cSourceSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.guardSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.probeSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.instrumentedRuntimeSha256 = "0".repeat(64); }
		, record => { delete record.reports.ordinary.files[Object.keys(record.reports.ordinary.files)[0]]; }
		, record => { record.reports.ordinary.live = 1; }
		, record => { record.reports.reviewed.identities = 1; }
		, record => { record.reports["scalars-reviewed"].checks--; }
		, record => { record.reports["scalars-ordinary"].managedFailures = 0; }
		, record => { record.reports.reviewed.nativeFailures = 0; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedJvmConversions(changed), change.toString());
	}
});
