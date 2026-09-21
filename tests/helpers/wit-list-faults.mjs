/**
 * Synthetic converter probes, separate from compiled Lean execution evidence.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe the synthetic copied API without claiming compiled Lean execution. */
export const witListFaultIr = () => corpusReviewedIr({ id: "probe" }, [{ name: "Probe.echo"
	, parameters: [{ list: { tuple: [{ option: "nat" }, { result: ["string", "bytes"] }] } }]
	, result: { list: { tuple: [{ option: "nat" }, { result: ["string", "bytes"] }] } } }]);

/**
 * Compile generated conversions into an ASan/LSan probe with fallible scratch allocation.
 *
 * @param model - Synthetic WIT/C naming, not expected runtime values.
 */
export const witListFaultSource = model => {
	const array = model.surface.copy(model.surface.functions[0].declaration.result.type), pair = array.element;
	const option = pair.fields[0].type, result = pair.fields[1].type;
	return `#include "probe.h"
#include <wasmtime.h>
#include <wasmtime/component.h>
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
static size_t attempts, fail_at, live, checks, failures, budget_failures, input_budget_failures;
#define CHECK(test) do { checks++; assert(test); } while (0)
static void *tracked_calloc(size_t n, size_t width) {
  if (++attempts == fail_at) return NULL;
  void *p = calloc(n, width); if (p) live++; return p;
}
static void tracked_free(void *p) { if (p) { CHECK(live); live--; } free(p); }
#define calloc tracked_calloc
#define free tracked_free
#include "conversions.h"
#undef calloc
#undef free
static lb_scope scope(void) { return (lb_scope){.remaining = 16u * 1024u * 1024u}; }
int main(void) {
  uint32_t limbs[] = {UINT32_MAX, 1};
  ${pair.name} pairs[3] = {0};
  for (size_t i = 0; i < 3; ++i) {
    pairs[i].fst.has_value = 1;
    pairs[i].fst.value.data = limbs; pairs[i].fst.value.length = 2;
    pairs[i].snd.is_ok = 1; pairs[i].snd.ok.data = "x\\0\\xce\\xbb"; pairs[i].snd.ok.length = 4;
  }
  ${array.name} native = {.data = pairs, .length = 3};
  wasmtime_component_val_t input = {0}; lb_scope initial = scope();
  CHECK(lb_out_${array.index}(&native, &initial, &input));
  for (fail_at = 1; fail_at <= 4; ++fail_at) {
    attempts = 0; lb_scope s = scope(); ${array.name} converted = {0};
    CHECK(!lb_in_${array.index}(&input, &s, &converted)); failures++;
    CHECK(attempts == fail_at); lb_scope_close(&s); CHECK(live == 0);
  }
  fail_at = 0; attempts = 0;
  for (size_t budget = 0; budget <= 3000; ++budget) {
    lb_scope s = {.remaining = budget}; wasmtime_component_val_t converted = {0};
    if (!lb_out_${array.index}(&native, &s, &converted)) budget_failures++;
    wasmtime_component_val_delete(&converted); lb_scope_close(&s); CHECK(live == 0);
  }
  CHECK(budget_failures > 500 && budget_failures < 3000);
  for (size_t budget = 0; budget <= 3000; ++budget) {
    lb_scope s = {.remaining = budget}; ${array.name} converted = {0};
    if (!lb_in_${array.index}(&input, &s, &converted)) input_budget_failures++;
    lb_scope_close(&s); CHECK(live == 0);
  }
  CHECK(input_budget_failures > 500 && input_budget_failures < 3000);
  for (unsigned mode = 0; mode < 3; ++mode) {
    ${array.name} bad = {.data = NULL, .length = 1};
    if (mode == 1) { bad.data = (void *)1; bad.length = SIZE_MAX; }
    if (mode == 2) { bad.data = (void *)1; bad.length = 1048577; }
    wasmtime_component_val_t output = {0}; lb_scope s = scope();
    CHECK(!lb_out_${array.index}(&bad, &s, &output));
    wasmtime_component_val_delete(&output); lb_scope_close(&s); CHECK(live == 0);
  }
  ${array.name} empty = {.data = (void *)1, .length = 0};
  wasmtime_component_val_t empty_output = {0}; lb_scope empty_scope = scope();
  CHECK(lb_out_${array.index}(&empty, &empty_scope, &empty_output));
  CHECK(empty_output.kind == WASMTIME_COMPONENT_LIST && empty_output.of.list.size == 0);
  wasmtime_component_val_delete(&empty_output); lb_scope_close(&empty_scope); CHECK(live == 0);
  for (unsigned mode = 0; mode < 2; ++mode) {
    wasmtime_component_val_t bad = {.kind = WASMTIME_COMPONENT_LIST, .of.list = {1, NULL}};
    if (mode) { bad.of.list.data = (void *)1; bad.of.list.size = SIZE_MAX; }
    ${array.name} converted = {0}; lb_scope s = scope();
    CHECK(!lb_in_${array.index}(&bad, &s, &converted)); lb_scope_close(&s); CHECK(live == 0);
  }
  for (unsigned mode = 0; mode < 8; ++mode) {
    ${pair.name} bad = pairs[0];
    if (mode == 0) bad.fst.has_value = 2;
    if (mode == 1) bad.snd.is_ok = 2;
    if (mode == 2) bad.snd.ok.data = NULL;
    if (mode == 3) { bad.snd.ok.data = "\\xff"; bad.snd.ok.length = 1; }
    if (mode == 4) bad.snd.ok.length = SIZE_MAX;
    if (mode == 5) bad.fst.value.data = NULL;
    if (mode == 6) { bad.snd.is_ok = 0; bad.snd.error.length = 1; }
    if (mode == 7) bad.fst.value.length = SIZE_MAX;
    wasmtime_component_val_t output = {0}; lb_scope s = scope();
    CHECK(!lb_out_${pair.index}(&bad, &s, &output)); wasmtime_component_val_delete(&output);
    lb_scope_close(&s); CHECK(live == 0);
  }
  ${option.name} absent = {.has_value = 0, .value = {.data = (void *)1, .length = SIZE_MAX}};
  ${result.name} inactive = {.is_ok = 1, .ok = {.data = "ok", .length = 2}, .error = {.data = (void *)1, .length = SIZE_MAX}};
  wasmtime_component_val_t output = {0}; lb_scope s = scope();
  CHECK(lb_out_${option.index}(&absent, &s, &output)); CHECK(output.of.option == NULL); wasmtime_component_val_delete(&output);
  output = (wasmtime_component_val_t){0}; s = scope();
  CHECK(lb_out_${result.index}(&inactive, &s, &output)); wasmtime_component_val_delete(&output);
  inactive.is_ok = 0; inactive.error.data = (void *)"ok"; inactive.error.length = 2;
  inactive.ok.data = (void *)1; inactive.ok.length = SIZE_MAX;
  output = (wasmtime_component_val_t){0}; s = scope();
  CHECK(lb_out_${result.index}(&inactive, &s, &output)); wasmtime_component_val_delete(&output);
  /* A wrong final payload follows successful allocations for earlier elements. */
  wasmtime_component_val_t *bad = input.of.list.data[2].of.tuple.data[1].of.result.val;
  wasmtime_component_val_delete(bad); *bad = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL};
  ${array.name} converted = {0}; s = scope();
  CHECK(!lb_in_${array.index}(&input, &s, &converted)); lb_scope_close(&s); CHECK(live == 0);
  wasmtime_component_val_delete(&input);
  input = (wasmtime_component_val_t){0}; s = scope();
  CHECK(lb_out_${array.index}(&native, &s, &input)); s = scope();
  CHECK(lb_in_${array.index}(&input, &s, &converted)); CHECK(live == 4);
  lb_scope_close(&s); CHECK(live == 0); wasmtime_component_val_delete(&input);
  printf("{\\"checks\\":%zu,\\"scratchFailures\\":%zu,\\"budgetFailures\\":%zu,\\"inputBudgetFailures\\":%zu,\\"malformedOutputs\\":11,\\"malformedInputs\\":2,\\"emptyPoisonPointers\\":1,\\"inactivePayloads\\":3,\\"liveAllocations\\":%zu}\\n", checks, failures, budget_failures, input_budget_failures, live);
}
`;
};
