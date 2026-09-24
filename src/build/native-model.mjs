/**
 * Checked native-library-v1 projection. Independent of the wasm32 scalar frame.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateNativeType } from "../analyze/native-types.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { createElaboratedSemanticModel } from "../analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../analyze/reviewed-source.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
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
	if(type.kind === "list") return `(List ${nativeLeanType(type.element)})`;
	if(type.kind === "option") return `(Option ${nativeLeanType(type.element)})`;
	if(type.kind === "result") return `(Except ${nativeLeanType(type.arguments[1])} ${nativeLeanType(type.arguments[0])})`;
	if(type.kind === "tuple") return `(Prod ${type.arguments.map(nativeLeanType).join(" ")})`;
	if(type.kind === "callback") return `(${[...type.parameters, type.result].map(nativeLeanType).join(" → ")})`;
	return type.lean;
};
const absoluteLeanType = type => {
	if(type.kind === "array") return `(_root_.Array ${absoluteLeanType(type.element)})`;
	if(type.kind === "list") return `(_root_.List ${absoluteLeanType(type.element)})`;
	if(type.kind === "option") return `(_root_.Option ${absoluteLeanType(type.element)})`;
	if(type.kind === "result") return `(_root_.Except ${absoluteLeanType(type.arguments[1])} ${absoluteLeanType(type.arguments[0])})`;
	if(type.kind === "tuple") return `(_root_.Prod ${type.arguments.map(absoluteLeanType).join(" ")})`;
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
	if(type.name === "char") return "uint32_t";
	if(type.name === "usize" || type.name === "isize") return "size_t";
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
	if(type.kind === "list") return `lb_t${nativeTypeKey(type)}_from_array(lean_mk_empty_array())`;
	if(type.kind === "option") return `lb_t${nativeTypeKey(type)}_none(lean_box(0))`;
	if(type.kind === "result") return `lb_t${nativeTypeKey(type)}_ok(${nativeCallbackDefault(type.arguments[0])})`;
	if(type.kind === "tuple") return `lb_t${nativeTypeKey(type)}_make(${type.arguments.map(nativeCallbackDefault).join(", ")})`;
	if(type.kind === "variant") return `lb_t${nativeTypeKey(type)}_make0(${type.cases[0].fields.map(field => nativeCallbackDefault(field.type)).join(", ") || "lean_box(0)"})`;
	if(type.kind === "record") return `lb_t${nativeTypeKey(type)}_make(${type.fields.map(f => nativeCallbackDefault(f.type)).join(", ") || "lean_box(0)"})`;
	if(type.kind !== "primitive") fail("callback results must be copied values; identity results need a failure representation");
	if(type.name === "string") return 'lean_mk_string("")';
	if(type.name === "bytes") return "lean_alloc_sarray(1, 0, 0)";
	return nativeObjectType(type) ? "lean_box(0)" : "0";
};

const callbackLeanDefault = type => {
	if(type.kind === "array") return "#[]";
	if(type.kind === "list") return "[]";
	if(type.kind === "option") return "_root_.Option.none";
	if(type.kind === "result") return `(_root_.Except.ok ${callbackLeanDefault(type.arguments[0])})`;
	if(type.kind === "tuple") return `(_root_.Prod.mk ${type.arguments.map(callbackLeanDefault).join(" ")})`;
	if(type.kind === "record") return `(_root_.${type.constructor} ${type.fields.map(f => callbackLeanDefault(f.type)).join(" ")})`;
	if(type.kind === "variant") return `(_root_.${type.cases[0].constructor} ${type.cases[0].fields.map(f => callbackLeanDefault(f.type)).join(" ")})`;
	if(type.kind !== "primitive") fail("callback results must be copied values");
	return { unit: "()", bool: "false", char: "(_root_.Char.ofNat 0)", string: '""', bytes: "_root_.ByteArray.empty" }[type.name] ?? "0";
};

const closed = (value, fields, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
	  || Object.keys(value).sort().join(",") !== [...fields].sort().join(",")) fail(`invalid ${label} fields`);
};

// Alias names remain in compiler metadata and Binding IR. Native conversion
// helpers use the compiler-checked target representation without a new wrapper.
const nativeRepresentation = type => {
	if(type.kind === "alias") return nativeRepresentation(type.target);
	if(["array", "list", "option"].includes(type.kind)) return { ...type, element: nativeRepresentation(type.element) };
	if(["result", "tuple"].includes(type.kind)) return { ...type, arguments: type.arguments.map(nativeRepresentation) };
	if(type.kind === "record") return { ...type, fields: type.fields.map(field => ({ ...field, type: nativeRepresentation(field.type) })) };
	if(type.kind === "variant") return { ...type, cases: type.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field, type: nativeRepresentation(field.type) })) })) };
	if(type.kind === "callback") return { ...type, parameters: type.parameters.map(nativeRepresentation), result: nativeRepresentation(type.result) };
	return type;
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
		if(["array", "list", "option"].includes(type.kind)) visit(type.element);
		if(["result", "tuple"].includes(type.kind)) type.arguments.forEach(visit);
		if(type.kind === "record") for(const field of type.fields) visit(field.type);
		if(type.kind === "variant") for(const branch of type.cases) for(const field of branch.fields) visit(field.type);
		if(type.kind === "callback")
		{ type.parameters.forEach(visit); visit(type.result); }
		allTypes.set(key, { ...type, key });
	};
	const checked = elaborated.declarations.map(source => {
		const declaration = { ...source, parameters: source.parameters.map(parameter => ({ ...parameter, type: nativeRepresentation(parameter.type) })), result: nativeRepresentation(source.result) };
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
	const bindingIr = sourceIdentity.reviewedBindingIr === undefined ? semantic.document
		: reconcileReviewedSource(sourceIdentity.reviewedBindingIr, semantic.document, sourceIdentity);
	const model = { schemaVersion: sourceIdentity.reviewedBindingIr === undefined ? 2 : 3
		, profile
		, pointerBits
		, byteOrder: "little"
		, component
		, ...(moduleName === undefined ? {} : { moduleName })
		, bindingIr
		, bindingIrSha256: hashBindingIr(bindingIr)
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
	const copied = type => type.kind === "primitive" || (["array", "list", "option"].includes(type.kind) && copied(type.element))
		|| (["result", "tuple"].includes(type.kind) && type.arguments.every(copied)) || (type.kind === "record" && type.fields.every(field => copied(field.type)))
		|| (type.kind === "variant" && type.cases.every(branch => branch.fields.every(field => copied(field.type))));
	const admitted = type => copied(type) || (type.kind === "callback" && type.parameters.every(parameter => parameter.kind === "primitive") && type.result.kind === "primitive");
	const unsupported = model.exports.find(item => !item.parameters.every(parameter => admitted(parameter.type)) || !admitted(item.result));
	if(unsupported)
	{
		const declaration = model.bindingIr.declarations.find(item => item.source.declaration === unsupported.name);
		const source = declaration.source.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${unsupported.name}: PHP-Wasm compilation admits copied primitives, arrays, Lists, records, concrete variants, options, results, binary products and synchronous primitive callables`), { code: "unsupported-php-wasm-signature", details: { declaration: declaration.id, source: source ?? null } });
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
	const prototypes = ["#include <lean/lean.h>", "#include <stdint.h>", `LEAN_CASSERT(sizeof(size_t) * 8 == ${model.pointerBits});`];
	const emit = (symbol, parameters, result, body) => {
		const ps = parameters.length ? parameters : [{ name: "unit", type: { kind: "primitive", name: "unit", lean: "Unit" } }];
		const callback = result.kind === "callback";
		lines.push(`@[export ${symbol}]`, `def f_${symbol} ${ps.map(p => `(${p.name} : ${absoluteLeanType(p.type)})`).join(" ")} : ${callback ? `ClosureCarry${nativeTypeKey(result)}` : absoluteLeanType(result)} :=`, `  ${callback ? `⟨${body}⟩` : body}`, "");
		prototypes.push(`${nativeCType(result)} ${symbol}(${ps.map(p => `${nativeCType(p.type)} ${p.name}`).join(", ")});`);
	};
	for(const item of model.exports) emit(item.symbol, item.parameters.map((p, i) => ({ name: `a${i}`, type: p.type })), item.result, `${item.specialization ? `(${item.specialization.application})` : `_root_.${item.name}`} ${item.parameters.map((_, i) => `a${i}`).join(" ")}`);
	for(const type of model.types)
	{
		const bool = { kind: "primitive", name: "bool", lean: "Bool" };
		if(type.kind === "list")
		{
			const array = { kind: "array", element: type.element };
			emit(`lb_t${type.key}_from_array`, [{ name: "value", type: array }], type, "value.toList");
			// One excess pointer makes any truncated result exceed the copy budget.
			// The tail-recursive walker avoids allocating an intermediate List.
			emit(`lb_t${type.key}_to_array`, [{ name: "value", type }], array,
				`let rec loop : _root_.Nat → ${absoluteLeanType(type)} → ${absoluteLeanType(array)} → ${absoluteLeanType(array)}\n`
				+ "    | 0, _, acc => acc\n    | _, [], acc => acc\n    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push head)\n"
				+ `  loop ${nativeCopyLimit / (model.pointerBits / 8) + 1} value #[]`);
		}
		if(type.kind === "option")
		{
			emit(`lb_t${type.key}_none`, [], type, "_root_.Option.none");
			emit(`lb_t${type.key}_some`, [{ name: "value", type: type.element }], type, "_root_.Option.some value");
			emit(`lb_t${type.key}_has`, [{ name: "value", type }], bool, "match value with | .none => false | .some _ => true");
			emit(`lb_t${type.key}_get0`, [{ name: "value", type }], type.element, `match value with | .none => ${callbackLeanDefault(type.element)} | .some item => item`);
		}
		if(type.kind === "result")
		{
			emit(`lb_t${type.key}_has`, [{ name: "value", type }], bool, "match value with | .ok _ => true | .error _ => false");
			for(const [i, branch] of ["ok", "error"].entries())
			{
				emit(`lb_t${type.key}_${branch}`, [{ name: "value", type: type.arguments[i] }], type, `_root_.Except.${branch} value`);
				emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], type.arguments[i], `match value with | .${branch} item => item | _ => ${callbackLeanDefault(type.arguments[i])}`);
			}
		}
		if(type.kind === "tuple")
		{
			emit(`lb_t${type.key}_make`, type.arguments.map((child, i) => ({ name: `a${i}`, type: child })), type, "_root_.Prod.mk a0 a1");
			type.arguments.forEach((child, i) => emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], child, `value.${i + 1}`));
		}
		if(type.kind === "record")
		{
			emit(`lb_t${type.key}_make`, type.fields.map((f, i) => ({ name: `a${i}`, type: f.type })), type, `_root_.${type.constructor} ${type.fields.map((_, i) => `a${i}`).join(" ")}`);
			type.fields.forEach((field, i) => emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], field.type, `_root_.${field.projection} value`));
		}
		if(type.kind === "variant")
		{
			emit(`lb_t${type.key}_tag`, [{ name: "value", type }], { kind: "primitive", name: "uint32", lean: "UInt32" },
				`match value with ${type.cases.map((branch, i) => `| .${branch.name} ${branch.fields.map(() => "_").join(" ")} => ${i}`).join(" ")}`);
			type.cases.forEach((branch, i) => {
				emit(`lb_t${type.key}_make${i}`, branch.fields.map((f, j) => ({ name: `a${j}`, type: f.type })), type,
					`_root_.${branch.constructor} ${branch.fields.map((_, j) => `a${j}`).join(" ")}`);
				branch.fields.forEach((field, j) => emit(`lb_t${type.key}_get${i}_${j}`, [{ name: "value", type }], field.type,
					`match value with | .${branch.name} ${branch.fields.map((_, k) => k === j ? "item" : "_").join(" ")} => item${type.cases.length > 1 ? ` | _ => ${callbackLeanDefault(field.type)}` : ""}`));
			});
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
