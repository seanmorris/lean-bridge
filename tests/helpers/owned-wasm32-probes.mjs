/**
 * Bind the existing independent C oracles to wasm32 ownership carriers.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Preserve the authored scalar and aggregate assertions without guessing layouts.
 *
 * @param generated - Compiler-authenticated width-specific adapter.
 * @param scalars - Select the nineteen-primitive fixture instead of recursive values.
 */
export const ownedWasm32Bindings = (generated, scalars) => {
	const { layout, carriers } = generated;
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const fn = name => layout.functions.find(item => item.name === name);
	const names = { Ticket: "lean:Owned.Ticket", Nat: "primitive:nat", Text: "primitive:string" };
	if(scalars)
	{
		Object.assign(names, { Packet: "lean:Owned.Packet"
			, Scalars: "lean:Owned.Scalars"
			, Empty: "lean:Owned.Empty", Units: fn("units").result });
		names.OuterOption = nodes.get(names.Packet).fields[2].type;
		names.InnerOption = nodes.get(names.OuterOption).fields[0].type;
		assert.equal(nodes.get(names.Scalars).fields.length, 19);
	}
	else
	{
		Object.assign(names, { Bundle: "lean:Owned.Bundle"
			, Payload: "lean:Owned.Payload"
			, Choice: "lean:Owned.Choice", Tree: "lean:Owned.Tree"
			, Integer: "primitive:int", Bytes: "primitive:bytes" });
		for(const [name, api] of Object.entries({ Tickets: "echoArray"
			, History: "echoList"
			, Optional: "echoOption", Result: "echoResult", Tuple: "echoTuple"
			, Row: "echoRow"
			, Nested: "echoNested" })) names[name] = fn(api).parameters[0];
		names.RecordClosure = fn("makeRecord").result;
		names.TreeClosure = fn("makeRecursive").result;
		names.RecordCallback = fn("callbackRecord").parameters[1];
		names.TreeCallback = fn("callbackRecursive").parameters[1];
		names.Trees = nodes.get(names.Tree).cases[1].fields[0].type;
		names.TupleTail = nodes.get(names.Tuple).fields[1].type;
		names.NestedList = nodes.get(names.Nested).element;
		names.NestedOption = nodes.get(names.NestedList).element;
	}
	const lines = [`#define COMPONENT_ID ${JSON.stringify(layout.model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${carriers.module}`];
	for(const [name, id] of Object.entries(names))
	{
		lines.push(`typedef ${nodes.get(id).cName} ${name};`
			, `#define ${name}_in ${nodes.get(id).walker}_in`
			, `#define ${name}_out ${nodes.get(id).walker}_out`);
	}
	for(const item of layout.functions) lines.push(`#define V_${item.name} ${item.symbol}`
		, `#define C_${item.name} ${carriers.symbols.exports[item.id]}`);
	if(scalars) for(const [prefix, name] of [["S", "Scalars"], ["P", "Packet"]])
		for(const field of nodes.get(names[name]).fields) lines.push(`#define ${prefix}_${field.sourceName} ${field.name}`);
	else for(const name of ["RecordClosure", "TreeClosure", "RecordCallback", "TreeCallback"])
		lines.push(`#define ${name}_apply ${layout.callbacks.find(item => item.id === names[name]).symbol}`
			, `#define ${name}_kind ${JSON.stringify(nodes.get(names[name]).identityKind)}`);
	return lines.join("\n") + "\n";
};

/**
 * Add Wasm heap, scalar-box and non-truncating identity checks to the C oracle.
 *
 * @param generated - Width-specific generated adapter.
 * @param scalars - Include malformed primitive boxes from the scalar fixture.
 */
