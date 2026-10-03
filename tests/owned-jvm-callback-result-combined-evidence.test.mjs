/**
 * Reject substituted peers or omitted reruns in the shared callback release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJvmCallbackCombinedRelease } from "./helpers/owned-jvm-callback-result-combined-evidence.mjs";

const zero = "0".repeat(64);
for(const mode of ["ordinary", "reviewed"])
test(`eight-target callback release reconstructs ${mode} inputs and execution`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const original = JSON.parse(await readFile(`build/owned-jvm-callback-results/${mode}-combined-release.json`, "utf8"));
	assert.equal(original.mode, mode);
	await assertOwnedJvmCallbackCombinedRelease(original);
	const changes = [
		item => { item.installedJvm.manifest.runtimeIdentity = zero; }
		, item => { item.installedJvm.observations[0].checks--; }
		, item => { item.installedJvm.observations[1].jvm.runtimeExecutions.pop(); }
		, item => { item.installedJvm.observations[0].jvm.documentation.pop(); }
		, item => { item.installedJvm.observations[1].jvm.documentation[2].sourceSha256 = zero; }
		, item => { item.installedJvm.observations[0].jvm.inspection.scenarios.pop(); }
		, item => { item.installedJvm.observations[1].observation.results.pop(); }
		, item => { item.installedDotnet.manifest.runtimeIdentity = zero; }
		, item => { item.installedDotnet.relocatedChecks--; }
		, item => { item.installedDotnet.installedProcess.observations.pop(); }
		, item => { item.rubyAdapter.rubyValues.callbackResultAnchors.anchor = "captured-owner"; }
		, item => { item.installedRuby.loader.liveIdentities++; }
		, item => { item.installedPython[0].manifest.ownedValues.callbackResultAnchors.anchor = "captured-owner"; }
		, item => { item.installedRust.relocatedChecks--; }
		, item => { item.installedCpp.checks--; }
		, item => { item.cProbeSha256 = zero; }
		, item => { item.browser.executions.pop(); }
		, item => { item.receipt.packages.pop(); }
		, item => { item.producerAndCliRemovedBeforeInstall = false; }
		, item => { item.independentProducerBuild = false; }
		, item => { item.independentBuild.result.packages.pop(); }
		, item => { item.independentPackageSetReceipt.packages[0].artifacts[0].sha256 = zero; }
		, item => { item.built.result.profiles[0].evidence.sha256 = zero; }
		, item => { item.compilerInputsIdentity = zero; }
	];
	for(const [index, change] of changes.entries())
	{
		const changed = structuredClone(original); change(changed);
		await assert.rejects(assertOwnedJvmCallbackCombinedRelease(changed), `shared-release forgery ${index}`);
	}
	t.diagnostic(`${changes.length} false shared-release claims rejected`);
});
