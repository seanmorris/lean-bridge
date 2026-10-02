/**
 * Reconstruct C++ callback-owner adapters and verify complete installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { ownedCallbackResultSource, ownedCallbackResultCombinedSource } from "./owned-callback-result-fixture.mjs";
import { ownedCppCallbackBaseline, ownedCppCallbackChangedPaths
	, ownedCppCallbackHistoryPath, ownedCppCallbackHistorySha256 } from "./owned-cpp-callback-result-history.mjs";
import { assertOwnedCppCallbackResultCi, ownedCppCallbackResultReports } from "./owned-cpp-callback-result-ci.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { beforeOwnedRustCallbackResults } from "./owned-rust-callback-result-history.mjs";

export const ownedCppCallbackEvidencePath = "docs/evidence/owned-cpp-callback-results-20261002.json";
export const ownedCppCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-callback-results-20261002.json"
	, sha256: "f1e30c443a9f0b6c34035008cb5f7831a646b6f49f038d0ccbfa4edc440adb75"
});
export const ownedCppCallbackScope = Object.freeze({
	profiles: ["cpp"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true, hostReplyBeforeFrameExpiration: true
	, hostRawAndWholeReplies: true, callbackExceptionIdentity: true
	, combinedReceiverAndTransferPackages: true, explicitNoHostPackage: true
	, compiledLean: true, installedCli: true, sourceFreeConsumption: true
	, pkgConfig: true, relocatedCMake: true, deterministicArchives: true
	, allocationFaultsBeforeAndAfterTransfer: true, semanticMutants: 6
	, combinedProfiles: ["c", "cpp", "npm"]
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, installedNoHostChecks: 53, installedCombinedChecks: 76
	, modelVersion: 11, ownedGraphVersion: 6, cppContractVersion: 5
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, docker: false, installedSupportPromotions: 0
});
const addedPaths = [
	ownedCppCallbackHistoryPath
	, ...["ci", "evidence", "history"].map(name => `tests/helpers/owned-cpp-callback-result-${name}.mjs`)
	, ...["ci", "evidence", "history", "packaging", "combined-packaging"].map(name => `tests/owned-cpp-callback-result-${name}.test.mjs`)
	, "tests/owned-cpp-callback-results.test.mjs"
	, "tests/fixtures/structured-types/owned-cpp-callback-results.cpp"
	, "tests/fixtures/documentation/consumers/cpp/owned-callback-results.cpp"
];
/** Keep the earlier source coverage and include every new acceptance input. */
export const ownedCppCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedCppCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedCppCallbackPrevious.sha256);
	return [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedCppCallbackChangedPaths, ...addedPaths])].sort();
};
const hash = value => sha256(canonicalJson(value));
const digest = value => { assert.match(value, /^[a-f0-9]{64}$/u); assert.notEqual(value, "0".repeat(64)); };
const flags = (item, names) => { for(const name of names) assert.equal(item[name], true, name); };
const options = (hostCallbacks, combined) => ({
	hostCallbacks, valueCopies: true, callbackResultAnchors: true
	, anchoredResults: combined, receiverExports: combined
	, transferredInputs: combined
});
const nativeOptions = (hostCallbacks, combined) => ({
	ownedGraphs: true, ownedHostCallbacks: hostCallbacks
	, ownedCallbackResultAnchors: true, ownedAnchoredResults: combined
	, ownedReceiverExports: combined, ownedInputTransfers: combined
});
const source = async (input, mode, combined) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256
		, sha256(lean + (combined ? ownedCallbackResultCombinedSource : ownedCallbackResultSource)));
};
const probe = async (hostCallbacks, combined, installed = false) =>
	(installed ? "#define CALLBACK_RESULTS_INSTALLED 1\n" : "")
	+ `#define HOST_CALLBACKS ${Number(hostCallbacks)}\n#define COMBINED ${Number(combined)}\n`
	+ await readFile("tests/fixtures/structured-types/owned-cpp-callback-results.cpp", "utf8");
