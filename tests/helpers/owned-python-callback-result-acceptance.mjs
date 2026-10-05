/**
 * Reconstruct Python callback-owner adapters and verify complete installed evidence.
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
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { ownedPythonCallbackResultSource as ownedCallbackResultSource
	, ownedPythonCallbackResultCombinedSource as ownedCallbackResultCombinedSource } from "./owned-python-callback-result-fixture.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { pythonPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { assertOwnedPythonCallbackResultCi, ownedPythonCallbackResultReports } from "./owned-python-callback-result-ci.mjs";
import { assertOwnedPythonCallbackRuntime } from "./owned-python-callback-result-evidence.mjs";
import { ownedPythonCallbackResultReviewedIr, ownedPythonCallbackResultCombinedReviewedIr } from "./owned-python-callback-result-fixture.mjs";
import { ownedPythonCallbackTyping } from "./owned-python-callback-result-typing.mjs";
import { ownedPythonCallbackInstalledProbe } from "./owned-python-callback-result-installed.mjs";
import { ownedPythonInstalledProbe } from "./owned-python-installed-probes.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";
import { ownedPythonCallbackBaseline, ownedPythonCallbackChangedPaths
	, ownedPythonCallbackHistoryPath, ownedPythonCallbackHistorySha256 } from "./owned-python-callback-result-history.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { beforeOwnedRubyCallbackResults } from "./owned-ruby-callback-result-history.mjs";

export const ownedPythonCallbackEvidencePath = "docs/evidence/owned-python-callback-results-20261002.json";
export const ownedPythonCallbackPrevious = Object.freeze({
	path: "docs/evidence/owned-rust-callback-results-20261002.json"
	, sha256: "5693780aae5f1641c46c2671b56c7e69aa08245fda8da71e5da492d9b55f4d7a"
});
export const ownedPythonCallbackScope = Object.freeze({
	profiles: ["python"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, callbackLocalAnchors: true, originalArgumentOwners: true
	, transitiveExpiration: true, emptyRecursiveValues: true
	, independentRetains: true, hostReplyBeforeFrameExpiration: true
	, hostRawAndWholeReplies: true, callbackExceptionIdentity: true
	, retainedTracebackCleanup: true, nativeClosureInputs: true
	, combinedReceiverAndTransferPackages: true, explicitNoHostPackage: true
	, compiledLean: true, installedCli: true, sourceFreeConsumption: true
	, offlineWheels: true, automaticSharedLoader: true, strictTyping: true
	, interpreters: ["3.11-minimum", "3.11-current", "3.12-standard"]
	, relocatedExecution: true, deterministicArchives: true
	, allocationFaultsBeforeAndAfterTransfer: true, semanticMutants: 7
	, nativeSanitizers: ["address", "undefined"]
	, sanitizerDetectors: ["address", "undefined", "leak"]
	, dynamicTlsRoots: true, clearedTlsLeakDetection: true
	, sanitizerAllocator: "malloc", coldLeakBaseline: true
	, combinedProfiles: ["c", "cpp", "cargo", "pypi", "npm"]
	, browsers: ["chromium", "firefox", "webkit"]
	, browserContexts: ["page", "react", "worker"], browserReruns: 2
	, installedNoHostChecks: 276, installedCombinedChecks: 407
	, modelVersion: 11, ownedGraphVersion: 6, pythonContractVersion: 5
	, wheelReceiptVersion: 6
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, docker: false, installedSupportPromotions: 0
});
const addedPaths = [
	ownedPythonCallbackHistoryPath
	, ...["ci", "evidence", "acceptance", "history", "fixture", "mutations", "report-mutations", "installed", "native", "sanitizers", "typing"].map(name => `tests/helpers/owned-python-callback-result-${name}.mjs`)
	, ...["ci", "evidence", "history", "runtime", "packaging", "combined-packaging"].map(name => `tests/owned-python-callback-result-${name}.test.mjs`)
	, "tests/owned-python-callback-results.test.mjs"
	, "tests/fixtures/structured-types/owned-python-callback-results.py"
	, "tests/fixtures/documentation/consumers/python/owned-callback-results.py"
	, "tests/helpers/python-graph-probes.mjs"
	, "tests/helpers/python-wheel-install.mjs"
	, "tests/helpers/owned-python-installed-probes.mjs"
	, "docs/evidence/python-callback-sanitizer-tls-20261002.md"
];
/** Keep predecessor coverage and add every new Python acceptance input. */
export const ownedPythonCallbackSourcePaths = async () => {
	const bytes = await readFile(ownedPythonCallbackPrevious.path);
	assert.equal(sha256(bytes), ownedPythonCallbackPrevious.sha256);
	return [...new Set([...Object.keys(JSON.parse(bytes).sources), ...ownedPythonCallbackChangedPaths, ...addedPaths])].sort();
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
const source = async (input, mode, combined, fixture = null) => {
	assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(input.sourceIdentity.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), input.sourceIdentity.extractorSha256)));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256
		, sha256(lean + (fixture?.source ?? (combined ? ownedCallbackResultCombinedSource : ownedCallbackResultSource))));
};
const probe = async (hostCallbacks, combined, installed = false) =>
	(installed ? "#define CALLBACK_RESULTS_INSTALLED 1\n" : "")
	+ `#define HOST_CALLBACKS ${Number(hostCallbacks)}\n#define COMBINED ${Number(combined)}\n`
	+ await readFile("tests/fixtures/structured-types/owned-cpp-callback-results.cpp", "utf8");
