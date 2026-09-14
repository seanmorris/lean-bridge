/**
 * Checked native-library-v1 projection. Independent of the wasm32 scalar frame.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateNativeType } from "../analyze/native-types.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";

export { validateNativeType };

export const nativeAbiVersion = 1;
export const nativeCopyLimit = 16 * 1024 * 1024;
/**
	Convert a checked public declaration name to Perl snake case.

 * @param value - Public declaration name to convert.
 */
export const snake = value => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const doc = summary => ({ summary, details: "" });
const source = declaration => ({ producer: "lean", declaration, extensions: {} });
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
 * @param root0.moduleName - Public Perl module name.
 * @param root0.sourceIdentity - Pinned compiler, source and interface identities.
 */
export const createNativeModel = ({ metadata, component, moduleName, sourceIdentity }) => {
	const elaborated = projectNativeMetadata(metadata, sourceIdentity);
	if(!/^LeanBridge::[A-Za-z][A-Za-z0-9_]*(?:::[A-Za-z][A-Za-z0-9_]*)*$/.test(moduleName) || /^LeanBridge::Runtime(?:::|$)/.test(moduleName)) fail("invalid or reserved Perl module name");
	const allTypes = new Map(), definitions = new Map();
	const callbackFailure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
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
	const identity = type => ["resource", "callback"].includes(type.kind);
	const site = (type, result = false) => ({
		type: reference(type)
		, ownership: identity(type) ? (result ? "lease" : "borrow") : "copy"
		, lifetime: identity(type) ? { scope: result ? "explicit" : "call", anchor: null } : null
	});
	const parameter = (type, index) => ({ name: `arg${index}`, ...site(type), mutability: "immutable", optional: false, default: null });
	const reference = type => {
		if(type.kind === "primitive") return { kind: "primitive", name: type.name };
		if(type.kind === "array") return { kind: "apply", constructor: "array", arguments: [reference(type.element)] };
		const id = type.kind === "callback" ? `native:Callback${nativeTypeKey(type)}` : `lean:${type.name}`;
		if(!definitions.has(id))
		{
			const definition = {
				id
				, name: type.kind === "callback" ? `Callback${nativeTypeKey(type)}` : type.name.split(".").at(-1)
				, kind: type.kind
				, representation: identity(type) ? "identity" : "copied"
				, mutability: type.kind === "resource" ? "read" : "immutable"
				, typeParameters: []
				, fields: []
				, target: null
				, resource: null
				, callable: null
				, cases: []
				, host: null
				, documentation: doc(`Checked Lean ${nativeLeanType(type)}.`)
				, source: source(type.name ?? nativeLeanType(type))
				, assurance: []
			};
			definitions.set(id, definition);
			if(type.kind === "record") definition.fields = type.fields.map(field => ({ name: field.name, type: reference(field.type), mutability: "immutable", documentation: doc(field.name) }));
			if(type.kind === "resource") definition.resource = { kindId: `resource:${type.name}`, disposal: "required", fallback: "queued-finalizer", cycles: "explicit-cut" };
			if(type.kind === "callback") definition.callable = {
				parameters: type.parameters.map(parameter)
				, result: site(type.result, true)
				, effects: ["host-call", "fails"]
				, failure: callbackFailure, resultMode: "value"
				, invocation: "many", reentry: "same-agent", selfDisposal: "defer"
			};
		}
		return { kind: "named", id };
	};
	const names = new Set(["true", "false", "close", "closed", "DESTROY", "CLONE", "CLONE_SKIP"]);
	const exports = elaborated.declarations.map(declaration => {
	  if(!identifier.test(declaration.name) || !identifier.test(declaration.module)) fail("invalid declaration identity");
	  const name = snake(declaration.name.split(".").at(-1));
	  if(names.has(name)) fail(`Perl name collision: ${name}`);
	  names.add(name);
	  declaration.parameters.forEach(parameter => { closed(parameter, ["name", "type"], "native parameter"); visit(parameter.type); }); visit(declaration.result);
	  return { ...declaration, publicName: name, symbol: `lb_${sha256(`${component.id}\0${declaration.name}`).slice(0, 24)}` };
	});
	if(!exports.length) fail("empty export set");
	const declarations = exports.map(item => ({
		id: `lean:${item.name}`
		, name: item.publicName
		, kind: "function"
		, owner: null
		, overloadKey: item.name
		, typeParameters: []
		, receiver: null
		, parameters: item.parameters.map((p, i) => parameter(p.type, i))
		, result: site(item.result, true)
		, mutability: "immutable"
		, effects: item.parameters.some(p => p.type.kind === "callback") ? ["host-call", "fails"] : []
		, failure: item.parameters.some(p => p.type.kind === "callback") ? callbackFailure : { mode: "none", errors: [], unexpected: "poison-runtime" }
		, resultMode: "value"
		, capabilities: []
		, assurance: []
		, documentation: doc(item.documentation ?? `Call ${item.name}.`)
		, source: { ...source(item.specialization?.declaration ?? item.name), extensions: {
			"lean-lang.org/theorem-references": item.theoremReferences
			, "lean-lang.org/source-position": item.sourcePosition
			, ...(item.specialization ? { "lean-lang.org/specialization": item.specialization } : {})
		} }
	}));
	const ir = {
		schemaVersion: 3
		, component
		, producers: [{ id: "lean", adapter: metadata.producer.adapter
			, adapterVersion: metadata.producer.adapterVersion
			, tool: "Lean", toolVersion: sourceIdentity.leanVersion
			, extensions: { "lean-lang.org/elaboration-sha256": elaborated.sha256 } }]
		, types: [...definitions.values()], declarations
		, errors: [{ id: "error:native-callback"
			, name: "NativeCallbackFailure"
			, category: "boundary"
			, payload: null
			, documentation: doc("A synchronous callback failed. Perl rethrows the original exception after native cleanup.") }]
		, capabilities: [], assurance: []
		, documentation: doc(`Checked native exports for ${component.name}.`)
	};
	validateBindingIr(ir);
	const model = { schemaVersion: 1
		, profile: "native-library-v1"
		, pointerBits: 64
		, byteOrder: "little"
		, component
		, moduleName
		, bindingIr: ir
		, bindingIrSha256: hashBindingIr(ir)
		, sourceIdentity
		, exports
		, types: [...allTypes.values()] };
	return Object.freeze(model);
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
