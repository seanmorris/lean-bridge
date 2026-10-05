/**
 * Reconstruct Rust callback-owner adapters and verify complete installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { compiledPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { ownedRustReceiverLinker } from "./owned-rust-receiver-fixture.mjs";
import { assertOwnedRustCallbackRuntime } from "./owned-rust-callback-result-evidence.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { ownedRustCallbackResultSource as ownedCallbackResultSource
	, ownedRustCallbackResultCombinedSource as ownedCallbackResultCombinedSource } from "./owned-rust-callback-result-fixture.mjs";
import { ownedRustCallbackBaseline, ownedRustCallbackChangedPaths
	, ownedRustCallbackHistoryPath, ownedRustCallbackHistorySha256 } from "./owned-rust-callback-result-history.mjs";
import { assertOwnedRustCallbackResultCi, ownedRustCallbackResultReports } from "./owned-rust-callback-result-ci.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { beforeOwnedPythonCallbackResults } from "./owned-python-callback-result-history.mjs";

export const ownedRustCallbackEvidencePath = "docs/evidence/owned-rust-callback-results-20261002.json";
export const ownedRustCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-cpp-callback-results-20261002.json"
	, sha256: "c73d31a18b168626bca6e1087b485f4af4b39b86bb7d110e1429aea6b13009a7"
});
export const ownedRustCallbackScope = Object.freeze({
	profiles: ["rust"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true, hostReplyBeforeFrameExpiration: true
	, hostRawAndWholeReplies: true, callbackPanicIdentity: true
	, sealedHostReplies: true, nativeClosureInputs: true
	, combinedReceiverAndTransferPackages: true, explicitNoHostPackage: true
	, compiledLean: true, installedCli: true, sourceFreeConsumption: true
	, offlineCargo: true, emptyCargoHome: true, linkOnly: true
	, relocatedExecution: true, deterministicArchives: true
	, allocationFaultsBeforeAndAfterTransfer: true, semanticMutants: 7
	, combinedProfiles: ["c", "cpp", "cargo", "npm"]
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, installedNoHostChecks: 93, installedCombinedChecks: 118
	, modelVersion: 11, ownedGraphVersion: 6, rustContractVersion: 5
	, cargoReceiptVersion: 6
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, docker: false, installedSupportPromotions: 0
});
const addedPaths = [
	ownedRustCallbackHistoryPath
	, ...["ci", "evidence", "acceptance", "history", "fixture", "mutations"].map(name => `tests/helpers/owned-rust-callback-result-${name}.mjs`)
	, ...["ci", "evidence", "history", "runtime", "packaging", "combined-packaging"].map(name => `tests/owned-rust-callback-result-${name}.test.mjs`)
	, "tests/owned-rust-callback-results.test.mjs"
	, "tests/fixtures/structured-types/owned-rust-callback-results.rs"
	, "tests/fixtures/documentation/consumers/rust/owned-callback-results.rs"
	, "tests/helpers/type-corpus-rust.mjs"
	, "tests/helpers/type-corpus-rust-source.mjs"
	, "tests/helpers/type-corpus-compiler.mjs"
	, "tests/fixtures/type-corpus/cases.mjs"
];
/** Keep the earlier source coverage and include every new acceptance input. */
export const ownedRustCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedRustCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedRustCallbackPrevious.sha256);
	return [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedRustCallbackChangedPaths, ...addedPaths])].sort();
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
	assert.equal(input.sourceIdentity.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), input.sourceIdentity.extractorSha256)));
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
	const configPath = "config/cli-package.v1.json";
	const config = JSON.parse(beforeOwnedPythonCallbackResults(configPath, await readFile(configPath, "utf8")));
	assert.deepEqual(report.package, { name: config.name, version: config.version });
	assert.equal(new Set(report.files.map(file => file.path)).size, report.files.length);
	for(const path of config.files)
	{
		const file = report.files.find(entry => entry.path === path);
		assert.ok(file, path);
		const bytes = Buffer.from(beforeOwnedPythonCallbackResults(path, await readFile(path), file.sha256));
		assert.ok(file, path); assert.equal(file.bytes, bytes.length, path); assert.equal(file.sha256, sha256(bytes), path);
	}
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
	const c = generateOwnedCPackage({ ...input, ...options(hostCallbacks, combined) });
	const cpp = generateOwnedCppPackage(model.bindingIr, options(hostCallbacks, combined));
	if(!manifest) return { c, cpp };
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
const rustProbe = async () => "use owned_callback_results::*;\n"
	+ await readFile("tests/fixtures/structured-types/owned-rust-callback-results.rs", "utf8");
