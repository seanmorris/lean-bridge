import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Reports component build plan failures with stable machine-readable codes and structured diagnostic context.
 */
export class ComponentBuildPlanError extends Error
{
	/**
   * Initializes the error used to report component build plan failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ComponentBuildPlanError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new ComponentBuildPlanError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-component-build-plan", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-component-build-plan", `${label} fields must be closed`, { actual, expected: wanted });
};

const hash = value => {
	if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-component-build-plan", "component plan hashes must be SHA-256 hex strings");
};

/**
 * Validates component build plan against its closed contract before it enters the isolated component build pipeline.
 *
 * @param plan - Validated plan that defines the allowed operation and targets.
 */
export const validateComponentBuildPlan = plan => {
	exactKeys(plan, ["schemaVersion", "component", "source", "bindingIr", "runtime", "targets", "policies"], "component build plan");
	if(plan.schemaVersion !== 1) fail("invalid-component-build-plan", "component build plan version must be 1");
	exactKeys(plan.component, ["id", "name", "version"], "component");
	for(const key of ["id", "name", "version"]) if(typeof plan.component[key] !== "string" || plan.component[key] === "") fail("invalid-component-build-plan", `component ${key} must be a string`);
	exactKeys(plan.source, ["treeSha256", "toolchain", "inputs"], "source");
	hash(plan.source.treeSha256);
	if(typeof plan.source.toolchain !== "string" || plan.source.toolchain === "") fail("invalid-component-build-plan", "source toolchain must be a string");
	if(!Array.isArray(plan.source.inputs) || plan.source.inputs.length === 0) fail("invalid-component-build-plan", "source inputs must not be empty");
	for(const input of plan.source.inputs)
	{
		exactKeys(input, ["path", "bytes", "sha256"], "source input");
		if(typeof input.path !== "string" || input.path.startsWith("/") || input.path.split("/").includes("..")) fail("invalid-component-build-plan", "source input paths must be project-relative");
		if(!Number.isSafeInteger(input.bytes) || input.bytes < 0) fail("invalid-component-build-plan", "source input bytes must be non-negative");
		hash(input.sha256);
	}
	exactKeys(plan.bindingIr, ["schemaVersion", "origin", "semanticSha256", "declarations"], "Binding IR");
	if(!Number.isSafeInteger(plan.bindingIr.schemaVersion) || plan.bindingIr.schemaVersion < 1) fail("invalid-component-build-plan", "Binding IR version must be positive");
	if(!new Set(["statically-inferred", "existing-validated"]).has(plan.bindingIr.origin)) fail("invalid-component-build-plan", "Binding IR origin is unsupported");
	hash(plan.bindingIr.semanticSha256);
	if(!Array.isArray(plan.bindingIr.declarations) || plan.bindingIr.declarations.length === 0 || plan.bindingIr.declarations.some(item => typeof item !== "string" || item === ""))
	{
		fail("invalid-component-build-plan", "Binding IR declarations must be a non-empty string array");
	}
	exactKeys(plan.runtime, ["abiVersion", "leanCommit", "patchSetSha256", "profile", "shared"], "runtime");
	if(!Number.isSafeInteger(plan.runtime.abiVersion) || plan.runtime.abiVersion < 1) fail("invalid-component-build-plan", "runtime ABI version must be positive");
	if(!/^[0-9a-f]{40}$/.test(plan.runtime.leanCommit)) fail("invalid-component-build-plan", "runtime Lean commit must be a Git identity");
	hash(plan.runtime.patchSetSha256);
	if(plan.runtime.profile !== "side-lazy" || plan.runtime.shared !== true) fail("invalid-component-build-plan", "plain components must use the shared lazy side-module profile");
	if(!Array.isArray(plan.targets) || new Set(plan.targets).size !== plan.targets.length || plan.targets.some(item => typeof item !== "string" || item === ""))
	{
		fail("invalid-component-build-plan", "targets must be unique strings");
	}
	exactKeys(plan.policies, ["compileOnce", "sourceReadOnly", "privateRuntime", "targetSpecificRebuild"], "policies");
	if(plan.policies.compileOnce !== true || plan.policies.sourceReadOnly !== true || plan.policies.privateRuntime !== false || plan.policies.targetSpecificRebuild !== false)
	{
		fail("invalid-component-build-plan", "component build policies must preserve compile-once shared-runtime composition");
	}
	return true;
};

/**
 * Converts complete analysis evidence into a compile-once component plan with pinned source, Binding IR, runtime, targets, and policy.
 *
 * @param root0 - Named inputs and dependency overrides used to create component build plan.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.runtime - Runtime closure or profile metadata used to construct the generated package or component plan.
 * @param root0.targets - Closed target identifiers selected for planning, building, or reproducibility comparison.
 */
export const createComponentBuildPlan = ({ analysis, runtime, targets = [] }) => {
	if(analysis.bindingIr === null) fail("component-binding-ir-required", "Build requires a complete Binding IR", { hints: analysis.adapterHints.map(item => item.id) });
	const requiredHints = analysis.adapterHints.filter(item => item.required);
	if(requiredHints.length > 0) fail("component-adapter-hints-required", "Build requires decisions for unresolved adapter hints", { hints: requiredHints.map(item => item.id) });
	const document = Object.freeze({
		schemaVersion: 1
		, component: Object.freeze({ ...analysis.bindingIr.document.component })
		, source: Object.freeze({
			treeSha256: analysis.sourceTreeSha256
			, toolchain: analysis.project.toolchain
			, inputs: Object.freeze(analysis.inputs.map(input => Object.freeze({ ...input })))
		})
		, bindingIr: Object.freeze({
			schemaVersion: analysis.bindingIr.document.schemaVersion
			, origin: analysis.bindingIr.origin
			, semanticSha256: analysis.bindingIr.semanticSha256
			, declarations: Object.freeze(analysis.bindingIr.document.declarations.map(item => item.id).sort())
		})
		, runtime: Object.freeze({
			abiVersion: runtime.abiVersion
			, leanCommit: runtime.leanCommit
			, patchSetSha256: runtime.patchSetSha256
			, profile: "side-lazy"
			, shared: true
		})
		, targets: Object.freeze([...targets].sort())
		, policies: Object.freeze({
			compileOnce: true
			, sourceReadOnly: true
			, privateRuntime: false
			, targetSpecificRebuild: false
		})
	});
	validateComponentBuildPlan(document);
	return Object.freeze({ document, sha256: sha256(canonicalJson(document)) });
};

/**
 * Prepares component build plan in an isolated, deterministic form for the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to prepare component build plan.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.engineRoot - Filesystem root containing the engine.
 * @param root0.targets - Closed target identifiers selected for planning, building, or reproducibility comparison.
 * @param root0.analyze - Injected analyzer used to inspect a project without coupling the caller to its implementation.
 * @param root0.signal - Abort signal used to cancel the operation.
 */
export const prepareComponentBuildPlan = async ({ projectRoot, engineRoot, targets = [], analyze = analyzeLeanProject, signal = undefined }) => {
	const [analysis, graph] = await Promise.all([
		analyze(resolve(projectRoot), { signal, targets })
		, readFile(join(resolve(engineRoot), "poc/lean-link-spike/graph-lock.json"), "utf8").then(JSON.parse)
	]);
	return createComponentBuildPlan({ analysis, runtime: graph.runtime, targets });
};
