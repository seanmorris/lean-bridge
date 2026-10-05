/**
 * Reconstruct recursive WIT packages from original compiler and runtime receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { nativeGraphProjectionSources } from "../../src/build/native-graph-sources.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { compileCallableWitGraphPackageModel } from "../../src/backends/wit/callable-graph-package.mjs";
import { renderWitGraphCallableHostSource } from "../../src/backends/wit/callable-graph-host.mjs";
import { guardWitHostSource, witHostDependencies } from "../../src/backends/wit/host-evidence.mjs";
import { witRecursiveCallableDocumentation } from "./wit-recursive-callable-docs.mjs";
import { witRecursiveMixedFixture, witRecursivePrimitiveConsumer } from "./wit-recursive-callable-mixed.mjs";
import { witRecursiveCallableValues } from "./wit-recursive-callable-values.mjs";
import { witRecursiveCallableMalformed, witRecursiveResultFaultModes } from "./wit-recursive-callable-malformed.mjs";

const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const flags = (value, keys) => { for(const key of keys) assert.equal(value[key], true, key); };
const inventory = files => {
	assert.ok(Object.keys(files).length);
	for(const [path, entry] of Object.entries(files))
	{
		assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); hash(entry.sha256);
	}
};

export const witRecursiveTypedObservation = {
	typed: true, callbacks: 4, releases: 1, owned: true
	, activeClose: true, independentResult: true
};
export const witRecursiveValueObservation = {
	aliases: 2, callbacks: 758, checks: 8546, nestedCases: 7, optionCases: 7
	, rejections: 540, releases: 110, resultCases: 15, shapes: 9
};
export const witRecursivePrimitiveObservation = {
	callbacks: 4664, calls: 4905, finalized: 3199, nativeIdentities: 0
	, primitives: 19, variants: 114, wideUnit: 1
};

/**
 * Require compiler-authenticated source semantics before reading a projection.
 *
 * @param run - Original model, metadata and compilation receipt.
 */
export const assertWitRecursiveCompilerReceipt = run => {
	const { model, metadata, receipt } = run;
	assert.deepEqual(model, createCompiledNativeModel({ metadata, component: model.component, moduleName: model.moduleName, sourceIdentity: receipt.sourceIdentity }));
	assert.equal(receipt.profile, "native-library-v1"); assert.equal(receipt.schemaVersion, 2);
	assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
	assert.equal(receipt.metadataSha256, sha256(canonicalJson(metadata)));
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	const adapters = generateCompiledNativeLeanAdapters(model);
	assert.equal(receipt.headerSha256, sha256(adapters.header));
	assert.equal(receipt.adaptersSha256, sha256(adapters.leanSource));
	assert.equal(receipt.initializer, `initialize_${adapters.module}`);
	return adapters;
};

/**
 * Check immutable installed files, original identities and independent callers.
 *
 * @param report - Both source paths of the original package acceptance run.
 * @param mixed - Include the nineteen-primitive and sixteen-argument companions.
 */
