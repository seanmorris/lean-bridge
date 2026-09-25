/**
 * Public C/GMP copied values, borrowed callbacks and owned recursive closures.
 * Native graph tokens and carriers never appear in the public consumer API.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { compileCallableGraphPackageModel } from "./callable-graph-model.mjs";
import { generateCopiedGraphPackage } from "./graph-package.mjs";
import { generateCopiedGmpGraphConversions } from "./gmp-graph-conversions.mjs";
import { cIdentifier } from "./generate.mjs";

/**
 * Generate status-returning public C calls over the authenticated graph ABI.
 *
 * @param ir - Compiler-authenticated copied graph and callable signatures.
 */
export const generateCallableCGraphPackage = ir => {
	const model = compileCallableGraphPackageModel(ir, ["c"]), p = model.prefix, m = p.toUpperCase();
	const converted = generateCopiedGmpGraphConversions(model.payloads.ir, { lifecycle: true });
	const nodes = new Map(converted.layout.nodes.map((node, index) => {
		const entry = { ...node, index, host: converted.types.find(type => type.id === node.id) };
		return [node.id, entry];
	}));
	const copy = ref => nodes.get(model.payloads.copy(ref).id);
	const nodeOf = node => nodes.get(node.id);
	const unit = node => node.ref?.name === "unit";
	const callbackName = node => node.gmpName;
	const ownedName = node => node.gmpOwnedName;
	const input = (node, name) => node.kind === "callback" ? `const ${callbackName(node)} *${name}`
		: `${nodeOf(node).host.integer ? "mpz_srcptr " : nodeOf(node).host.name + (node.aggregate ? " const *" : " ")}${name}`;
	const output = (node, name) => node.kind === "callback" ? `${ownedName(node)} **${name}`
		: `${nodeOf(node).host.integer ? "mpz_ptr " : nodeOf(node).host.name + " *"}${name}`;
	const address = (node, value) => nodeOf(node).host.integer ? value : `&${value}`;
	const initialize = (node, value) => node.aggregate ? `${nodeOf(node).host.name}_init(${address(node, value)});` : `${value} = 0;`;
	const clear = (node, value) => node.aggregate ? `${nodeOf(node).host.name}_clear(${address(node, value)});` : "";
	const walker = node => `${p}_gg_${nodeOf(node).index}`;
	const files = { ...generateCopiedGraphPackage(model.payloads.ir, ["c"]).files };
	const declarations = [], aliases = [], helpers = [], definitions = [];
	aliases.push(...model.cAliases);
	const constants = ir.errors.map((error, index) => `#define ${m}_ERROR_${cIdentifier(error.name).toUpperCase()} ((${p}_error_code)${index + 100})`);
	const support = `
#include <sys/types.h>
#include <unistd.h>
typedef struct {
  lb_gg_budget budget;
  uint32_t native_status;
  ${p}_status status;
  ${p}_error error;
  char message[1024];
} lb_gc_state;
static _Thread_local char lb_gc_message[1024];
static inline lb_gc_state lb_gc_begin(void) {
  return (lb_gc_state){ .budget = { .nodes = ${componentRecursiveLimits.valueNodes},
    .native_bytes = 16u * 1024u * 1024u, .storage_bytes = 16u * 1024u * 1024u } };
}
static inline void lb_gc_message_copy(lb_gc_state *state, ${p}_error error) {
  size_t length = error.message_length < sizeof(state->message) ? error.message_length : sizeof(state->message) - 1;
  if (length) memcpy(state->message, error.message, length);
  state->message[length] = 0;
  state->error = (${p}_error){error.code, state->message, length};
}
static inline uint32_t lb_gc_fail(lb_gc_state *state, uint32_t status) {
  if (status == 4) ${p}_graph_retire();
  if (!state->native_status && status) {
    state->native_status = status;
    ${p}_error error; state->status = ${p}_graph_finish(status, &error);
    lb_gc_message_copy(state, error);
  }
  return state->native_status;
}
static inline void lb_gc_host_fail(lb_gc_state *state, ${p}_status status, ${p}_error error) {
  if (!status || state->native_status) return;
  if (status > ${m}_STATUS_UNEXPECTED_ERROR || status < ${m}_STATUS_INVALID_ARGUMENT
      || !lb_gg_span(error.message, error.message_length, 1, 1)) { lb_gc_fail(state, 1); return; }
  state->native_status = 6; state->status = status; lb_gc_message_copy(state, error);
}
static inline void lb_gc_ready(lb_gc_state *state) {
  if (!${p}_graph_ready()) lb_gc_fail(state, 5);
}
static inline ${p}_status lb_gc_finish(lb_gc_state *state, ${p}_error *error) {
  if (!state->native_status) return ${p}_graph_finish(0, error);
  if (error) {
    memcpy(lb_gc_message, state->message, state->error.message_length + 1);
    *error = (${p}_error){state->error.code, lb_gc_message, state->error.message_length};
  }
  return state->status;
}
`;
	for(const node of nodes.values())
	{
		if(!node.aggregate) continue;
		const signature = `${p}_status ${node.host.name}_copy(${input(node, "value")}, ${output(node, "out")}, ${p}_error *error)`;
		declarations.push(signature + ";");
		definitions.push(signature + " {", "  lb_gc_state state = lb_gc_begin();"
			, `  if (!lb_gg_pointer(out, sizeof(${node.host.name}), _Alignof(${node.host.name}))) { lb_gc_fail(&state, 1); return lb_gc_finish(&state, error); }`
			, `  if (lb_gc_fail(&state, ${walker(node)}_check(value, 0, 1, &state.budget))) return lb_gc_finish(&state, error);`
			, `  ${node.host.name} returned; ${initialize(node, "returned")}`
			, `  ${node.name} native = {0};`
			, "  lb_gg_arena views = { .budget = &state.budget };"
			, "  lb_gg_arena owned = { .budget = &state.budget, .root = &returned, .root_size = sizeof(returned) };"
			, `  if (!lb_gc_fail(&state, ${walker(node)}_to(value, &native, &views)))`
			, `    lb_gc_fail(&state, ${walker(node)}_from(&native, ${address(node, "returned")}, 0, 1, &owned));`
			, "  lb_gg_release(views.head, NULL);"
			, "  if (state.native_status) lb_gg_release(owned.head, &returned);"
			, ...node.host.integer ? ["  else { mpz_swap(out, returned); lb_gg_release(owned.head, &returned); }"]
				: [`  else { ${node.host.name}_clear(out); returned._bridge_owner = owned.head; returned._bridge_release = owned.head ? lb_gg_release : NULL; *out = returned; }`]
			, "  return lb_gc_finish(&state, error);", "}");
	}
	for(const callback of model.callbacks.values())
	{
		const params = callback.parameters.map(copy), result = copy(callback.result), k = callback.index;
		const n = callbackName(callback), owned = ownedName(callback);
		declarations.push(`typedef ${p}_status (*${n}_fn)(${["void *context", ...params.map((node, index) => input(node, `a${index}`)), ...unit(result) ? [] : [output(result, "out")], `${p}_error *error`].join(", ")});`
			, `typedef struct ${n} { ${n}_fn call; void *context; } ${n};`
			, `typedef struct ${owned} ${owned};`);
		aliases.push(`typedef ${n} ${n.replace(`${p}_gmp_`, `${p}_`)};`
			, `typedef ${n}_fn ${n.replace(`${p}_gmp_`, `${p}_`)}_fn;`
			, `typedef ${owned} ${owned.replace(`${p}_gmp_`, `${p}_`)};`);
		helpers.push(`struct ${owned} { uint64_t token; pid_t process; };`
			, `typedef struct { const ${n} *callback; lb_gc_state *state; } lb_gc_callback${k};`);
		if(result.aggregate) helpers.push(`typedef struct { ${result.host.name} value; lb_gg_allocation *views; } lb_gc_reply${k};`
			, `static void lb_gc_release${k}(void *raw) {`
			, `  lb_gc_reply${k} *owner = raw; ${clear(result, "owner->value")}`
			, "  lb_gg_release(owner->views, NULL); LB_GMP_GRAPH_FREE(owner);", "}");
		const lines = [`static inline uint32_t lb_gc_invoke${k}(${["void *context", ...params.map((node, index) => `const ${node.name} *a${index}`), `${result.name} *out`].join(", ")}) {`
			, `  lb_gc_callback${k} *self = context; lb_gc_state *state = self->state;`
			, "  if (state->native_status) return state->native_status;"
			, `  ${p}_error error = {0}; ${p}_status status;`
			, `  ${result.host.name} returned; ${initialize(result, "returned")}`
			, `  ${result.name} native = {0};`
			, "  lb_gg_arena views = { .budget = &state->budget };"
			, ...result.aggregate ? [`  lb_gc_reply${k} *owner = NULL;`] : []];
		params.forEach((node, index) => lines.push(`  ${node.host.name} value${index}; ${initialize(node, `value${index}`)}`
			, `  lb_gg_arena argument${index} = { .budget = &state->budget, .root = &value${index}, .root_size = sizeof(value${index}) };`));
		params.forEach((node, index) => lines.push(`  if (lb_gc_fail(state, ${walker(node)}_from(a${index}, ${address(node, `value${index}`)}, 0, 1, &argument${index}))) goto done;`));
		lines.push(`  status = self->callback->call(${["self->callback->context", ...params.map((node, index) => node.aggregate && !node.host.integer ? `&value${index}` : `value${index}`), ...unit(result) ? [] : [address(result, "returned")], "&error"].join(", ")});`
			, "  lb_gc_host_fail(state, status, error); lb_gc_ready(state);"
			, "  if (state->native_status) goto done;"
			, `  if (lb_gc_fail(state, ${walker(result)}_check(${address(result, "returned")}, 0, 1, &state->budget))) goto done;`
			, `  if (lb_gc_fail(state, ${walker(result)}_to(${address(result, "returned")}, &native, &views))) goto done;`);
		if(result.aggregate) lines.push("  if (lb_gc_fail(state, lb_gg_charge(&state->budget.storage_bytes, 1, sizeof(*owner)))) goto done;"
			, "  owner = LB_GMP_GRAPH_MALLOC(sizeof(*owner)); if (!owner) { lb_gc_fail(state, 3); goto done; }"
			, ...result.host.integer ? ["  mpz_init(owner->value); mpz_swap(owner->value, returned);"]
				: [`  owner->value = returned; ${initialize(result, "returned")}`]
			, "  owner->views = views.head; views.head = NULL;"
			, `  native._bridge_owner = owner; native._bridge_release = lb_gc_release${k};`);
		lines.push("  *out = native;", "done:"
			, ...params.map((_, index) => `  lb_gg_release(argument${index}.head, &value${index});`)
			, `  ${clear(result, "returned")}`, "  lb_gg_release(views.head, NULL);"
			, "  lb_gc_ready(state); return state->native_status;", "}");
		helpers.push(...lines);
	}
	const expose = (name, params, args, body, result = `${p}_status`) => {
		const signature = `${result} ${name}(${params.join(", ")})`;
		declarations.push(signature + ";"); definitions.push(signature + " {", ...body, "}");
		aliases.push(`static inline ${result} ${name.replace(`${p}_gmp_`, `${p}_`)}(${params.join(", ")}) { ${result === "void" ? "" : "return "}${name}(${args.join(", ")}); }`);
	};
	const wrap = (name, params, result, native, closure = null) => {
		const isCallback = result.kind === "callback", inputParams = params.map((node, index) => input(node, `a${index}`));
		const pointer = isCallback ? "&returned->token" : address(result, "returned");
		const publicParams = [...closure ? [`const ${ownedName(closure)} *self`] : []
			, ...inputParams, ...unit(result) ? [] : [output(result, "out")]
			, `${p}_error *error`];
		const args = [...closure ? ["self"] : []
			, ...params.map((_, index) => `a${index}`)
			, ...unit(result) ? [] : ["out"], "error"];
		const lines = ["  lb_gc_state state = lb_gc_begin(); uint32_t status;"
			, ...closure ? [`  if (!lb_gg_pointer(self, sizeof(*self), _Alignof(${ownedName(closure)})) || self->process != getpid()) { lb_gc_fail(&state, 1); return lb_gc_finish(&state, error); }`, "  const uint64_t token = self->token;"] : []
			, ...unit(result) ? [] : [`  if (!lb_gg_pointer(out, sizeof(*out), _Alignof(${isCallback ? `${ownedName(result)} *` : nodeOf(result).host.name}))${isCallback ? " || *out" : ""}) { lb_gc_fail(&state, 1); return lb_gc_finish(&state, error); }`]
			, "  lb_gg_arena views = { .budget = &state.budget };"
			, ...isCallback ? [`  ${ownedName(result)} *returned = NULL;`]
				: [`  ${nodeOf(result).host.name} returned; ${initialize(result, "returned")}`
					, "  lb_gg_arena owned = { .budget = &state.budget, .root = &returned, .root_size = sizeof(returned) };"
					, `  ${result.name} returned_native = {0};`]];
		params.forEach((node, index) => {
			if(node.kind === "callback") lines.push(`  lb_gc_callback${node.index} callback${index} = {a${index}, &state};`
				, `  ${node.name} view${index} = {lb_gc_invoke${node.index}, &callback${index}};`);
			else lines.push(`  ${node.name} view${index} = {0};`);
		});
		params.forEach((node, index) => {
			if(node.kind === "callback") lines.push(`  if (!lb_gg_pointer(a${index}, sizeof(*a${index}), _Alignof(${callbackName(node)})) || !a${index}->call) { lb_gc_fail(&state, 1); goto done; }`);
			else lines.push(`  if (lb_gc_fail(&state, ${walker(node)}_check(${node.aggregate ? "" : "&"}a${index}, 0, 1, &state.budget))) goto done;`);
		});
		params.forEach((node, index) => {
			if(node.kind !== "callback") lines.push(`  if (lb_gc_fail(&state, ${walker(node)}_to(${node.aggregate ? "" : "&"}a${index}, &view${index}, &views))) goto done;`);
		});
		if(isCallback) lines.push("  if (lb_gc_fail(&state, lb_gg_charge(&state.budget.storage_bytes, 1, sizeof(*returned)))) goto done;"
			, "  returned = LB_GMP_GRAPH_MALLOC(sizeof(*returned)); if (!returned) { lb_gc_fail(&state, 3); goto done; }"
			, `  *returned = (${ownedName(result)}){ .process = getpid() };`);
		lines.push(`  status = ${native}(${[...closure ? ["token"] : [], ...params.map((_, index) => `&view${index}`), isCallback ? pointer : "&returned_native"].join(", ")});`
			, "  if (lb_gc_fail(&state, status)) goto done;");
		if(!isCallback) lines.push(`  lb_gc_fail(&state, ${walker(result)}_from(&returned_native, ${pointer}, 0, 1, &owned));`);
		lines.push("done:", "  lb_gg_release(views.head, NULL);");
		if(!isCallback && result.aggregate) lines.push(`  ${result.name}_clear(&returned_native);`);
		lines.push("  if (!state.native_status) lb_gc_ready(&state);");
		if(isCallback) lines.push(`  if (state.native_status && returned) { if (returned->token) ${result.dispose}(returned->token); LB_GMP_GRAPH_FREE(returned); }`
			, "  else if (!state.native_status) *out = returned;");
		else lines.push("  if (state.native_status) lb_gg_release(owned.head, &returned);"
			, ...unit(result) ? [] : nodeOf(result).host.integer ? ["  else { mpz_swap(out, returned); lb_gg_release(owned.head, &returned); }"]
				: result.aggregate ? [`  else { ${nodeOf(result).host.name}_clear(out); returned._bridge_owner = owned.head; returned._bridge_release = owned.head ? lb_gg_release : NULL; *out = returned; }`]
					: ["  else *out = returned;"]);
		lines.push("  return lb_gc_finish(&state, error);");
		expose(name, publicParams, args, lines);
	};
	expose(`${p}_gmp_initialize`, [`${p}_error *error`], ["error"], [`  return ${p}_graph_finish(${p}_graph_initialize(), error);`]);
	for(const callback of model.callbacks.values())
	{
		const owned = ownedName(callback);
		wrap(`${owned}_call`, callback.parameters.map(copy), copy(callback.result), callback.call, callback);
		expose(`${owned}_dispose`, [`${owned} **self`], ["self"], ["  if (!self || !*self) return;"
			, `  ${owned} *value = *self; *self = NULL;`
			, `  if (value->process == getpid() && value->token) ${callback.dispose}(value->token);`
			, "  LB_GMP_GRAPH_FREE(value);"], "void");
	}
	for(const fn of model.functions) wrap(`${p}_gmp_${fn.field}`, fn.parameters, fn.result, fn.native);
	files[`gmp/include/detail/${p}-gmp-api.h`] = ["#pragma once"
		, `#include "${p}-status.h"`, `#include "${p}-gmp-graph-values.h"`
		, ...constants, "#ifdef __cplusplus", 'extern "C" {', "#endif"
		, "/* Callback arguments are borrowed until return. Fill the initialized reply"
		, "   with owned values using the generated copy functions or mpz_set."
		, "   Copy functions accept initialized output and support in-place copying."
		, "   Closure outputs require a NULL slot. Dispose through the pointer address. */"
		, ...declarations, "#ifdef __cplusplus", "}", "#endif", ""].join("\n");
	files[`gmp/include/${p}.h`] = ["#pragma once", `#include "detail/${p}-gmp-api.h"`, ...aliases, ""].join("\n");
	files[`gmp/src/${p}_gmp.c`] = [`#include "detail/${p}-gmp-api.h"`
		, `#include "${p}-graph.h"`, `#include "${p}-gmp-conversions.h"`
		, support, ...helpers, ...definitions, ""].join("\n");
	return { ...model, files };
};
