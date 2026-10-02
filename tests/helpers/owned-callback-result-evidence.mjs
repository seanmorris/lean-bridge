/**
 * Reconstruct callback-result adapters and authenticate installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeCallbackInventoryRepair } from "./owned-callback-inventory-history.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedWasmComponent } from "../../src/backends/javascript/owned-wasm-component.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { ownedJavaScriptWasmNativeProbe } from "./owned-javascript-wasm-native.mjs";
import { ownedCallbackResultSource, ownedCallbackResultCombinedSource } from "./owned-callback-result-fixture.mjs";
import { assertOwnedCallbackResultCi, ownedCallbackResultReports, ownedCallbackResultTestNames } from "./owned-callback-result-ci.mjs";
import { ownedCallbackResultBaseline, ownedCallbackResultChangedPaths
	, ownedCallbackResultHistoryPath, ownedCallbackResultHistorySha256 } from "./owned-callback-result-history.mjs";

export const ownedCallbackResultEvidencePath = "docs/evidence/owned-callback-results-20261002.json";
export const ownedCallbackResultPrevious = Object.freeze({
	path: "docs/evidence/owned-jvm-receiver-gc-20261001.json"
	, sha256: "aa71717e00fa100a2a7c8a8bb2c54a69f99b9a31f2d780ea94480b638d2444fc"
});
const addedPaths = [
	"src/analyze/callback-signature.mjs"
	, "docs/evidence/owned-callback-result-progress-20261002.md"
	, ownedCallbackResultHistoryPath
	, ...["ci", "evidence", "fixture", "history"].map(name => `tests/helpers/owned-callback-result-${name}.mjs`)
	, ...[...ownedCallbackResultTestNames, "ci", "history", "evidence"].map(name => `tests/owned-callback-result-${name}.test.mjs`)
	, ...["owned-callback-result-wasm-semantic.mjs", "owned-callback-results.c"
		, "owned-installed-callback-combinations.c"
		, "owned-installed-callback-results.c"
		, "owned-installed-javascript-callback-combinations.mjs"
		, "owned-installed-javascript-callback-results.mjs"].map(name => "tests/fixtures/structured-types/" + name)
];

/** Keep the previous source coverage and require every new acceptance input. */
export const ownedCallbackResultSourcePaths = async () => {
	const bytes = await readFile(ownedCallbackResultPrevious.path);
	assert.equal(sha256(bytes), ownedCallbackResultPrevious.sha256);
	return [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedCallbackResultChangedPaths, ...addedPaths])].sort();
};
export const ownedCallbackResultScope = Object.freeze({
	profiles: ["c", "javascript", "typescript", "browser", "react", "worker"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true, hostReplyBeforeFrameExpiration: true
	, combinedReceiverAndTransferPackages: true
	, compiledLean: true, installedCli: true, sourceFreeConsumption: true
	, strictTypeScript: true, pkgConfig: true, relocatedCMake: true
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, cChecks: 134, combinedCChecks: 219, npmChecks: 43, combinedNpmChecks: 40
	, nativeFaults: [21, 62], wasmNativeFaults: 9, wasmHostFaults: 10
	, wasmSemanticMutants: 6, sharedRuntimeLoadOrders: 2
	, modelVersion: 11, ownedGraphVersion: 6, privateAbiVersion: 14
	, deterministicBaseArchives: true, documentationExecuted: true
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, docker: false, installedSupportPromotions: 0
});
const hash = value => sha256(canonicalJson(value));
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };

/**
 * Share repeated JSON subtrees without dropping any original report fields.
 *
 * @param reports - Complete canonical JSON observations keyed by artifact path.
 */
export const packOwnedCallbackReports = reports => {
	const nodes = {};
	const pack = value => {
		if(value === null || typeof value !== "object") return value;
		assert.equal(Object.hasOwn(value, "$node"), false);
		const packed = Array.isArray(value) ? value.map(pack) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, pack(child)]));
		const text = canonicalJson(packed);
		if(text.length < 2048) return packed;
		const id = sha256(text); nodes[id] = packed;
		return { $node: id };
	};
	const entries = Object.fromEntries(Object.entries(reports).map(([path, report]) => {
		const entry = { bytes: Buffer.byteLength(canonicalJson(report))
			, sha256: hash(report), data: pack(report) };
		return [path, entry];
	}));
	return { format: "sha256-json-nodes-v1", nodes, reports: entries };
};

