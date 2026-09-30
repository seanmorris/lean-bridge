/**
 * Require compiled handoffs and source-free installed consuming JavaScript APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedWasmComponent } from "../../src/backends/javascript/owned-wasm-component.mjs";
import { generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { assertComponentOwnedWasmBindings } from "../../src/abi/component-owned-wasm.mjs";
import { ownedJavaScriptWasmNativeProbe } from "./owned-javascript-wasm-native.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";
import { assertOwnedJavaScriptTransferCi } from "./owned-javascript-transfer-ci.mjs";

export const ownedJavaScriptTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-javascript-transfers";
export const ownedJavaScriptTransferScope = Object.freeze({
	profiles: ["javascript", "typescript", "browser", "react", "worker"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedNpm: true
	, strictTypeScript: true, sourceFreeInstallation: true
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, publicExports: 26, consumingExports: 20, pointerBits: 32, privateAbi: 11
	, sharedAliases: true, independentRetains: true, callbackReentry: true
	, multipleInputHandoffs: true, recursiveValues: true
	, nativeAllocationFaults: true, hostAllocationFaults: true
	, deterministicReassembly: true, independentRebuild: false
	, documentationExecuted: true, combinedCRelease: true
	, transferredInputs: true, anchoredBorrowedResults: false
	, docker: false, installedSupportPromotions: 0
});
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Authenticate the execution scope without inflating frozen support claims.
 *
 * @param record - Recorded enabled executions, sources and installed inventories.
 */
export const assertOwnedJavaScriptTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptTransferScope);
	assert.equal(record.run.command, ownedJavaScriptTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 6, pass: 6, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	for(const item of record.runtime)
	{
		assert.equal(item.schemaVersion, 1); assert.equal(item.profile, "owned-javascript-input-transfers");
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const native = generateOwnedNativeValueAdapters({ ...item.input, wordBits: 32, hostCallbacks: true, transferredInputs: true });
		const component = generateOwnedWasmComponent(native);
		assert.deepEqual(item.privateAbi, component.privateAbi);
		assert.equal(item.sourceSha256, sha256(ownedJavaScriptWasmNativeProbe(component))); digest(item.binarySha256);
		assert.equal(assertComponentOwnedWasmBindings(item.privateAbi, native.layout.model.bindingIr), component.metadataHash);
		assert.deepEqual(item.exports, native.layout.functions.map(fn => fn.name).sort());
		assert.equal(item.exports.length, 26); assert.equal(item.privateAbi.inputTransfers.exports.length, 20);
		for(const kind of ["nativeFaults", "hostFaults"]) for(const phase of ["before", "after"])
			assert.ok(Number.isSafeInteger(item[kind][phase]) && item[kind][phase] > 0);
		for(const key of ["liveOwners", "liveAllocations", "liveIdentities"]) assert.equal(item[key], 0, key);
		assert.equal(item.runtimeInitializations, 1);
	}
	const packages = record.packages;
	assert.equal(packages.schemaVersion, 1); assert.equal(packages.profile, "installed-owned-javascript-transfers");
	digest(packages.compilerInputsIdentity);
	assert.deepEqual(packages.reports.map(item => item.reviewed), [false, true]);
	const doc = (await readFile("docs/javascript-typescript.md", "utf8")).split("### Consuming inputs\n")[1].split("### Type conversions\n")[0];
	const example = doc.match(/```js\n([^]*?)\n```/u)[1];
	const runtimes = new Set();
	for(const item of packages.reports)
	{
		flags(item, ["sourceRemovedBeforeInstall", "installedCli", "installedTypeScript", "deterministicReassembly"]);
		assert.equal(item.combinedNative, item.reviewed); assert.equal(item.rejected, 14);
		assert.equal(item.model.schemaVersion, 8); assert.equal(item.model.pointerBits, 32);
		assert.equal(item.receipt.ownedGraph.schemaVersion, 2);
		assert.deepEqual(item.receipt.ownedGraph.inputTransfers, item.model.ownedGraph.inputTransfers);
		assert.equal(item.model.ownedGraph.inputTransfers.exports.length, 20);
		assert.equal(sha256(canonicalJson(item.model)), item.receipt.modelSha256);
		generateOwnedJavaScriptWasmLeanAdapters(item.model);
		assert.equal(Boolean(item.model.sourceIdentity.reviewedBindingIr), item.reviewed);
		assert.equal(item.packages.length, 2);
		const runtime = item.packages.find(entry => entry.role === "runtime"), component = item.packages.find(entry => entry.role === "component");
		assert.equal(runtime.name, "@lean-bridge/runtime"); runtimes.add(runtime.sha256);
		assert.equal(component.name, `@owned/${item.reviewed ? "reviewed" : "ordinary"}-transfers`);
		for(const archive of item.packages)
		{ digest(archive.sha256); assert.ok(archive.bytes > 0); }
		assert.ok(Object.keys(item.inventory).length > 50);
		for(const entry of Object.values(item.inventory))
		{ digest(entry.sha256); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); }
		const prefix = component.name + "/metadata/compiler/";
		assert.equal(item.inventory[prefix + "model.json"].sha256, item.receipt.modelSha256);
		assert.equal(item.inventory[prefix + "metadata.json"].sha256, item.receipt.metadataSha256);
		for(const [path, hash] of Object.entries(item.receipt.ownedGraph.files)) assert.equal(item.inventory[prefix + path].sha256, hash);
		assert.deepEqual(item.observed, { checks: 130, exports: 26
			, serial: (1n << 90n).toString()
			, borrowExpired: true, closureDisposed: true, transferredInputs: true });
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), output: "true\n42n\n42n\n" });
		flags(item.browser, ["installedSourcesRemoved", "externalNetworkBlocked"]);
		assert.deepEqual(item.browser.executions.map(value => [value.engine, value.profile])
			, ["chromium", "firefox", "webkit"].flatMap(engine => ["page", "react", "worker"].map(profile => [engine, profile])));
		const expectedAssets = [item.inventory["@lean-bridge/runtime/internal/main.wasm"].sha256
			, item.inventory[component.name + "/internal/component.so.wasm"].sha256].sort();
		for(const execution of item.browser.executions)
		{
			assert.equal(execution.checks, 130); assert.equal(execution.reruns, 2);
			assert.ok(typeof execution.version === "string" && execution.version.length > 0);
			assert.deepEqual(execution.assets, expectedAssets);
		}
	}
	assert.equal(runtimes.size, 1);
	assertOwnedJavaScriptTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
