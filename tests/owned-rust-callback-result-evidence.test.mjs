/**
 * Reject incomplete, source-substituted or weakened Rust callback acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { unpackOwnedCallbackReports } from "./helpers/owned-callback-result-evidence.mjs";
import { ownedRustCallbackEvidencePath, assertOwnedRustCallbackAcceptance
	, assertOwnedRustCallbackReport } from "./helpers/owned-rust-callback-result-acceptance.mjs";

const read = async () => JSON.parse(await readFile(ownedRustCallbackEvidencePath, "utf8"));

test("Rust callback acceptance reconstructs all runtime and original installed reports", async () => {
	await assertOwnedRustCallbackAcceptance(await read());
	assert.equal(classifyRepositoryTest("tests/owned-rust-callback-result-evidence.test.mjs"), "contract");
});

test("Rust callback acceptance rejects partial execution, substituted sources and inflated claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.retainedHostCallbacks = true; }
		, value => { value.scope.installedSupportPromotions++; }
		, value => { value.previous.sha256 = "0".repeat(64); }
		, value => { delete value.sources["tests/owned-rust-callback-result-packaging.test.mjs"]; }
		, value => { value.sources["src/backends/rust/owned-callables.mjs"] = "0".repeat(64); }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace("# pass 13", "# pass 12"); value.run.sha256 = sha256(value.run.text); }
		, value => { delete value.archive.reports["build/owned-rust-callback-results/reviewed-combined-release.json"]; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedRustCallbackAcceptance(changed), undefined, mutate.toString());
	}
});

test("Rust callback reports reject forged lifetime, fault, package and browser outcomes", async () => {
	const reports = unpackOwnedCallbackReports((await read()).archive);
	for(const [name, mutate] of [
		["ordinary-no-host", value => { value.result.identities++; }]
		, ["ordinary-no-host", value => { value.contract.callbackResultAnchors.signatures[0].parameter++; }]
		, ["reviewed-host", value => { value.result.rustFaults--; }]
		, ["reviewed-combined", value => { value.result.after--; }]
		, ["ordinary-combined", value => { value.restored.live++; }]
		, ["ordinary-combined", value => { value.mutations.pop(); }]
		, ["reviewed-combined", value => { value.mutations[0].compiled = false; }]
		, ["reviewed-combined", value => { value.mutations[1].sourceSha256 = "0".repeat(64); }]
		, ["ordinary-no-host", value => { value.sanitizerProbes.pop(); }]
		, ["ordinary-host", value => { value.sanitizerProbes[0].rejected = false; }]
		, ["reviewed-host", value => { value.nativeSanitizers.pop(); }]
		, ["ordinary-no-host-package", value => { value.checks--; }]
		, ["ordinary-no-host-package", value => { value.independentRebuild = false; }]
		, ["reviewed-no-host-package", value => { value.emptyCargoHome = false; }]
		, ["reviewed-no-host-package", value => { value.manifest.ownedValues.callbackResultAnchors.signatures.pop(); }]
		, ["ordinary-combined-package", value => { value.cli.files[0].sha256 = "0".repeat(64); }]
		, ["ordinary-combined-package", value => { value.compiled.evidence.libraries["libowned_aggregates.so"] = "0".repeat(64); }]
		, ["reviewed-combined-package", value => { value.rejected--; }]
		, ["reviewed-combined-package", value => { value.documentation.stdout = ""; }]
		, ["reviewed-combined-package", value => { value.incapableReadersRejected--; }]
		, ["ordinary-combined-package", value => { value.dependencies.packages.pop(); }]
		, ["ordinary-combined-release", value => { value.installedRust.checks--; }]
		, ["ordinary-combined-release", value => { value.installedRust.handoffRemovedBeforeExecution = false; }]
		, ["ordinary-combined-release", value => { value.rustManifest.files["src/assets.rs"].sha256 = "0".repeat(64); }]
		, ["reviewed-combined-release", value => { value.rustDocumentation.output = ""; }]
		, ["reviewed-combined-release", value => { value.installedRust.dependencies.lockSha256 = "0".repeat(64); }]
		, ["ordinary-combined-release", value => { value.installedCpp.checks--; }]
		, ["ordinary-combined-release", value => { value.cppCmake = false; }]
		, ["reviewed-combined-release", value => { value.producerAndCliRemovedBeforeInstall = false; }]
		, ["reviewed-combined-release", value => { value.wasm.model.ownedGraph.inputTransfers.exports.pop(); }]
		, ["ordinary-combined-release", value => { value.browser.executions.pop(); }]
		, ["reviewed-combined-release", value => { value.browser.executions[0].assets.pop(); }]
		, ["reviewed-combined-release", value => { value.installedTypeScript = false; }]
	]) {
		const path = `build/owned-rust-callback-results/${name}.json`;
		const item = structuredClone(reports[path]); mutate(item);
		await assert.rejects(() => assertOwnedRustCallbackReport(path, item), undefined, name + ": " + mutate.toString());
	}
});
