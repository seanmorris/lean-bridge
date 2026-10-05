/**
 * The frozen .NET milestone must include every source, execution and package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedDotnetCallbackAcceptance, assertOwnedDotnetCallbackReport
	, ownedDotnetCallbackEvidencePath } from "./owned-dotnet-callback-result-acceptance.mjs";

const read = async () => JSON.parse(await readFile(ownedDotnetCallbackEvidencePath, "utf8"));

test(".NET acceptance reconstructs all 26 original reports and executed probes", async () => {
	await assertOwnedDotnetCallbackAcceptance(await read());
	assert.equal(classifyRepositoryTest("tests/owned-dotnet-callback-result-acceptance.test.mjs"), "contract");
});

test(".NET acceptance rejects incomplete runs, substituted sources and inflated scope", async () => {
	const original = await read();
	const mutations = [
		item => { item.acceptance = "pending"; }
		, item => { item.scope.retainedHostCallbacks = true; }
		, item => { item.scope.leanRuntimeInstrumented = true; }
		, item => { item.scope.installedSupportPromotions++; }
		, item => { item.previous.sha256 = "0".repeat(64); }
		, item => { item.sourceHistory.sha256 = "0".repeat(64); }
		, item => { delete item.sources["src/backends/dotnet/owned-callback-arguments.mjs"]; }
		, item => { item.sources["tests/helpers/owned-dotnet-callback-result-installed-process.mjs"] = "0".repeat(64); }
		, item => { item.runs.pop(); }
		, item => { item.runs[0].exitCode = 1; }
		, item => { item.runs[0].text += "unrecorded"; }
		, item => { item.runs[0].text = item.runs[0].text.replace("# pass 7", "# pass 6"); item.runs[0].sha256 = sha256(item.runs[0].text); }
		, item => { item.runs[0].text = item.runs[0].text.replace("# skipped 0", "# skipped 1"); item.runs[0].sha256 = sha256(item.runs[0].text); }
		, item => { item.verification.exitCode = 1; }
		, item => { item.verification.text = item.verification.text.replace("# pass 8", "# pass 7"); item.verification.sha256 = sha256(item.verification.text); }
		, item => { delete item.archive.reports["build/owned-dotnet-callback-results/reviewed-combined-release.json"]; }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedDotnetCallbackAcceptance(changed), undefined, mutate.toString());
	}
});

test(".NET acceptance keeps runtime, installed and combined ownership claims distinct", async () => {
	const reports = unpackOwnedCallbackReports((await read()).archive);
	for(const mode of ["ordinary", "reviewed"])
	for(const [name, mutate] of [
		[`${mode}-no-host.json`, item => { item.installedPackage = true; }]
		, [`${mode}-combined-lifetime.json`, item => { item.observed.identities++; }]
		, [`${mode}-combined-sanitizers.json`, item => { item.sanitized.leakSanitizer = true; }]
		, [`${mode}-no-host-process.json`, item => { item.observations[0].forkChecks = 0; }]
		, [`${mode}-combined-package.json`, item => { item.installedProcess.observations[0].installedPublicApi = false; }]
		, [`${mode}-no-host-package.json`, item => { item.relocatedProcess.pop(); }]
		, [`${mode}-combined-release.json`, item => { item.installedDotnet.relocatedChecks--; }]
	]) {
		const path = "build/owned-dotnet-callback-results/" + name;
		const changed = structuredClone(reports[path]); mutate(changed);
		await assert.rejects(() => assertOwnedDotnetCallbackReport(path, changed), undefined, name);
	}
});
