/**
 * Reject substituted peers or omitted process checks in the shared release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedDotnetCallbackCombinedRelease } from "./helpers/owned-dotnet-callback-result-combined-evidence.mjs";

for(const mode of ["ordinary", "reviewed"])
test(`seven-target callback release reconstructs ${mode} inputs and execution`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const original = JSON.parse(await readFile(`build/owned-dotnet-callback-results/${mode}-combined-release.json`, "utf8"));
	await assertOwnedDotnetCallbackCombinedRelease(original);
	const changes = [
		item => { item.installedDotnet.manifest.runtimeIdentity = "0".repeat(64); }
		, item => { item.installedDotnet.relocatedChecks--; }
		, item => { item.installedDotnet.installedProcess.observations.pop(); }
		, item => { item.installedDotnet.relocatedProcess[0].identities++; }
		, item => { item.rubyAdapter.rubyValues.callbackResultAnchors.anchor = "captured-owner"; }
		, item => { item.installedRuby.loader.liveIdentities++; }
		, item => { item.installedPython[0].manifest.ownedValues.callbackResultAnchors.anchor = "captured-owner"; }
		, item => { item.installedRust.relocatedChecks--; }
		, item => { item.installedCpp.checks--; }
		, item => { item.cProbeSha256 = "0".repeat(64); }
		, item => { item.browser.executions.pop(); }
		, item => { item.receipt.packages.pop(); }
		, item => { item.producerAndCliRemovedBeforeInstall = false; }
	];
	for(const change of changes)
	{
		const changed = structuredClone(original); change(changed);
		await assert.rejects(assertOwnedDotnetCallbackCombinedRelease(changed));
	}
	t.diagnostic(`${changes.length} false shared-release claims rejected`);
});