/**
 * Check every shared node and reconstruct byte-identical canonical reports.
 *
 * @param archive - Content-addressed report archive.
 */
export const unpackOwnedCallbackReports = archive => {
	assert.equal(archive.format, "sha256-json-nodes-v1");
	assert.ok(archive.nodes && !Array.isArray(archive.nodes));
	assert.ok(Object.keys(archive.nodes).length <= 10000);
	const cache = new Map(), active = new Set();
	const unpack = (value, depth = 0) => {
		assert.ok(depth < 512);
		if(value === null || typeof value !== "object") return value;
		if(Object.hasOwn(value, "$node"))
		{
			assert.deepEqual(Object.keys(value), ["$node"]); digest(value.$node);
			assert.ok(Object.hasOwn(archive.nodes, value.$node));
			assert.equal(active.has(value.$node), false, "Cyclic evidence node");
			if(cache.has(value.$node)) return cache.get(value.$node);
			const packed = archive.nodes[value.$node]; assert.equal(hash(packed), value.$node);
			active.add(value.$node); const decoded = unpack(packed, depth + 1);
			active.delete(value.$node); cache.set(value.$node, decoded); return decoded;
		}
		return Array.isArray(value) ? value.map(child => unpack(child, depth + 1))
			: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unpack(child, depth + 1)]));
	};
	const reports = Object.fromEntries(Object.entries(archive.reports).map(([path, entry]) => {
		const report = unpack(entry.data), text = canonicalJson(report);
		assert.equal(Buffer.byteLength(text), entry.bytes, path);
		assert.equal(sha256(text), entry.sha256, path); return [path, report];
	}));
	assert.deepEqual([...cache.keys()].sort(), Object.keys(archive.nodes).sort(), "Unreferenced evidence node");
	return reports;
};

