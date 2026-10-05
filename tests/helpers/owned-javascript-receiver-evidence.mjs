/**
 * Reconstruct receiver adapters and authenticate executed installed acceptance.
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
import { ownedJavaScriptReceiverMutations } from "./owned-javascript-receiver-mutants.mjs";
import { assertOwnedJavaScriptReceiverCi } from "./owned-javascript-receiver-ci.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { beforeOwnedCallbackResults } from "./owned-callback-result-history.mjs";

export const ownedJavaScriptReceiverCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-javascript-receivers";
export const ownedJavaScriptReceiverScope = Object.freeze({
	profiles: ["javascript", "typescript", "browser", "react", "worker"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedNpm: true
	, strictTypeScript: true, sourceFreeInstallation: true, offlineInstall: true
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, publicExports: 27, members: 16, anchoredResults: 20, consumingExports: 4
	, pointerBits: 32, privateAbi: 13, compiledModel: 10, ownedGraph: 5
	, originalReceiverOwners: true, remainingParameterOwners: true
	, readOnlyProperties: true, sharedMembers: true, independentRetains: true
	, originalOwnerTransfers: true, recursiveValues: true, emptyValues: true
	, resourceOnlyConfigurations: ["plain", "consuming"]
	, unanchoredCallbacks: true, returnedClosures: true
	, nativeAllocationFaults: true, hostAllocationFaults: true
	, retainedErrors: true, actualGarbageCollection: true, payloadCycles: true
	, parsedNegativeVariants: 12
	, sharedRuntimeLoadOrders: ["owned-first", "copied-first"]
	, deterministicReassembly: true, independentRebuild: true
	, documentationExecuted: true, combinedCRelease: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});
const hash = value => sha256(canonicalJson(value));
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const drained = item => { for(const key of ["owners", "allocations", "identities", "callbacks"]) assert.equal(item[key], 0, key); };
const members = value => assert.deepEqual(value, { checks: 60, members: 16, receiverAnchors: true, parameterAnchors: true });
const borrows = value => assert.deepEqual(value, { checks: 232, exports: 26, borrowedResults: true });
const options = kind => ({ receiverExports: true
	, anchoredResults: kind === "full"
	, hostCallbacks: ["full", "unanchored"].includes(kind)
	, transferredInputs: kind !== "plain" });
const compile = (item, lean, kind = "full", probe = true) => {
	assert.equal(item.schemaVersion, 1);
	assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
	const native = generateOwnedNativeValueAdapters({ ...item.input, wordBits: 32, ...options(kind) });
	const component = generateOwnedWasmComponent(native);
	assert.deepEqual(item.privateAbi, component.privateAbi);
	assert.equal(assertComponentOwnedWasmBindings(item.privateAbi, native.layout.model.bindingIr), component.metadataHash);
	assert.equal(item.privateAbi.version, 13);
	assert.equal(item.privateAbi.receiverExports.exports.length, ["full", "unanchored"].includes(kind) ? 16 : kind === "plain" ? 3 : 4);
	if(kind === "full") assert.equal(item.privateAbi.resultAnchors.exports.length, 20);
	else assert.equal(item.privateAbi.resultAnchors, undefined);
	if(probe)
	{ assert.equal(item.sourceSha256, sha256(ownedJavaScriptWasmNativeProbe(component))); digest(item.binarySha256); }
	return component;
};
const browser = (item, name, checks) => {
	flags(item.browser, ["installedSourcesRemoved", "externalNetworkBlocked"]);
	assert.deepEqual(item.browser.executions.map(value => [value.engine, value.profile])
		, ["chromium", "firefox", "webkit"].flatMap(engine => ["page", "react", "worker"].map(profile => [engine, profile])));
	const assets = [item.inventory["@lean-bridge/runtime/internal/main.wasm"].sha256
		, item.inventory[name + "/internal/component.so.wasm"].sha256].sort();
	for(const execution of item.browser.executions)
	{
		assert.equal(execution.checks, checks); assert.equal(execution.reruns, 2);
		assert.ok(typeof execution.version === "string" && execution.version.length > 0);
		assert.deepEqual(execution.assets, assets);
	}
};
const installed = async (item, name, lean, kind = "full") => {
	flags(item, ["sourceRemovedBeforeInstall", "installedTypeScript", "deterministicReassembly", "independentRebuild"]);
	assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), (item.mode ?? (item.reviewed ? "reviewed" : "ordinary")) === "reviewed");
	assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
	const model = createOwnedJavaScriptWasmModel({ ...item.input, ...options(kind) });
	assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, 10); assert.equal(model.pointerBits, 32);
	assert.equal(model.ownedGraph.schemaVersion, 5);
	const generated = generateCompiledJavaScriptWasmOwned(model, item.input.metadata, generateOwnedJavaScriptWasmLeanAdapters(model));
	assert.deepEqual(item.receipt.ownedGraph, generated.receipt);
	assert.equal(item.receipt.modelSha256, hash(model));
	assert.equal(item.receipt.metadataSha256, hash(item.input.metadata));
	assert.ok(Object.keys(item.inventory).length > 50);
	for(const entry of Object.values(item.inventory))
	{ digest(entry.sha256); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); }
	const prefix = name + "/metadata/compiler/";
	assert.equal(item.inventory[prefix + "model.json"].sha256, item.receipt.modelSha256);
	assert.equal(item.inventory[prefix + "metadata.json"].sha256, item.receipt.metadataSha256);
	for(const [path, identity] of Object.entries(item.receipt.ownedGraph.files)) assert.equal(item.inventory[prefix + path].sha256, identity, path);
	assert.equal(item.inventory[name + "/internal/component.so.wasm"].sha256, item.receipt.wasmLibrary.sha256);
	const publicFiles = generateJavaScriptPackage(model.bindingIr);
	for(const path of ["index.mjs", "index.d.ts"]) assert.equal(item.inventory[name + "/" + path].sha256, sha256(publicFiles[path]));
	for(const path of ["component-runtime", "owned-wasm-calls", "owned-wasm-borrow-registry"])
	{
		const sourcePath = `src/release/${path}.mjs`;
		let source = beforeOwnedCallbackResults(sourcePath, await readFile(sourcePath, "utf8"));
		// The installed runtime puts ABI modules beside the runtime sources.
		for(const module of ["component-scalars", "component-callables"
			, "component-copied", "component-records", "component-recursive"
			, "component-recursive-abi", "component-structured-callables"
			, "component-owned-wasm", "owned-wasm-control"])
			source = source.replaceAll(`../abi/${module}.mjs`, `./${module}.mjs`);
		source = source.replaceAll("../binding-ir/", "./binding-ir/");
		assert.deepEqual(item.inventory[`@lean-bridge/runtime/internal/${path}.mjs`]
			, { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
	}
	const archives = item.packages ?? item.archives;
	assert.equal(archives.length, 2); assert.deepEqual(archives.map(row => row.role).sort(), ["component", "runtime"]);
	for(const entry of archives)
	{ digest(entry.sha256); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0); }
	return { runtimeArchive: archives.find(row => row.role === "runtime").sha256
		, runtime: item.inventory["@lean-bridge/runtime/internal/main.wasm"].sha256 };
};

/**
 * Match all enabled execution reports to generated sources and exact inputs.
 *
 * @param record - Frozen acceptance receipt, not a hand-authored support claim.
 */
export const assertOwnedJavaScriptReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptReceiverScope);
	assert.equal(record.run.command, ownedJavaScriptReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 28, pass: 28, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const base = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const lean = base + ownedRustReceiverSource, plainLean = base + ownedJvmPlainReceiverSource;
	for(const field of ["runtime", "gc", "mutants"]) assert.deepEqual(record[field].map(item => item.mode), ["ordinary", "reviewed"]);
	for(const item of record.runtime)
	{
		assert.equal(item.profile, "owned-javascript-receivers"); compile(item, lean);
		members(item.members); borrows(item.borrows); drained(item);
		assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
		const cleanup = item.failureCleanup;
		assert.equal(cleanup.retainedErrors, 169); assert.equal(cleanup.publicationFailures, 2);
		assert.equal(cleanup.borrowDepth, 128); assert.equal(cleanup.hostWrappers, 4096);
		for(const key of ["liveOwners", "liveAllocations", "liveIdentities", "liveCallbacks"]) assert.equal(cleanup[key], 0, key);
		assert.deepEqual(cleanup.counts, {
			"native:borrow": { before: 18, after: 0 }
			, "native:property": { before: 6, after: 0 }
			, "native:parameter": { before: 3, after: 0 }
			, "native:copy": { before: 18, after: 0 }
			, "native:move": { before: 5, after: 31 }
			, "native:mixed": { before: 3, after: 1 }
			, "native:transfer": { before: 2, after: 1 }
			, "host:borrow": { before: 10, after: 0 }
			, "host:property": { before: 10, after: 0 }
			, "host:parameter": { before: 10, after: 0 }
			, "host:copy": { before: 10, after: 0 }
			, "host:move": { before: 2, after: 15 }
			, "host:mixed": { before: 2, after: 9 }
			, "host:transfer": { before: 2, after: 9 }
		});
	}
	assert.deepEqual(record.resources.map(item => [item.mode, item.profile, item.consuming ?? true])
		, ["ordinary", "reviewed"].flatMap(mode => [
			[mode, "owned-javascript-resource-receivers", false]
			, [mode, "owned-javascript-resource-receivers", true]
			, [mode, "owned-javascript-unanchored-receivers", true]
		])
	);
	for(const item of record.resources)
	{
		const unanchored = item.profile === "owned-javascript-unanchored-receivers";
		compile(item, unanchored ? lean : plainLean, unanchored ? "unanchored" : item.consuming ? "consuming" : "plain");
		drained(item); assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
		if(unanchored) assert.deepEqual(item.observed, { checks: 11, consuming: true, callbacks: true, resultAnchors: false });
	}
	for(const item of record.gc)
	{
		assert.equal(item.profile, "owned-javascript-receiver-gc"); compile(item, lean); drained(item);
		flags(item, ["actualGc", "originalOwnerCollected", "cycleCollected", "retainedMethodPinsReceiver"]);
		assert.ok(Number.isSafeInteger(item.collections) && item.collections >= 3 && item.collections <= 600);
	}
	for(const item of record.mutants)
	{
		assert.equal(item.profile, "owned-javascript-receiver-mutants");
		const component = compile(item, lean), source = ownedJavaScriptWasmNativeProbe(component);
		assert.equal(item.baselineChecks, 12);
		assert.equal(item.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-javascript-receiver-semantic.mjs")));
		const expected = [];
		for(const [name, path, before, after] of ownedJavaScriptReceiverMutations)
		{
			const original = path === "probe.c" ? source : path === "owned-leases.h"
				? ownedAggregateTransferRuntime({ anchoredResults: true }) : beforeOwnedCallbackResults(path, await readFile(path, "utf8"));
			assert.equal(original.split(before).length, 2, name);
			expected.push({ name, path, sourceSha256: sha256(original.replace(before, after)), parsed: true, semanticRejection: true });
		}
		assert.deepEqual(item.observations, expected);
	}
	assert.deepEqual(record.coexistence.map(item => [item.mode, item.alphaFirst])
		, ["ordinary", "reviewed"].flatMap(mode => [false, true].map(order => [mode, order])));
	const runtimes = new Set(), alphas = new Set(), archives = new Set();
	for(const item of record.coexistence)
	{
		assert.equal(item.profile, "owned-javascript-receiver-coexistence"); compile(item, lean, "full", false);
		members(item.members); borrows(item.borrows);
		for(const key of ["componentSha256", "runtimeSha256", "alphaSha256"]) digest(item[key]);
		runtimes.add(item.runtimeSha256); alphas.add(item.alphaSha256);
		assert.equal(item.runtimeInitializations, 1); assert.equal(item.libraryInitializations, 2);
		for(const key of ["components", "identities", "legacyHandles"]) assert.equal(item[key], 0, key);
		assert.equal(item.state, 4);
	}
	assert.equal(runtimes.size, 1); assert.equal(alphas.size, 1);
	const packages = record.packages;
	assert.equal(packages.schemaVersion, 1); assert.equal(packages.profile, "installed-owned-javascript-receivers");
	digest(packages.compilerInputsIdentity); assert.deepEqual(packages.reports.map(item => item.reviewed), [false, true]);
	const doc = (await readFile("docs/javascript-typescript.md", "utf8")).split("### Methods and properties\n")[1].split("### Consuming inputs\n")[0];
	const example = doc.match(/```js\n([^]*?)\n```/u)[1];
	for(const item of packages.reports)
	{
		assert.equal(item.installedCli, true); assert.equal(item.combinedNative, item.reviewed); assert.equal(item.rejected, 19);
		const name = `@owned/${item.reviewed ? "reviewed" : "ordinary"}-receivers`;
		const checked = await installed(item, name, lean);
		archives.add(checked.runtimeArchive); assert.ok(runtimes.has(checked.runtime));
		members(item.observed.members); borrows(item.observed.borrows); assert.equal(item.observed.checks, 292);
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), output: "42n\nexpired\n42n\n" });
		browser(item, name, 292);
	}
	assert.deepEqual(record.resourcePackages.map(item => [item.mode, item.kind])
		, ["ordinary", "reviewed"].flatMap(mode => ["plain", "consuming", "unanchored"].map(kind => [mode, kind])));
	for(const item of record.resourcePackages)
	{
		assert.equal(item.schemaVersion, 1); assert.equal(item.profile, "installed-javascript-resource-receivers");
		assert.equal(item.producerInterface, "javascript-wasm-build-api"); assert.equal(item.sourceUnchanged, true);
		const unanchored = item.kind === "unanchored", consuming = item.kind !== "plain";
		assert.equal(item.unanchored, unanchored); assert.equal(item.consuming, consuming);
		const name = `@owned/${item.mode}-${item.kind}-receivers`;
		const checked = await installed(item, name, unanchored ? lean : plainLean, item.kind);
		archives.add(checked.runtimeArchive); assert.ok(runtimes.has(checked.runtime));
		const checks = unanchored ? 11 : consuming ? 20 : 17;
		assert.deepEqual(item.observed, { checks, consuming, callbacks: unanchored, resultAnchors: false });
		assert.equal(item.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-javascript-resource-receivers.mjs")));
		browser(item, name, checks);
	}
	assert.equal(archives.size, 1);
	assertOwnedJavaScriptReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
