/**
 * Implements the component compilation plan module in the build subsystem.
 *
 * @file
 */

import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Reports component compilation plan failures with stable machine-readable codes and structured diagnostic context.
 */
export class ComponentCompilationPlanError extends Error
{
	/**
   * Initializes the error used to report component compilation plan failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ComponentCompilationPlanError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new ComponentCompilationPlanError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-component-compilation-plan", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-component-compilation-plan", `${label} fields must be closed`, { actual, expected: wanted });
};

const validHash = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const validModule = value => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(value);
const moduleFromPath = path => path.replace(/\.lean$/, "").replaceAll("/", ".");

const importsFromSource = source => Object.freeze([...source.matchAll(/^\s*(?:(?:public|private|protected)\s+)?import\s+([A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*)\s*(?:--.*)?$/gm)]
  .map(match => match[1]));

const topologicalOrder = modules => {
	const byName = new Map(modules.map(module => [module.module, module]));
	const visiting = new Set();
	const visited = new Set();
	const ordered = [];
	const visit = name => {
		if(visited.has(name)) return;
		if(visiting.has(name)) fail("component-module-cycle", `Local Lean module cycle includes ${name}`);
		visiting.add(name);
		for(const dependency of byName.get(name).localDependencies) visit(dependency);
		visiting.delete(name);
		visited.add(name);
		ordered.push(name);
	};
	for(const name of [...byName.keys()].sort()) visit(name);
	return Object.freeze(ordered);
};

const safePath = (path, label) => {
	if(typeof path !== "string" || path === "" || path.startsWith("/") || path.split("/").includes("..") || path.includes("\\"))
	{
		fail("invalid-component-compilation-plan", `${label} must be a safe relative path`);
	}
};

/**
 * Validates component compilation plan against its closed contract before it enters the isolated component build pipeline.
 *
 * @param plan - Validated plan that defines the allowed operation and targets.
 */
export const validateComponentCompilationPlan = plan => {
	exactKeys(plan, ["schemaVersion", "component", "componentPlanSha256", "compilerAdapters", "source", "runtime", "target", "outputs", "policies"], "component compilation plan");
	if(plan.schemaVersion !== 1) fail("invalid-component-compilation-plan", "component compilation plan version must be 1");
	exactKeys(plan.component, ["id", "name", "version"], "component");
	for(const key of ["id", "name", "version"]) if(typeof plan.component[key] !== "string" || plan.component[key] === "") fail("invalid-component-compilation-plan", `component ${key} is required`);
	if(!validHash(plan.componentPlanSha256)) fail("invalid-component-compilation-plan", "component plan identity must be a SHA-256 value");
	exactKeys(plan.compilerAdapters, ["planSha256", "leanSourceSha256", "module", "initializer", "directSymbols"], "compiler adapters");
	if(!validHash(plan.compilerAdapters.planSha256) || !validHash(plan.compilerAdapters.leanSourceSha256)) fail("invalid-component-compilation-plan", "compiler adapter identities must be SHA-256 values");
	if(plan.compilerAdapters.module !== "LeanBridgeGenerated" || plan.compilerAdapters.initializer !== "initialize_LeanBridgeGenerated") fail("invalid-component-compilation-plan", "compiler adapter module or initializer is unsupported");
	if(!Array.isArray(plan.compilerAdapters.directSymbols) || plan.compilerAdapters.directSymbols.length === 0 || new Set(plan.compilerAdapters.directSymbols).size !== plan.compilerAdapters.directSymbols.length || plan.compilerAdapters.directSymbols.some(symbol => !/^lean_bridge_[0-9a-f]{24}$/.test(symbol)))
	{
		fail("invalid-component-compilation-plan", "compiler adapters must expose unique direct symbols");
	}
	exactKeys(plan.source, ["treeSha256", "toolchain", "modules", "compileOrder", "externalImports"], "source");
	if(!validHash(plan.source.treeSha256) || typeof plan.source.toolchain !== "string" || plan.source.toolchain === "") fail("invalid-component-compilation-plan", "source identity is incomplete");
	if(!Array.isArray(plan.source.modules) || plan.source.modules.length === 0) fail("invalid-component-compilation-plan", "source modules must not be empty");
	const moduleNames = new Set();
	for(const module of plan.source.modules)
	{
		exactKeys(module, ["module", "path", "bytes", "sha256", "imports", "localDependencies"], "source module");
		if(!validModule(module.module) || moduleNames.has(module.module)) fail("invalid-component-compilation-plan", "source module names must be unique Lean names");
		moduleNames.add(module.module);
		safePath(module.path, "source module path");
		if(!module.path.endsWith(".lean") || moduleFromPath(module.path) !== module.module || !Number.isSafeInteger(module.bytes) || module.bytes < 0 || !validHash(module.sha256)) fail("invalid-component-compilation-plan", `source module ${module.module} identity is invalid`);
		if(!Array.isArray(module.imports) || !Array.isArray(module.localDependencies) || module.imports.some(imported => !validModule(imported)) || module.localDependencies.some(imported => !validModule(imported))) fail("invalid-component-compilation-plan", `source module ${module.module} imports are invalid`);
	}
	for(const module of plan.source.modules) if(module.localDependencies.some(dependency => !moduleNames.has(dependency) || !module.imports.includes(dependency))) fail("invalid-component-compilation-plan", `source module ${module.module} has an unbound local dependency`);
	if(!Array.isArray(plan.source.compileOrder) || plan.source.compileOrder.length !== moduleNames.size + 1 || plan.source.compileOrder.at(-1) !== plan.compilerAdapters.module || new Set(plan.source.compileOrder).size !== plan.source.compileOrder.length) fail("invalid-component-compilation-plan", "compile order must cover every source module before the generated module");
	if(plan.source.compileOrder.slice(0, -1).some(module => !moduleNames.has(module))) fail("invalid-component-compilation-plan", "compile order contains an unknown source module");
	for(const module of plan.source.modules) for(const dependency of module.localDependencies) if(plan.source.compileOrder.indexOf(dependency) > plan.source.compileOrder.indexOf(module.module)) fail("invalid-component-compilation-plan", `compile order places ${module.module} before ${dependency}`);
	if(!Array.isArray(plan.source.externalImports) || new Set(plan.source.externalImports).size !== plan.source.externalImports.length || plan.source.externalImports.some(imported => !validModule(imported) || moduleNames.has(imported))) fail("invalid-component-compilation-plan", "external imports must be unique non-local Lean module names");
	exactKeys(plan.runtime, ["abiVersion", "leanCommit", "patchSetSha256", "profile", "shared"], "runtime");
	if(!Number.isSafeInteger(plan.runtime.abiVersion) || plan.runtime.abiVersion < 1 || !/^[0-9a-f]{40}$/.test(plan.runtime.leanCommit) || !validHash(plan.runtime.patchSetSha256) || plan.runtime.profile !== "side-lazy" || plan.runtime.shared !== true) fail("invalid-component-compilation-plan", "runtime identity does not describe one shared lazy runtime");
	exactKeys(plan.target, ["triple", "format", "linkMode", "exceptionHandling", "positionIndependent"], "target");
	if(plan.target.triple !== "wasm32-unknown-emscripten" || plan.target.format !== "wasm" || plan.target.linkMode !== "side-module-2" || plan.target.exceptionHandling !== "wasm" || plan.target.positionIndependent !== true) fail("invalid-component-compilation-plan", "target must use the reviewed Emscripten side-module profile");
	exactKeys(plan.outputs, ["sideModule", "linkMap", "artifactManifest"], "outputs");
	for(const [key, path] of Object.entries(plan.outputs)) safePath(path, `output ${key}`);
	if(!plan.outputs.sideModule.endsWith(".so.wasm") || !plan.outputs.linkMap.endsWith(".link.map") || !plan.outputs.artifactManifest.endsWith(".json")) fail("invalid-component-compilation-plan", "output extensions are invalid");
	exactKeys(plan.policies, ["compileOnce", "sourceReadOnly", "linksRuntime", "definesMemory", "definesTable", "publicGenericDispatch"], "policies");
	if(plan.policies.compileOnce !== true || plan.policies.sourceReadOnly !== true || plan.policies.linksRuntime !== false || plan.policies.definesMemory !== false || plan.policies.definesTable !== false || plan.policies.publicGenericDispatch !== false) fail("invalid-component-compilation-plan", "component compilation policies must preserve shared-runtime native-call composition");
	return true;
};

/**
 * Verifies analyzed sources, derives module dependencies and compile order, and closes the authorized side-module outputs and runtime policy.
 *
 * @param root0 - Named inputs and dependency overrides used to create component compilation plan.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 * @param root0.compilerAdapters - Generated adapter manifest and source files that connect Lean declarations to the component ABI.
 * @param root0.sourceFiles - Authorized source-file inventory included in the component compilation plan.
 */
export const createComponentCompilationPlan = ({ analysis, componentPlan, compilerAdapters, sourceFiles }) => {
	if(componentPlan.sha256 !== compilerAdapters.plan.componentPlanSha256) fail("component-compilation-plan-drift", "component and compiler adapter plan identities differ");
	const inputByPath = new Map(componentPlan.document.source.inputs.map(input => [input.path, input]));
	const leanInputs = componentPlan.document.source.inputs.filter(input => input.path.endsWith(".lean"));
	const moduleNames = new Set(leanInputs.map(input => moduleFromPath(input.path)));
	const externalImports = new Set();
	const modules = leanInputs.map(input => {
    const source = sourceFiles[input.path];
    if(typeof source !== "string" || Buffer.byteLength(source) !== input.bytes || sha256(source) !== input.sha256) fail("component-source-drift", `Source input changed before compilation: ${input.path}`);
    const imports = [...new Set(importsFromSource(source))].sort();
    const localDependencies = imports.filter(imported => moduleNames.has(imported));
    for(const imported of imports) if(!moduleNames.has(imported)) externalImports.add(imported);
    return Object.freeze({ module: moduleFromPath(input.path), path: input.path, bytes: input.bytes, sha256: input.sha256, imports: Object.freeze(imports), localDependencies: Object.freeze(localDependencies) });
	}).sort((left, right) => left.module.localeCompare(right.module));
	for(const imported of compilerAdapters.plan.imports) if(!moduleNames.has(imported)) fail("compiler-adapter-import-missing", `Generated compiler adapter imports source module outside the component closure: ${imported}`);
	if(inputByPath.size !== analysis.inputs.length || analysis.inputs.some(input => inputByPath.get(input.path)?.sha256 !== input.sha256)) fail("component-analysis-plan-drift", "Analysis inputs and component plan source closure differ");
	const sourceOrder = topologicalOrder(modules);
	const componentStem = `${componentPlan.document.component.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "component"}-${sha256(componentPlan.document.component.id).slice(0, 16)}`;
	const document = Object.freeze({
		schemaVersion: 1
		, component: Object.freeze({ ...componentPlan.document.component })
		, componentPlanSha256: componentPlan.sha256
		, compilerAdapters: Object.freeze({
			planSha256: sha256(canonicalJson(compilerAdapters.plan))
			, leanSourceSha256: compilerAdapters.plan.leanSourceSha256
			, module: compilerAdapters.plan.module
			, initializer: `initialize_${compilerAdapters.plan.module}`
			, directSymbols: Object.freeze(compilerAdapters.plan.privateAbi.exports.map(item => item.symbol).sort())
		})
		, source: Object.freeze({
			treeSha256: componentPlan.document.source.treeSha256
			, toolchain: componentPlan.document.source.toolchain
			, modules: Object.freeze(modules)
			, compileOrder: Object.freeze([...sourceOrder, compilerAdapters.plan.module])
			, externalImports: Object.freeze([...externalImports].sort())
		})
		, runtime: Object.freeze({ ...componentPlan.document.runtime })
		, target: Object.freeze({ triple: "wasm32-unknown-emscripten", format: "wasm", linkMode: "side-module-2", exceptionHandling: "wasm", positionIndependent: true })
		, outputs: Object.freeze({ sideModule: `artifacts/${componentStem}.so.wasm`, linkMap: `audit/${componentStem}.link.map`, artifactManifest: "component-artifact-manifest.json" })
		, policies: Object.freeze({ compileOnce: true, sourceReadOnly: true, linksRuntime: false, definesMemory: false, definesTable: false, publicGenericDispatch: false })
	});
	validateComponentCompilationPlan(document);
	return Object.freeze({ document, sha256: sha256(canonicalJson(document)) });
};

/**
 * Prepares component compilation plan in an isolated, deterministic form for the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to prepare component compilation plan.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 * @param root0.compilerAdapters - Generated adapter manifest and source files that connect Lean declarations to the component ABI.
 */
export const prepareComponentCompilationPlan = async ({ projectRoot, analysis, componentPlan, compilerAdapters }) => {
	const root = resolve(projectRoot);
	const sourceFiles = Object.fromEntries(await Promise.all(componentPlan.document.source.inputs.filter(input => input.path.endsWith(".lean")).map(async input => [input.path, await readFile(join(root, input.path), "utf8")])));
	return createComponentCompilationPlan({ analysis, componentPlan, compilerAdapters, sourceFiles });
};

/**
 * Writes component compilation inputs in deterministic form with the metadata required by the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to write component compilation inputs.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 * @param root0.compilerAdapters - Generated adapter manifest and source files that connect Lean declarations to the component ABI.
 */
export const writeComponentCompilationInputs = async ({ projectRoot, outputRoot, analysis, componentPlan, compilerAdapters }) => {
	const root = resolve(projectRoot);
	const output = resolve(outputRoot);
	try
	{
		await stat(output);
		fail("component-compilation-output-exists", `Component compilation input closure already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof ComponentCompilationPlanError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	const plan = await prepareComponentCompilationPlan({ projectRoot: root, analysis, componentPlan, compilerAdapters });
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-component-inputs-"));
	try
	{
		for(const input of componentPlan.document.source.inputs)
		{
			const bytes = await readFile(join(root, input.path));
			if(bytes.length !== input.bytes || sha256(bytes) !== input.sha256) fail("component-source-drift", `Source input changed before staging: ${input.path}`);
			const destination = join(staging, "source", input.path);
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, bytes, { mode: 0o444 });
			await chmod(destination, 0o444);
		}
		for(const [path, contents] of Object.entries(compilerAdapters.files).sort(([left], [right]) => left.localeCompare(right)))
		{
			const destination = join(staging, "generated", path);
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, contents, { mode: 0o444 });
			await chmod(destination, 0o444);
		}
		await writeFile(join(staging, "component-build-plan.json"), canonicalJson(componentPlan.document), { mode: 0o444 });
		await writeFile(join(staging, "component-compilation-plan.json"), canonicalJson(plan.document), { mode: 0o444 });
		await rename(staging, output);
		return Object.freeze({ output, component: plan.document.component.id, componentPlanSha256: componentPlan.sha256, compilationPlanSha256: plan.sha256, sourceTreeSha256: plan.document.source.treeSha256 });
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