const rustExample = async () => {
	const text = await readFile("tests/fixtures/documentation/consumers/rust/owned-callback-results.rs", "utf8");
	assert.equal((await readFile("docs/consume/rust.md", "utf8"))
		.match(/```rust file=rust\/owned-callback-results\.rs\n([\s\S]*?)```/u)?.[1], text);
	return text;
};
const rustPackage = async (input, model, receipt, manifest, hostCallbacks, combined, compiled, adapter, cManifest) => {
	const { c } = await native({ mode: input.sourceIdentity.reviewedBindingIr ? "reviewed" : "ordinary" }
		, input, model, receipt, null, hostCallbacks, combined);
	const rustOptions = options(hostCallbacks, combined);
	const contract = generateOwnedRustPackage(model.bindingIr, null, {}, rustOptions).contract;
	assert.equal(manifest.schemaVersion, 6); assert.equal(contract.schemaVersion, 5);
	assert.equal(manifest.kind, "lean-bridge-owned-cargo-package"); assert.equal(manifest.ecosystem, "cargo");
	assert.equal(manifest.name, "owned-callback-results"); assert.equal(manifest.version, "1.2.3");
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.runtimeIdentity, receipt.runtimeIdentity);
	assert.deepEqual(manifest.component, model.component);
	assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(manifest.ownedValues, contract);
	const libraries = Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => path.startsWith("native/linux-x64/"))
		.map(([path, identity]) => [path.slice("native/linux-x64/".length), identity.sha256]));
	const library = `lib${c.values.prefix}.so`;
	assert.deepEqual(Object.keys(libraries).sort(), [library, receipt.library, "libgmp.so.10", "libleanshared.so", "liblean_bridge_native.so"].sort());
	assert.equal(libraries[receipt.library], receipt.nativeLibrary.sha256);
	const evidence = { runtimeIdentity: receipt.runtimeIdentity
		, componentId: model.component.id, componentReceiptSha256: hash(receipt)
		, ownedValues: contract, library, libraries };
	const generated = generateOwnedRustPackage(model.bindingIr, evidence, {
		name: manifest.name, version: manifest.version
		, metadata: compiledPackageMetadata(model.sourceIdentity)
	}, rustOptions);
	const lock = await copiedRustLock(manifest.name, manifest.version);
	const license = await readFile("LICENSE", "utf8");
	const packageSources = { ...generated.files, "Cargo.lock": lock
		, "lean-bridge/licenses/LeanBridge-LICENSE": license };
	for(const [path, text] of Object.entries(packageSources))
	{
		const identity = { bytes: Buffer.byteLength(text), sha256: sha256(text) };
		assert.deepEqual(manifest.files[path], identity, path);
		if(compiled) assert.deepEqual(compiled.files[path], identity, path);
	}
	const adapters = generateCompiledNativeLeanAdapters(model);
	for(const [path, text] of Object.entries({
		"native-component.json": canonicalJson(receipt)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "generated.lean": adapters.leanSource, "component.h": adapters.header
		, ...hostCallbacks ? { "callbacks.c": adapters.callbackSource } : {}
	})) assert.deepEqual(manifest.files["lean-bridge/component/" + path], { bytes: Buffer.byteLength(text), sha256: sha256(text) }, path);
	assert.equal(Object.hasOwn(manifest.files, "lean-bridge/component/callbacks.c"), hostCallbacks);
	if(compiled)
	{
		assert.equal(compiled.schemaVersion, 6); assert.equal(compiled.profile, "native-library-v1");
		assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
		assert.equal(compiled.name, manifest.name); assert.equal(compiled.version, manifest.version);
		assert.match(compiled.rustc, /^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u);
		assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, contract);
		assert.equal(manifest.compiledProjectionSha256, hash(compiled));
		assert.equal(manifest.files["lean-bridge/native-rust.json"].sha256, hash(compiled));
		assert.deepEqual(Object.keys(compiled.files).sort(), [
			...Object.keys(generated.files), "Cargo.lock"
			, "lean-bridge/licenses/LeanBridge-LICENSE"
			, ...Object.keys(libraries).map(file => "native/linux-x64/" + file)].sort());
		for(const [path, identity] of Object.entries(compiled.files)) assert.deepEqual(manifest.files[path], identity, path);
	}
	if(adapter)
	{
		assert.equal(adapter.schemaVersion, 7); assert.equal(adapter.ownedValues.schemaVersion, 6);
		assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
		assert.equal(adapter.componentReceiptSha256, hash(receipt));
		assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.library, library); assert.deepEqual(adapter.rustValues, contract);
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers", "hostCallbacks"])
			assert.deepEqual(adapter.ownedValues[key], model.ownedGraph[key], key);
		for(const [path, text] of Object.entries({ ...c.files, "internal/rust-abi.h": generated.abiHeader }))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(text), sha256: sha256(text) }, path);
		assert.equal(libraries[library], adapter.files["lib/" + library].sha256);
		assert.equal(libraries["libgmp.so.10"], adapter.files["gmp/lib/libgmp.so.10"].sha256);
		assert.equal(manifest.files["lean-bridge/native-c-adapter.json"].sha256, hash(adapter));
	}
	if(cManifest) for(const [file, expected] of Object.entries(libraries))
		assert.equal(cManifest.files["lib/" + file].sha256, expected, file);
	for(const identity of Object.values(manifest.files))
	{ digest(identity.sha256); assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes > 0); }
	return lock;
};
const dependencies = (item, lock) => {
	assert.equal(item.archive, "rust-dependencies.tar.gz"); digest(item.sha256);
	assert.equal(item.lockSha256, sha256(lock));
	const packages = lock.split("[[package]]").slice(1).filter(block => /^source = "registry\+/mu.test(block)).map(block => ({
		directory: block.match(/^name = "([^"]+)"/mu)[1] + "-" + block.match(/^version = "([^"]+)"/mu)[1]
		, checksum: block.match(/^checksum = "([^"]+)"/mu)[1]
	})).sort((left, right) => left.directory.localeCompare(right.directory));
	assert.deepEqual(item.packages.map(({ directory, checksum, files, manifestSha256 }) => {
		assert.ok(Number.isSafeInteger(files) && files > 0); digest(manifestSha256);
		return { directory, checksum };
	}), packages);
};
const installed = async (item, mode, combined) => {
	assert.equal(item.mode, mode); assert.equal(item.combined, combined); assert.equal(item.hostCallbacks, combined);
	const input = { metadata: item.metadata, sourceIdentity: item.model.sourceIdentity, component: item.model.component };
	const lock = await rustPackage(input, item.model, item.receipt, item.manifest, combined, combined, item.compiled, item.adapter);
	dependencies(item.dependencies, lock);
	flags(item, ["sourceRemovedBeforeInstall", "cliRemovedBeforeConsumerInstall"
		, "independentRebuild", "deterministicReassembly", "sourceFreeInstallation"
		, "emptyCargoHome", "offlineInstall"
		, "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"]);
	assert.equal(item.checks, combined ? 118 : 93); assert.equal(item.relocatedChecks, item.checks);
	assert.equal(item.rejected, 21); assert.equal(item.incapableReadersRejected, combined ? 5 : 1);
	assert.equal(item.consumerSha256, sha256(await rustProbe()));
	assert.equal(item.linkerSha256, sha256(ownedRustReceiverLinker));
	assert.deepEqual(item.documentation, { sourceSha256: sha256(await rustExample()), stdout: "42\n" });
	assert.equal(item.builds.length, 2); assert.equal(item.packages.length, 1);
	for(const pkg of item.packages)
	{
		assert.equal(pkg.name, item.manifest.name); assert.equal(pkg.version, item.manifest.version);
		assert.equal(pkg.archive, `${pkg.name}-${pkg.version}.crate`);
		assert.ok(pkg.bytes > 0); digest(pkg.sha256); assert.equal(pkg.compilerAccess, false);
	}
	if(combined)
	{
		await cli(item.cli);
		assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
		assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verificationType, "local-package-set");
		assert.equal(item.verification.result.verified, true);
		for(const build of item.builds)
		{
			assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["cargo"]);
			assert.deepEqual(build.result.packages, item.packages);
		}
	}
	else
	{
		assert.equal(item.cli, null); assert.equal(item.cliInstallation, null); assert.equal(item.verification, null);
		for(const build of item.builds)
		{
			assert.equal(build.producerInterface, "native-build-api"); assert.equal(build.projections.length, 1);
			assert.deepEqual(build.projections[0].packages, item.packages);
		}
	}
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
	const lock = await rustPackage(item.nativeInput, item.native.model, item.native.receipt, item.rustManifest, true, true, null, null, item.manifest);
	const rust = item.installedRust;
	assert.equal(rust.checks, 118); assert.equal(rust.relocatedChecks, 118); assert.equal(rust.reruns, 2);
	flags(rust, ["offlineInstall", "emptyCargoHome", "linkOnly", "sourceFreeRelocatedExecution", "handoffRemovedBeforeExecution"]);
	assert.equal(rust.consumerSha256, sha256(await rustProbe())); assert.equal(rust.linkerSha256, sha256(ownedRustReceiverLinker));
	dependencies(rust.dependencies, lock);
	assert.deepEqual(item.rustDocumentation, { sourceSha256: sha256(await rustExample()), output: "42\n" });
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
	assert.equal(item.receipt.packages.length, 5); assert.equal(item.built.status, "ok");
	assert.deepEqual(item.receipt.packages.map(value => value.target).sort(), ["c", "cargo", "cpp", "npm", "npm"]);
	digest(item.compilerInputsIdentity);
};