const example = async () => (await readFile("docs/consume/cpp.md", "utf8"))
	.match(/```cpp file=cpp\/owned-callback-results\.cpp\n([\s\S]*?)```/u)[1];
const graph = (model, hostCallbacks, combined, count = 4, fixture = null) => {
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	const signatures = model.bindingIr.types.filter(type => type.kind === "callback" && type.callable.result.ownership === "borrow")
		.map(type => ({ id: type.id, parameter: type.callable.parameters.findIndex(parameter => parameter.name === type.callable.result.lifetime.anchor) }));
	assert.equal(signatures.length, count);
	assert.deepEqual(model.ownedGraph.callbackResultAnchors.signatures, signatures);
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), hostCallbacks);
	for(const [name, length] of fixture?.exports ?? [["receiverExports", 4], ["resultAnchors", 1], ["inputTransfers", 1]])
		if(combined) assert.equal(model.ownedGraph[name].exports.length, length);
		else assert.equal(model.ownedGraph[name], undefined);
};
const cli = async report => {
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = report;
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "lean-bridge-cli-package");
	assert.equal(report.productionApproved, false); assert.equal(externalRegistryWrites, false);
	assert.equal(inventorySha256, hash(inventory)); digest(archive.sha256); assert.ok(archive.bytes > 0);
	const configPath = "config/cli-package.v1.json";
	const config = JSON.parse(beforeOwnedRubyCallbackResults(configPath, await readFile(configPath, "utf8")));
	assert.deepEqual(report.package, { name: config.name, version: config.version });
	assert.equal(new Set(report.files.map(file => file.path)).size, report.files.length);
	for(const path of config.files)
	{
		const file = report.files.find(entry => entry.path === path);
		assert.ok(file, path);
		const bytes = Buffer.from(beforeOwnedRubyCallbackResults(path, await readFile(path), file.sha256));
		assert.ok(file, path); assert.equal(file.bytes, bytes.length, path); assert.equal(file.sha256, sha256(bytes), path);
	}
};
const native = async (item, input, model, receipt, manifest, hostCallbacks, combined, count = 4, fixture = null) => {
	await source(input, item.mode, combined, fixture);
	assert.deepEqual(model, createCompiledNativeModel({ ...input, moduleName: model.moduleName }, nativeOptions(hostCallbacks, combined)));
	graph(model, hostCallbacks, combined, count, fixture); assert.equal(model.pointerBits, 64);
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
const rustPackage = async (input, model, receipt, manifest, hostCallbacks, combined, compiled, adapter, cManifest, fixture = null) => {
	const { c } = await native({ mode: input.sourceIdentity.reviewedBindingIr ? "reviewed" : "ordinary" }
		, input, model, receipt, null, hostCallbacks, combined, 4, fixture);
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

const pythonExample = async () => {
	const text = await readFile("tests/fixtures/documentation/consumers/python/owned-callback-results.py", "utf8");
	assert.equal((await readFile("docs/consume/python.md", "utf8"))
		.match(/```python file=python\/owned-callback-results\.py\n([\s\S]*?)```/u)?.[1], text);
	return text;
};
const loaderProbe = () => ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
	.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
const pythonPackage = async (input, model, receipt, manifest, combined, adapter = null, runtime = null, cManifest = null, fixture = null) => {
	const { c } = await native({ mode: input.sourceIdentity.reviewedBindingIr ? "reviewed" : "ordinary" }
		, input, model, receipt, null, combined, combined, 4, fixture);
	const generated = generateOwnedPythonPackage(model.bindingIr, null, options(combined, combined));
	assert.equal(manifest.schemaVersion, 6); assert.equal(generated.contract.schemaVersion, 5);
	assert.equal(manifest.kind, "lean-bridge-owned-python-package"); assert.equal(manifest.ecosystem, "pypi");
	assert.equal(manifest.name, "owned-callback-results"); assert.equal(manifest.version, "1.2.3");
	assert.equal(manifest.moduleName, generated.packageDir);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.runtimeIdentity, receipt.runtimeIdentity);
	assert.deepEqual(manifest.component, model.component);
	assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(manifest.ownedValues, generated.contract);
	assert.match(manifest.glibcMinimumVersion, /^2\.\d+$/u);
	assert.equal(manifest.tag, `py3-none-manylinux_${manifest.glibcMinimumVersion.replace(".", "_")}_x86_64`);
	const module = generated.packageDir, meta = `${module}/lean_bridge`, librariesRoot = `${module}/native/linux-x64/`;
	const libraries = Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => path.startsWith(librariesRoot))
		.map(([path, identity]) => [path.slice(librariesRoot.length), identity.sha256]));
	const library = `lib${c.values.prefix}.so`;
	assert.deepEqual(Object.keys(libraries).sort(), [library, receipt.library, "libgmp.so.10", "libleanshared.so", "liblean_bridge_native.so"].sort());
	assert.equal(libraries[receipt.library], receipt.nativeLibrary.sha256);
	const evidence = { runtimeIdentity: receipt.runtimeIdentity
		, componentId: model.component.id, componentReceiptSha256: hash(receipt)
		, ownedValues: generated.contract, library, libraries };
	const installed = generateOwnedPythonPackage(model.bindingIr, evidence, options(combined, combined));
	const sources = Object.fromEntries(Object.entries(installed.files)
		.map(([path, text]) => [path.startsWith(module + "/") ? path : `${meta}/${path}`, text]));
	const adapters = generateCompiledNativeLeanAdapters(model);
	for(const [path, text] of Object.entries({
		"native-component.json": canonicalJson(receipt)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "generated.lean": adapters.leanSource, "component.h": adapters.header
		, ...combined ? { "callbacks.c": adapters.callbackSource } : {}
	})) sources[`${meta}/component/${path}`] = text;
	assert.equal(Object.hasOwn(manifest.files, `${meta}/component/callbacks.c`), combined);
	sources[`${meta}/include/${c.values.prefix}.h`] = c.publicHeader;
	sources[`${meta}/internal/python-abi.h`] = generated.abiHeader;
	const dist = `${manifest.name.replaceAll("-", "_")}-${manifest.version}.dist-info`;
	const licenseFiles = ["Lean-LICENSE", "Lean-LICENSES", "LeanBridge-LICENSE", "source-notices.json"];
	assert.deepEqual(Object.keys(manifest.files).filter(path => path.startsWith(`${dist}/licenses/`))
		.map(path => path.slice(`${dist}/licenses/`.length)).sort(), licenseFiles);
	sources[`${dist}/licenses/LeanBridge-LICENSE`] = await readFile("LICENSE", "utf8");
	const typing = generated.requiresTypeAliases ? 'Requires-Dist: typing_extensions (<5,>=4.6); python_version < "3.12"\n' : "";
	const metadata = { description: "Compiled Lean API with checked resource-bearing values", ...compiledPackageMetadata(model.sourceIdentity) };
	sources[`${dist}/METADATA`] = `Metadata-Version: 2.4\nName: ${manifest.name}\nVersion: ${manifest.version}\n${pythonPackageMetadata(metadata)}\n${licenseFiles.map(path => `License-File: ${path}\n`).join("")}Requires-Python: >=3.11\n${typing}Description-Content-Type: text/markdown\n\n${installed.files["README.md"]}`;
	sources[`${dist}/WHEEL`] = `Wheel-Version: 1.0\nGenerator: lean-bridge-python-owned/5\nRoot-Is-Purelib: false\nTag: ${manifest.tag}\n`;
	sources[`${dist}/top_level.txt`] = module + "\n";
	if(runtime)
	{
		assert.equal(hash(runtime), receipt.runtimeIdentity);
		sources[`${meta}/runtime.json`] = canonicalJson(runtime);
		for(const [path, expected] of Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")))
			assert.deepEqual(manifest.files[librariesRoot + path.slice(4)], expected, path);
	}
	if(adapter)
	{
		assert.equal(adapter.schemaVersion, 7); assert.equal(adapter.ownedValues.schemaVersion, 6);
		assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
		assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.equal(adapter.componentReceiptSha256, hash(receipt));
		assert.equal(adapter.library, library); assert.deepEqual(adapter.pythonValues, generated.contract);
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers", "hostCallbacks"])
			assert.deepEqual(adapter.ownedValues[key], model.ownedGraph[key], key);
		for(const [path, text] of Object.entries({ ...c.files, "internal/python-abi.h": generated.abiHeader }))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(text), sha256: sha256(text) }, path);
		assert.equal(libraries[library], adapter.files[`lib/${library}`].sha256);
		assert.equal(libraries["libgmp.so.10"], adapter.files["gmp/lib/libgmp.so.10"].sha256);
		sources[`${meta}/native-c-adapter.json`] = canonicalJson(adapter);
		assert.deepEqual(manifest.files[`${meta}/gmp/include/gmp.h`], adapter.files["gmp/include/gmp.h"]);
		for(const [path, identity] of Object.entries(adapter.files).filter(([path]) => path.startsWith("gmp/share/lean-bridge/")))
			assert.deepEqual(manifest.files[`${meta}/${path.slice("gmp/share/lean-bridge/".length)}`], identity, path);
	}
	if(cManifest)
	{
		for(const [file, expected] of Object.entries(libraries))
			assert.equal(cManifest.files["lib/" + file].sha256, expected, file);
		assert.deepEqual(manifest.files[`${meta}/native-c-adapter.json`], cManifest.files["share/lean-bridge/native-c-adapter.json"]);
		assert.deepEqual(manifest.files[`${meta}/runtime.json`], cManifest.files["share/lean-bridge/runtime.json"]);
	}
	for(const [path, text] of Object.entries(sources))
		assert.deepEqual(manifest.files[path], { bytes: Buffer.byteLength(text), sha256: sha256(text) }, path);
	for(const identity of Object.values(manifest.files))
	{ digest(identity.sha256); assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes >= 0); }
};
const pythonObservations = async (observations, combined) => {
	assert.deepEqual(observations.map(value => value.name), ["3.11-minimum", "3.11-current", "3.12-standard"]);
	const checks = combined ? 407 : 276;
	const scenarios = ["original_owner", "independent_closure", "native_passback", "recursive_owners", "bounded_depth", "affinity", ...combined ? ["host_replies", "combined_transfers"] : []];
	for(const [index, observed] of observations.entries())
	{
		assert.equal(observed.checks, checks); assert.equal(observed.relocatedChecks, checks);
		assert.deepEqual(observed.scenarios, scenarios);
		assert.deepEqual(observed.loader, {
			compatibleImports: 5, concurrentImports: 4
			, conflictingRuntimeRejected: true, forkWithHeldLockRejected: true
			, componentInitializations: 1, runtimeInitializations: 1, liveIdentities: 0
			, consumer: { checks, scenarios, ordinaryImport: true }
		});
		assert.equal(observed.installation.resolvedOffline, true);
		assert.deepEqual(observed.installation.requires, ['typing_extensions (<5,>=4.6); python_version < "3.12"']);
		assert.match(observed.installation.python, index === 2 ? /^3\.12\.\d+$/u : /^3\.11\.\d+$/u);
		if(index === 2) assert.equal(observed.installation.dependency, null);
		else
		{
			const version = index === 0 ? "4.6.0" : "4.16.0";
			assert.deepEqual(observed.installation.dependency, {
				name: "typing_extensions", version
				, archive: `typing_extensions-${version}-py3-none-any.whl`
				, bytes: index === 0 ? 30680 : 45571, sha256: pythonTypingWheels[version]
			});
		}
		assert.deepEqual(observed.documentation, { sourceSha256: sha256(await pythonExample()), stdout: "42\n42\n" });
	}
};
const installed = async (item, mode, combined) => {
	assert.equal(item.mode, mode); assert.equal(item.combined, combined);
	const input = { metadata: item.metadata, sourceIdentity: item.model.sourceIdentity, component: item.model.component };
	flags(item, ["sourceRemovedBeforeInstall", "cliRemovedBeforeConsumerInstall"
		, "independentRebuild", "deterministicReassembly", "sourceFreeInstallation"
		, "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"]);
	assert.equal(item.rejected, 21); assert.equal(item.incapableReadersRejected, combined ? 5 : 1);
	assert.equal(item.consumerSha256, sha256(await ownedPythonCallbackInstalledProbe(combined)));
	assert.equal(item.loaderProbeSha256, sha256(loaderProbe()));
	await pythonObservations(item.observations, combined);
	const invalid = 'import lean_owned_aggregates as api\ndef invalid(root: api.Value[api.Bundle], ticket: api.Value[api.Ticket]) -> None:\n    callback = api.make_record(root.get())\n    callback(False, root.get())\n    callback(False, ticket)\n    wrong: api.Bundle = callback(False, root)\n';
	for(const observed of item.observations)
	{
		await pythonPackage(input, item.model, item.componentReceipt, observed.manifest, combined, item.adapter, item.runtime);
		assert.equal(observed.rejectedTypes, 3); assert.equal(observed.invalidSha256, sha256(invalid));
	}
	assert.equal(item.packages.length, 1); assert.equal(item.builds.length, 2);
	const pkg = item.packages[0], manifest = item.observations[0].manifest;
	assert.equal(pkg.name, manifest.name); assert.equal(pkg.version, manifest.version);
	assert.equal(pkg.tag, manifest.tag);
	assert.equal(pkg.archive, `${pkg.name.replaceAll("-", "_")}-${pkg.version}-${pkg.tag}.whl`);
	digest(pkg.sha256); assert.ok(pkg.bytes > 0); assert.equal(pkg.compilerAccess, false);
	await cli(item.cli);
	assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
	assert.equal(item.verification.status, "ok"); assert.equal(item.verification.result.verified, true);
	assert.equal(item.verification.result.verificationType, "local-package-set");
	assert.equal(item.packageSetReceipt.packages.length, 1);
	assert.equal(item.packageSetReceipt.packages[0].target, "pypi");
	assert.equal(item.packageSetReceipt.packages[0].artifacts[0].sha256, pkg.sha256);
	assert.equal(item.producerInterface, combined ? "installed-cli" : "native-build-api");
	for(const build of item.builds)
	{
		if(combined)
		{
			assert.equal(build.status, "ok"); assert.deepEqual(build.result.targets, ["pypi"]);
			assert.deepEqual(build.result.packages, item.packages);
		}
		else
		{
			assert.equal(build.producerInterface, "native-build-api"); assert.equal(build.projections.length, 1);
			assert.deepEqual(build.projections[0].packages, item.packages);
		}
	}
};
const typing = async item => {
	const expected = [];
	for(const name of ["no-host", "host", "combined"])
	{
		const combined = name === "combined", hostCallbacks = name !== "no-host";
		const ir = (combined ? ownedPythonCallbackResultCombinedReviewedIr : ownedPythonCallbackResultReviewedIr)();
		const generated = generateOwnedPythonPackage(ir, null, options(hostCallbacks, combined));
		const { positive, invalid, wrong } = ownedPythonCallbackTyping({ hostCallbacks, combined });
		for(const [interpreter, version] of [["3.11-minimum", "4.6.0"], ["3.11-current", "4.16.0"], ["3.12-standard", null]])
			expected.push({ variant: name, name: interpreter, typing: version
				, rejected: wrong.map((_, index) => index + 5)
				, positiveSha256: sha256(positive), invalidSha256: sha256(invalid)
				, stubSha256: sha256(generated.stub) });
	}
	assert.deepEqual(item, { observations: expected });
};
/**
 * Reconstruct the C/C++/Cargo/PyPI/npm portion of one installed release.
 *
 * @param item - Complete combined-release report.
 * @param mode - Ordinary source or reviewed IR.
 * @param additionalTargets - Other package targets verified by the calling reader.
 * @param fixture - Explicit source, counts and CLI verifier for a larger fixture.
 */
