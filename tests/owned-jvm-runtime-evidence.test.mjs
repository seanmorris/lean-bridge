/**
 * Reject unsupported JVM ownership claims and altered cleanup observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJvmRuntime, ownedJvmRuntimeReceipt } from "./helpers/owned-jvm-runtime-evidence.mjs";

test("JVM runtime evidence binds exact native and Java sources to both Lean paths", async () => {
	await assertOwnedJvmRuntime(JSON.parse(await readFile(ownedJvmRuntimeReceipt, "utf8")));
});

test("JVM runtime evidence rejects invented package support and missing lifetime checks", async () => {
	const original = JSON.parse(await readFile(ownedJvmRuntimeReceipt, "utf8"));
	for(const change of [
		record => { record.scope.installedMaven = true; }
		, record => { record.scope.virtualThreads = true; }
		, record => { record.scope.generalJvmForkSupport = true; }
		, record => { record.scope.publicJavaKotlinValues = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { delete record.sources["src/backends/jvm/owned-runtime.mjs"]; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.text += "not ok 4 - forged\n"; }
		, record => { record.reports.reviewed = record.reports.ordinary; }
		, record => { record.reports.ordinary.nativeSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.guardSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.runtimeSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.instrumentedSha256 = "0".repeat(64); }
		, record => { record.reports.ordinary.observations[0].live = 1; }
		, record => { record.reports.reviewed.observations[0].exits = 0; }
		, record => { record.reports.reviewed.observations.pop(); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedJvmRuntime(changed), change.toString());
	}
});