export const ownedWasm32Probe = (generated, scalars) => {
	const boxed = new Set(["uint32", "int32", "char", "uint64", "int64", "usize", "isize", "float32", "float64"]);
	const nodes = generated.layout.nodes.filter(node => node.kind === "primitive" && boxed.has(node.name));
	const char = nodes.find(node => node.name === "char");
	return `/* Test-only Zend entry point, not a downstream PHP API. */
#include <php.h>
#include <stdio.h>
#include <lean_bridge_native_runtime.h>
static int ignore_report(const char *format, ...) { (void)format; return 0; }
#define main owned_probe_main
#define printf ignore_report
#include "check.c"
#undef printf
#undef main
_Static_assert(sizeof(void *) == 4 && sizeof(size_t) == 4 && sizeof(zend_long) == 4, "Actual wasm32 execution required");
_Static_assert(sizeof(((Ticket *)0)->token) == 8, "Resource identities must not shrink with machine words");
${scalars ? `_Static_assert(sizeof(((Scalars *)0)->S_word) == 4 && sizeof(((Scalars *)0)->S_signedWord) == 4, "32-bit Lean machine words required");
_Static_assert(sizeof(((Scalars *)0)->S_u64) == 8 && sizeof(((Scalars *)0)->S_i64) == 8, "Fixed-width integers must not shrink");` : ""}
static size_t wasm32_boundary_checks(void) {
  size_t before = checks;
  uintptr_t end = (uintptr_t)__builtin_wasm_memory_size(0) * 65536;
  CHECK(!ov_pointer((void *)end, 1, 1));
  CHECK(!ov_pointer((void *)(end - 1), 2, 1));
  CHECK(!ov_pointer((void *)UINTPTR_MAX, 1, 1));
  CHECK(ov_pointer((void *)(end - 1), 1, 1));
  lb_owned_context context = {0}; ov_result_owner owner = {0}, ticket_owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  uint32_t limb = 42; Nat number = { &limb, 1 }; Text label = { "ticket", 6 }; Ticket ticket = {0};
  CHECK(V_newTicket(&context, &number, &label, &ticket, &ticket_owner) == LB_OWNED_OK);
  CHECK(ticket.token > UINT32_MAX);
  Ticket untouched = { UINT64_MAX };
  Text invalid = { (const char *)end, 1 };
  size_t baseline = live;
  CHECK(V_newTicket(&context, &number, &invalid, &untouched, &owner) == LB_OWNED_INVALID);
  CHECK(untouched.token == UINT64_MAX && ov_owner_empty(&owner) && live == baseline && !context.scopes);
  CHECK(V_newTicket(&context, (const Nat *)end, &label, &untouched, &owner) == LB_OWNED_INVALID);
  CHECK(untouched.token == UINT64_MAX && ov_owner_empty(&owner) && live == baseline && !context.scopes);
  CHECK(V_newTicket(&context, &number, &label, (Ticket *)end, &owner) == LB_OWNED_INVALID);
  CHECK(V_newTicket(&context, &number, &label, &untouched, (ov_result_owner *)end) == LB_OWNED_INVALID);
  for (unsigned corruption = 0; corruption < 5; ++corruption) {
${nodes.map(node => `    {
      lean_object *child;
      if (corruption == 0) child = lean_box(0);
      else if (corruption == 1) child = lean_alloc_array(0, 0);
      else if (corruption == 2) child = lean_alloc_ctor(1, 0, 8);
      else if (corruption == 3) { child = lean_alloc_ctor(0, 1, 0); lean_ctor_set(child, 0, lean_box(0)); }
      else child = lean_alloc_ctor(0, 0, 0);
      /* A decoder-only transaction does not retire the interpreter. The final
         scoped failure below separately proves retirement and resource cleanup. */
      ov_transaction transaction = { .budget = { .bytes = ${generated.layout.model.limits.bytes}, .visits = ${generated.layout.model.limits.visits} } };
      ${node.cName} value = 0;
      CHECK(${node.walker}_out(&value, ov_carry(child), 0, &transaction) == OV_RESULT);
      CHECK(ov_abort(&transaction, OV_RESULT) == OV_RESULT);
      CHECK(ov_owner_empty(&owner) && live == baseline && !context.scopes);
    }`).join("\n")}
  }
${scalars ? `  for (unsigned i = 0; i < 3; ++i) {
    uint32_t values[] = { 0xd800, 0x110000, UINT32_MAX }, result = 0;
    ov_transaction transaction = { .budget = { .bytes = ${generated.layout.model.limits.bytes}, .visits = ${generated.layout.model.limits.visits} } };
    CHECK(${char.walker}_out(&result, ov_carry(lean_box_uint32(values[i])), 0, &transaction) == OV_RESULT);
    CHECK(ov_abort(&transaction, OV_RESULT) == OV_RESULT);
  }
  ov_transaction failed = {0}; uint32_t bad_char = 0;
  CHECK(ov_begin(&failed, &context, &owner, COMPONENT_ID) == LB_OWNED_OK);
  CHECK(${char.walker}_out(&bad_char, ov_carry(lean_box(0)), 0, &failed) == OV_RESULT);
  CHECK(ov_abort(&failed, OV_RESULT) == OV_RESULT);
  CHECK(lb_owned_ready(&context) == LB_OWNED_RUNTIME);
  CHECK(V_newTicket(&context, &number, &label, &untouched, &owner) == LB_OWNED_RUNTIME);
  CHECK(untouched.token == UINT64_MAX && ov_owner_empty(&owner) && live == baseline && !context.scopes);` : ""}
  CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK);
  CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  CHECK(live == 0 && snapshot.live_identities == 0);
  return checks - before;
}
ZEND_BEGIN_ARG_INFO_EX(probe_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lean_bridge_owned_wasm32_probe) {
  CHECK(owned_probe_main() == 0);
  size_t transport_checks = checks;
  size_t boundary_checks = wasm32_boundary_checks();
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  array_init(return_value);
  add_assoc_long(return_value, "checks", transport_checks);
  add_assoc_long(return_value, "boundaryChecks", boundary_checks);
  add_assoc_long(return_value, "failures", failures);
  add_assoc_long(return_value, "wordBits", sizeof(size_t) * 8);
  add_assoc_long(return_value, "phpBits", sizeof(zend_long) * 8);
  add_assoc_string(return_value, "phpVersion", PHP_VERSION);
  add_assoc_long(return_value, "live", live);
  add_assoc_long(return_value, "identities", snapshot.live_identities);
  add_assoc_long(return_value, "runtimeInitializations", snapshot.runtime_init_runs);
  add_assoc_long(return_value, "componentInitializations", snapshot.component_init_runs);
  add_assoc_bool(return_value, "retired", !lean_bridge_native_component_ready(COMPONENT_ID));
}
static const zend_function_entry probe_functions[] = {
  ZEND_FE(lean_bridge_owned_wasm32_probe, probe_args)
  PHP_FE_END
};
zend_module_entry probe_module_entry = {
  STANDARD_MODULE_HEADER, "lean_bridge_owned_wasm32_probe", probe_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(probe)
`;
};
