/**
 * Reject changed inputs, bindings, probes, ownership counts and detector claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedDotnetCallbackRuntime } from "./helpers/owned-dotnet-callback-result-evidence.mjs";

test("C# callback runtime reports reconstruct their inputs and reject forged observations", {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	let reports = 0, rejected = 0;
	for(const mode of ["ordinary", "reviewed"]) for(const kind of ["", "-lifetime", "-sanitizers", "-process"])
	for(const variant of kind === "" || kind === "-lifetime" ? ["no-host", "host", "combined"] : ["no-host", "combined"])
	{
		const name = `${mode}-${variant}${kind}.json`;
		const original = JSON.parse(await readFile(`build/owned-dotnet-callback-results/${name}`, "utf8"));
		await assertOwnedDotnetCallbackRuntime(name, original); reports++;
		const changes = [
			item => { item.actualLean = false; }
			, item => { item.installedPackage = true; }
			, item => { item.mode = mode === "ordinary" ? "reviewed" : "ordinary"; }
			, item => { item.combined = !item.combined; }
			, item => { item.generated["Calls.cs"] = "0".repeat(64); }
			, item => { delete item.generated["Values.cs"]; }
			, item => { item.probeSha256 = "0".repeat(64); }
			, item => { item.nativeProbeSha256 = "0".repeat(64); }
			, item => { item.input.sourceIdentity.modules[0].source.sha256 = "0".repeat(64); }
			, item => { item.input.sourceIdentity.exportConfigurationSha256 = "0".repeat(64); }
			, ...kind === "-process" ? [
				item => { item.observations[0].forkChecks = 0; }
				, item => { item.observations[1].live = 1; }
				, item => { item.observations.pop(); }
				, item => { item.forkProbeSha256 = "0".repeat(64); }
			] : [
				item => { item.observed.checks--; }, item => { item.observed.live++; }
				, item => { item.observed.identities++; }
				, item => { item.observed.nativeFaults = 0; }
			]
			, ...kind === "-sanitizers" ? [
				item => { item.sanitized.rejected.pop(); }
				, item => { item.leanRuntimeInstrumented = true; }
				, item => { item.sanitized.leakSanitizer = true; }
				, item => { item.sanitized.environment.ASAN_OPTIONS = "detect_leaks=0"; }
			] : kind === "-process" ? [] : [
				item => { item.rejectedMutations.pop(); }
				, item => { item.rejectedMutations[0].sourceSha256 = "0".repeat(64); }
				, item => { item.restored = false; }
			]
		];
		for(const change of changes)
		{
			const changed = structuredClone(original); change(changed);
			await assert.rejects(assertOwnedDotnetCallbackRuntime(name, changed)); rejected++;
		}
	}
	assert.equal(reports, 20); t.diagnostic(JSON.stringify({ reports, rejected }));
});
