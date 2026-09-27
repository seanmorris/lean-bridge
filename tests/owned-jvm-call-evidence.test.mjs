/**
 * Reject changed callback sources, lost owners and unsupported package claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJvmCalls, ownedJvmCallReceipt } from "./helpers/owned-jvm-call-evidence.mjs";

test("JVM call evidence binds all six compiled Lean runs and converter history", async () => {
	await assertOwnedJvmCalls(JSON.parse(await readFile(ownedJvmCallReceipt, "utf8")));
});

test("JVM call evidence rejects lost language cases, cleanup and source bindings", async () => {
	const original = JSON.parse(await readFile(ownedJvmCallReceipt, "utf8"));
	for(const change of [
		record => { record.scope.installedMaven = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { delete record.sources["src/backends/jvm/owned-kotlin.mjs"]; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import substitute.mjs"; }
		, record => { record.run.text += "not ok 8 - missing\n"; }
		, record => { delete record.reports["values-reviewed"]; }
		, record => { record.reports["values-reviewed"] = record.reports["values-ordinary"]; }
		, record => { record.reports["values-ordinary"].cSourceSha256 = "0".repeat(64); }
		, record => { record.reports["values-ordinary"].guardSha256 = "0".repeat(64); }
		, record => { record.reports["values-ordinary"].javaProbeSha256 = "0".repeat(64); }
		, record => { record.reports["values-ordinary"].kotlinProbeSha256 = "0".repeat(64); }
		, record => { record.reports["values-ordinary"].instrumentedRuntimeSha256 = "0".repeat(64); }
		, record => { delete record.reports["values-ordinary"].files[Object.keys(record.reports["values-ordinary"].files)[0]]; }
		, record => { record.reports["values-ordinary"].live = 1; }
		, record => { record.reports["values-reviewed"].identities = 1; }
		, record => { record.reports["scalars-reviewed"].kotlinChecks--; }
		, record => { record.reports["scalars-ordinary"].managedFailures = 0; }
		, record => { record.reports["signatures-reviewed"].nativeFailures = 0; }
		, record => { record.reports["values-ordinary"].threadExits = 0; }
		, record => { record.reports["values-ordinary"].threadExitErrors = 1; }
		, record => { record.reports["values-reviewed"].retirement.pop(); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedJvmCalls(changed), change.toString());
	}
});
