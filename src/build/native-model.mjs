/**
 * Checked native-library-v1 projection. Independent of the wasm32 scalar frame.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateNativeType } from "../analyze/native-types.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { createElaboratedSemanticModel } from "../analyze/semantic-model.mjs";
import { projectPerlNames } from "../backends/perl/naming.mjs";

export { validateNativeType };

export const nativeAbiVersion = 1;
export const nativeCopyLimit = 16 * 1024 * 1024;
const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const fail = message => { throw new TypeError(`native-library-v1: ${message}`); };

/**
	Render a validated native type as Lean source syntax.

 * @param type - Checked native type and compiler representation.
 */
export const nativeLeanType = type => {
	if(type.kind === "array") return `(Array ${nativeLeanType(type.element)})`;
	if(type.kind === "callback") return `(${[...type.parameters, type.result].map(nativeLeanType).join(" → ")})`;
	return type.lean;
};
const absoluteLeanType = type => {
	if(type.kind === "array") return `(_root_.Array ${absoluteLeanType(type.element)})`;
	if(type.kind === "callback") return `(${[...type.parameters, type.result].map(absoluteLeanType).join(" → ")})`;
	return `_root_.${type.lean}`;
};
/**
	Hash the checked representation and semantic type, excluding its cached key.

 * @param type - Checked native type and compiler representation.
 */
export const nativeTypeKey = type => {
	const { key, ...shape } = type;
	void key;
	return sha256(canonicalJson(shape)).slice(0, 20);
};
/**
	Read the compiler-checked C representation for a native type.

 * @param type - Checked native type and compiler representation.
 */
export const nativeCType = type => {
	if(type.abi) return type.abi.cType === "lean_object*" ? "lean_object *" : type.abi.cType;
	if(type.kind !== "primitive") return "lean_object *";
	if(/^u?int(?:8|16|32|64)$/.test(type.name)) return `uint${type.name.match(/\d+/)[0]}_t`;
	if(type.name === "bool") return "uint8_t";
	if(type.name === "float32") return "float";
	if(type.name === "float64") return "double";
	return "lean_object *";
};
/**
	Identify values represented by a Lean object pointer.

 * @param type - Checked native type and compiler representation.
 */
export const nativeObjectType = type => nativeCType(type) === "lean_object *";

/**
 * A valid copied value used only while a callback exception awaits cleanup.
 *
 * @param type - Checked native type and compiler representation.
 */
export const nativeCallbackDefault = type => {
	if(type.kind === "array") return "lean_mk_empty_array()";
	if(type.kind === "record") return `lb_t${nativeTypeKey(type)}_make(${type.fields.map(f => nativeCallbackDefault(f.type)).join(", ") || "lean_box(0)"})`;
	if(type.kind !== "primitive") fail("callback results must be copied values; identity results need a failure representation");
	if(type.name === "string") return 'lean_mk_string("")';
	if(type.name === "bytes") return "lean_alloc_sarray(1, 0, 0)";
	return nativeObjectType(type) ? "lean_box(0)" : "0";
};

const callbackLeanDefault = type => {
	if(type.kind === "array") return "#[]";
	if(type.kind === "record") return `(_root_.${type.constructor} ${type.fields.map(f => callbackLeanDefault(f.type)).join(" ")})`;
	if(type.kind !== "primitive") fail("callback results must be copied values");
	return { unit: "()", bool: "false", string: '""', bytes: "_root_.ByteArray.empty" }[type.name] ?? "0";
};

const closed = (value, fields, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
	  || Object.keys(value).sort().join(",") !== [...fields].sort().join(",")) fail(`invalid ${label} fields`);
};


