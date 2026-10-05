/**
 * Typed structured callback trampolines over the recursive copied-value wire.
 * Callback arguments belong to a native allocation ledger. Host replies remain
 * borrowed from the enclosing JavaScript call until Lean has copied them.
 *
 * @file
 */
import { assertComponentStructuredCallableAbi } from "../abi/component-structured-callables.mjs";
import { componentRecursiveLimits } from "../abi/component-recursive.mjs";
import { componentRecursiveWalker, generateComponentRecursiveAdapters } from "./component-recursive-adapters.mjs";
import { componentStructuredCallablePrefix, componentStructuredCopiedView } from "./component-structured-callable-lean.mjs";

const budget = `  recursive_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = ${componentRecursiveLimits.valueNodes}, .owner = NULL, .path = {0} };`;
const parameters = count => Array(Math.max(1, count)).fill("lean_object *").join(", ");

/**
 * Generate native adapters without inspecting Lean constructor or closure layout.
 * All decoded values and closures use one-element Array carriers from Lean.
 *
 * @param abi - Authenticated copied-payload callable descriptor.
 */
export const generateComponentStructuredCallableAdapters = abi => {
	assertComponentStructuredCallableAbi(abi);
	const copied = componentStructuredCopiedView(abi);
	const walker = type => componentRecursiveWalker(copied, type);
	const callbacks = new Map(abi.callbacks.map(signature => [signature.id, signature]));
	const identity = type => type.kind === "named" && callbacks.has(type.id);
	const prefix = signature => componentStructuredCallablePrefix(abi, signature);
	const lines = [generateComponentRecursiveAdapters(copied, { exportFrames: false })];
	for(const signature of abi.callbacks)
		lines.push(`extern lean_object *${prefix(signature)}_wrap(size_t);`
			, `extern lean_object *${prefix(signature)}_apply(lean_object *, ${parameters(signature.parameters.length)});`
			, `static uint32_t ${prefix(signature)}_frame(lean_object *, bridge_scalar_frame *);`);
	const frame = (signature, name, target, closure = false) => {
		const names = signature.parameters.map((_, index) => `a${index}`);
		lines.push(closure ? `static uint32_t ${name}(lean_object *closure, bridge_scalar_frame *frame) {`
			: `LEAN_EXPORT uint32_t ${name}(bridge_scalar_frame *frame) {`
		, `  uint32_t status = bridge_recursive_frame_validate(frame, ${names.length});`
		, `  if (status) { ${closure ? "lean_dec(closure); " : ""}return status; }`
		, "  if (bridge_recursive_abi() != 1 || bridge_callable_abi() != 1) status = 6;", budget);
		for(const [index, type] of signature.parameters.entries())
		{
			if(identity(type)) lines.push("  if (!status) {"
				, "    if (!budget.nodes) status = 4;"
				, `    else { --budget.nodes; status = bridge_copied_validate(&frame->args[${index}], 4, 0, &budget.bytes); }`
				, `    if (!status && !frame->args[${index}].bits) status = 3;`, "  }");
			else lines.push(`  if (!status) status = ${walker(type)}_validate(&frame->args[${index}], 0, &budget);`);
		}
		lines.push("  if (!status && (budget.bytes < 16 || !budget.nodes)) status = 4;"
			, "  if (!status) { budget.bytes -= 16; status = bridge_recursive_arena_open(frame, &budget.owner); }"
			, `  if (status) { ${closure ? "lean_dec(closure); " : ""}frame->status = status; return status; }`);
		for(const [index, type] of signature.parameters.entries())
			lines.push(`  lean_object *a${index} = ${identity(type)
				? `${prefix(callbacks.get(type.id))}_wrap((size_t)frame->args[${index}].bits)`
				: `${walker(type)}_decode(&frame->args[${index}])`};`);
		lines.push(`  lean_object *result = ${target}(${[...(closure ? ["closure"] : []), ...names].join(", ") || "lean_box(0)"});`);
		if(identity(signature.result))
		{
			const callback = callbacks.get(signature.result.id);
			lines.push("  if (!lean_is_array(result) || lean_array_size(result) != 1) { lean_dec(result); status = 6; }"
				, "  else {", "    --budget.nodes;"
				, `    uint32_t token = bridge_callable_store(result, "${callback.key}", ${prefix(callback)}_frame);`
				, "    if (!token) status = 9;", "    else { frame->result.kind = 4; frame->result.bits = token; }", "  }");
		}
		else lines.push(`  status = ${walker(signature.result)}_encode(&frame->result, result, 0, &budget);`);
		lines.push("  if (status) bridge_recursive_frame_clear(frame);", "  frame->status = status;", "  return status;", "}", "");
	};
	for(const signature of abi.callbacks)
	{
		const symbol = prefix(signature);
		frame(signature, `${symbol}_frame`, `${symbol}_apply`, true);
		lines.push(`lean_object *${symbol}_invoke(size_t token, ${signature.parameters.map((_, index) => `lean_object *a${index}`).join(", ")}) {`
			, `  struct { uint32_t version, bytes, status, argc; bridge_scalar_slot result, args[${signature.parameters.length}]; } storage = {0};`
			, "  bridge_scalar_frame *frame = (bridge_scalar_frame *)&storage;"
			, `  frame->version = 8; frame->bytes = sizeof(storage); frame->argc = ${signature.parameters.length};`
			, budget, "  uint32_t status = bridge_recursive_arena_open(frame, &budget.owner);");
		for(const [index, type] of signature.parameters.entries())
			lines.push("  if (!status && (budget.bytes < 16 || !budget.nodes)) status = 4;"
				, `  if (status) lean_dec(a${index});`
				, `  else { budget.bytes -= 16; status = ${walker(type)}_encode(&frame->args[${index}], a${index}, 0, &budget); }`);
		lines.push("  frame->status = status;"
			, `  uint32_t dispatched = bridge_callable_dispatch((uint32_t)token, "${signature.key}", frame);`
			, "  if (!status) status = dispatched ? dispatched : frame->status;"
			, "  if (!status) {"
			, `    status = ${walker(signature.result)}_validate(&frame->result, 0, &budget);`
			, "    if (status) {"
			, "      /* Report invalid replies without invoking the host callback again. */"
			, "      frame->status = status;"
			, `      bridge_callable_dispatch((uint32_t)token, "${signature.key}", frame);`, "    }", "  }"
			, `  lean_object *result = status ? lean_alloc_array(0, 0) : ${walker(signature.result)}_decode(&frame->result);`
			, "  bridge_recursive_frame_clear(frame);", "  return result;", "}", "");
	}
	for(const item of abi.exports)
	{
		lines.push(`extern lean_object *${item.symbol}_lean(${parameters(item.parameters.length)});`);
		frame(item, item.symbol, `${item.symbol}_lean`);
	}
	return lines.join("\n");
};
