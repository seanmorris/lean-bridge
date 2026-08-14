/**
 * Implements the component artifact manifest module in the build subsystem.
 *
 * @file
 */

import { readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Reports component artifact manifest failures with stable machine-readable codes and structured diagnostic context.
 */
export class ComponentArtifactManifestError extends Error
{
	/**
   * Initializes the error used to report component artifact manifest failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ComponentArtifactManifestError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new ComponentArtifactManifestError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-component-artifact-manifest", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-component-artifact-manifest", `${label} fields must be closed`, { actual, expected: wanted });
};

const hash = value => {
	if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-component-artifact-manifest", "Artifact manifest identities must be SHA-256 values");
};

/**
 * Validates component artifact manifest against its closed contract before it enters the isolated component build pipeline.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 */
export const validateComponentArtifactManifest = manifest => {
	exactKeys(manifest, ["schemaVersion", "kind", "component", "source", "bindingIr", "compilerAdapters", "compilation", "runtime", "wasm", "structure", "policies"], "component artifact manifest");
	if(manifest.schemaVersion !== 1 || manifest.kind !== "lean-bridge-component-artifact") fail("invalid-component-artifact-manifest", "Component artifact manifest version or kind is unsupported");
	exactKeys(manifest.component, ["id", "name", "version"], "component");
	for(const key of ["id", "name", "version"]) if(typeof manifest.component[key] !== "string" || manifest.component[key] === "") fail("invalid-component-artifact-manifest", `Component ${key} is required`);
	exactKeys(manifest.source, ["treeSha256", "toolchain", "inputCount", "inputsSha256"], "source");
	hash(manifest.source.treeSha256); hash(manifest.source.inputsSha256);
	if(typeof manifest.source.toolchain !== "string" || manifest.source.toolchain === "" || !Number.isSafeInteger(manifest.source.inputCount) || manifest.source.inputCount < 1) fail("invalid-component-artifact-manifest", "Source closure identity is incomplete");
	exactKeys(manifest.bindingIr, ["schemaVersion", "origin", "semanticSha256", "declarations"], "Binding IR");
	hash(manifest.bindingIr.semanticSha256);
	if(!Number.isSafeInteger(manifest.bindingIr.schemaVersion) || manifest.bindingIr.schemaVersion < 1 || !new Set(["statically-inferred", "existing-validated"]).has(manifest.bindingIr.origin) || !Array.isArray(manifest.bindingIr.declarations) || manifest.bindingIr.declarations.length < 1 || new Set(manifest.bindingIr.declarations).size !== manifest.bindingIr.declarations.length || manifest.bindingIr.declarations.some(value => typeof value !== "string" || value === "")) fail("invalid-component-artifact-manifest", "Binding IR identity is incomplete");
	exactKeys(manifest.compilerAdapters, ["planSha256", "leanSourceSha256", "privateAbiSha256", "directSymbols"], "compiler adapters");
	hash(manifest.compilerAdapters.planSha256); hash(manifest.compilerAdapters.leanSourceSha256); hash(manifest.compilerAdapters.privateAbiSha256);
	if(!Array.isArray(manifest.compilerAdapters.directSymbols) || manifest.compilerAdapters.directSymbols.length < 1 || new Set(manifest.compilerAdapters.directSymbols).size !== manifest.compilerAdapters.directSymbols.length || manifest.compilerAdapters.directSymbols.some(symbol => !/^lean_bridge_[0-9a-f]{24}$/.test(symbol))) fail("invalid-component-artifact-manifest", "Compiler adapter symbols are absent or invalid");
	exactKeys(manifest.compilation, ["componentPlanSha256", "compilationPlanSha256", "targetCManifestSha256", "compiler"], "compilation");
	hash(manifest.compilation.componentPlanSha256); hash(manifest.compilation.compilationPlanSha256); hash(manifest.compilation.targetCManifestSha256);
	exactKeys(manifest.compilation.compiler, ["version", "commit"], "Lean compiler");
	if(typeof manifest.compilation.compiler.version !== "string" || !/^[0-9a-f]{40}$/.test(manifest.compilation.compiler.commit)) fail("invalid-component-artifact-manifest", "Lean compiler identity is invalid");
	exactKeys(manifest.runtime, ["abiVersion", "leanCommit", "patchSetSha256", "profile", "shared"], "runtime");
	if(!Number.isSafeInteger(manifest.runtime.abiVersion) || !/^[0-9a-f]{40}$/.test(manifest.runtime.leanCommit) || manifest.runtime.profile !== "side-lazy" || manifest.runtime.shared !== true) fail("invalid-component-artifact-manifest", "Shared runtime identity is invalid");
	hash(manifest.runtime.patchSetSha256);
	exactKeys(manifest.wasm, ["artifact", "linkManifestSha256", "auditSha256", "linker"], "Wasm");
	exactKeys(manifest.wasm.artifact, ["path", "bytes", "sha256"], "Wasm artifact");
	hash(manifest.wasm.artifact.sha256); hash(manifest.wasm.linkManifestSha256); hash(manifest.wasm.auditSha256);
	if(typeof manifest.wasm.artifact.path !== "string" || !manifest.wasm.artifact.path.endsWith(".so.wasm") || !Number.isSafeInteger(manifest.wasm.artifact.bytes) || manifest.wasm.artifact.bytes < 1) fail("invalid-component-artifact-manifest", "Wasm artifact path or size is invalid");
	exactKeys(manifest.wasm.linker, ["version", "commit"], "Emscripten linker");
	if(typeof manifest.wasm.linker.version !== "string" || !/^[0-9a-f]{40}$/.test(manifest.wasm.linker.commit)) fail("invalid-component-artifact-manifest", "Emscripten linker identity is invalid");
	exactKeys(manifest.structure, ["imports", "exports", "definitions"], "structure");
	exactKeys(manifest.structure.imports, ["memory", "table", "functions", "globals"], "structure imports");
	exactKeys(manifest.structure.exports, ["directSymbols", "initializer", "internalInitializer", "emscriptenInternals"], "structure exports");
	exactKeys(manifest.structure.definitions, ["memory", "table"], "structure definitions");
	if(manifest.structure.imports.memory !== 1 || manifest.structure.imports.table !== 1 || !Array.isArray(manifest.structure.imports.functions) || !Array.isArray(manifest.structure.imports.globals) || manifest.structure.definitions.memory !== 0 || manifest.structure.definitions.table !== 0) fail("invalid-component-artifact-manifest", "Wasm structure does not preserve shared memory and table ownership");
	if(JSON.stringify(manifest.structure.exports.directSymbols) !== JSON.stringify(manifest.compilerAdapters.directSymbols) || manifest.structure.exports.initializer !== "initialize_LeanBridgeGenerated" || !/^lean_bridge_internal_initialize_[0-9a-f]{16}$/.test(manifest.structure.exports.internalInitializer) || JSON.stringify(manifest.structure.exports.emscriptenInternals) !== JSON.stringify(["__wasm_apply_data_relocs", "__wasm_call_ctors"])) fail("invalid-component-artifact-manifest", "Wasm structure exports differ from the closed compiler adapter ABI");
	exactKeys(manifest.policies, ["compileOnce", "sourceReadOnly", "linksRuntime", "importsSharedMemory", "importsSharedTable", "publicGenericDispatch", "targetSpecificRebuild"], "policies");
	if(manifest.policies.compileOnce !== true || manifest.policies.sourceReadOnly !== true || manifest.policies.linksRuntime !== false || manifest.policies.importsSharedMemory !== true || manifest.policies.importsSharedTable !== true || manifest.policies.publicGenericDispatch !== false || manifest.policies.targetSpecificRebuild !== false) fail("invalid-component-artifact-manifest", "Artifact policies do not preserve shared-runtime compile-once composition");
	return true;
};

/**
 * Verifies the plan, compiler, linker, and audit identity chain before assembling the immutable component artifact manifest.
 *
 * @param root0 - Named inputs and dependency overrides used to create component artifact manifest.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 * @param root0.compilerAdapters - Generated adapter manifest and source files that connect Lean declarations to the component ABI.
 * @param root0.compilationPlan - Validated compilation plan binding authorized inputs, outputs, toolchain, and runtime profile.
 * @param root0.compiled - Compiler result containing the generated target-C closure and its recorded identities.
 * @param root0.linked - Link result containing the side module and deterministic link manifest.
 * @param root0.audited - Side-module audit result proving the linked artifact has the required structure and exports.
 */
export const createComponentArtifactManifest = ({ analysis, componentPlan, compilerAdapters, compilationPlan, compiled, linked, audited }) => {
	const adapterPlanSha256 = sha256(canonicalJson(compilerAdapters.plan));
	const privateAbiSha256 = sha256(canonicalJson(compilerAdapters.plan.privateAbi));
	const targetCManifestSha256 = sha256(canonicalJson(compiled.manifest));
	const linkManifestSha256 = sha256(canonicalJson(linked.manifest));
	const auditSha256 = sha256(canonicalJson(audited));
	if(componentPlan.sha256 !== compilationPlan.document.componentPlanSha256 || adapterPlanSha256 !== compilationPlan.document.compilerAdapters.planSha256) fail("component-artifact-plan-drift", "Component, compilation, and compiler adapter plans differ");
	if(analysis.bindingIr.semanticSha256 !== componentPlan.document.bindingIr.semanticSha256 || compiled.manifest.compilationPlanSha256 !== compilationPlan.sha256 || linked.manifest.compilationPlanSha256 !== compilationPlan.sha256 || audited.compilationPlanSha256 !== compilationPlan.sha256) fail("component-artifact-identity-drift", "One compiler or linker result names a different semantic or compilation identity");
	if(linked.manifest.targetCManifestSha256 !== targetCManifestSha256 || audited.linkManifestSha256 !== linkManifestSha256 || audited.artifact.sha256 !== linked.manifest.artifact.sha256) fail("component-artifact-evidence-drift", "Target C, link, audit, and Wasm identities do not form one chain");
	const document = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-component-artifact"
		, component: Object.freeze({ ...componentPlan.document.component })
		, source: Object.freeze({
			treeSha256: componentPlan.document.source.treeSha256
			, toolchain: componentPlan.document.source.toolchain
			, inputCount: componentPlan.document.source.inputs.length
			, inputsSha256: sha256(canonicalJson(componentPlan.document.source.inputs))
		})
		, bindingIr: Object.freeze({ ...componentPlan.document.bindingIr, declarations: Object.freeze([...componentPlan.document.bindingIr.declarations]) })
		, compilerAdapters: Object.freeze({
			planSha256: adapterPlanSha256
			, leanSourceSha256: compilerAdapters.plan.leanSourceSha256
			, privateAbiSha256
			, directSymbols: Object.freeze([...compilationPlan.document.compilerAdapters.directSymbols])
		})
		, compilation: Object.freeze({
			componentPlanSha256: componentPlan.sha256
			, compilationPlanSha256: compilationPlan.sha256
			, targetCManifestSha256
			, compiler: Object.freeze({ ...compiled.manifest.compiler })
		})
		, runtime: Object.freeze({ ...componentPlan.document.runtime })
		, wasm: Object.freeze({
			artifact: Object.freeze({ ...linked.manifest.artifact })
			, linkManifestSha256
			, auditSha256
			, linker: Object.freeze({ ...linked.manifest.linker })
		})
		, structure: audited.structure
		, policies: Object.freeze({
			compileOnce: true
			, sourceReadOnly: true
			, linksRuntime: false
			, importsSharedMemory: true
			, importsSharedTable: true
			, publicGenericDispatch: false
			, targetSpecificRebuild: false
		})
	});
	validateComponentArtifactManifest(document);
	return Object.freeze({ document, sha256: sha256(canonicalJson(document)) });
};

/**
 * Writes component artifact manifest in deterministic form with the metadata required by the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to write component artifact manifest.
 * @param root0.sideRoot - Filesystem root containing the side.
 */
export const writeComponentArtifactManifest = async ({ sideRoot, ...inputs }) => {
	const output = join(resolve(sideRoot), "component-artifact-manifest.json");
	try
	{
		await stat(output);
		fail("component-artifact-manifest-exists", `Component artifact manifest already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof ComponentArtifactManifestError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	const manifest = createComponentArtifactManifest(inputs);
	const artifact = await readFile(join(resolve(sideRoot), manifest.document.wasm.artifact.path));
	if(artifact.length !== manifest.document.wasm.artifact.bytes || sha256(artifact) !== manifest.document.wasm.artifact.sha256) fail("component-artifact-drift", "Wasm changed before the component artifact manifest was written");
	await writeFile(output, canonicalJson(manifest.document), { flag: "wx" });
	return Object.freeze({ path: "component-artifact-manifest.json", sha256: manifest.sha256, document: manifest.document });
};
