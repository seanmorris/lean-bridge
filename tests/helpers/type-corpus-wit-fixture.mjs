/**
 * Synthetic WIT evidence for validator mutation tests, never execution evidence.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import wasmtimeFiles from "../fixtures/type-corpus/wasmtime-c-api-files.json" with { type: "json" };
import { corpusWitSignatures, corpusWitSource, witRuntimeCases } from "./type-corpus-wit-source.mjs";
import { witCompilerOptions, witIsolationFlags } from "./type-corpus-wit-evidence.mjs";

/**
 * Build catalog-derived shapes, independently of the production WIT generator.
 *
 * @param library - Independent catalog library.
 */
export const witDocumentFixture = library => {
	const signatures = corpusWitSignatures(library), types = [];
	const type = shape => {
		if(typeof shape === "string") return shape;
		const kind = shape.list ? { list: type(shape.list) } : shape.record
			? { record: { fields: shape.record.map(field => ({ name: field.name, type: type(field.type) })) } }
			: { enum: { cases: shape.enum.map(name => ({ name })) } };
		types.push({ kind }); return types.length - 1;
	};
	const functions = Object.fromEntries(signatures.map(signature => [signature.name, { name: signature.name, kind: "freestanding", params: signature.parameters.map((shape, index) => ({ name: "arg" + index, type: type(shape) })), result: type(signature.result) }]));
	return { types
		, interfaces: ["api", "native"].map(name => ({ name, functions: structuredClone(functions) }))
		, worlds: [{ imports: { native: { interface: { id: 1 } } }, exports: { api: { interface: { id: 0 } } } }]
		, packages: [{ name: "lean-bridge:" + library.id + "-corpus@1.0.0" }] };
};

/**
 * Construct consistent receipt relationships so each mutation tests one boundary.
 *
 * @param library - Independent catalog library.
 * @param observation - Synthetic observation, modified only by the fixture.
 * @param oracle - Synthetic expected values, never installed execution evidence.
 */
export const witValidationFixture = (library, observation, oracle) => {
	const hash = "e".repeat(64), identity = { bytes: 100, sha256: hash }, p = library.cModule;
	const files = {}, put = (path, value) => { const text = canonicalJson(value); files[path] = { bytes: Buffer.byteLength(text), sha256: sha256(text) }; };
	const runtimeReceipt = { files: { "lib/libleanshared.so": identity, "lib/liblean_bridge_native.so": identity } };
	const runtimeIdentity = sha256(canonicalJson(runtimeReceipt)), bindingIrSha256 = "c".repeat(64);
	const componentReceipt = { runtimeIdentity, bindingIrSha256, modelSha256: "d".repeat(64), library: "libcomponent_" + "f".repeat(20) + ".so", nativeLibrary: identity };
	const adapterReceipt = { runtimeIdentity, bindingIrSha256, files: { ["lib/lib" + p + ".so"]: identity } };
	const compiledFiles = Object.fromEntries(["include/" + p + "_wasmtime.h", "src/" + p + "_wasmtime.c", "lib/lib" + p + "_wasmtime.so", "wit/" + library.id + "-corpus.wit", "component/" + library.id + "-corpus.wat", "component/" + library.id + "-corpus.wasm", "binding-manifest.json"].map(path => [path, identity]));
	for(const [path, identity] of Object.entries(wasmtimeFiles)) compiledFiles["wasmtime/" + path] = identity;
	const name = library.id + "-corpus";
	const compiled = { schemaVersion: 1, profile: "native-wit-v1"
		, runtimeIdentity, bindingIrSha256
		, glibcMinimumVersion: "2.38", settings: { name, version: "1.0.0" }
		, library: "lib" + p + "_wasmtime.so"
		, component: "component/" + name + ".wasm"
		, wasmTools: "wasm-tools 1.245.1"
		, componentReceiptSha256: sha256(canonicalJson(componentReceipt))
		, adapterReceiptSha256: sha256(canonicalJson(adapterReceipt))
		, files: compiledFiles
		, wasmtime: { ...wasmtimeCapiIdentity, files: structuredClone(wasmtimeFiles) } };
	for(const [path, identity] of Object.entries(compiledFiles))
		files[path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path] = identity;
	Object.assign(files, runtimeReceipt.files, adapterReceipt.files);
	files["lib/" + componentReceipt.library] = identity;
	files["share/lean-bridge/component/model.json"] = { bytes: 100, sha256: componentReceipt.modelSha256 };
	files["lib/pkgconfig/" + name + "-wit.pc"] = identity;
	put("share/lean-bridge/runtime.json", runtimeReceipt);
	put("share/lean-bridge/native-c-adapter.json", adapterReceipt);
	put("share/lean-bridge/component/native-component.json", componentReceipt);
	put("native-wit-adapter.json", compiled);
	const packageReceipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-wit-package", ecosystem: "wit-wasi"
		, name, version: "1.0.0", component: { name: p }
		, runtimeIdentity, bindingIrSha256
		, glibcMinimumVersion: "2.38", wasmtime: "42.0.1"
		, componentSha256: hash, files };
	const libraries = Object.fromEntries(Object.entries(files).filter(([path]) => /^lib\/[^/]+\.so$/.test(path)));
	const root = "/validator/relocated", flagsRoot = "/validator/project/package/" + name + "-1.0.0-wit-wasi/lib/pkgconfig/../..";
	observation.hostVersion = "42.0.1";
	observation.loadedLibraries = Object.keys(libraries).map(path => root + "/" + path);
	observation.copiesSurviveSessionClose = true;
	observation.errors = Object.entries(witRuntimeCases).flatMap(([id, message]) => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, message, exception: "WasmtimeError", outputUnchanged: true, recovery: oracle.dependency })));
	const wit = { ...Object.fromEntries(witIsolationFlags.map(flag => [flag, true]))
		, repeatExecutions: 2, compilerVersion: "12.2.0"
		, compilerSha256: hash, compilerMacrosSha256: hash
		, compilerOptions: [...witCompilerOptions]
		, negativeCompilerOptions: [...witCompilerOptions, "-Wconversion", "-Wsign-conversion", "-fsyntax-only", "-fdiagnostics-format=json"]
		, sourceSha256: sha256(corpusWitSource(library)), executableSha256: hash
		, wasmToolsVersion: compiled.wasmTools, wasmToolsSha256: hash
		, packageReceipt, packageReceiptSha256: sha256(canonicalJson(packageReceipt))
		, archiveSha256: "a".repeat(64), compiled
		, componentReceipt, adapterReceipt, runtimeReceipt
		, deploymentRoot: root, libraries
		, declarations: Object.fromEntries(["wit", "component"].map(name => [name, { inputSha256: hash, document: witDocumentFixture(library), signatures: corpusWitSignatures(library) }]))
		, pkgConfig: { version: "1.8.1", manifestSha256: hash, flags: ["-I" + flagsRoot + "/include", "-L" + flagsRoot + "/lib", "-Wl,-rpath," + flagsRoot + "/lib", "-l" + p + "_wasmtime", "-lwasmtime"] } };
	return { wit, runtimeIdentity, archive: { sha256: "a".repeat(64), target: "wit-wasi", name, version: "1.0.0" } };
};
