/**
 * Reject forged ownership, installation and source-history claims for Rust.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedRustExecution, assertOwnedRustIntegration } from "./helpers/owned-rust-evidence.mjs";
import { beforeOwnedRust, reverseOwnedRustUpdate, ownedRustHistoryPath, ownedRustExecutionPath } from "./helpers/owned-rust-source-history.mjs";
import { beforeOwnedPython } from "./helpers/owned-python-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Rust ownership evidence requires compiled probes, installed crates and immutable predecessors", async () => {
	await assertOwnedRustIntegration(await json(ownedRustHistoryPath));
});

test("Rust ownership evidence rejects altered lifetimes, execution and package claims", async () => {
	const original = await json(ownedRustExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("pypi"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.runs.core.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.packages.text += "changed"; }
		, record => { delete record.sources["src/backends/rust/owned-runtime.mjs"]; }
		, record => { record.runtime.ordinary.result.identities++; }
		, record => { record.values.reviewed.result.rustFaults--; }
		, record => { record.values.ordinary.result.nativeFaults--; }
		, record => { record.packages.ordinary.checks--; }
		, record => { record.packages.reviewed.companions.cpp--; }
		, record => { record.packages.reviewed.sourceFreeInstallation = false; }
		, record => { record.packages.ordinary.loaderRejected.pop(); }
		, record => { record.packages.reviewed.documentationSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.adapterReceipt.rustValues.callbackLifetime = "retained"; }
		, record => { record.packages.ordinary.manifest.files["src/lib.rs"].sha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.manifest.ownedValues.loader = "manual"; }
		, record => { record.packages.ordinary.dependencies.lockSha256 = "0".repeat(64); }
		, record => { record.packages.ordinary.dependencies.packages[0].checksum = "0".repeat(64); }
		, record => { record.packages.reviewed.packageSetReceipt.packages[0].target = "pypi"; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedRustExecution(changed), change.toString());
	}
});

test("Rust source history preserves exact predecessors and rejects unrecorded edits", async () => {
	for(const update of (await json(ownedRustHistoryPath)).updates)
	{
		const source = beforeOwnedPython(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseOwnedRustUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedRust(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedRust(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedRust(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRustUpdate(unknown, update));
		assert.throws(() => reverseOwnedRustUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedRustUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
