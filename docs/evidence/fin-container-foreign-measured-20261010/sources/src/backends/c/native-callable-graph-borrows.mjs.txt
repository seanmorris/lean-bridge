/**
 * Borrowed recursive callback payloads with a shared conversion budget.
 * Language frontends supply typed native values; the compiled Lean component
 * receives total carriers and never sees host ownership metadata.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { compileNativeCallableGraphPayloads } from "./native-callable-graph-payloads.mjs";
import { generateNativeCopiedGraphAdapters } from "./native-graph-adapters.mjs";

/**
 * Generate reusable payload converters and synchronous host callback adapters.
 * A call frame owns argument storage; each host reply transfers its root owner.
 *
 * @param ir - Authenticated public exports.
 * @param descriptor - Matching native callback descriptor.
 * @param options - Native or PHP-Wasm machine-word layout.
 * @param options.wordBits - Target pointer width.
 * @param options.initializer - Checked component initializer, when calls own readiness checks.
 */
export const generateNativeCallableGraphBorrows = (ir, descriptor, { wordBits = 64, initializer = null } = {}) => {
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor, { wordBits });
	const generated = generateNativeCopiedGraphAdapters(payloads.ir, payloads.abi, { wordBits, initializer, exportCalls: false });
	const p = generated.layout.prefix, header = ["#pragma once", `#include "${p}-graph-types.h"`];
	const lines = [generated.source
		, "enum { NG_CALLBACK = 6 };"
		, "typedef struct ng_borrow_frame { ng_budget budget; uint32_t status; void (*observe)(struct ng_borrow_frame *); } ng_borrow_frame;"
		, "static inline void ng_borrow_fail(ng_borrow_frame *frame, uint32_t status) {"
		, "  if (!frame->status && status) frame->status = status <= NG_CALLBACK ? status : NG_CALLBACK;"
		, "}"
		, "static inline void ng_borrow_observe(ng_borrow_frame *frame) { if (frame->observe) frame->observe(frame); }"];
	for(const signature of descriptor.callbacks)
	{
		const key = signature.key, name = `${p}_callback_${key}`;
		const parameters = signature.parameters.map(payloads.copy), result = payloads.copy(signature.result);
		const walker = node => `ng_${sha256(node.id).slice(0, 20)}`;
		const types = parameters.map((node, index) => `const ${node.name} *arg${index}`);
		header.push(`typedef struct ${name} {`
			, `  uint32_t (*call)(void *, ${[...types, `${result.name} *out`].join(", ")});`
			, "  void *context;", `} ${name};`);
		lines.push(`typedef struct { ${name} callback; ng_borrow_frame *frame; } ng_borrow_${key};`
			, `static inline lean_object *ng_invoke_${key}(void *context, ${parameters.map((_, index) => `lean_object *value${index}`).join(", ")}) {`
			, `  ng_borrow_${key} *host = context; ng_borrow_frame *frame = host->frame;`
			, "  ng_arena arena = { .head = NULL, .budget = &frame->budget };"
			, "  lean_object *returned = NULL;"
			, `  ${result.name} reply = {0};`
			, ...parameters.map((node, index) => `  ${node.name} arg${index} = {0};`)
			, "  ng_borrow_observe(frame);"
			, "  if (frame->status) goto cleanup;");
		for(const [index, node] of parameters.entries())
			lines.push(`  ng_borrow_fail(frame, ng_charge(&frame->budget, 1, sizeof(arg${index})));`
				, "  if (frame->status) goto cleanup;"
				, `  ng_borrow_fail(frame, ${walker(node)}_out(&arg${index}, value${index}, 0, &arena));`
				, `  value${index} = NULL;`
				, "  if (frame->status) goto cleanup;");
		lines.push("  if (!host->callback.call) { ng_borrow_fail(frame, NG_INVALID); goto cleanup; }"
			, `  ng_borrow_fail(frame, host->callback.call(host->callback.context, ${parameters.map((_, index) => `&arg${index}`).join(", ")}, &reply));`
			, "  ng_borrow_observe(frame);"
			, "  if (frame->status) goto cleanup;"
			, `  ng_borrow_fail(frame, ${walker(result)}_check(&reply, 0, 1, &frame->budget));`
			, `  if (!frame->status) returned = ${walker(result)}_in(&reply);`
			, "cleanup:"
			, ...result.aggregate ? [`  ${result.name}_clear(&reply);`] : []
			, ...parameters.map((_, index) => `  if (value${index}) lean_dec(value${index});`)
			, "  ng_release(arena.head);"
			, "  ng_borrow_observe(frame);"
			, "  if (frame->status && returned) { lean_dec(returned); returned = NULL; }"
			, "  return returned ? returned : lean_alloc_array(0, 0);", "}");
	}
	return { ...generated, payloads, header: header.join("\n") + "\n"
		, source: `#include "${p}-callable-borrows.h"\n` + lines.join("\n") + "\n" };
};