export const assertWitRecursiveCallablePackages = async (report, mixed = false) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.mixed, mixed);
	flags(report, ["compiledLean", "installedPackage"]);
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	const documentation = await witRecursiveCallableDocumentation();
	const source = mixed ? (await witRecursiveMixedFixture(documentation.source)).source : documentation.source;
	const fixture = await readFile("tests/fixtures/structured-callable-consumers/wit-recursive-typed.c", "utf8");
	for(const run of report.observations)
	{
		flags(run, ["checkedSourceUnchanged", "witOnly", "deterministicReassembly", "compilerFreeReassembly"]);
		assert.equal(run.rejectsRegeneratedSourceDrift, 9);
		assert.equal(run.exports, mixed ? 99 : 33); assert.equal(run.callbacks, mixed ? 59 : 18);
		assert.equal(run.sourceSha256, sha256(source));
		const producerSources = Object.fromEntries(run.producerSources.map(file => [file.path, file.sha256]));
		assert.equal(Object.keys(producerSources).length, run.producerSources.length);
		for(const value of Object.values(producerSources)) hash(value);
		assert.equal(producerSources["Structured.lean"], sha256(source));
		assert.deepEqual(run.documentation, {
			authorSha256: sha256(documentation.author)
			, configurationSha256: sha256(documentation.configuration)
			, consumerSha256: sha256(documentation.example.source)
			, standaloneLeanChecked: true, compiledVerbatim: true
		});
		const { model, receipt, adapter, runtime, runtimeIdentity, installed } = run;
		const lean = assertWitRecursiveCompilerReceipt(run);
		assert.equal(model.schemaVersion, run.reviewed ? 5 : 4);
		assert.equal(model.exports.length, run.exports); assert.equal(model.copiedGraph.callbacks.length, run.callbacks);
		assert.equal(receipt.sourceIdentity.modules[0].source.sha256, run.sourceSha256);
		assert.equal(receipt.runtimeIdentity, runtimeIdentity); assert.equal(runtimeIdentity, sha256(canonicalJson(runtime)));
		assert.equal(receipt.bindingIrSha256, run.bindingIrSha256); assert.equal(receipt.nativeLibrary.sha256, run.binarySha256);
		const projection = compileCallableWitGraphPackageModel(model.bindingIr, { name: "structured", version: "1.0.0" });
		assert.equal(projection.layoutSha256, run.layoutSha256); assert.equal(adapter.copiedGraph.layoutSha256, run.layoutSha256);
		assert.equal(projection.manifest.backend, "ordinary-wit-native-callable-graph-v1");
		assert.equal(projection.functions.length, run.exports); assert.equal(projection.callbacks.size, run.callbacks);
		assert.equal(adapter.bindingIrSha256, run.bindingIrSha256); assert.equal(adapter.runtimeIdentity, runtimeIdentity);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(receipt)));
		assert.equal(adapter.gmp, undefined);
		for(const [path, text] of Object.entries(nativeGraphProjectionSources(model, receipt))) assert.deepEqual(adapter.files[path], identity(text), path);
		const { packageReceipt, compiled, probes } = installed, files = packageReceipt.files;
		for(const map of [files, compiled.files, compiled.wasmtime.files, runtime.files, run.componentFiles, adapter.files, installed.libraries]) inventory(map);
		flags(installed, ["sourceFreeInstallation", "compilerFreeExecution", "sourceAndHandoffRemovedBeforeExecution", "publicHeadersOnly", "offline", "nodelete"]);
		assert.equal(installed.repeatExecutions, 2);
		assert.equal(packageReceipt.kind, "lean-bridge-ordinary-wit-package");
		assert.equal(packageReceipt.glibcMinimumVersion, "2.38");
		assert.equal(packageReceipt.runtimeIdentity, runtimeIdentity); assert.equal(packageReceipt.bindingIrSha256, run.bindingIrSha256);
		assert.deepEqual(packageReceipt.sourceIdentity, model.sourceIdentity);
		assert.equal(compiled.profile, "native-wit-v1"); assert.equal(compiled.library, "libstructured_wasmtime.so");
		assert.equal(compiled.component, "component/structured.wasm"); assert.equal(compiled.glibcMinimumVersion, "2.38");
		assert.deepEqual(compiled.settings, { name: "structured", version: "1.0.0" });
		assert.equal(compiled.runtimeIdentity, runtimeIdentity); assert.equal(compiled.bindingIrSha256, run.bindingIrSha256);
		assert.equal(compiled.componentReceiptSha256, sha256(canonicalJson(receipt)));
		assert.equal(compiled.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.deepEqual(Object.fromEntries(Object.keys(wasmtimeCapiIdentity).map(key => [key, compiled.wasmtime[key]])), wasmtimeCapiIdentity);
		assert.equal(sha256(canonicalJson(compiled.wasmtime.files)), wasmtimeCapiIdentity.filesSha256);
		assert.match(compiled.wasmTools, /^wasm-tools 1\.245\.1(?: |$)/u);
		const component = Buffer.from(installed.componentBase64, "base64");
		assert.equal(component.toString("base64"), installed.componentBase64);
		assert.deepEqual(compiled.files[compiled.component], identity(component));
		assert.equal(packageReceipt.componentSha256, sha256(component));
		const generated = {
			"wit/structured.wit": projection.wit
			, "component/structured.wat": projection.wat
			, "include/structured_wasmtime.h": projection.hostHeader
			, "binding-manifest.json": canonicalJson(projection.manifest)
			, "src/structured_wasmtime.c": guardWitHostSource(renderWitGraphCallableHostSource(projection, component), projection.prefix, witHostDependencies(run, compiled.wasmtime.files))
		};
		for(const [path, text] of Object.entries(generated)) assert.deepEqual(compiled.files[path], identity(text), path);
		for(const [path, file] of Object.entries(compiled.files))
			assert.deepEqual(files[path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path], file, path);
		for(const [path, file] of Object.entries(compiled.wasmtime.files)) assert.deepEqual(compiled.files["wasmtime/" + path], file, path);
		const sources = {
			"model.json": canonicalJson(model)
			, "metadata.json": canonicalJson(run.metadata)
			, "binding-ir.json": canonicalJson(model.bindingIr)
			, "native-component.json": canonicalJson(receipt)
			, "component.h": lean.header, "generated.lean": lean.leanSource
		};
		for(const [path, text] of Object.entries(sources))
		{
			assert.deepEqual(files["share/lean-bridge/component/" + path], identity(text), path);
			assert.deepEqual(run.componentFiles[path], identity(text), path);
		}
		for(const [path, value] of Object.entries({
			"native-wit-adapter.json": compiled
			, "share/lean-bridge/runtime.json": runtime
			, "share/lean-bridge/native-c-adapter.json": adapter
		})) assert.deepEqual(files[path], identity(canonicalJson(value)), path);
		for(const suffix of ["graph.h", "graph-types.h", "callable-borrows.h"])
			assert.deepEqual(files[`include/structured-${suffix}`], adapter.files[`include/detail/structured-${suffix}`]);
		assert.deepEqual(files["lib/" + adapter.library], adapter.files["lib/" + adapter.library]);
		assert.deepEqual(files["lib/" + receipt.library], receipt.nativeLibrary);
		for(const [path, file] of Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/"))) assert.deepEqual(files[path], file, path);
		assert.deepEqual(installed.libraries, Object.fromEntries(Object.entries(files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/u.test(path))));
		assert.equal(Object.keys(installed.libraries).length, 6);
		const pkg = run.package;
		assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.name, "structured"); assert.equal(pkg.version, "1.0.0"); assert.equal(pkg.runtimeIdentity, runtimeIdentity);
		assert.deepEqual(pkg.requires, []); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/structured-1.0.0-wit-wasi.tar.gz");
		assert.equal(pkg.artifacts[0].sha256, installed.archiveSha256); hash(installed.archiveSha256);
		assert.ok(Number.isSafeInteger(pkg.artifacts[0].bytes) && pkg.artifacts[0].bytes > 1000);
		const fn = name => projection.manifest.cHost.values.find(item => item.declaration === projection.functions.find(fn => fn.declaration.name === name).declaration.id);
		const bindings = `#define fixture_callback_create ${fn("callRecursive").callbacks[0].create}\n#define fixture_owned_call ${fn("makeRecursive").invoke}`;
		const callers = { consumer: fixture.replace("/* GENERATED_BINDINGS */", bindings)
			, values: witRecursiveCallableValues(projection)
			, documentation: documentation.example.source
			, boundary: witRecursiveCallableMalformed(projection)
			, "boundary.so": witRecursiveCallableMalformed(projection)
			, ...mixed ? { primitives: await witRecursivePrimitiveConsumer(projection) } : {} };
		assert.deepEqual(Object.keys(probes).sort(), Object.keys(callers).sort());
		for(const [name, text] of Object.entries(callers))
		{ assert.equal(probes[name].sourceSha256, sha256(text), name); hash(probes[name].executableSha256); }
		const observed = { typed: witRecursiveTypedObservation
			, values: witRecursiveValueObservation
			, documentation: { verbatim: true, stdout: documentation.example.stdout }
			, ...mixed ? { primitives: witRecursivePrimitiveObservation } : {} };
		assert.deepEqual(installed.observations, [observed, observed]);
		assert.deepEqual(installed.resultFaults, witRecursiveResultFaultModes.map(mode => ({
			mode, runtimeRetired: !mode.startsWith("limit-")
			, twoSessionsChecked: true, outputUnchanged: true
		})));
	}
};