const options = (hostCallbacks = true, combined = false) => ({
	hostCallbacks, callbackResultAnchors: true
	, anchoredResults: combined, receiverExports: combined
	, transferredInputs: combined
});
const nativeOptions = (hostCallbacks = true, combined = false) => ({
	ownedGraphs: true, ownedHostCallbacks: hostCallbacks
	, ownedCallbackResultAnchors: true
	, ownedAnchoredResults: combined, ownedReceiverExports: combined
	, ownedInputTransfers: combined
});
const source = async (input, mode, combined = false) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256
		, sha256(lean + (combined ? ownedCallbackResultCombinedSource : ownedCallbackResultSource)));
};
const graph = (model, combined = false) => {
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	const signatures = model.bindingIr.types.filter(type => type.kind === "callback" && type.callable.result.ownership === "borrow")
		.map(type => ({ id: type.id, parameter: type.callable.parameters.length - 1 }));
	assert.equal(signatures.length, 4);
	assert.deepEqual(model.ownedGraph.callbackResultAnchors.signatures, signatures);
	for(const [key, count] of [["receiverExports", 4], ["resultAnchors", 1], ["inputTransfers", 1]])
		if(combined) assert.equal(model.ownedGraph[key].exports.length, count);
		else assert.equal(model.ownedGraph[key], undefined);
};
const wasm = (item, hostCallbacks = true, combined = false) => {
	const native = generateOwnedNativeValueAdapters({ ...item.input, wordBits: 32, ...options(hostCallbacks, combined) });
	const component = generateOwnedWasmComponent(native);
	assert.deepEqual(item.privateAbi, component.privateAbi);
	assert.equal(item.privateAbi.version, 14);
	if(item.sourceSha256) assert.equal(item.sourceSha256, sha256(ownedJavaScriptWasmNativeProbe(component)));
	return { native, component };
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
const cli = async report => {
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = report;
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "lean-bridge-cli-package");
	assert.equal(report.productionApproved, false); assert.equal(externalRegistryWrites, false);
	assert.equal(inventorySha256, hash(inventory)); digest(archive.sha256); assert.ok(archive.bytes > 0);
	const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	assert.deepEqual(report.package, { name: config.name, version: config.version });
	assert.equal(new Set(report.files.map(file => file.path)).size, report.files.length);
	for(const path of config.files)
	{
		const file = report.files.find(entry => entry.path === path); assert.ok(file, path);
		const bytes = Buffer.from(beforeCallbackInventoryRepair(path, await readFile(path), file.sha256));
		assert.equal(file.bytes, bytes.length, path); assert.equal(file.sha256, sha256(bytes), path);
	}
};
const installedWasm = async (item, combined = false) => {
	const model = createOwnedJavaScriptWasmModel({ ...item.input, ...options(true, combined) });
	assert.deepEqual(item.model, model); graph(model, combined); assert.equal(model.pointerBits, 32);
	const generated = generateCompiledJavaScriptWasmOwned(model, item.input.metadata, generateOwnedJavaScriptWasmLeanAdapters(model));
	assert.deepEqual(item.receipt.ownedGraph, generated.receipt);
	assert.equal(item.receipt.modelSha256, hash(model));
	assert.equal(item.receipt.metadataSha256, hash(item.input.metadata));
	const publicFiles = generateJavaScriptPackage(model.bindingIr);
	const name = item.name;
	assert.ok(Object.keys(item.inventory).length > 50);
	for(const entry of Object.values(item.inventory))
	{ digest(entry.sha256); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); }
	for(const [path, identity] of Object.entries(item.receipt.ownedGraph.files))
		assert.equal(item.inventory[name + "/metadata/compiler/" + path].sha256, identity);
	assert.equal(item.inventory[name + "/metadata/compiler/model.json"].sha256, hash(model));
	assert.equal(item.inventory[name + "/metadata/compiler/metadata.json"].sha256, hash(item.input.metadata));
	assert.equal(item.inventory[name + "/internal/component.so.wasm"].sha256, item.receipt.wasmLibrary.sha256);
	for(const path of ["index.mjs", "index.d.ts"])
		assert.equal(item.inventory[name + "/" + path].sha256, sha256(publicFiles[path]));
	for(const path of ["component-runtime", "owned-wasm-calls", "owned-wasm-borrow-registry", "owned-wasm-callbacks"])
	{
		let text = await readFile(`src/release/${path}.mjs`, "utf8");
		for(const module of ["component-scalars", "component-callables"
			, "component-copied", "component-records", "component-recursive"
			, "component-recursive-abi", "component-structured-callables"
			, "component-owned-wasm", "owned-wasm-control"])
			text = text.replaceAll(`../abi/${module}.mjs`, `./${module}.mjs`);
		text = text.replaceAll("../binding-ir/", "./binding-ir/");
		assert.deepEqual(item.inventory[`@lean-bridge/runtime/internal/${path}.mjs`]
			, { bytes: Buffer.byteLength(text), sha256: sha256(text) }, path);
	}
};

