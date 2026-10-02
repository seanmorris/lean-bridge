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
