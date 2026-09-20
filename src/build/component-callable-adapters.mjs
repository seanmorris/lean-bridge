/**
 * Typed Lean/C trampolines for the wasm32 primitive callable boundary.
 *
 * @file
 */
import { assertComponentCallableAbi, assertComponentCallableBindings, componentCallableSignatureText } from "../abi/component-callables.mjs";
import { componentScalarTypes, assertComponentSignature } from "../abi/component-scalars.mjs";
import { generateComponentScalarAdapters } from "./component-scalar-adapters.mjs";
import { assertComponentCopiedBindings, componentCopiedAbi, componentCopiedDispatch } from "../abi/component-copied.mjs";
import { sha256 } from "../capsule/node.mjs";
import { componentRecordAbi, componentRecordDispatch, componentRecordDefinitions, assertComponentRecordBindings } from "../abi/component-records.mjs";

/**
 * Admit scalar or primitive callable declarations and derive their private ABI.
 *
 * @param document - Validated compiler-owned Binding IR.
 */
export const createComponentPrivateAbi = document => {
	const records = document.types.some(type => type.kind === "record");
	const copied = document.declarations.some(item => [...item.parameters.map(p => p.type), item.result.type].some(type => type.kind === "apply"));
	const callbacks = document.types.filter(type => type.kind === "callback").map(type => {
		const signature = { parameters: type.callable.parameters.map(parameter => parameter.type), result: type.callable.result.type };
		return { id: type.id, key: sha256(componentCallableSignatureText(signature)).slice(0, 40), ...signature };
	});
	const abi = {
		version: callbacks.length ? 3 : records ? componentRecordAbi : copied ? componentCopiedAbi : 2
		, dispatch: callbacks.length ? "scalar-callable-frame-v1" : records ? componentRecordDispatch : copied ? componentCopiedDispatch : "scalar-frame-v2"
		, ...(callbacks.length ? { callbacks } : {})
		, ...(records && !callbacks.length ? { records: componentRecordDefinitions(document) } : {})
		, exports: document.declarations.map(declaration => ({
			bindingId: declaration.id
			, symbol: `lean_bridge_${sha256(`${document.component.id}\0${declaration.id}`).slice(0, 24)}`
			, parameters: declaration.parameters.map(parameter => parameter.type)
			, result: declaration.result.type
			, resultMode: declaration.resultMode }))
	};
	if(callbacks.length) assertComponentCallableBindings(abi, document);
	else if(records) assertComponentRecordBindings(abi, document);
	else if(copied) assertComponentCopiedBindings(abi, document);
	else for(const declaration of document.declarations) assertComponentSignature(declaration);
	return abi;
};

const object = type => ["unit", "nat", "int", "string", "bytes"].includes(type.name) || type.kind === "named";
const cType = type => object(type) ? "lean_object *" : type.name === "bool" ? "uint8_t" : type.name === "char" ? "uint32_t"
	: ["usize", "isize"].includes(type.name) ? "size_t" : type.name === "float32" ? "float" : type.name === "float64" ? "double" : `${type.name.replace(/^int/, "uint")}_t`;
const tag = type => componentScalarTypes.indexOf(type.name);
const prefix = (abi, signature) => `${abi.exports[0].symbol}_cb${signature.key}`;
const defaultLean = type => ({ unit: "()", bool: "false", char: "(_root_.Char.ofNat 0)", string: '""', bytes: "_root_.ByteArray.empty" })[type.name] ?? "0";
const defaultC = type => type.name === "string" ? 'lean_mk_string("")' : type.name === "bytes" ? "lean_alloc_sarray(1, 0, 0)" : object(type) ? "lean_box(0)" : "0";

/**
 * Generate typed closure carriers, invocation wrappers and extern declarations.
 *
 * @param abi - Private callable ABI.
 * @param leanType - Primitive Lean type renderer.
 */
export const componentCallableLeanPrelude = (abi, leanType) => abi.callbacks.flatMap(signature => {
	const key = signature.key, symbol = prefix(abi, signature);
	const type = `(${[...signature.parameters, signature.result].map(leanType).join(" → ")})`;
	const names = signature.parameters.map((_, index) => `a${index}`), args = names.join(" ");
	const ps = signature.parameters.map((type, index) => `(${names[index]} : ${leanType(type)})`).join(" ");
	return [`structure ClosureCarry${key} where`, `  value : ${type}`, ""
		, `@[extern "${symbol}_invoke"]`
		, `opaque invoke_${key} (token : _root_.USize) ${ps} : ${leanType(signature.result)} := ${defaultLean(signature.result)}`
		, ""
		, `@[export ${symbol}_wrap]`
		, `def wrap_${key} (token : _root_.USize) : ClosureCarry${key} := ⟨fun ${args} => invoke_${key} token ${args}⟩`
		, ""
		, `@[export ${symbol}_apply]`
		, `def apply_${key} (closure : ${type}) ${ps} : ${leanType(signature.result)} := closure ${args}`
		, ""];
});