const installedC = async (item, input, model, combined = false) => {
	await source(input, item.mode, combined);
	assert.deepEqual(model, createCompiledNativeModel({ ...input, moduleName: model.moduleName }, nativeOptions(true, combined)));
	graph(model, combined); assert.equal(model.pointerBits, 64);
	const receipt = combined ? item.native.receipt : item.receipt;
	const adapters = generateCompiledNativeLeanAdapters(model);
	assert.equal(receipt.schemaVersion, 7);
	assert.equal(receipt.modelSha256, hash(model));
	assert.equal(receipt.metadataSha256, hash(input.metadata));
	assert.equal(receipt.headerSha256, sha256(adapters.header));
	assert.equal(receipt.adaptersSha256, sha256(adapters.leanSource));
	assert.equal(receipt.callbackSourceSha256, sha256(adapters.callbackSource));
	assert.equal(item.manifest.componentReceiptSha256, hash(receipt));
	assert.equal(item.manifest.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(item.manifest.files["share/lean-bridge/component/native-component.json"].sha256, hash(receipt));
	assert.equal(item.manifest.files["share/lean-bridge/component/model.json"].sha256, hash(model));
	assert.equal(item.manifest.files["share/lean-bridge/component/metadata.json"].sha256, hash(input.metadata));
	assert.deepEqual(item.manifest.files["lib/" + receipt.library], receipt.nativeLibrary);
	for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
		assert.deepEqual(receipt[key], model.ownedGraph[key]);
	const generated = generateOwnedCPackage({ ...input, ...options(true, combined) });
	assert.equal(item.manifest.schemaVersion, 7); assert.equal(item.manifest.ownedValues.schemaVersion, 6);
	for(const key of ["callbackResultAnchors", "hostCallbacks", "receiverExports", "resultAnchors", "inputTransfers"])
		assert.deepEqual(item.manifest.ownedValues[key], model.ownedGraph[key]);
	assert.equal(item.manifest.ownedValues.headerSha256, sha256(generated.publicHeader));
	assert.equal(item.manifest.ownedValues.sourceSha256, sha256(generated.source));
	assert.equal(item.manifest.files[`include/${generated.values.prefix}.h`].sha256, sha256(generated.publicHeader));
	assert.equal(item.manifest.bindingIrSha256, model.bindingIrSha256);
	const execution = combined ? item.installedC : item.installed;
	assert.equal(execution.checks, combined ? 219 : 134);
	flags(execution, ["offlineInstall", "compilerFreePath"]);
	assert.equal(item.cmake, true);
};
const cMutations = (generated, hostCallbacks) => {
	const mutations = [
		["unchecked-anchor-input", generated.source.replaceAll("transaction.anchor_input = 1;", "transaction.anchor_input = 0;")]
		, ["independent-result-owner", generated.source.replace("transaction->anchor\n    ? lb_owned_scope_commit_borrow(&transaction->scope, &owner->batch, transaction->anchor, transaction->anchor_generation)\n    : ", "")]
	];
	if(hostCallbacks) mutations.push(["expired-host-result-before-handoff"
		, generated.source.replace(/( {2}if \(!status\) status = oc_v\d+_to\(&reply,)/gu, "  (void)ov_owner_clear(&argument_owner);\n$1")]);
	return mutations.map(([name, code]) => {
		assert.notEqual(code, generated.source);
		return { name, sourceSha256: sha256(code), compiled: true, semanticRejection: true };
	});
};
const wasmMutations = [
	["lost-anchor", "src/release/owned-wasm-borrow-registry.mjs", "current = current.anchor", "current = null"]
	, ["independent-native-result", "owned-values-codec.h"
		, "transaction->anchor\n    ? lb_owned_scope_commit_borrow(&transaction->scope, &owner->batch, transaction->anchor, transaction->anchor_generation)\n    : "
		, ""]
	, ["unchecked-anchor-input", "owned-values-codec.h"
		, "transaction.anchor_input = 1;", "transaction.anchor_input = 0;"]
	, ["host-owner-unwrapping", "src/release/owned-wasm-callbacks.mjs", 'if(callback.type.callable.result.ownership === "borrow")', "if(false)"]
	, ["early-host-view-expiration", "src/release/owned-wasm-callbacks.mjs"
		, "let result = Reflect.apply(callback.value, undefined, args);"
		, "let result = Reflect.apply(callback.value, undefined, args); state.borrow.rollback();"]
	, ["unpublished-owner", "src/release/owned-wasm-calls.mjs", "if(output) cleanup(output.rollback);", "if(output) { if(!failed) cleanup(output.rollback); }"]
];

/**
 * Rebuild checked models and generated sources for every recorded execution.
 *
 * @param reports - Expanded, complete installed and runtime reports.
 */
export const assertOwnedCallbackReportData = async reports => {
	assert.deepEqual(Object.keys(reports).sort(), [...ownedCallbackResultReports].sort());
	const get = path => reports["build/owned-callback-results/" + path];
	const cProbe = await readFile("tests/fixtures/structured-types/owned-installed-callback-results.c", "utf8");
	const extraC = await readFile("tests/fixtures/structured-types/owned-installed-callback-combinations.c", "utf8");
	const combinedC = cProbe.replace("int main(void) {", extraC + "\nint main(void) {")
		.replace("  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);", "  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);\n  callback_combinations(session);");
	const guide = await readFile("docs/javascript-typescript.md", "utf8");
	const example = guide.split("### Borrowed callback results\n")[1].split("### Methods and properties\n")[0].match(/```js\n([\s\S]*?)\n```/u)[1];
	for(const mode of ["ordinary", "reviewed"])
	{
		const metadata = get(`metadata-${mode}.json`); await source(metadata.input, mode);
		assert.equal(metadata.models.length, 2);
		for(const [index, model] of metadata.models.entries())
		{
			assert.deepEqual(model, createCompiledNativeModel(metadata.input, nativeOptions(Boolean(index))));
			graph(model); assert.equal(Boolean(model.ownedGraph.hostCallbacks), Boolean(index));
		}
		for(const hostCallbacks of [false, true])
		{
			const item = get(`runtime-${mode}-${hostCallbacks}.json`);
			assert.equal(item.mode, mode); assert.equal(item.hostCallbacks, hostCallbacks);
			await source(item.input, mode);
			const generated = generateOwnedCPackage(item.input);
			assert.equal(item.sourceSha256, sha256(generated.source));
			assert.deepEqual(item.result, { checks: hostCallbacks ? 1846 : 627
				, allocationFailures: hostCallbacks ? 62 : 21, identities: 0, live: 0 });
			assert.deepEqual(item.restored, item.result);
			assert.equal(item.sanitizer, "address,undefined");
			assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
			const probe = `#define HOST_CALLBACKS ${Number(hostCallbacks)}\n` + await readFile("tests/fixtures/structured-types/owned-callback-results.c", "utf8");
			assert.equal(item.probeSha256, sha256(probe));
			assert.deepEqual(item.mutations, cMutations(generated, hostCallbacks));
			const runtime = get(`wasm-${mode}-${hostCallbacks}.json`); await source(runtime.input, mode);
			assert.equal(runtime.mode, mode); assert.equal(runtime.hostCallbacks, hostCallbacks);
			wasm(runtime, hostCallbacks); digest(runtime.binarySha256);
			assert.deepEqual(runtime.faultCounts, { native: 9, host: 10 });
			assert.deepEqual(runtime.live, [0, 0, 0, 0]);
		}
		for(const alphaFirst of [false, true])
		{
			const item = get(`coexistence-${mode}-${alphaFirst}.json`); await source(item.input, mode);
			assert.equal(item.mode, mode); assert.equal(item.alphaFirst, alphaFirst); wasm(item);
			assert.equal(item.runtimeInitializations, 1); assert.equal(item.libraryInitializations, 2);
			for(const key of ["liveComponents", "liveIdentities", "liveLegacyHandles"]) assert.equal(item[key], 0);
			for(const key of ["alphaSha256", "componentSha256", "runtimeSha256"]) digest(item[key]);
		}
		const mutations = get(`wasm-${mode}-mutants.json`); await source(mutations.input, mode);
		assert.equal(mutations.mode, mode); assert.deepEqual(mutations.baseline, { checks: 6 });
		assert.deepEqual(mutations.restored, mutations.baseline); digest(mutations.binarySha256);
		assert.equal(mutations.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-callback-result-wasm-semantic.mjs")));
		const native = generateOwnedNativeValueAdapters({ ...mutations.input, wordBits: 32, ...options() });
		const expected = [];
		for(const [name, path, before, after] of wasmMutations)
		{
			const original = path === "owned-values-codec.h" ? native.source : await readFile(path, "utf8");
			assert.ok(original.includes(before), name);
			expected.push({ name, path
				, sourceSha256: sha256(original.replaceAll(before, after))
				, parsed: true, compiled: path === "owned-values-codec.h"
				, semanticRejection: true });
		}
		assert.deepEqual(mutations.observations, expected);
		const composition = get(`wasm-${mode}-combinations.json`); await source(composition.input, mode, true);
		assert.equal(composition.mode, mode); wasm(composition, true, true);
		assert.equal(composition.methods, 4); assert.equal(composition.callbackAnchors, 4);
		assert.equal(composition.callbackCalls, 1); assert.deepEqual(composition.live, [0, 0, 0, 0]);
		flags(composition, ["transferredReceiver", "nestedExpiration", "failedTransferConsumesOwner", "borrowedTransferRejected"]);
		const c = get(`${mode}-c-package.json`); assert.equal(c.mode, mode);
		await cli(c.cli); assert.equal(c.cliFilesVerified, c.cli.files.length);
		await installedC(c, { metadata: c.metadata, sourceIdentity: c.model.sourceIdentity, component: c.model.component }, c.model);
		flags(c, ["relocated", "sourceRemovedBeforeInstall", "cliRemovedBeforeConsumerInstall", "independentRebuild", "deterministicReassembly"]);
		assert.equal(c.rejected, 12); assert.equal(c.builds.length, 2);
		for(const build of c.builds) assert.equal(build.status, "ok");
		assert.equal(c.probeSha256, sha256(cProbe)); assert.deepEqual(c.manifest.ownedValues, c.adapter.ownedValues);
		assert.equal(c.installed.consumerSha256, sha256(cProbe));
		const combined = get(`${mode}-combined-package.json`); assert.equal(combined.mode, mode);
		await cli(combined.cli); assert.equal(combined.cliFilesVerified, combined.cli.files.length);
		flags(combined, ["sourceUnchanged", "producerAndCliRemovedBeforeInstall", "compilerFreeConsumerEnvironment", "installedTypeScript"]);
		await installedC(combined, combined.nativeInput, combined.native.model, true);
		await source(combined.wasmInput, mode, true);
		const name = `@owned/${mode}-callback-combinations`;
		await installedWasm({ ...combined.wasm, input: combined.wasmInput, inventory: combined.inventory, name }, true);
		for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
			assert.deepEqual(combined.native.model.ownedGraph[key], combined.wasm.model.ownedGraph[key]);
		assert.deepEqual(combined.observed, { checks: 40, receiverMethods: true
			, transitiveExpiration: true, consumingHandoff: true
			, borrowedTransferRejected: true });
		browser(combined, name, 40);
		assert.equal(combined.cProbeSha256, sha256(combinedC));
		assert.equal(combined.installedC.consumerSha256, sha256(combinedC));
		assert.equal(combined.jsProbeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-javascript-callback-combinations.mjs")));
		assert.deepEqual(combined.documentation, { sourceSha256: sha256(example), output: "42n\ntrue\n42n\n" });
		assert.equal(combined.receipt.packages.length, 3);
	}
	const npm = get("npm-package.json"); await cli(npm.cli);
	assert.equal(npm.schemaVersion, 1); assert.equal(npm.profile, "installed-owned-callback-results");
	digest(npm.compilerInputsIdentity); assert.deepEqual(npm.reports.map(item => item.reviewed), [false, true]);
	for(const item of npm.reports)
	{
		const mode = item.reviewed ? "reviewed" : "ordinary", name = `@owned/${mode}-callback-results`;
		await source(item.input, mode); await installedWasm({ ...item, name });
		flags(item, ["sourceRemovedBeforeInstall", "compilerFreeConsumerEnvironment", "installedCli", "installedTypeScript", "deterministicReassembly", "independentRebuild"]);
		assert.equal(item.rejected, 17); assert.equal(item.packages.length, 2);
		assert.deepEqual(item.observed, { checks: 43, borrowedResults: true, transitiveExpiration: true, hostReplyHandoff: true });
		assert.equal(item.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-javascript-callback-results.mjs")));
		browser(item, name, 43);
	}
};

const run = (item, command, tests) => {
	assert.equal(item.command, command); assert.equal(item.exitCode, 0);
	assert.equal(item.sha256, sha256(item.text));
	for(const [key, count] of Object.entries({ tests, pass: tests, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(item.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(item.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Require completed execution, closed scope and exact source-bound reports.
 *
 * @param record - Frozen callback-result acceptance receipt.
 */
export const assertOwnedCallbackResultAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedCallbackResultBaseline);
	assert.deepEqual(record.previous, ownedCallbackResultPrevious);
	assert.deepEqual(record.scope, ownedCallbackResultScope);
	assert.deepEqual(record.sourceHistory, { path: ownedCallbackResultHistoryPath, sha256: ownedCallbackResultHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedCallbackResultSourcePaths());
	for(const [path, value] of Object.entries(record.sources)) assert.equal(sha256(beforeCallbackInventoryRepair(path, await readFile(path), value)), value, path);
	run(record.run, "npm run test:owned-callback-results", 33);
	run(record.combinedRun, "LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST=1 node --test tests/owned-callback-result-combined-packaging.test.mjs", 1);
	const reports = unpackOwnedCallbackReports(record.archive);
	await assertOwnedCallbackReportData(reports);
	assertOwnedCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
