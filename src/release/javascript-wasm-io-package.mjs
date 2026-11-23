/** @file Assemble synchronous IO npm archives from a source-checked Lean compilation. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { assertExportConfigurationCapabilities } from "../analyze/export-configuration.mjs";
import { reconcileHostExports } from "../analyze/host-export-model.mjs";
import { npmPackageMetadata } from "../analyze/package-metadata.mjs";
import { assertJavaScriptIOAbi } from "../abi/component-sync-io.mjs";
import { validateJavaScriptWasmControl } from "../abi/component-wasm-control.mjs";
import { generateJavaScriptPackage } from "../backends/javascript/generate.mjs";
import { assembleComponentNpmRuntime } from "./component-npm-package.mjs";
import { componentNpmIdentity } from "./component-package-receipt.mjs";
import { archiveSharedJavaScriptPackages, assertOwnedJavaScriptRuntime, javascriptSharedRuntimeRequirement } from "./owned-javascript-npm-package.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

export const javaScriptIOProfile = "javascript-wasm-sync-io-v1";

/**
 * Refuse unavailable capabilities before starting the compiler.
 *
 * @param configuration - Source project's export configuration.
 */
export const assertJavaScriptIOConfiguration = configuration => {
	assertExportConfigurationCapabilities(configuration, {target: "npm"
		, fields: ["package", "modules", "exports", "nativeEffects"]
		, targetFields: ["name", "version"]});
	if(!Array.isArray(configuration.nativeEffects) || configuration.nativeEffects.length)
		throw new Error("JavaScript synchronous IO supports only in-memory computation (nativeEffects: [])");
};

/**
 * Write two installable archives plus their verified local handoff into private staging.
 *
 * @param options - Live compiler result, captured source/review, selected runtime and empty staging directory.
 */
export const writeJavaScriptIOPackages = async options => {
	const {root, compilation, configuration, projectContract, captured, mainModule, mainWasm, signal} = options;
	signal?.throwIfAborted();
	assertJavaScriptIOConfiguration(configuration);
	const {api, abi, evidence, binary, integrity} = compilation;
	if(evidence.configurationSha256 !== sha256(canonicalJson(configuration))
		|| evidence.sourceTreeSha256 !== captured.document.packages[0].source.sourceTreeSha256
		|| evidence.reviewedSourceSha256 !== (projectContract.review?.sha256 ?? null)
		|| canonicalJson(evidence.lake) !== canonicalJson(projectContract.lake)
		|| canonicalJson(evidence.selection.exports) !== canonicalJson(projectContract.exports)
		|| evidence.hostImportsSourceSha256 !== null || sha256(binary) !== integrity)
		throw new Error("JavaScript IO package differs from the checked project");
	const {api: reconstructed} = reconcileHostExports({ir: null
		, selection: evidence.selection
		, metadata: evidence.metadata
		, component: projectContract.component
		, review: projectContract.review
		, owned: []});
	if(canonicalJson(api) !== canonicalJson(reconstructed)) throw new Error("JavaScript IO public API differs from the observed Lean interfaces");
	assertJavaScriptIOAbi(abi, api);
	await validateJavaScriptWasmControl(binary, abi.controlSymbol, false);
	assertOwnedJavaScriptRuntime({mainModule, mainWasm, sideWasm: binary, privateAbi: abi});
	const runtime = await assembleComponentNpmRuntime({mainModule, mainWasm, runtimeRequirement: javascriptSharedRuntimeRequirement});
	const coordinate = componentNpmIdentity(api.component, configuration.targets?.npm);
	const files = new Map(Object.entries(generateJavaScriptPackage(api)));
	const pkg = JSON.parse(files.get("package.json")), metadata = configuration.package ?? {};
	files.set("package.json", canonicalJson({
		...pkg
		, ...coordinate
		, license: metadata.license ?? "UNLICENSED"
		, description: api.documentation.summary
		, ...npmPackageMetadata(metadata)
		, engines: {node: ">=22"}
		, files: [...pkg.files, "metadata", "notices"]
		, dependencies: {"@lean-bridge/runtime": runtime.version}
		, leanBridge: {component: api.component.id
			, profile: javaScriptIOProfile
			, sharedRuntime: true
			, bindingIrSha256: abi.bindingIrSha256
			, componentIdentitySha256: abi.componentIdentity
			, runtimeIdentity: runtime.runtimeIdentity}}));
	files.set("internal/runtime.mjs", 'import { loadComponent } from "@lean-bridge/runtime";\nimport descriptor from "./descriptor.mjs";\nexport const runtime = await loadComponent(descriptor);\n');
	const descriptor = {id: api.component.id, buildHash: abi.componentIdentity, integrity, initializer: null, bindingIr: api, privateAbi: abi};
	files.set("internal/descriptor.mjs", `export default Object.freeze({...${canonicalJson(descriptor).trimEnd()}, sideModule: new URL("./component.wasm", import.meta.url)});\n`);
	files.set("internal/component.wasm", binary);
	files.set("metadata/compiler.json", canonicalJson(evidence));
	files.set("metadata/binding-ir.json", canonicalJson(api));
	if(projectContract.review) files.set("metadata/review.binding-ir.json", projectContract.review.source);
	for(const [path, bytes] of captured.files) files.set("notices/" + path, bytes);
	files.set("notices/lean-bridge.txt", await readFile(new URL("../../LICENSE", import.meta.url)));
	const delivery = archiveSharedJavaScriptPackages({runtime, files, coordinate, profile: javaScriptIOProfile});
	for(const [path, bytes] of [[delivery.componentName, delivery.componentArchive], [delivery.runtimeName, delivery.runtimeArchive]])
		await writeFile(join(root, path), bytes, {flag: "wx", signal});
	const receipt = {component: api.component
		, source: {treeSha256: evidence.sourceTreeSha256}
		, profiles: [{id: javaScriptIOProfile, bindingIrSha256: abi.bindingIrSha256, runtimeIdentity: runtime.runtimeIdentity}]
		, packages: delivery.packages};
	await writePackageSetReceipt({root, ...receipt, signal});
	return receipt;
};
