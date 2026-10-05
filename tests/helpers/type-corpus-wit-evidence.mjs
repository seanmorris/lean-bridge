/**
 * Receipt-bound WIT corpus evidence; synthetic validator data never proves support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { corpusWitSource, validateWitSignatures, witRuntimeCases } from "./type-corpus-wit-source.mjs";

export const witCompilerOptions = Object.freeze(["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"]);
export const witIsolationFlags = Object.freeze(["sourcesRemovedBeforeInstall"
	, "installedSourcesRemoved", "offline", "runtimeOverridesDisabled"
	, "publicHeadersOnly", "compilerFreeExecution", "localLibraries"]);
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const fileMap = files => {
	assert.ok(files && Object.keys(files).length > 0);
	for(const [path, file] of Object.entries(files))
	{
		assert.match(path, /^[A-Za-z0-9_.+/-]+$/);
		assert.ok(!path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part)));
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
	}
};

/**
 * Require compiler identities, parsed declarations, exact installed bytes and recovery.
 *
 * @param run - Full installed corpus report entry.
 * @param library - Independent catalog library.
 * @param fixture - Optional independent source, signature and observation checks.
 */
export const validateWitEvidence = (run, library, fixture = null) => {
	const evidence = run.wit, p = library.cModule, receipt = evidence.packageReceipt;
	for(const flag of witIsolationFlags) assert.equal(evidence[flag], true, flag);
	assert.equal(evidence.repeatExecutions, 2);
	assert.match(evidence.compilerVersion, /^\d+\.\d+(?:\.\d+)?$/);
	assert.ok(Number(evidence.compilerVersion.split(".")[0]) >= 12);
	for(const name of ["compilerSha256", "compilerMacrosSha256", "sourceSha256", "executableSha256", "wasmToolsSha256"]) hash(evidence[name]);
	assert.equal(evidence.sourceSha256, sha256(fixture?.source ?? corpusWitSource(library)));
	assert.deepEqual(evidence.compilerOptions, [...witCompilerOptions]);
	assert.deepEqual(evidence.negativeCompilerOptions, [...witCompilerOptions, "-Wconversion", "-Wsign-conversion", "-fsyntax-only", "-fdiagnostics-format=json"]);
	assert.match(evidence.wasmToolsVersion, /^wasm-tools 1\.245\.1(?: \([a-f0-9]+ \d{4}-\d{2}-\d{2}\))?$/);
	assert.equal(evidence.archiveSha256, run.archiveSha256);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.ecosystem, "wit-wasi");
	assert.equal(receipt.name, run.archive.name); assert.equal(receipt.version, run.archive.version);
	assert.equal(receipt.component.name, p);
	assert.equal(receipt.bindingIrSha256, run.bindingIrSha256);
	assert.equal(receipt.runtimeIdentity, run.runtimeIdentity);
	assert.equal(receipt.wasmtime, "42.0.1"); assert.equal(run.observation.hostVersion, receipt.wasmtime);
	assert.equal(evidence.packageReceiptSha256, sha256(canonicalJson(receipt)));
	fileMap(receipt.files); fileMap(evidence.libraries);
	const compiled = evidence.compiled, files = receipt.files;
	assert.equal(files["native-wit-adapter.json"].sha256, sha256(canonicalJson(compiled)));
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-wit-v1");
	assert.equal(compiled.bindingIrSha256, run.bindingIrSha256); assert.equal(compiled.runtimeIdentity, run.runtimeIdentity);
	assert.equal(compiled.glibcMinimumVersion, receipt.glibcMinimumVersion);
	assert.deepEqual(compiled.settings, { name: receipt.name, version: receipt.version });
	assert.equal(compiled.library, `lib${p}_wasmtime.so`);
	assert.equal(compiled.component, `component/${receipt.name}.wasm`);
	assert.equal(compiled.wasmTools, evidence.wasmToolsVersion);
	fileMap(compiled.files); fileMap(compiled.wasmtime.files);
	assert.deepEqual(Object.fromEntries(Object.keys(wasmtimeCapiIdentity).map(key => [key, compiled.wasmtime[key]])), wasmtimeCapiIdentity);
	assert.equal(sha256(canonicalJson(compiled.wasmtime.files)), wasmtimeCapiIdentity.filesSha256);
	const mapped = path => path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path;
	for(const [path, identity] of Object.entries(compiled.files)) assert.deepEqual(files[mapped(path)], identity, path);
	for(const [path, identity] of Object.entries(compiled.wasmtime.files))
		assert.deepEqual(compiled.files["wasmtime/" + path], identity, path);
	for(const path of [`include/${p}_wasmtime.h`, `src/${p}_wasmtime.c`, `lib/lib${p}_wasmtime.so`, `wit/${receipt.name}.wit`, `component/${receipt.name}.wat`, compiled.component, "binding-manifest.json"])
		assert.ok(Object.hasOwn(compiled.files, path));
	assert.equal(receipt.componentSha256, files[compiled.component].sha256);
	for(const [name, path] of [["componentReceipt", "share/lean-bridge/component/native-component.json"], ["adapterReceipt", "share/lean-bridge/native-c-adapter.json"], ["runtimeReceipt", "share/lean-bridge/runtime.json"]])
		assert.equal(files[path].sha256, sha256(canonicalJson(evidence[name])));
	assert.equal(compiled.componentReceiptSha256, sha256(canonicalJson(evidence.componentReceipt)));
	assert.equal(compiled.adapterReceiptSha256, sha256(canonicalJson(evidence.adapterReceipt)));
	assert.equal(run.runtimeIdentity, sha256(canonicalJson(evidence.runtimeReceipt)));
	assert.equal(evidence.componentReceipt.runtimeIdentity, run.runtimeIdentity);
	assert.equal(evidence.componentReceipt.bindingIrSha256, run.bindingIrSha256);
	assert.equal(evidence.componentReceipt.modelSha256, run.declarationEvidence.modelSha256);
	assert.equal(files["share/lean-bridge/component/model.json"].sha256, run.declarationEvidence.modelSha256);
	assert.equal(evidence.adapterReceipt.runtimeIdentity, run.runtimeIdentity);
	assert.equal(evidence.adapterReceipt.bindingIrSha256, run.bindingIrSha256);
	for(const [path, identity] of Object.entries(evidence.adapterReceipt.files)) if(path.startsWith("lib/")) assert.deepEqual(files[path], identity);
	for(const [path, identity] of Object.entries(evidence.runtimeReceipt.files)) if(path.startsWith("lib/")) assert.deepEqual(files[path], identity);
	assert.deepEqual(files["lib/" + evidence.componentReceipt.library], evidence.componentReceipt.nativeLibrary);
	assert.deepEqual(Object.keys(evidence.declarations).sort(), ["component", "wit"]);
	for(const [name, path] of [["wit", `wit/${receipt.name}.wit`], ["component", compiled.component]])
	{
		const declaration = evidence.declarations[name];
		assert.equal(declaration.inputSha256, files[path].sha256);
		assert.deepEqual(declaration.signatures, fixture ? fixture.validateSignatures(declaration.document) : validateWitSignatures(declaration.document, library));
		const packages = declaration.document.packages.map(pkg => pkg.name);
		assert.ok(packages.includes(`lean-bridge:${receipt.name}@${receipt.version}`));
	}
	const libraries = Object.fromEntries(Object.entries(files).filter(([path]) => /^lib\/[^/]+\.so(?:\.[0-9]+)*$/.test(path)));
	assert.deepEqual(evidence.libraries, libraries);
	for(const path of [`lib/lib${p}.so`, `lib/lib${p}_wasmtime.so`, "lib/libleanshared.so", "lib/liblean_bridge_native.so", "lib/libwasmtime.so"])
		assert.ok(Object.hasOwn(libraries, path));
	assert.match(evidence.deploymentRoot, /^\/.+\/relocated$/);
	assert.ok(!evidence.deploymentRoot.split("/").includes(".."));
	const paths = Object.keys(libraries).map(path => evidence.deploymentRoot + "/" + path).sort();
	assert.deepEqual(run.observation.loadedLibraries.filter(path => path.startsWith(evidence.deploymentRoot + "/")).sort(), paths);
	for(const path of paths) assert.equal(run.observation.loadedLibraries.filter(value => value.split("/").at(-1) === path.split("/").at(-1)).length, 1);
	assert.equal(run.observation.copiesSurviveSessionClose, true);
	assert.match(evidence.pkgConfig.version, /^\d+\.\d+(?:\.\d+)?$/);
	assert.equal(evidence.pkgConfig.manifestSha256, files[`lib/pkgconfig/${receipt.name}-wit.pc`].sha256);
	const flags = evidence.pkgConfig.flags;
	assert.equal(flags.length, 5);
	assert.ok(flags[0].startsWith("-I/") && flags[1].startsWith("-L/"));
	const installed = resolve(evidence.deploymentRoot, "../project/package", receipt.name + "-" + receipt.version + "-wit-wasi");
	assert.equal(resolve(flags[0].slice(2)), installed + "/include");
	assert.equal(resolve(flags[1].slice(2)), installed + "/lib");
	assert.deepEqual(flags.slice(2), ["-Wl,-rpath," + flags[1].slice(2), `-l${p}_wasmtime`, "-lwasmtime"]);
	if(fixture)
	{
		fixture.validateObservation(run.observation); return;
	}
	const expected = Object.entries(witRuntimeCases).flatMap(([id, message]) => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, message })));
	assert.equal(run.observation.errors.length, expected.length);
	for(const [index, entry] of expected.entries())
	{
		const observed = run.observation.errors[index];
		assert.equal(observed.id, entry.id); assert.equal(observed.iteration, entry.iteration);
		assert.equal(observed.exception, "WasmtimeError"); assert.equal(observed.outputUnchanged, true);
		if(entry.id === "native-budget-trap") assert.ok(observed.message.includes(entry.message));
		else assert.equal(observed.message, entry.message);
		assert.deepEqual(observed.recovery, run.oracle.dependency);
	}
};
