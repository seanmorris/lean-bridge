/**
 * Exercise the real Wasmtime callback adapter with tracked native allocations.
 * No synthetic provider is counted as installed Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { witStructuredConsumer, witStructuredShapes } from "./wit-structured-callable-fixture.mjs";

/**
 * Generate direct adapter calls using independent Wasmtime value builders.
 *
 * @param model - Checked WIT projection.
 */
export const witStructuredFaultProbe = async model => {
	const consumer = await witStructuredConsumer(model);
	const start = consumer.indexOf("static void ok("), end = consumer.indexOf("static size_t identities(");
	assert.ok(start > 0 && end > start);
	const builders = consumer.slice(start, end).replaceAll("static value ", "static inline value ")
		.replaceAll("static void ", "static inline void ");
	const functions = witStructuredShapes.map((shape, index) => {
		const fn = model.surface.functions.find(fn => fn.field === "call_" + shape);
		const resource = model.resources.find(resource => resource.type.id === fn.declaration.parameters[1].type.id);
		const copy = model.surface.copy(resource.type.callable.result.type), callback = model.resources.indexOf(resource);
		return `static void check_${index}(unsigned seed, unsigned mode, size_t checkpoint) {
  size_t baseline = live; value input = shape_value(${index}, seed);
  ${copy.name} argument = {0}, output, unchanged;
  memset(&output, 0x5a, sizeof(output)); unchanged = output;
  lb_scope inputs = {.remaining = LB_BUDGET};
  CHECK(lb_in_${copy.index}(&input, &inputs, &argument));
  structured_wasmtime session = {0};
  lb_entry entry = {.session = &session, .active = 1, .callback = echo};
  structured_error error = {0}; behavior = mode;
  attempts = 0; fail_at = checkpoint; failed = false;
  structured_status status = lb_callback_${callback}(&entry, &argument, &output, &error);
  fail_at = 0;
  if (status == STRUCTURED_STATUS_OK) {
    CHECK(!failed && !mode); value result = {0}; lb_scope scope = {.remaining = LB_BUDGET};
    CHECK(lb_out_${copy.index}(&output, &scope, &result)); equal(&input, &result);
    wasmtime_component_val_delete(&result); lb_scope_close(&scope);
    ${copy.name}_clear(&output); successes++;
  } else {
    CHECK(failed || mode); CHECK(memcmp(&output, &unchanged, sizeof(output)) == 0);
    CHECK(session.poisoned && error.message_length); failures++;
  }
  lb_scope_close(&inputs); wasmtime_component_val_delete(&input);
  CHECK(live == baseline);
}`;
	});
	return `#define _GNU_SOURCE
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "structured_wasmtime.h"
typedef wasmtime_component_val_t value;
static size_t checks, live, attempts, fail_at, successes, failures;
static bool failed;
#define CHECK(test) do { checks++; assert(test); } while (0)
static struct { void *data; size_t size; } allocations[8192];
static void *tracked_calloc(size_t count, size_t width) {
  if (fail_at && ++attempts == fail_at) { failed = true; return NULL; }
  void *data = calloc(count, width); CHECK(data);
  for (size_t i = 0; i < 8192; ++i) if (!allocations[i].data) {
    allocations[i].data = data; allocations[i].size = count * width; live++; return data;
  }
  abort();
}
static void tracked_free(void *data) {
  if (!data) return;
  for (size_t i = 0; i < 8192; ++i) if (allocations[i].data == data) {
    memset(data, 0xdd, allocations[i].size); free(data);
    allocations[i].data = NULL; live--; return;
  }
  abort();
}
#define calloc tracked_calloc
#define free tracked_free
#include "host.c"
#undef calloc
#undef free
#define clone copied_clone
${builders}
static unsigned behavior;
static wasmtime_error_t *echo(void *data, const value *args, size_t count, value *out) {
  (void)data; CHECK(count == 1);
  *out = behavior == 1 ? u32(123) : clone(&args[0]);
  return behavior == 2 ? wasmtime_error_new("expected structured callback failure") : NULL;
}
${functions.join("\n")}
int main(void) {
  (void)bindings; (void)labels; (void)type_labels;
  void (*shapes[])(unsigned, unsigned, size_t) = {${witStructuredShapes.map((_, index) => `check_${index}`).join(",")}};
  size_t injected = 0;
  for (size_t shape = 0; shape < 8; ++shape) for (unsigned seed = 0; seed < 12; ++seed) {
    shapes[shape](seed, 0, 0);
    for (size_t checkpoint = 1; checkpoint < 128; ++checkpoint) {
      shapes[shape](seed, 0, checkpoint);
      if (!failed) break;
      injected++; shapes[shape](seed, 0, 0);
      CHECK(checkpoint < 127);
    }
    shapes[shape](seed, 1, 0); shapes[shape](seed, 2, 0); shapes[shape](seed, 0, 0);
  }
  CHECK(live == 0 && injected > 100 && failures > 100);
  printf(${JSON.stringify('{"checks":%zu,"successes":%zu,"failures":%zu,"injected":%zu,"live":%zu}\n')}, checks, successes, failures, injected, live);
  return 0;
}
`;
};