/**
	Project elaborated native declarations into a checked model and canonical Binding IR.

 * @param root0 - Named inputs for this operation.
 * @param root0.metadata - Fresh elaborated Lean metadata.
 * @param root0.component - Canonical component name and version.
 * @param root0.moduleName - Optional Perl projection namespace; omitted for other native targets.
 * @param root0.sourceIdentity - Pinned compiler, source and interface identities.
 * @param profile - Fixed compilation profile.
 * @param pointerBits - Fixed target pointer width.
 */
const createCompiledModel = ({ metadata, component, moduleName, sourceIdentity }, profile, pointerBits) => {
	const elaborated = projectNativeMetadata(metadata, sourceIdentity);
	const allTypes = new Map();
	const visit = type => {
		validateNativeType(type);
		const key = nativeTypeKey(type);
		if(allTypes.has(key)) return;
		if(type.kind === "array") visit(type.element);
		if(type.kind === "record") for(const field of type.fields) visit(field.type);
		if(type.kind === "callback")
		{ type.parameters.forEach(visit); visit(type.result); }
		allTypes.set(key, { ...type, key });
	};
	const checked = elaborated.declarations.map(declaration => {
		if(!identifier.test(declaration.name) || !identifier.test(declaration.module)) fail("invalid declaration identity");
		declaration.parameters.forEach(parameter => { closed(parameter, ["name", "type"], "native parameter"); visit(parameter.type); });
		visit(declaration.result);
		return { ...declaration, symbol: `lb_${sha256(`${component.id}\0${declaration.name}`).slice(0, 24)}` };
	});
	if(!checked.length) fail("empty export set");
	const exports = moduleName === undefined ? checked : projectPerlNames(moduleName, checked);
	const semantic = createElaboratedSemanticModel({
		metadata, request: sourceIdentity.request, component
		, elaborationSha256: elaborated.sha256
	});
	const model = { schemaVersion: 2
		, profile
		, pointerBits
		, byteOrder: "little"
		, component
		, ...(moduleName === undefined ? {} : { moduleName })
		, bindingIr: semantic.document
		, bindingIrSha256: semantic.semanticSha256
		, sourceIdentity
		, exports
		, types: [...allTypes.values()] };
	return Object.freeze(model);
};

/**
 * Build the fixed 64-bit native profile from fresh compiler metadata.
 *
 * @param options - Elaborated metadata, component and source identity.
 */
export const createNativeModel = options => createCompiledModel(options, "native-library-v1", 64);

/**
 * Reuse C-shape elaboration, not a compiled native receipt, for wasm32.
 * The target C compiler checks the emitted definitions against these prototypes.
 *
 * @param options - Elaborated metadata, component and source identity.
 */