export const assertOwnedPythonCallbackCombinedRelease = async (item, mode, additionalTargets = [], fixture = null) => {
	assert.equal(item.mode, mode); assert.equal(item.schemaVersion, 1);
	await (fixture?.cli ?? cli)(item.cli); assert.equal(item.cliFilesVerified, item.cli.files.length);
	flags(item, ["cmake", "cppCmake", "installedTypeScript", "sourceUnchanged", "producerAndCliRemovedBeforeInstall", "compilerFreeConsumerEnvironment"]);
	await native(item, item.nativeInput, item.native.model, item.native.receipt, item.cppManifest, true, true, 4, fixture);
	await native(item, item.nativeInput, item.native.model, item.native.receipt, item.manifest, true, true, 4, fixture);
	assert.deepEqual(item.cppManifest.ownedValues, item.manifest.ownedValues);
	await pythonObservations(item.installedPython, true);
	for(const observed of item.installedPython)
	{
		await pythonPackage(item.nativeInput, item.native.model, item.native.receipt, observed.manifest, true, null, null, item.manifest, fixture);
		flags(observed, ["sourceFreeInstallation", "cliRemovedBeforeConsumerInstall", "sourceFreeRelocatedExecution", "handoffRemovedBeforeRelocatedExecution"]);
		assert.equal(observed.consumerSha256, sha256(await ownedPythonCallbackInstalledProbe(true)));
		assert.equal(observed.loaderProbeSha256, sha256(loaderProbe()));
	}
	assert.equal(item.installedCpp.checks, 76); assert.equal(item.installedC.checks, 219);
	for(const result of [item.installedCpp, item.installedC]) flags(result, ["offlineInstall", "compilerFreePath"]);
	assert.equal(item.cppProbeSha256, sha256(await probe(true, true, true)));
	assert.equal(item.installedCpp.consumerSha256, item.cppProbeSha256);
	assert.deepEqual(item.cppDocumentation, { sourceSha256: sha256(await example()), output: "42\n" });
	const lock = await rustPackage(item.nativeInput, item.native.model, item.native.receipt, item.rustManifest, true, true, null, null, item.manifest, fixture);
	const rust = item.installedRust;
	assert.equal(rust.checks, 118); assert.equal(rust.relocatedChecks, 118); assert.equal(rust.reruns, 2);
	flags(rust, ["offlineInstall", "emptyCargoHome", "linkOnly", "sourceFreeRelocatedExecution", "handoffRemovedBeforeExecution"]);
	assert.equal(rust.consumerSha256, sha256(await rustProbe())); assert.equal(rust.linkerSha256, sha256(ownedRustReceiverLinker));
	dependencies(rust.dependencies, lock);
	assert.deepEqual(item.rustDocumentation, { sourceSha256: sha256(await rustExample()), output: "42\n" });
	const cProbe = await readFile("tests/fixtures/structured-types/owned-installed-callback-results.c", "utf8");
	const cExtra = await readFile("tests/fixtures/structured-types/owned-installed-callback-combinations.c", "utf8");
	let combinedC = cProbe.replace("int main(void) {", cExtra + "\nint main(void) {")
		.replace("  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);", "  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);\n  callback_combinations(session);");
	if(fixture?.cProbe) combinedC = fixture.cProbe(combinedC);
	assert.equal(item.cProbeSha256, sha256(combinedC)); assert.equal(item.installedC.consumerSha256, item.cProbeSha256);
	await source(item.wasmInput, mode, true, fixture);
	const model = createOwnedJavaScriptWasmModel({ ...item.wasmInput, ...options(true, true) });
	assert.deepEqual(item.wasm.model, model); graph(model, true, true, 4, fixture); assert.equal(model.pointerBits, 32);
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
	assert.equal(item.receipt.packages.length, 6 + additionalTargets.length); assert.equal(item.built.status, "ok");
	assert.deepEqual(item.receipt.packages.map(value => value.target).sort(), ["c", "cargo", "cpp", "npm", "npm", "pypi", ...additionalTargets].sort());
	digest(item.compilerInputsIdentity);
};

