/**
 * Reject incomplete or rehashed C++ callback-result acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { unpackOwnedCallbackReports } from "./helpers/owned-callback-result-evidence.mjs";
import { ownedCppCallbackEvidencePath, assertOwnedCppCallbackAcceptance
	, assertOwnedCppCallbackReport } from "./helpers/owned-cpp-callback-result-evidence.mjs";

const read = async () => JSON.parse(await readFile(ownedCppCallbackEvidencePath, "utf8"));

test("C++ callback acceptance reconstructs every runtime and original installed report", async () => {
	await assertOwnedCppCallbackAcceptance(await read());
	assert.equal(classifyRepositoryTest("tests/owned-cpp-callback-result-evidence.test.mjs"), "contract");
});

test("C++ callback acceptance rejects incomplete execution or expanded support claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.retainedHostCallbacks = true; }
		, value => { value.scope.installedSupportPromotions++; }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { delete value.sources["tests/owned-cpp-callback-result-packaging.test.mjs"]; }
		, value => { value.sources["src/backends/cpp/owned-callables.mjs"] = "0".repeat(64); }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace("# pass 12", "# pass 11"); value.run.sha256 = sha256(value.run.text); }
		, value => { delete value.archive.reports["build/owned-cpp-callback-results/reviewed-combined-release.json"]; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedCppCallbackAcceptance(changed), undefined, mutate.toString());
	}
});

test("C++ callback evidence rejects rehashed reports with weakened ownership or installation checks", async () => {
	const reports = unpackOwnedCallbackReports((await read()).archive);
	for(const [name, mutate] of [
		["ordinary-base-nohost", value => { value.result.identities++; }]
		, ["ordinary-base-nohost", value => { value.contract.callbackResultAnchors.signatures[0].parameter++; }]
		, ["reviewed-base-host", value => { value.result.cppFaults--; }]
		, ["reviewed-combined", value => { value.result.transfers.nativeAfter--; }]
		, ["ordinary-combined", value => { value.restored.live++; }]
		, ["ordinary-combined", value => { value.mutations.pop(); }]
		, ["reviewed-combined", value => { value.mutations[0].compiled = false; }]
		, ["reviewed-combined", value => { value.mutations[1].sourceSha256 = "0".repeat(64); }]
		, ["ordinary-no-host-package", value => { value.installed.checks--; }]
		, ["ordinary-no-host-package", value => { value.independentRebuild = false; }]
		, ["reviewed-no-host-package", value => { value.producerInterface = "installed-cli"; }]
		, ["reviewed-no-host-package", value => { value.manifest.ownedValues.callbackResultAnchors.signatures.pop(); }]
		, ["ordinary-combined-package", value => { value.cli.files[0].sha256 = "0".repeat(64); }]
		, ["ordinary-combined-package", value => { value.tamperedSources.generated.pop(); }]
		, ["reviewed-combined-package", value => { value.rejected--; }]
		, ["reviewed-combined-package", value => { value.documentation.stdout = ""; }]
		, ["ordinary-combined-release", value => { value.installedCpp.checks--; }]
		, ["ordinary-combined-release", value => { value.cppCmake = false; }]
		, ["ordinary-combined-release", value => { value.cppManifest.files["include/owned_aggregates.hpp"].sha256 = "0".repeat(64); }]
		, ["reviewed-combined-release", value => { value.producerAndCliRemovedBeforeInstall = false; }]
		, ["reviewed-combined-release", value => { value.cppDocumentation.output = ""; }]
		, ["reviewed-combined-release", value => { value.wasm.model.ownedGraph.inputTransfers.exports.pop(); }]
		, ["ordinary-combined-release", value => { value.browser.executions.pop(); }]
		, ["reviewed-combined-release", value => { value.browser.executions[0].assets.pop(); }]
		, ["reviewed-combined-release", value => { value.installedTypeScript = false; }]
	]) {
		const path = `build/owned-cpp-callback-results/${name}.json`;
		const item = structuredClone(reports[path]); mutate(item);
		await assert.rejects(() => assertOwnedCppCallbackReport(path, item), undefined, name + ": " + mutate.toString());
	}
});
