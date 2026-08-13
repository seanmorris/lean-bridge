import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";

const primitiveLeanTypes = new Map([
	["unit", "Unit"], ["bool", "Bool"], ["uint8", "UInt8"], ["uint16", "UInt16"]
	, ["uint32", "UInt32"]
	, ["uint64", "UInt64"]
	, ["int8", "Int8"]
	, ["int16", "Int16"]
	, ["int32", "Int32"], ["int64", "Int64"], ["nat", "Nat"], ["int", "Int"]
	, ["float32", "Float32"]
	, ["float64", "Float"]
	, ["string", "String"]
	, ["bytes", "ByteArray"]
]);

/**
 * Reports compiler adapter failures with stable machine-readable codes and structured diagnostic context.
 */
export class CompilerAdapterError extends Error
{
	/**
   * Initializes the error used to report compiler adapter failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "CompilerAdapterError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new CompilerAdapterError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-compiler-adapter-plan", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-compiler-adapter-plan", `${label} fields must be closed`, { actual, expected: wanted });
};

const leanType = type => {
	if(type.kind === "primitive")
	{
		const result = primitiveLeanTypes.get(type.name);
		if(result === undefined) fail("unsupported-compiler-type", `No Lean compiler adapter type exists for ${type.name}`);
		return result;
	}
	if(type.kind === "named")
	{
		const separator = type.id.indexOf(":");
		if(separator === -1 || type.id.slice(0, separator) !== "lean") fail("unsupported-compiler-type", `Named compiler type must come from Lean: ${type.id}`);
		return type.id.slice(separator + 1);
	}
	if(type.kind === "apply")
	{
		const arguments_ = type.arguments.map(leanType);
		if(type.constructor === "array" && arguments_.length === 1) return `Array ${arguments_[0]}`;
		if(type.constructor === "option" && arguments_.length === 1) return `Option ${arguments_[0]}`;
		if(type.constructor === "result" && arguments_.length === 2) return `Except ${arguments_[0]} ${arguments_[1]}`;
		if(type.constructor === "tuple" && arguments_.length >= 2) return `(${arguments_.join(" × ")})`;
	}
	fail("unsupported-compiler-type", `Compiler adapters cannot project ${JSON.stringify(type)}`);
};

const sourceModule = path => path.replace(/\.lean$/, "").replaceAll("/", ".");
const wrapperIdentifier = id => `export_${sha256(id).slice(0, 20)}`;
const exportSymbol = (component, id) => `lean_bridge_${sha256(`${component}\0${id}`).slice(0, 24)}`;

const validateParameter = (parameter, path) => {
	exactKeys(parameter, ["name", "leanType"], path);
	if(typeof parameter.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_']*$/.test(parameter.name)) fail("invalid-compiler-adapter-plan", `${path} has an invalid name`);
	if(typeof parameter.leanType !== "string" || parameter.leanType === "") fail("invalid-compiler-adapter-plan", `${path} has no Lean type`);
};

/**
 * Validates compiler adapter plan against its closed contract before it enters the isolated component build pipeline.
 *
 * @param plan - Validated plan that defines the allowed operation and targets.
 */
export const validateCompilerAdapterPlan = plan => {
	exactKeys(plan, ["schemaVersion", "component", "componentPlanSha256", "module", "imports", "exports", "privateAbi", "leanSourceSha256"], "compiler adapter plan");
	if(plan.schemaVersion !== 1) fail("invalid-compiler-adapter-plan", "compiler adapter plan version must be 1");
	if(typeof plan.component !== "string" || plan.component === "") fail("invalid-compiler-adapter-plan", "component must be a string");
	for(const value of [plan.componentPlanSha256, plan.leanSourceSha256]) if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("invalid-compiler-adapter-plan", "compiler adapter hashes must be SHA-256 values");
	if(plan.module !== "LeanBridgeGenerated") fail("invalid-compiler-adapter-plan", "generated compiler module name is unsupported");
	if(!Array.isArray(plan.imports) || plan.imports.length === 0 || new Set(plan.imports).size !== plan.imports.length) fail("invalid-compiler-adapter-plan", "imports must be a unique non-empty array");
	if(!Array.isArray(plan.exports) || plan.exports.length === 0) fail("invalid-compiler-adapter-plan", "compiler adapter plan must export declarations");
	const symbols = new Set();
	for(const item of plan.exports)
	{
		exactKeys(item, ["bindingId", "sourceDeclaration", "sourceModule", "wrapper", "symbol", "parameters", "leanResultType", "resultMode", "leanEffect"], "compiler export");
		for(const key of ["bindingId", "sourceDeclaration", "sourceModule", "wrapper", "symbol", "leanResultType"]) if(typeof item[key] !== "string" || item[key] === "") fail("invalid-compiler-adapter-plan", `compiler export ${key} must be a string`);
		if(!/^lean_bridge_[0-9a-f]{24}$/.test(item.symbol) || symbols.has(item.symbol)) fail("invalid-compiler-adapter-plan", "compiler export symbols must be unique generated names");
		symbols.add(item.symbol);
		if(!Array.isArray(item.parameters)) fail("invalid-compiler-adapter-plan", "compiler export parameters must be an array");
		item.parameters.forEach((parameter, index) => validateParameter(parameter, `parameter ${index}`));
		if(!new Set(["value", "promise"]).has(item.resultMode)) fail("invalid-compiler-adapter-plan", "compiler adapters currently support value and promise results");
		if(item.leanEffect !== null && !new Set(["IO", "Task"]).has(item.leanEffect)) fail("invalid-compiler-adapter-plan", "compiler adapter effect is unsupported");
		if((item.resultMode === "promise") !== (item.leanEffect !== null)) fail("invalid-compiler-adapter-plan", "promise adapters require IO or Task");
	}
	exactKeys(plan.privateAbi, ["version", "dispatch", "exports"], "private ABI");
	if(plan.privateAbi.version !== 1 || plan.privateAbi.dispatch !== "direct-symbols") fail("invalid-compiler-adapter-plan", "private ABI must use direct symbols");
	if(!Array.isArray(plan.privateAbi.exports) || plan.privateAbi.exports.length !== plan.exports.length) fail("invalid-compiler-adapter-plan", "private ABI must cover every generated export");
	for(const [index, item] of plan.privateAbi.exports.entries())
	{
		exactKeys(item, ["bindingId", "symbol", "parameters", "result", "resultMode"], `private ABI export ${index}`);
		if(item.bindingId !== plan.exports[index].bindingId || item.symbol !== plan.exports[index].symbol || item.resultMode !== plan.exports[index].resultMode)
		{
			fail("invalid-compiler-adapter-plan", "private ABI export order and identities must match generated exports");
		}
		if(!Array.isArray(item.parameters) || item.result === null || typeof item.result !== "object") fail("invalid-compiler-adapter-plan", "private ABI type shapes are incomplete");
	}
	return true;
};

const renderLeanSource = ({ imports, exports }) => {
	const lines = [
		...imports.map(module => `import ${module}`)
		, ""
		, "namespace LeanBridgeGenerated"
		, ""
	];
	for(const item of exports)
	{
		const parameters = item.parameters.map(parameter => `(${parameter.name} : ${parameter.leanType})`).join(" ");
		const arguments_ = item.parameters.map(parameter => parameter.name).join(" ");
		lines.push(`@[export ${item.symbol}]`);
		lines.push(`def ${item.wrapper}${parameters === "" ? "" : ` ${parameters}`} : ${item.leanEffect === null ? item.leanResultType : `${item.leanEffect} ${item.leanResultType}`} :=`);
		lines.push(`  ${item.sourceDeclaration}${arguments_ === "" ? "" : ` ${arguments_}`}`);
		lines.push("");
	}
	lines.push("end LeanBridgeGenerated", "");
	return lines.join("\n");
};

/**
 * Generates compiler adapters from validated semantic input without introducing behavior outside the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to generate compiler adapters.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 */
export const generateCompilerAdapters = ({ analysis, componentPlan }) => {
	if(analysis.bindingIr?.origin !== "statically-inferred") fail("compiler-adapter-ir-origin", "Generated compiler adapters require statically inferred Binding IR");
	if(componentPlan?.document?.bindingIr?.semanticSha256 !== analysis.bindingIr.semanticSha256) fail("compiler-adapter-plan-drift", "Component plan and Binding IR identities differ");
	const candidates = new Map(analysis.exportCandidates.map(item => [item.declaration, item]));
	const exports = analysis.bindingIr.document.declarations.map(declaration => {
    if(declaration.kind !== "function" || declaration.owner !== null || declaration.receiver !== null) fail("unsupported-compiler-declaration", `Compiler adapter cannot emit ${declaration.id}`);
    const sourceDeclaration = declaration.source.declaration;
    const candidate = candidates.get(sourceDeclaration);
    if(candidate?.status !== "exportable") fail("compiler-source-declaration-missing", `No exportable Lean source declaration matches ${sourceDeclaration}`);
    const effect = declaration.source.extensions["lean-lang.org/effect"] ?? null;
    const item = Object.freeze({
      bindingId: declaration.id
      , sourceDeclaration
      , sourceModule: sourceModule(candidate.path)
      , wrapper: wrapperIdentifier(declaration.id)
      , symbol: exportSymbol(analysis.bindingIr.document.component.id, declaration.id)
      , parameters: Object.freeze(declaration.parameters.map(parameter => Object.freeze({ name: parameter.name, leanType: leanType(parameter.type) })))
      , leanResultType: leanType(declaration.result.type)
      , resultMode: declaration.resultMode
      , leanEffect: effect
    });
    return item;
	});
	const imports = Object.freeze([...new Set(exports.map(item => item.sourceModule))].sort());
	const leanSource = renderLeanSource({ imports, exports });
	const privateAbi = Object.freeze({
		version: 1
		, dispatch: "direct-symbols"
		, exports: Object.freeze(exports.map(item => Object.freeze({
			bindingId: item.bindingId
			, symbol: item.symbol
			, parameters: Object.freeze(analysis.bindingIr.document.declarations.find(declaration => declaration.id === item.bindingId).parameters.map(parameter => parameter.type))
			, result: analysis.bindingIr.document.declarations.find(declaration => declaration.id === item.bindingId).result.type
			, resultMode: item.resultMode
		})))
	});
	const plan = Object.freeze({
		schemaVersion: 1
		, component: analysis.bindingIr.document.component.id
		, componentPlanSha256: componentPlan.sha256
		, module: "LeanBridgeGenerated"
		, imports
		, exports: Object.freeze(exports)
		, privateAbi
		, leanSourceSha256: sha256(leanSource)
	});
	validateCompilerAdapterPlan(plan);
	return Object.freeze({
		plan
		, files: Object.freeze({
			"LeanBridgeGenerated.lean": leanSource
			, "compiler-adapters.json": canonicalJson(plan)
			, "private-abi.json": canonicalJson(privateAbi)
		})
	});
};

/**
 * Loads compiler adapter plan, verifies its structure and identity, and returns it to the isolated component build pipeline.
 *
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const readCompilerAdapterPlan = async path => {
	const plan = JSON.parse(await readFile(path, "utf8"));
	validateCompilerAdapterPlan(plan);
	return plan;
};

/**
 * Writes compiler adapters in deterministic form with the metadata required by the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to write compiler adapters.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.analysis - Completed project analysis containing source identities, diagnostics, export evidence, and proposed Binding IR.
 * @param root0.componentPlan - Validated component plan defining exports, targets, and generated adapter requirements.
 */
export const writeCompilerAdapters = async ({ outputRoot, analysis, componentPlan }) => {
	const output = resolve(outputRoot);
	try
	{
		await stat(output);
		fail("compiler-adapter-output-exists", `Compiler adapter output already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof CompilerAdapterError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-adapters-"));
	try
	{
		const generated = generateCompilerAdapters({ analysis, componentPlan });
		for(const [path, contents] of Object.entries(generated.files).sort(([left], [right]) => left.localeCompare(right)))
		{
			await writeFile(join(staging, path), contents);
		}
		await rename(staging, output);
		return Object.freeze({
			output
			, component: generated.plan.component
			, componentPlanSha256: generated.plan.componentPlanSha256
			, leanSourceSha256: generated.plan.leanSourceSha256
			, files: Object.freeze(Object.keys(generated.files).sort())
		});
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
