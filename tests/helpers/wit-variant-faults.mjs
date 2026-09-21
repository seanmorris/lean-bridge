/**
 * Synthetic conversion faults, independent of real compiled Lean acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { witVariantConsumer } from "./wit-variant-fixture.mjs";

/**
 * Probe selected branches, allocation budgets and partial-value cleanup.
 *
 * @param model - Generated public C type spellings and private converter indices.
 */
export const witVariantFaultSource = async model => {
	const names = ["Signal", "Mode", "Nested", "Scalars", "Anonymous", "One", "Buffers", "Aliased", "Wide", "Joined"];
	const copies = names.map(name => model.surface.copy({ kind: "named", id: `lean:Variants.${name}` }));
	const consumer = await witVariantConsumer();
	const start = consumer.indexOf("static void ok("), end = consumer.indexOf("static bool named(");
	const records = consumer.indexOf("static value record("), loaded = consumer.indexOf("static int loaded(");
	assert.ok(start > 0 && end > start && records > end && loaded > records);
	const badPayloads = [
		[0, "native.kind = 2; native.cases.data.label.length = 1;"]
		, [0, "native.kind = 2; native.cases.data.label.data = (char *)\"\\xff\"; native.cases.data.label.length = 1;"]
		, [0, "native.kind = 3; native.cases.marker.value = 1;"]
		, [2, "native.kind = 1; native.cases.packet.value.fallback.has_value = 2;"]
		, [2, "native.kind = 2; native.cases.outcome.value.is_ok = 2;"]
		, [3, "native.kind = 1; native.cases.all.char_ = 0xd800;"]
		, [3, "native.kind = 1; native.cases.all.natural.length = 1;"]
		, [6, "native.kind = 1; native.cases.pair.second.length = SIZE_MAX;"]
		, [7, "native.kind = 1; native.cases.values.batch.length = SIZE_MAX;"]
	];
	return `#include "variants.h"
#include <wasmtime.h>
#include <wasmtime/component.h>
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#define clone copied_clone
typedef wasmtime_component_val_t value;
static size_t checks, attempts, fail_at, live, failures, input_budgets, output_budgets, malformed, inactive;
#define CHECK(test) do { checks++; assert(test); } while (0)
static void *tracked_calloc(size_t count, size_t width) {
  if (++attempts == fail_at) return NULL;
  void *p = calloc(count, width); if (p) live++; return p;
}
static void tracked_free(void *p) { if (p) { CHECK(live > 0); live--; } free(p); }
#define calloc tracked_calloc
#define free tracked_free
#include "conversions.h"
#undef calloc
#undef free
${consumer.slice(start, end)}
${consumer.slice(records, loaded)}
static lb_scope scope(void) { return (lb_scope){.remaining = 16u * 1024u * 1024u}; }
static bool convert(unsigned family, const value *input, lb_scope *in, lb_scope *out, value *output) {
  switch (family) {
${copies.map((copy, index) => `  case ${index}: { ${copy.name} native = {0};
    if (!lb_in_${copy.index}(input, in, &native)) return false;
    return lb_out_${copy.index}(&native, out, output); }`).join("\n")}
  default: abort();
  }
}
static value fixture(unsigned family, unsigned round) {
  switch (family) {
  case 0: return signal_value(round);
  case 1: return mode(round);
  case 2: return nested(round);
  case 3: return round ? scalars(round) : tagged("absent", NULL);
  case 4: return round % 3 == 0 ? one_field("number", "arg0", u32(round))
    : with(round % 3 == 1 ? "pair" : "collision", record(round % 3 == 1 ? (const char *[]){"arg0", "arg1"}
      : (const char *[]){"arg1", "lean-field-x00006100007200006700003100005f"}, (value[]){u32(round), text("x")}, 2));
  case 5: return one_field("only", "value", u32(round));
  case 6: return round ? buffers(sample(15, round), sample(15, round + 1)) : tagged("empty", NULL);
  case 7: return aliased(round);
  case 8: return wide(round == 4 ? 255 : round == 5 ? 256 : round, (uint8_t)round);
  case 9: return joined(round);
  default: abort();
  }
}
int main(void) {
  (void)labels; (void)type_labels;
  for (unsigned family = 0; family < 10; ++family) for (unsigned round = 0; round < 6; ++round) {
    value input = fixture(family, round), output = {0};
    lb_scope in = scope(), out = scope(); fail_at = 0; attempts = 0;
    CHECK(convert(family, &input, &in, &out, &output)); equal(&input, &output);
    size_t allocations = attempts, input_cost = 16u * 1024u * 1024u - in.remaining, output_cost = 16u * 1024u * 1024u - out.remaining;
    clear(&output); lb_scope_close(&in); lb_scope_close(&out); CHECK(live == 0);
    for (fail_at = 1; fail_at <= allocations; ++fail_at) {
      attempts = 0; in = scope(); out = scope(); output = (value){0};
      CHECK(!convert(family, &input, &in, &out, &output)); CHECK(attempts == fail_at); failures++;
      clear(&output); lb_scope_close(&in); lb_scope_close(&out); CHECK(live == 0);
    }
    fail_at = 0;
    for (size_t budget = 0; budget <= input_cost; ++budget) {
      in = (lb_scope){.remaining = budget}; out = scope(); output = (value){0};
      bool valid = convert(family, &input, &in, &out, &output);
      CHECK(valid == (budget == input_cost)); if (!valid) input_budgets++;
      clear(&output); lb_scope_close(&in); lb_scope_close(&out); CHECK(live == 0);
    }
    for (size_t budget = 0; budget <= output_cost; ++budget) {
      in = scope(); out = (lb_scope){.remaining = budget}; output = (value){0};
      bool valid = convert(family, &input, &in, &out, &output);
      CHECK(valid == (budget == output_cost)); if (!valid) output_budgets++;
      clear(&output); lb_scope_close(&in); lb_scope_close(&out); CHECK(live == 0);
    }
    clear(&input);
  }
${copies.map(copy => `  {
    ${copy.name} native; memset(&native, 0xa5, sizeof(native)); native.kind = UINT32_MAX;
    lb_scope s = scope(); value output = {0};
    CHECK(!lb_out_${copy.index}(&native, &s, &output)); malformed++;
    clear(&output); lb_scope_close(&s); CHECK(live == 0);
  }
${copy.cases.flatMap((branch, index) => branch.fields.length ? [] : [`  {
    ${copy.name} native; memset(&native, 0xa5, sizeof(native)); native.kind = ${index};
    lb_scope s = scope(); value output = {0};
    CHECK(lb_out_${copy.index}(&native, &s, &output)); CHECK(output.of.variant.val == NULL); inactive++;
    clear(&output); lb_scope_close(&s); CHECK(live == 0);
  }`]).join("\n")}`).join("\n")}
${badPayloads.map(([family, setup]) => `  {
    ${copies[family].name} native = {0}; ${setup}
    lb_scope s = scope(); value output = {0};
    CHECK(!lb_out_${copies[family].index}(&native, &s, &output)); malformed++;
    clear(&output); lb_scope_close(&s); CHECK(live == 0);
  }`).join("\n")}
  value input = inspected(), output = {0}; lb_scope in = scope(), out = scope(); attempts = 0;
  input.of.variant.val->of.record.data[18].val.kind = WASMTIME_COMPONENT_BOOL;
  CHECK(!convert(3, &input, &in, &out, &output)); CHECK(attempts == 3);
  clear(&output); lb_scope_close(&in); lb_scope_close(&out); CHECK(live == 0);
  input.of.variant.val->of.record.data[18].val.kind = WASMTIME_COMPONENT_S64;
  in = scope(); out = scope(); output = (value){0};
  CHECK(convert(3, &input, &in, &out, &output)); equal(&input, &output);
  clear(&input); clear(&output); lb_scope_close(&in); lb_scope_close(&out); CHECK(live == 0);
  printf("{\\"checks\\":%zu,\\"scratchFailures\\":%zu,\\"inputBudgetFailures\\":%zu,\\"outputBudgetFailures\\":%zu,\\"malformedOutputs\\":%zu,\\"inactivePayloads\\":%zu,\\"partialInputs\\":1,\\"families\\":10,\\"liveAllocations\\":%zu}\\n", checks, failures, input_budgets, output_budgets, malformed, inactive, live);
}
`;
};