const example = async () => (await readFile("docs/consume/cpp.md", "utf8"))
	.match(/```cpp file=cpp\/owned-callback-results\.cpp\n([\s\S]*?)```/u)[1];
const graph = (model, hostCallbacks, combined, count = 4) => {
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	const signatures = model.bindingIr.types.filter(type => type.kind === "callback" && type.callable.result.ownership === "borrow")
		.map(type => ({ id: type.id, parameter: type.callable.parameters.findIndex(parameter => parameter.name === type.callable.result.lifetime.anchor) }));
	assert.equal(signatures.length, count);
	assert.deepEqual(model.ownedGraph.callbackResultAnchors.signatures, signatures);
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), hostCallbacks);
	for(const [name, length] of [["receiverExports", 4], ["resultAnchors", 1], ["inputTransfers", 1]])
		if(combined) assert.equal(model.ownedGraph[name].exports.length, length);
		else assert.equal(model.ownedGraph[name], undefined);
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
		const file = report.files.find(entry => entry.path === path);
		assert.ok(file, path);
		const bytes = Buffer.from(beforeOwnedRustCallbackResults(path, await readFile(path), file.sha256));
		assert.equal(file.bytes, bytes.length, path); assert.equal(file.sha256, sha256(bytes), path);
	}
};
const mutations = (cpp, combined) => {
	const p = cpp.c.prefix, bundle = cpp.types.find(type => type.hostName === "Bundle");
	return [
		["unchecked-result-owner", `include/${p}-values.hpp`, `checked(${p}_result_validate(state_->require(), owner));`, "(void)owner;"]
		, ["retention-shares-owner", `include/${p}-values.hpp`, "Value retain() const { return detail::ValueOps<T>::copy(get()); }", "Value retain() const { (void)get(); return *this; }"]
		, ...combined ? [
			["host-borrow-never-expires", `include/${p}-values.hpp`, "~BorrowFrame() { scope->active.store(false); }", "~BorrowFrame() {}"]
			, ["host-reply-after-expiration", `include/${p}.hpp`
				, `      owned_check${bundle.index}(owned_callback_reply(reply), 0, self.call.budget, self.call.state);`
				, `      frame.scope->active.store(false);\n      owned_check${bundle.index}(owned_callback_reply(reply), 0, self.call.budget, self.call.state);`]
			, ["host-exception-identity-erased", `include/${p}.hpp`, "if (call.error) std::rethrow_exception(call.error);", "if (call.error) throw Error(OWNED_AGGREGATES_CALLBACK_FAILED);"]
			, ["transfer-consumes-copy", `include/${p}.hpp`, "moves.add(ValueAccess::lease(a0, call.state), 0);", "moves.add(ValueAccess::lease(a0.retain(), call.state), 0);"]
		] : []
	].map(([name, path, before, after]) => {
		const original = cpp.files[path], occurrences = original.split(before).length - 1;
		assert.ok(occurrences > 0, name);
		return { name, path, occurrences, sourceSha256: sha256(original.replaceAll(before, after)), compiled: true, semanticRejection: true };
	});
};
const runtime = async (item, mode, name) => {
	const combined = name === "combined", hostCallbacks = name !== "base-nohost";
	assert.equal(item.mode, mode); assert.equal(item.name, name);
	assert.equal(item.hostCallbacks, hostCallbacks); assert.equal(item.combined, combined);
	await source(item.input, mode, combined);
	for(const [key, value] of Object.entries(options(hostCallbacks, combined))) assert.equal(item.input[key], value, key);
	const c = generateOwnedCPackage(item.input), cpp = generateOwnedCppPackage(c.layout.model.bindingIr, options(hostCallbacks, combined));
	graph(createCompiledNativeModel(item.input, nativeOptions(hostCallbacks, combined)), hostCallbacks, combined);
	assert.deepEqual(item.contract, cpp.contract); assert.equal(cpp.contract.schemaVersion, 5);
	assert.equal(item.sourceSha256, sha256(c.source)); assert.equal(item.probeSha256, sha256(await probe(hostCallbacks, combined)));
	assert.deepEqual(item.result, { checks: combined ? 2014 : hostCallbacks ? 619 : 262
		, cppFaults: hostCallbacks ? 83 : 34, nativeFaults: hostCallbacks ? 119 : 40
		, live: 0, identities: 0
		, ...combined ? { transfers: { cppBefore: 22, cppAfter: 12, nativeBefore: 18, nativeAfter: 135 } } : {} });
	assert.deepEqual(item.restored, item.result);
	assert.equal(item.sanitizer, "address,undefined"); assert.equal(typeof item.startupLeakBaseline, "string");
	assert.doesNotMatch(item.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
	assert.deepEqual(item.mutations.map(({ diagnostic, ...mutation }) => {
		assert.match(diagnostic, /owned C\+\+ callback result check failed|terminate called after throwing an instance of/u); return mutation;
	}), name === "base-host" ? [] : mutations(cpp, combined));
};
const native = async (item, input, model, receipt, manifest, hostCallbacks, combined, count = 4) => {
	await source(input, item.mode, combined);
	assert.deepEqual(model, createCompiledNativeModel({ ...input, moduleName: model.moduleName }, nativeOptions(hostCallbacks, combined)));
	graph(model, hostCallbacks, combined, count); assert.equal(model.pointerBits, 64);
	const adapters = generateCompiledNativeLeanAdapters(model);
	assert.equal(receipt.schemaVersion, 7); assert.equal(receipt.modelSha256, hash(model));
	assert.equal(receipt.metadataSha256, hash(input.metadata)); assert.equal(receipt.headerSha256, sha256(adapters.header));
	assert.equal(receipt.adaptersSha256, sha256(adapters.leanSource));
	if(hostCallbacks) assert.equal(receipt.callbackSourceSha256, sha256(adapters.callbackSource));
	else assert.equal(receipt.callbackSourceSha256, undefined);
	assert.equal(manifest.schemaVersion, 7); assert.equal(manifest.ownedValues.schemaVersion, 6);
	assert.equal(manifest.componentReceiptSha256, hash(receipt)); assert.equal(manifest.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
	for(const [name, value] of [["native-component.json", receipt], ["model.json", model], ["metadata.json", input.metadata]])
		assert.equal(manifest.files["share/lean-bridge/component/" + name].sha256, hash(value));
	assert.deepEqual(manifest.files["lib/" + receipt.library], receipt.nativeLibrary);
	for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
	{
		assert.deepEqual(receipt[key], model.ownedGraph[key]);
		assert.deepEqual(manifest.ownedValues[key], model.ownedGraph[key]);
	}
	assert.deepEqual(manifest.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	const c = generateOwnedCPackage({ ...input, ...options(hostCallbacks, combined) });
	const cpp = generateOwnedCppPackage(model.bindingIr, options(hostCallbacks, combined));
	assert.equal(manifest.ownedValues.headerSha256, sha256(c.publicHeader));
	assert.equal(manifest.ownedValues.sourceSha256, sha256(c.source));
	assert.equal(manifest.files[`include/${c.values.prefix}.h`].sha256, sha256(c.publicHeader));
	if(manifest.cppValues)
	{
		assert.deepEqual(manifest.cppValues, cpp.contract);
		for(const [path, text] of Object.entries(cpp.files).filter(([path]) => !path.startsWith("src/")))
			assert.equal(manifest.files[path].sha256, sha256(text), path);
	}
	for(const identity of Object.values(manifest.files))
	{ digest(identity.sha256); assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes > 0); }
	return { c, cpp };
};
const installed = async (item, mode, combined) => {
	assert.equal(item.mode, mode); assert.equal(item.combined, combined);
	const input = { metadata: item.metadata, sourceIdentity: item.model.sourceIdentity, component: item.model.component };
	const { c, cpp } = await native(item, input, item.model, item.receipt, item.manifest, combined, combined, combined ? 4 : 2);
	assert.deepEqual(item.adapter.cppValues, cpp.contract); assert.deepEqual(item.adapter.ownedValues, item.manifest.ownedValues);
	assert.equal(item.adapter.schemaVersion, 7);
	for(const [path, text] of Object.entries({ ...c.files, ...cpp.files }))
		assert.deepEqual(item.adapter.files[path], { bytes: Buffer.byteLength(text), sha256: sha256(text) });
	const generated = Object.keys(item.adapter.files).filter(path => /^(?:src|include)\/owned_aggregates(?:[.-]|$)/u.test(path)).sort();
	assert.equal(generated.length, 6);
	assert.deepEqual(item.tamperedSources, { generated, vendored: ["include/boost/multiprecision/cpp_int.hpp"] });
	assert.equal(item.rejected, 27); assert.equal(item.builds.length, 2);
	assert.equal(item.producerInterface, combined ? "installed-cli" : "native-build-api");
	if(combined)
	{
		await cli(item.cli); assert.equal(item.cliFilesVerified, item.cli.files.length);
		for(const build of item.builds) assert.equal(build.status, "ok");
	}
	else
	{
		assert.equal(item.cli, null); assert.equal(item.cliFilesVerified, 0);
		for(const build of item.builds) assert.equal(build.producerInterface, "native-build-api");
		assert.equal(Object.hasOwn(item.manifest.files, "share/lean-bridge/component/callbacks.c"), false);
	}
	flags(item, ["relocated", "sourceRemovedBeforeInstall", "cliRemovedBeforeConsumerInstall", "independentRebuild", "deterministicReassembly", "cmake"]);
	assert.equal(item.installed.checks, combined ? 76 : 53); flags(item.installed, ["offlineInstall", "compilerFreePath"]);
	assert.equal(item.probeSha256, sha256(await probe(combined, combined, true)));
	assert.equal(item.installed.consumerSha256, item.probeSha256);
	assert.deepEqual(item.documentation, { sourceSha256: sha256(await example()), stdout: "42\n" });
	assert.equal(item.packages.length, 1); assert.equal(item.packageSetReceipt.packages.length, 1);
};
const combinedRelease = async (item, mode) => {
	assert.equal(item.mode, mode); assert.equal(item.schemaVersion, 1);
	await cli(item.cli); assert.equal(item.cliFilesVerified, item.cli.files.length);
	flags(item, ["cmake", "cppCmake", "installedTypeScript", "sourceUnchanged", "producerAndCliRemovedBeforeInstall", "compilerFreeConsumerEnvironment"]);
	await native(item, item.nativeInput, item.native.model, item.native.receipt, item.cppManifest, true, true);
	await native(item, item.nativeInput, item.native.model, item.native.receipt, item.manifest, true, true);
	assert.deepEqual(item.cppManifest.ownedValues, item.manifest.ownedValues);
	assert.equal(item.installedCpp.checks, 76); assert.equal(item.installedC.checks, 219);
	for(const result of [item.installedCpp, item.installedC]) flags(result, ["offlineInstall", "compilerFreePath"]);
	assert.equal(item.cppProbeSha256, sha256(await probe(true, true, true)));
	assert.equal(item.installedCpp.consumerSha256, item.cppProbeSha256);
	assert.deepEqual(item.cppDocumentation, { sourceSha256: sha256(await example()), output: "42\n" });
	const cProbe = await readFile("tests/fixtures/structured-types/owned-installed-callback-results.c", "utf8");
	const cExtra = await readFile("tests/fixtures/structured-types/owned-installed-callback-combinations.c", "utf8");
	const combinedC = cProbe.replace("int main(void) {", cExtra + "\nint main(void) {")
		.replace("  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);", "  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);\n  callback_combinations(session);");
	assert.equal(item.cProbeSha256, sha256(combinedC)); assert.equal(item.installedC.consumerSha256, item.cProbeSha256);
	await source(item.wasmInput, mode, true);
	const model = createOwnedJavaScriptWasmModel({ ...item.wasmInput, ...options(true, true) });
	assert.deepEqual(item.wasm.model, model); graph(model, true, true); assert.equal(model.pointerBits, 32);
	const generated = generateCompiledJavaScriptWasmOwned(model, item.wasmInput.metadata, generateOwnedJavaScriptWasmLeanAdapters(model));
	assert.deepEqual(item.wasm.receipt.ownedGraph, generated.receipt);
	assert.equal(item.wasm.receipt.modelSha256, hash(model));
	assert.equal(item.wasm.receipt.metadataSha256, hash(item.wasmInput.metadata));
	assert.equal(item.wasm.privateAbi.version, 14);
	for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
		assert.deepEqual(item.native.model.ownedGraph[key], model.ownedGraph[key]);
	const name = `@owned/${mode}-callback-combinations`;
	for(const [path, identity] of Object.entries(item.wasm.receipt.ownedGraph.files))
		assert.equal(item.inventory[name + "/metadata/compiler/" + path].sha256, identity);
	assert.equal(item.inventory[name + "/metadata/compiler/model.json"].sha256, hash(model));
	for(const value of Object.values(item.inventory))
	{ digest(value.sha256); assert.ok(value.bytes >= 0); }
	assert.deepEqual(item.observed, { checks: 40, receiverMethods: true, transitiveExpiration: true, consumingHandoff: true, borrowedTransferRejected: true });
	flags(item.browser, ["installedSourcesRemoved", "externalNetworkBlocked"]);
	assert.deepEqual(item.browser.executions.map(value => [value.engine, value.profile])
		, ["chromium", "firefox", "webkit"].flatMap(engine => ["page", "react", "worker"].map(profile => [engine, profile])));
	const assets = [item.inventory["@lean-bridge/runtime/internal/main.wasm"].sha256, item.inventory[name + "/internal/component.so.wasm"].sha256].sort();
	for(const execution of item.browser.executions)
	{
		assert.equal(execution.checks, 40); assert.equal(execution.reruns, 2); assert.deepEqual(execution.assets, assets);
		assert.ok(typeof execution.version === "string" && execution.version.length > 0);
	}
	assert.equal(item.jsProbeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-javascript-callback-combinations.mjs")));
	const guide = await readFile("docs/javascript-typescript.md", "utf8");
	const jsExample = guide.split("### Borrowed callback results\n")[1].split("### Methods and properties\n")[0].match(/```js\n([\s\S]*?)\n```/u)[1];
	assert.deepEqual(item.documentation, { sourceSha256: sha256(jsExample), output: "42n\ntrue\n42n\n" });
	assert.equal(item.receipt.packages.length, 4); assert.equal(item.built.status, "ok");
	assert.deepEqual(item.receipt.packages.map(value => value.target).sort(), ["c", "cpp", "npm", "npm"]);
	digest(item.compilerInputsIdentity);
};

/**
 * Check one report against current generated sources and its complete oracle.
 *
 * @param path - Required repository-relative report path.
 * @param item - Complete original report data.
 */
export const assertOwnedCppCallbackReport = async (path, item) => {
	assert.ok(ownedCppCallbackResultReports.includes(path), path);
	const name = path.split("/").at(-1).slice(0, -5), mode = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const variant = name.slice(mode.length + 1);
	if(variant === "combined-release") return combinedRelease(item, mode);
	if(variant.endsWith("-package")) return installed(item, mode, variant === "combined-package");
	return runtime(item, mode, variant);
};

/**
 * Require the complete gate, source history and all twelve original reports.
 *
 * @param record - Frozen C++ callback-result acceptance record.
 */
export const assertOwnedCppCallbackAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedCppCallbackBaseline);
	assert.deepEqual(record.previous, ownedCppCallbackPrevious); assert.deepEqual(record.scope, ownedCppCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedCppCallbackHistoryPath, sha256: ownedCppCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedCppCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(beforeOwnedRustCallbackResults(path, await readFile(path), digest)), digest, path);
	assert.equal(record.run.command, "npm run test:owned-cpp-callback-results"); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 12, pass: 12, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports).sort(), [...ownedCppCallbackResultReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedCppCallbackReport(path, item);
	assertOwnedCppCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
