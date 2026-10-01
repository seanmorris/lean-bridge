/**
 * Reconstruct compiled borrowed-result sources and require installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateTransferRuntime } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { generateOwnedWasmComponent } from "../../src/backends/javascript/owned-wasm-component.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { assertComponentOwnedWasmBindings } from "../../src/abi/component-owned-wasm.mjs";
import { ownedJavaScriptWasmNativeProbe } from "./owned-javascript-wasm-native.mjs";
import { ownedJavaScriptBorrowMutations } from "./owned-javascript-borrow-mutants.mjs";
import { assertOwnedJavaScriptBorrowCi } from "./owned-javascript-borrow-ci.mjs";
import { ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";

export const ownedJavaScriptBorrowCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-javascript-borrows";
export const ownedJavaScriptBorrowScope = Object.freeze({
	profiles: ["javascript", "typescript", "browser", "react", "worker"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedNpm: true
	, strictTypeScript: true, sourceFreeInstallation: true, offlineInstall: true
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, publicExports: 26, anchoredResults: 19, consumingExports: 4
	, pointerBits: 32, privateAbi: 12, compiledModel: 9, ownedGraph: 4
	, wholeValueOwners: true, sharedRoots: true, independentRetains: true
	, originalOwnerTransfers: true, canonicalIdentity: true
	, transitiveExpiration: true, recursiveValues: true, emptyValues: true
	, borrowOnlyExecuted: true, callbackReentry: true, returnedClosures: true
	, nativeAllocationFaults: true, hostAllocationFaults: true
	, parsedNegativeVariants: 8
	, sharedRuntimeLoadOrders: ["owned-first", "copied-first"]
	, deterministicReassembly: true, independentRebuild: true
	, documentationExecuted: true, combinedCRelease: true
	, receiverAnchors: false, callbackResultAnchors: false
	, docker: false, installedSupportPromotions: 0
});
const hash = value => sha256(canonicalJson(value));
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const drained = value => {
	for(const key of ["liveOwners", "liveAllocations", "liveIdentities"]) assert.equal(value[key], 0, key);
};
const observed = value => assert.deepEqual(value, { checks: 232, exports: 26, borrowedResults: true });
const compile = (item, lean, borrowOnly = false) => {
	assert.equal(item.schemaVersion, 1);
	assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
	const native = generateOwnedNativeValueAdapters({ ...item.input
		, wordBits: 32
		, hostCallbacks: true, transferredInputs: !borrowOnly
		, anchoredResults: true });
	const component = generateOwnedWasmComponent(native);
	assert.deepEqual(item.privateAbi, component.privateAbi);
	assert.equal(assertComponentOwnedWasmBindings(item.privateAbi, native.layout.model.bindingIr), component.metadataHash);
	assert.equal(item.privateAbi.version, 12);
	assert.equal(item.privateAbi.resultAnchors.exports.length, borrowOnly ? 18 : 19);
	assert.equal(native.layout.functions.length, borrowOnly ? 22 : 26);
	if(borrowOnly) assert.equal(item.privateAbi.inputTransfers, undefined);
	else assert.equal(item.privateAbi.inputTransfers.exports.length, 4);
	return component;
};

/**
 * Check observations against compiler-generated sources, not feature flags alone.
 *
 * @param record - Complete enabled gate, captured inputs and package inventories.
 */
export const assertOwnedJavaScriptBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptBorrowScope);
	assert.equal(record.run.command, ownedJavaScriptBorrowCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 25, pass: 25, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const base = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const lean = base + ownedRustBorrowSource;
	for(const field of ["runtime", "borrowOnly", "mutants"])
		assert.deepEqual(record[field].map(item => item.mode), ["ordinary", "reviewed"]);
	for(const item of record.runtime)
	{
		assert.equal(item.profile, "owned-javascript-borrows");
		const component = compile(item, lean);
		assert.equal(item.sourceSha256, sha256(ownedJavaScriptWasmNativeProbe(component))); digest(item.binarySha256);
		observed(item.observed); drained(item);
		assert.deepEqual(item.limits, { borrowDepth: 128, hostWrappers: 4096 });
		assert.deepEqual(item.faultCounts, {
			"native:borrow": { before: 18, after: 0 }
			, "native:copy": { before: 18, after: 0 }
			, "native:move": { before: 5, after: 31 }
			, "native:mixed": { before: 3, after: 1 }
			, "host:borrow": { before: 10, after: 0 }
			, "host:copy": { before: 10, after: 0 }
			, "host:move": { before: 2, after: 15 }
			, "host:mixed": { before: 2, after: 9 }
		});
	}
	for(const item of record.borrowOnly)
	{
		assert.equal(item.profile, "owned-javascript-borrow-only");
		const component = compile(item, base, true);
		assert.equal(item.sourceSha256, sha256(ownedJavaScriptWasmNativeProbe(component))); digest(item.binarySha256);
		assert.equal(item.emptyShapes, 4); drained(item);
	}
	for(const item of record.mutants)
	{
		assert.equal(item.profile, "owned-javascript-borrow-mutants");
		const component = compile(item, lean), source = ownedJavaScriptWasmNativeProbe(component);
		assert.equal(item.sourceSha256, sha256(source)); digest(item.binarySha256);
		assert.equal(item.baselineChecks, 8);
		assert.equal(item.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-javascript-borrow-semantic.mjs")));
		const expected = [];
		for(const [name, path, before, after] of ownedJavaScriptBorrowMutations)
		{
			const original = path === "probe.c" ? source : path === "owned-leases.h"
				? ownedAggregateTransferRuntime({ anchoredResults: true }) : await readFile(path, "utf8");
			assert.equal(original.split(before).length, 2, name);
			expected.push({ name, path, sourceSha256: sha256(original.replace(before, after)), parsed: true, semanticRejection: true });
		}
		assert.deepEqual(item.observations, expected);
	}
	assert.deepEqual(record.coexistence.map(item => [item.mode, item.alphaFirst])
		, ["ordinary", "reviewed"].flatMap(mode => [false, true].map(order => [mode, order])));
	const runtimes = new Set(), alphas = new Set();
	for(const item of record.coexistence)
	{
		assert.equal(item.profile, "owned-javascript-borrow-coexistence"); compile(item, lean); observed(item.observed);
		for(const key of ["componentSha256", "runtimeSha256", "alphaSha256"]) digest(item[key]);
		runtimes.add(item.runtimeSha256); alphas.add(item.alphaSha256);
		assert.equal(item.runtimeInitializations, 1); assert.equal(item.libraryInitializations, 2);
		for(const key of ["components", "identities", "legacyHandles"]) assert.equal(item[key], 0, key);
		assert.equal(item.state, 4);
	}
	assert.equal(runtimes.size, 1); assert.equal(alphas.size, 1);
	const packages = record.packages;
	assert.equal(packages.schemaVersion, 1); assert.equal(packages.profile, "installed-owned-javascript-borrows");
	digest(packages.compilerInputsIdentity);
	assert.deepEqual(packages.reports.map(item => item.reviewed), [false, true]);
	const doc = (await readFile("docs/javascript-typescript.md", "utf8")).split("### Borrowed results and whole-value owners\n")[1].split("### Consuming inputs\n")[0];
	const example = doc.match(/```js\n([^]*?)\n```/u)[1], archives = new Set();
	for(const item of packages.reports)
	{
		flags(item, ["sourceRemovedBeforeInstall", "installedCli", "installedTypeScript", "deterministicReassembly", "independentRebuild"]);
		assert.equal(item.combinedNative, item.reviewed); assert.equal(item.rejected, 16);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.reviewed);
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const model = createOwnedJavaScriptWasmModel(item.input);
		assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, 9); assert.equal(model.pointerBits, 32);
		assert.equal(model.ownedGraph.schemaVersion, 4);
		const generated = generateCompiledJavaScriptWasmOwned(model, item.input.metadata, generateOwnedJavaScriptWasmLeanAdapters(model));
		assert.deepEqual(item.receipt.ownedGraph, generated.receipt);
		assert.equal(item.receipt.modelSha256, hash(model));
		assert.equal(item.receipt.metadataSha256, hash(item.input.metadata));
		assert.equal(item.packages.length, 2);
		const runtime = item.packages.find(entry => entry.role === "runtime"), component = item.packages.find(entry => entry.role === "component");
		assert.equal(runtime.name, "@lean-bridge/runtime"); archives.add(runtime.sha256);
		assert.equal(component.name, `@owned/${item.reviewed ? "reviewed" : "ordinary"}-borrows`);
		for(const archive of item.packages)
		{ digest(archive.sha256); assert.ok(archive.bytes > 0); }
		assert.ok(Object.keys(item.inventory).length > 50);
		for(const entry of Object.values(item.inventory))
		{ digest(entry.sha256); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); }
		const prefix = component.name + "/metadata/compiler/";
		assert.equal(item.inventory[prefix + "model.json"].sha256, item.receipt.modelSha256);
		assert.equal(item.inventory[prefix + "metadata.json"].sha256, item.receipt.metadataSha256);
		for(const [path, identity] of Object.entries(item.receipt.ownedGraph.files)) assert.equal(item.inventory[prefix + path].sha256, identity, path);
		const publicFiles = generateJavaScriptPackage(model.bindingIr);
		for(const path of ["index.mjs", "index.d.ts"]) assert.equal(item.inventory[component.name + "/" + path].sha256, sha256(publicFiles[path]));
		for(const name of ["calls", "borrow-registry"])
			assert.equal(item.inventory[`@lean-bridge/runtime/internal/owned-wasm-${name}.mjs`].sha256, sha256(await readFile(`src/release/owned-wasm-${name}.mjs`)));
		observed(item.observed);
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), output: "42n\nexpired\n42n\n" });
		flags(item.browser, ["installedSourcesRemoved", "externalNetworkBlocked"]);
		assert.deepEqual(item.browser.executions.map(value => [value.engine, value.profile])
			, ["chromium", "firefox", "webkit"].flatMap(engine => ["page", "react", "worker"].map(profile => [engine, profile])));
		const expectedAssets = [item.inventory["@lean-bridge/runtime/internal/main.wasm"].sha256
			, item.inventory[component.name + "/internal/component.so.wasm"].sha256].sort();
		assert.equal(runtimes.has(item.inventory["@lean-bridge/runtime/internal/main.wasm"].sha256), true);
		for(const execution of item.browser.executions)
		{
			assert.equal(execution.checks, 232); assert.equal(execution.reruns, 2);
			assert.ok(typeof execution.version === "string" && execution.version.length > 0);
			assert.deepEqual(execution.assets, expectedAssets);
		}
	}
	assert.equal(archives.size, 1);
	assertOwnedJavaScriptBorrowCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
