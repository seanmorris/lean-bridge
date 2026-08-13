import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateComponentCompilationPlan } from "./component-compilation-plan.mjs";

/**
 * Reports side module audit failures with stable machine-readable codes and structured diagnostic context.
 */
export class SideModuleAuditError extends Error
{
	/**
   * Initializes the error used to report side module audit failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "SideModuleAuditError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new SideModuleAuditError(code, message, details);
};

const exactKeys = (value, expected, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-side-module-link-manifest", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if(JSON.stringify(actual) !== JSON.stringify(wanted)) fail("invalid-side-module-link-manifest", `${label} fields must be closed`, { actual, expected: wanted });
};

const readUleb = (bytes, start) => {
	let value = 0;
	let shift = 0;
	let offset = start;
	while(offset < bytes.length)
	{
		const byte = bytes[offset++];
		value |= (byte & 0x7f) << shift;
		if((byte & 0x80) === 0) return { value, offset };
		shift += 7;
		if(shift > 35) fail("invalid-wasm", "Wasm contains an oversized u32 LEB value");
	}
	fail("invalid-wasm", "Wasm contains a truncated u32 LEB value");
};

const sectionVectorCount = (bytes, wanted) => {
	if(bytes.length < 8 || bytes.subarray(0, 4).toString("hex") !== "0061736d") fail("invalid-wasm", "Artifact does not have the WebAssembly magic header");
	let offset = 8;
	while(offset < bytes.length)
	{
		const section = bytes[offset];
		const size = readUleb(bytes, offset + 1);
		const end = size.offset + size.value;
		if(end > bytes.length) fail("invalid-wasm", "Wasm contains a truncated section");
		if(section === wanted) return readUleb(bytes, size.offset).value;
		offset = end;
	}
	return 0;
};

const entries = (values, kind) => values.filter(value => value.kind === kind);
const names = values => values.map(value => value.name).sort();
const same = (actual, expected, code, message) => {
	if(JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, message, { actual, expected });
};

const validateLinkManifest = ({ manifest, compilationPlan }) => {
	exactKeys(manifest, ["schemaVersion", "component", "compilationPlanSha256", "targetCManifestSha256", "linker", "profile", "artifact", "linkMap", "generatedInitializer", "exports", "policies"], "side-module link manifest");
	if(manifest.schemaVersion !== 1 || manifest.component !== compilationPlan.document.component.id || manifest.compilationPlanSha256 !== compilationPlan.sha256 || manifest.profile !== "side-module-2") fail("side-module-plan-drift", "Side-module link manifest does not match the component compilation plan");
	exactKeys(manifest.exports, ["directSymbols", "initializer", "internalInitializer"], "side-module exports");
	same(manifest.exports.directSymbols, compilationPlan.document.compilerAdapters.directSymbols, "side-module-symbol-drift", "Side-module direct symbols differ from the compiler adapters");
	if(manifest.exports.initializer !== compilationPlan.document.compilerAdapters.initializer || !/^lean_bridge_internal_initialize_[0-9a-f]{16}$/.test(manifest.exports.internalInitializer)) fail("side-module-symbol-drift", "Side-module initializer symbols are invalid");
	exactKeys(manifest.policies, ["linksRuntime", "importsSharedMemory", "importsSharedTable", "publicGenericDispatch"], "side-module policies");
	if(manifest.policies.linksRuntime !== false || manifest.policies.importsSharedMemory !== true || manifest.policies.importsSharedTable !== true || manifest.policies.publicGenericDispatch !== false) fail("side-module-policy-drift", "Side-module policies do not preserve one private-free shared runtime");
	if(manifest.artifact.path !== compilationPlan.document.outputs.sideModule || manifest.linkMap.path !== compilationPlan.document.outputs.linkMap) fail("side-module-output-drift", "Side-module paths differ from the component compilation plan");
};

const allowedFunctionImport = name => name === "initialize_Init"
  || name === "malloc"
  || name === "free"
  || name === "abort"
  || name.startsWith("lean_")
  || name.startsWith("emscripten_")
  || name.startsWith("__cxa_");

/**
 * Checks Wasm structure and returns structured evidence instead of relying on prose diagnostics in the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to audit Wasm structure.
 * @param root0.bytes - WebAssembly module bytes inspected without executing the module.
 * @param root0.directSymbols - Native symbols that must be exported directly rather than through an initializer.
 * @param root0.initializer - Public initialization symbol required in the WebAssembly export surface.
 * @param root0.internalInitializer - Private initialization symbol required for runtime setup but excluded from the public surface.
 */
export const auditWasmStructure = async ({ bytes, directSymbols, initializer, internalInitializer }) => {
	if(!WebAssembly.validate(bytes)) fail("invalid-wasm", "JavaScript WebAssembly validation rejected the side module");
	const module = await WebAssembly.compile(bytes);
	const imports = WebAssembly.Module.imports(module);
	const exports = WebAssembly.Module.exports(module);
	same(entries(imports, "memory"), [{ module: "env", name: "memory", kind: "memory" }], "side-module-memory-drift", "Side module must import exactly one shared env.memory");
	same(entries(imports, "table"), [{ module: "env", name: "__indirect_function_table", kind: "table" }], "side-module-table-drift", "Side module must import exactly one shared function table");
	if(sectionVectorCount(bytes, 5) !== 0 || sectionVectorCount(bytes, 4) !== 0 || entries(exports, "memory").length !== 0 || entries(exports, "table").length !== 0) fail("side-module-private-state", "Side module defines or exports private memory or a private table");
	const functionImports = entries(imports, "function");
	if(!functionImports.some(value => value.module === "env" && value.name === "initialize_Init") || !functionImports.some(value => value.module === "env" && value.name.startsWith("lean_"))) fail("side-module-runtime-imports-missing", "Side module does not import the shared Lean Init and runtime domains");
	const rejectedImports = functionImports.filter(value => value.module !== "env" || !allowedFunctionImport(value.name));
	if(rejectedImports.length > 0) fail("side-module-import-domain", "Side module imports an unreviewed function domain", { imports: rejectedImports });
	const allowedGlobals = entries(imports, "global").every(value =>
		(value.module === "env" && new Set(["__memory_base", "__table_base"]).has(value.name))
    || (new Set(["GOT.func", "GOT.mem"]).has(value.module) && /^[A-Za-z_][A-Za-z0-9_.$]*$/.test(value.name)),
	);
	if(!allowedGlobals) fail("side-module-import-domain", "Side module imports an unreviewed global domain", { globals: entries(imports, "global") });
	const requiredExports = [...directSymbols, initializer, internalInitializer].sort();
	const allowedInternals = ["__wasm_apply_data_relocs", "__wasm_call_ctors"];
	const functionExports = names(entries(exports, "function"));
	same(functionExports, [...requiredExports, ...allowedInternals].sort(), "side-module-export-drift", "Side module function exports differ from the closed private ABI");
	return Object.freeze({
		imports: Object.freeze({ memory: 1, table: 1, functions: Object.freeze(names(functionImports)), globals: Object.freeze(entries(imports, "global").map(value => `${value.module}.${value.name}`).sort()) })
		, exports: Object.freeze({ directSymbols: Object.freeze([...directSymbols]), initializer, internalInitializer, emscriptenInternals: Object.freeze(allowedInternals) })
		, definitions: Object.freeze({ memory: 0, table: 0 })
	});
};

/**
 * Checks component side module and returns structured evidence instead of relying on prose diagnostics in the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to audit component side module.
 * @param root0.sideRoot - Filesystem root containing the side.
 * @param root0.compilationPlan - Validated compilation plan binding authorized inputs, outputs, toolchain, and runtime profile.
 * @param root0.reportPath - Filesystem path to the report.
 */
export const auditComponentSideModule = async ({ sideRoot, compilationPlan, reportPath = null }) => {
	validateComponentCompilationPlan(compilationPlan.document);
	const root = resolve(sideRoot);
	const manifestBytes = await readFile(join(root, "side-module-link-manifest.json"));
	const manifest = JSON.parse(manifestBytes);
	validateLinkManifest({ manifest, compilationPlan });
	const [wasm, linkMap, shim] = await Promise.all([
		readFile(join(root, manifest.artifact.path))
		, readFile(join(root, manifest.linkMap.path), "utf8")
		, readFile(join(root, manifest.generatedInitializer.path), "utf8")
	]);
	if(wasm.length !== manifest.artifact.bytes || sha256(wasm) !== manifest.artifact.sha256) fail("side-module-artifact-drift", "Side-module artifact bytes differ from the link manifest");
	if(sha256(linkMap) !== manifest.linkMap.sha256 || sha256(shim) !== manifest.generatedInitializer.sha256) fail("side-module-evidence-drift", "Side-module link map or generated initializer differs from the link manifest");
	if(/libleanrt\.a|libInit\.a/.test(linkMap)) fail("side-module-private-runtime", "Side-module link map contains a Lean runtime archive");
	if(/(?:^|[\s:(])\/(?!workspace(?:\/|\b))[A-Za-z0-9_.-]+\//m.test(linkMap) || /ccall|cwrap|generic.?dispatch/i.test(linkMap)) fail("side-module-link-map-policy", "Side-module link map exposes a host path or generic dispatch path");
	for(const symbol of [...manifest.exports.directSymbols, manifest.exports.initializer, manifest.exports.internalInitializer])
	{
		if(!linkMap.includes(symbol)) fail("side-module-link-map-symbol", `Side-module link map does not contain ${symbol}`);
	}
	const structure = await auditWasmStructure({ bytes: wasm, ...manifest.exports });
	const report = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-side-module-audit"
		, passed: true
		, component: manifest.component
		, compilationPlanSha256: compilationPlan.sha256
		, linkManifestSha256: sha256(manifestBytes)
		, artifact: manifest.artifact
		, structure
		, checks: Object.freeze({ validWasm: true, artifactIdentity: true, linkEvidenceIdentity: true, noPrivateRuntime: true, noPrivateMemory: true, noPrivateTable: true, directSymbolCoverage: true, initializerCoverage: true, closedImportDomains: true, closedExportDomains: true, noHostPaths: true, noPublicGenericDispatch: true })
	});
	if(reportPath !== null) await writeFile(resolve(reportPath), canonicalJson(report));
	return report;
};
