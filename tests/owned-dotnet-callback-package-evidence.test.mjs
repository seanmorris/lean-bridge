/**
 * Reject coordinated callback and managed-source forgeries in original receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertOwnedDotnetCallbackPackageInputs } from "./helpers/owned-dotnet-callback-result-package-evidence.mjs";
import { assertOwnedDotnetCallbackPackageExecution } from "./helpers/owned-dotnet-callback-result-package-execution.mjs";

test("C# callback package reports reconstruct all native and managed contracts", {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	let reports = 0, rejected = 0;
	for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "combined"])
	{
		const name = `${mode}-${variant}-package.json`;
		const original = JSON.parse(await readFile(`build/owned-dotnet-callback-results/${name}`, "utf8"));
		await assertOwnedDotnetCallbackPackageInputs(original); reports++;
		for(const change of [
			item => { item.adapterReceipt.dotnetValues.callbackResultAnchors.anchor = "closure-owner"; }
			, item => { item.compiledProjection.ownedValues.callbackResultAnchors.signatures.pop(); }
			, item => { item.manifest.ownedValues.callbackResultAnchors.signatures[1].parameter = 0; }
			, item => { item.componentReceipt.callbackResultAnchors.maximumDepth++; }
			, item => { item.adapterReceipt.schemaVersion--; }
			, item => { item.compiledProjection.schemaVersion--; }
			, item => { item.manifest.schemaVersion--; }
			, item => { item.manifest.runtimeIdentity = "0".repeat(64); }
			, item => { item.compiledProjection.evidence.libraries["libleanshared.so"] = "0".repeat(64); }
			, item => { item.compiledProjection.evidence.ownedValues.callbackResultAnchors.anchor = "closure-owner"; }
			, item => { item.compiledProjection.files["src/LeanBridge.OwnedAggregates/Api.cs"].sha256 = "0".repeat(64); item.manifest.compiledProjectionSha256 = sha256(canonicalJson(item.compiledProjection)); }
			, item => { delete item.manifest.files["lean-bridge/component/model.json"]; }
			, item => { item.manifest.files["lean-bridge/native-dotnet-adapter.json"].bytes--; }
			, item => { item.input.sourceIdentity.exportConfigurationSha256 = "0".repeat(64); }
			, item => { item.input.sourceIdentity.modules[0].source.sha256 = "0".repeat(64); }
			, item => {
				for(const contract of [item.adapterReceipt.dotnetValues, item.compiledProjection.ownedValues, item.manifest.ownedValues])
					contract.callbackResultAnchors.anchor = "closure-owner";
			}
		]) {
			const changed = structuredClone(original); change(changed);
			await assert.rejects(assertOwnedDotnetCallbackPackageInputs(changed)); rejected++;
		}
	}
	assert.equal(reports, 4); assert.equal(rejected, 64);
	t.diagnostic(JSON.stringify({ reports, rejected }));
});

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "combined"])
test(`installed C# callback execution reconstructs ${mode} ${variant}`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const original = JSON.parse(await readFile(`build/owned-dotnet-callback-results/${mode}-${variant}-package.json`, "utf8"));
	await assertOwnedDotnetCallbackPackageExecution(original);
	const mutations = [
		item => { item.observation.checks++; item.relocatedObservation.checks++; }
		, item => { item.sdkFreeExecution = false; }
		, item => { item.consumerSourceRemoved = false; }
		, item => { item.consumerSha256 = "0".repeat(64); }
		, item => { item.invalidConsumers.pop(); }
		, item => { item.invalidConsumers[0].diagnostic = "unrelated diagnostic"; }
		, item => { item.documentation.observed[0].stdout = "42\n"; }
		, item => { item.relocatedDocumentation[0].sourceSha256 = "0".repeat(64); }
		, item => { item.installedProcess.observations[0].forkChecks--; }
		, item => { item.installedProcess.observations[1].rejected--; }
		, item => { item.installedProcess.observations[0].identities = 1; }
		, item => { item.installedProcess.sourceSha256 = "0".repeat(64); }
		, item => { item.installedProcess.projectSha256 = "0".repeat(64); }
		, item => { item.installedProcess.forkProbeSha256 = "0".repeat(64); }
		, item => { item.relocatedProcess.pop(); }
		, item => { item.tamperRejected.pop(); }
		, item => { item.incapableReadersRejected.pop(); }
		, item => { item.loaderRejected.pop(); }
		, item => { item.cli.externalRegistryWrites = true; }
		, item => { item.cliInstallation.filesVerified--; }
		, item => { item.cliBuilds.pop(); }
		, item => { item.packageSetReceipt.packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, item => { item.cliVerification.result.receiptSha256 = "0".repeat(64); }
	];
	for(const change of mutations)
	{
		const changed = structuredClone(original); change(changed);
		await assert.rejects(assertOwnedDotnetCallbackPackageExecution(changed));
	}
	t.diagnostic(`${mutations.length} false execution claims rejected`);
});
