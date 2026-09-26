/**
 * Probe each recursive WIT reply allocation and owner handoff independently.
 * The native provider is synthetic; this is not installed Lean evidence.
 *
 * @file
 */
import { structuredCallableShapes } from "./structured-callable-fixture.mjs";
import { witRecursiveCallableValues } from "./wit-recursive-callable-values.mjs";

/**
 * Render direct callback-boundary probes with independent copied graph samples.
 *
 * @param model - Checked recursive callable model and native ABI names.
 */
export const witRecursiveCallableFaults = model => {
	const p = model.prefix;
	const lines = [witRecursiveCallableValues(model, { buildersOnly: true })
		, `
static size_t live, attempts, fail_at, injected, successes, failures;
static bool allocation_failed;
static unsigned behavior, retired;
static struct { void *address; size_t bytes; } tracked[16384];
static void *tracked_malloc(size_t bytes) {
  if (++attempts == fail_at) { allocation_failed = true; return NULL; }
  void *value = malloc(bytes); CHECK(value);
  for (size_t i = 0; i < 16384; ++i) if (!tracked[i].address) {
    tracked[i].address = value; tracked[i].bytes = bytes; ++live; return value;
  }
  abort();
}
static void *tracked_calloc(size_t count, size_t width) {
  CHECK(!count || width <= SIZE_MAX / count);
  void *value = tracked_malloc(count * width); if (value) memset(value, 0, count * width); return value;
}
static void tracked_free(void *value) {
  if (!value) return;
  for (size_t i = 0; i < 16384; ++i) if (tracked[i].address == value) {
    memset(value, 0xdd, tracked[i].bytes); free(value); tracked[i].address = NULL; --live; return;
  }
  abort();
}
#define malloc tracked_malloc
#define calloc tracked_calloc
#define free tracked_free
#include "host.c"
#undef malloc
#undef calloc
#undef free
int lean_bridge_native_component_ready(const char *id) { CHECK(id && !strcmp(id, ${JSON.stringify(model.ir.component.id)})); return !retired; }
void lean_bridge_native_runtime_retire(void) { ++retired; }
`];
	for(const callback of model.callbacks.values())
		lines.push(`uint32_t ${callback.call}(uint64_t token, ${callback.parameters.map((node, i) => `const ${node.name} *arg${i}`).concat(`${callback.result.name} *out`).join(", ")}) {
  (void)token; ${callback.parameters.map((_, i) => `(void)arg${i};`).join(" ")} (void)out; abort();
}`);
	lines.push(`static wasmtime_error_t *raw_echo(void *data, const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  (void)data; CHECK(count == 1); ++callbacks;
  if (behavior == 2) { *out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 17}; return NULL; }
  wasmtime_component_val_clone(&args[0], out);
  return behavior == 1 ? wasmtime_error_new("raw reply failure") : NULL;
}`);
	const functions = [];
	for(const shape of Object.keys(structuredCallableShapes))
	{
		const fn = model.functions.find(item => item.declaration.name === `call${shape}`);
		const node = fn.parameters[0], callback = fn.parameters[1], n = node.name, k = node.index;
		const base = `${p}_wasmtime_callback_${callback.publicName.slice(p.length + 1)}`;
		const tag = model.wire.resources.indexOf(callback.resource) + 1;
		lines.push(`static wasmtime_error_t *typed_${shape}(void *data, const ${n} *value, ${n} *out) {
  (void)data; ++callbacks; borrowed${k}(value);
  if (behavior == 3) { *out = *value; return NULL; }
  wasmtime_error_t *error = ${n}_wasmtime_copy(value, out);
  if (error) return error;
  return behavior == 5 ? wasmtime_error_new("typed reply failure") : NULL;
}
static void check_${shape}(unsigned seed, unsigned mode, size_t checkpoint) {
  CHECK(!live && !sample_live && !lb_active_frame); allocation *owner = NULL;
  ${n} input = {0}, out = {0}; sample${k}(&input, seed, 0, &owner);
  out = input; unsigned char unchanged[sizeof(out)]; memcpy(unchanged, &out, sizeof(out));
  ${p}_wasmtime session = {.thread = pthread_self(), .thread_serial = lb_thread_identity(), .process = getpid()};
  ${base}_context context = {typed_${shape}, NULL, NULL};
  lb_entry *entry = &session.entries[0];
  *entry = (lb_entry){.token = 1, .tag = ${tag}, .active = 1, .session = &session
    , .callback = mode < 3 ? raw_echo : ${base}_invoke, .data = &context};
  lb_frame frame = {.session = &session}; lb_active_frame = &frame;
  behavior = mode; attempts = 0; fail_at = checkpoint; allocation_failed = false;
  uint32_t status = lb_graph_callback_${tag}(entry, &input, &out);
  fail_at = 0; lb_active_frame = NULL;
  if (!status) {
    CHECK(!allocation_failed && (mode == 0 || mode == 3 || mode == 4));
    CHECK(equal${k}(&input, &out)); ${n}_clear(&out); ${n}_clear(&out); ++successes;
  } else {
    CHECK(allocation_failed || mode == 1 || mode == 2 || mode == 5);
    CHECK(!memcmp(unchanged, &out, sizeof(out)) && session.poisoned && session.first_error[0]); ++failures;
  }
  release(&owner); CHECK(!live && !sample_live && !retired);
  CHECK(lb_graph_callback_${tag}(entry, (const ${n} *)1, (${n} *)1) == 1);
  CHECK(lb_graph_callback_${tag}((void *)1, (const ${n} *)1, (${n} *)1) == 1);
}`);
		functions.push(`check_${shape}`);
	}
	lines.push(`int main(void) {
  (void)success; (void)rejected; (void)finalizer;
  (void)releases; (void)rejections; (void)shapes; (void)aliases;
  (void)option_cases; (void)result_cases; (void)nested_cases;
  void (*probes[])(unsigned, unsigned, size_t) = {${functions.join(", ")}};
  for (size_t shape = 0; shape < 9; ++shape) for (unsigned seed = 0; seed < 12; ++seed) {
    for (unsigned mode = 0; mode < 6; ++mode) {
      probes[shape](seed, mode, 0);
      for (size_t checkpoint = 1; checkpoint < 2048; ++checkpoint) {
        probes[shape](seed, mode, checkpoint);
        if (!allocation_failed) break;
        ++injected; probes[shape](seed, mode, 0); CHECK(checkpoint < 2047);
      }
    }
  }
  CHECK(injected > 1000 && successes > 500 && failures > 1000 && !live);
  printf("{\\"checks\\":%u,\\"successes\\":%zu,\\"failures\\":%zu,\\"injected\\":%zu,\\"live\\":%zu,\\"retired\\":%u}\\n", checks, successes, failures, injected, live, retired);
}
`);
	return lines.join("\n");
};