/**
 * Check each original Python report against current generated code and callers.
 *
 * @param path - Required repository-relative report path.
 * @param item - Complete executed report.
 */
export const assertOwnedPythonCallbackReport = async (path, item) => {
	assert.ok(ownedPythonCallbackResultReports.includes(path), path);
	const name = path.split("/").at(-1).slice(0, -5);
	if(name === "typing") return typing(item);
	if(name.startsWith("runtime-"))
	{
		assert.equal(name, `runtime-${item.mode}-${item.name}`);
		return assertOwnedPythonCallbackRuntime(item);
	}
	const mode = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const variant = name.slice(mode.length + 1);
	if(variant === "combined-release") return assertOwnedPythonCallbackCombinedRelease(item, mode);
	return installed(item, mode, variant === "combined-package");
};

/**
 * Require the complete gate, unchanged predecessors and all thirteen reports.
 *
 * @param record - Frozen Python callback-result acceptance.
 */
export const assertOwnedPythonCallbackAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-python-callback-results");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.equal(record.baselineRevision, ownedPythonCallbackBaseline);
	assert.deepEqual(record.previous, ownedPythonCallbackPrevious); assert.deepEqual(record.scope, ownedPythonCallbackScope);
	assert.deepEqual(record.sourceHistory, { path: ownedPythonCallbackHistoryPath, sha256: ownedPythonCallbackHistorySha256 });
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), await ownedPythonCallbackSourcePaths());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(beforeOwnedRubyCallbackResults(path, await readFile(path), digest)), digest, path);
	assert.equal(record.run.command, "npm run test:owned-python-callback-results"); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 13, pass: 13, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(Object.keys(reports).sort(), [...ownedPythonCallbackResultReports].sort());
	for(const [path, item] of Object.entries(reports)) await assertOwnedPythonCallbackReport(path, item);
	assertOwnedPythonCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