/**
 * Check one report against current generated sources and its complete oracle.
 *
 * @param path - Required repository-relative report path.
 * @param item - Complete original report data.
 */
export const assertOwnedRustCallbackReport = async (path, item) => {
	assert.ok(ownedRustCallbackResultReports.includes(path), path);
	const name = path.split("/").at(-1).slice(0, -5), mode = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const variant = name.slice(mode.length + 1);
	if(variant === "combined-release") return combinedRelease(item, mode);
	if(variant.endsWith("-package")) return installed(item, mode, variant === "combined-package");
	assert.equal(item.mode, mode); assert.equal(item.name, variant);
	return assertOwnedRustCallbackRuntime(item);
};

/**
 * Require the complete gate, source history and all twelve original reports.
 *
 * @param record - Frozen Rust callback-result acceptance record.
 */
export const assertOwnedRustCallbackAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-rust-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedRustCallbackBaseline);
	assert.deepEqual(record.previous, ownedRustCallbackPrevious); assert.deepEqual(record.scope, ownedRustCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedRustCallbackHistoryPath, sha256: ownedRustCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedRustCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(beforeOwnedPythonCallbackResults(path, await readFile(path), digest)), digest, path);
	assert.equal(record.run.command, "npm run test:owned-rust-callback-results"); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 13, pass: 13, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports).sort(), [...ownedRustCallbackResultReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedRustCallbackReport(path, item);
	assertOwnedRustCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