const encode = (slot, type, value) => {
	if(object(type)) return [`  { uint32_t encoded = bridge_scalar_encode_object(&${slot}, ${tag(type)}, ${value}); if (!frame->status) frame->status = encoded; }`];
	const lines = [`  ${slot}.kind = ${tag(type)};`];
	if(type.name.startsWith("float")) lines.push(`  memcpy(&${slot}.bits, &${value}, sizeof(${value}));`);
	else if(type.name === "isize") lines.push(`  ${slot}.bits = (uint64_t)(int64_t)(int32_t)${value};`);
	else lines.push(`  ${slot}.bits = ${type.name.startsWith("int") ? `(uint64_t)(int64_t)(${type.name}_t)` : "(uint64_t)"}${value};`);
	return lines;
};
const decode = (slot, type, name) => object(type) ? [`  ${cType(type)} ${name} = bridge_scalar_decode_object(&${slot});`]
	: type.name.startsWith("float") ? [`  ${cType(type)} ${name}; memcpy(&${name}, &${slot}.bits, sizeof(${name}));`]
		: [`  ${cType(type)} ${name} = (${cType(type)})${slot}.bits;`];

/**
 * Consume Lean arguments, contain host failures and retain no copied views.
 *
 * @param abi - Authenticated private descriptor emitted beside Lean wrappers.
 */
export const generateComponentCallableAdapters = abi => {
	assertComponentCallableAbi(abi);
	const lines = ['#include "component_scalar.h"', "#include <string.h>", '_Static_assert(sizeof(size_t) == 4, "callable frames require wasm32 Lean");', ""];
	const signatures = new Map(abi.callbacks.map(signature => [signature.id, signature]));
	for(const signature of abi.callbacks)
	{
		const symbol = prefix(abi, signature), types = signature.parameters, result = signature.result;
		const params = types.map((type, index) => `${cType(type)} a${index}`), args = types.map((_, index) => `a${index}`);
		lines.push(`extern lean_object *${symbol}_wrap(size_t);`, `extern ${cType(result)} ${symbol}_apply(lean_object *, ${types.map(cType).join(", ")});`);
		lines.push(`static uint32_t ${symbol}_frame(lean_object *closure, bridge_scalar_frame *frame) {`, `  uint32_t status = bridge_scalar_frame_validate(frame, ${types.length});`);
		for(const [index, type] of types.entries()) lines.push(`  if (!status) status = bridge_scalar_slot_validate(&frame->args[${index}], ${tag(type)});`);
		lines.push("  if (status) { lean_dec(closure); return status; }");
		for(const [index, type] of types.entries()) lines.push(...decode(`frame->args[${index}]`, type, `a${index}`));
		lines.push(`  ${cType(result)} result = ${symbol}_apply(closure, ${args.join(", ")});`, ...encode("frame->result", result, "result"), "  return frame->status;", "}");
		lines.push(`${cType(result)} ${symbol}_invoke(size_t token, ${params.join(", ")}) {`
			, `  struct { uint32_t version, bytes, status, argc; bridge_scalar_slot result, args[${types.length}]; } storage = {0};`
			, "  bridge_scalar_frame *frame = (bridge_scalar_frame *)&storage;"
			, `  frame->version = 2; frame->bytes = sizeof(storage); frame->argc = ${types.length};`);
		for(const [index, type] of types.entries()) lines.push(...encode(`frame->args[${index}]`, type, `a${index}`));
		lines.push(`  uint32_t status = bridge_callable_dispatch((uint32_t)token, "${signature.key}", frame);`
			, "  bridge_scalar_slot checked = frame->result; checked.flags &= ~2u;"
			, `  if (status || frame->status || bridge_scalar_slot_validate(&checked, ${tag(result)})) { bridge_callable_frame_clear(frame); return ${defaultC(result)}; }`
			, ...decode("frame->result", result, "result"), "  bridge_callable_frame_clear(frame);", "  return result;", "}", "");
	}
	for(const item of abi.exports)
	{
		if([...item.parameters, item.result].every(type => type.kind === "primitive"))
		{ lines.push(generateComponentScalarAdapters({ exports: [item] })); continue; }
		lines.push(`extern ${cType(item.result)} ${item.symbol}_lean(${item.parameters.length ? item.parameters.map(cType).join(", ") : "lean_object *"});`
			, `LEAN_EXPORT uint32_t ${item.symbol}(bridge_scalar_frame *frame) {`
			, `  uint32_t status = bridge_scalar_frame_validate(frame, ${item.parameters.length});`
			, "  if (status) return status;", "  if (bridge_callable_abi() != 1) return 9;");
		for(const [index, type] of item.parameters.entries()) lines.push(`  if ((status = bridge_scalar_slot_validate(&frame->args[${index}], ${type.kind === "named" ? 4 : tag(type)}))) return status;`);
		for(const [index, type] of item.parameters.entries())
			if(type.kind === "named") lines.push(`  lean_object *a${index} = ${prefix(abi, signatures.get(type.id))}_wrap((size_t)frame->args[${index}].bits);`);
			else lines.push(...decode(`frame->args[${index}]`, type, `a${index}`));
		lines.push(`  ${cType(item.result)} result = ${item.symbol}_lean(${item.parameters.length ? item.parameters.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`);
		if(item.result.kind === "named")
		{
			const signature = signatures.get(item.result.id);
			lines.push(`  uint32_t token = bridge_callable_store(result, "${signature.key}", ${prefix(abi, signature)}_frame);`
				, "  if (!token) return 9;", "  frame->result.kind = 4; frame->result.bits = token;", "  return 0;");
		}
		else lines.push(...encode("frame->result", item.result, "result"), "  return frame->status;");
		lines.push("}", "");
	}
	return lines.join("\n");
};