export const createPhpWasmCopiedModel = options => {
	if(options.moduleName !== undefined) throw new TypeError("PHP-Wasm models cannot carry a Perl namespace");
	const model = createCompiledModel(options, "php-wasm-copied-v1", 32);
	const copied = type => type.kind === "primitive" || (type.kind === "array" && copied(type.element)) || (type.kind === "record" && type.fields.every(field => copied(field.type)));
	const unsupported = model.exports.find(item => !item.parameters.every(parameter => copied(parameter.type)) || !copied(item.result));
	if(unsupported)
	{
		const declaration = model.bindingIr.declarations.find(item => item.source.declaration === unsupported.name);
		const source = declaration.source.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${unsupported.name}: PHP-Wasm copied compilation admits only primitives, arrays and records`), { code: "unsupported-php-wasm-signature", details: { declaration: declaration.id, source: source ?? null } });
	}
	return model;
};

/**
 * Per-type constructor/projection functions keep Lean object layout private.
 *
 * @param model - Compiler-checked native model and Binding IR.
 */
export const generateNativeLeanAdapters = model => {
	const module = `LeanBridgeNative${sha256(model.component.id).slice(0, 16)}`;
	const lines = [...new Set(model.exports.map(item => `import ${item.module}`)), "", `namespace ${module}`, ""];
	// A named one-field carrier prevents Lean's eta expansion from adding a
	// returned closure's arguments to the exported C function. Trivial-structure
	// elimination preserves the closure object's representation without copying.
	for(const type of model.types.filter(type => type.kind === "callback"))
	  lines.push(`structure ClosureCarry${type.key} where`, `  value : ${absoluteLeanType(type)}`, "");
	const prototypes = ["#include <lean/lean.h>", "#include <stdint.h>"];
	const emit = (symbol, parameters, result, body) => {
		const ps = parameters.length ? parameters : [{ name: "unit", type: { kind: "primitive", name: "unit", lean: "Unit" } }];
		const callback = result.kind === "callback";
		lines.push(`@[export ${symbol}]`, `def f_${symbol} ${ps.map(p => `(${p.name} : ${absoluteLeanType(p.type)})`).join(" ")} : ${callback ? `ClosureCarry${nativeTypeKey(result)}` : absoluteLeanType(result)} :=`, `  ${callback ? `⟨${body}⟩` : body}`, "");
		prototypes.push(`${nativeCType(result)} ${symbol}(${ps.map(p => `${nativeCType(p.type)} ${p.name}`).join(", ")});`);
	};
	for(const item of model.exports) emit(item.symbol, item.parameters.map((p, i) => ({ name: `a${i}`, type: p.type })), item.result, `${item.specialization ? `(${item.specialization.application})` : `_root_.${item.name}`} ${item.parameters.map((_, i) => `a${i}`).join(" ")}`);
	for(const type of model.types)
	{
		if(type.kind === "record")
		{
			emit(`lb_t${type.key}_make`, type.fields.map((f, i) => ({ name: `a${i}`, type: f.type })), type, `_root_.${type.constructor} ${type.fields.map((_, i) => `a${i}`).join(" ")}`);
			type.fields.forEach((field, i) => emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], field.type, `_root_.${field.projection} value`));
		}
		if(type.kind === "callback")
		{
			const parameters = type.parameters.map((parameter, i) => ({ name: `value${i}`, type: parameter }));
			const arguments_ = parameters.map(parameter => parameter.name).join(" ");
			emit(`lb_t${type.key}_call`, [{ name: "closure", type }, ...parameters], type.result, `closure ${arguments_}`);
			// No Perl symbol or Perl interpreter pointer enters the compiled component.
			// A synchronous callback uses a private C trampoline installed by XS.
			lines.push(`@[extern "lb_t${type.key}_invoke"]`, `opaque invoke_${type.key} (token : _root_.USize) ${parameters.map(p => `(${p.name} : ${absoluteLeanType(p.type)})`).join(" ")} : ${absoluteLeanType(type.result)} := ${callbackLeanDefault(type.result)}`, "");
			lines.push(`@[export lb_t${type.key}_wrap]`, `def wrap_${type.key} (token : _root_.USize) : ClosureCarry${type.key} := ⟨fun ${arguments_} => invoke_${type.key} token ${arguments_}⟩`, "");
			prototypes.push(`lean_object * lb_t${type.key}_wrap(size_t token);`);
		}
	}
	// Exact Nat/Int decimal conversion uses checked Lean operations, independent of limb layout.
	emit("lb_native_nat_text", [{ name: "value", type: { kind: "primitive", name: "nat", lean: "Nat" } }], { kind: "primitive", name: "string", lean: "String" }, "_root_.Nat.repr value");
	emit("lb_native_int_text", [{ name: "value", type: { kind: "primitive", name: "int", lean: "Int" } }], { kind: "primitive", name: "string", lean: "String" }, "_root_.Int.repr value");
	emit("lb_native_int_parse", [{ name: "value", type: { kind: "primitive", name: "string", lean: "String" } }], { kind: "primitive", name: "int", lean: "Int" }, "_root_.String.toInt! value");
	lines.push(`end ${module}`, "");
	return { module, leanSource: lines.join("\n"), header: `${prototypes.join("\n")}\n` };
};
