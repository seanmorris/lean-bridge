/**
 * Independently construct native values and exercise real compiled graph calls.
 * No production decoder is used to decide whether a round trip preserved data.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";
import { generateNativeCallableGraphCalls } from "../../src/backends/c/native-callable-graph-calls.mjs";
import { structuredCallableShapes } from "./structured-callable-fixture.mjs";

/**
 * Return a C caller with independent samples, equality and ownership checks.
 *
 * @param model - Fresh compiler-authenticated model.
 * @param receipt - Matching compiled component receipt.
 */
export const nativeRecursiveCallableCallsProbe = (model, receipt) => {
	const generated = generateNativeCallableGraphCalls(model.bindingIr, model.copiedGraph, { initializer: receipt.initializer });
	const { layout, payloads } = generated, table = new Map(layout.nodes.map(node => [node.id, node]));
	const id = node => sha256(node.id).slice(0, 16);
	const call = name => generated.calls.find(item => item.bindingId === `lean:Structured.${name}`);
	const closure = ref => generated.closures.find(item => item.id === ref.id);
	const cb = ref => `${layout.prefix}_callback_${model.copiedGraph.callbacks.find(item => item.id === ref.id).key}`;
	const clear = (node, value) => node.aggregate ? `${node.name}_clear(${value});` : `(void)${value};`;
	const lines = [`#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdatomic.h>
#include <sys/wait.h>
static _Atomic unsigned checks;
static unsigned callbacks, rejections, owned_replies, shapes, failed_allocations, alias_signatures;
#define CHECK(condition) do { ++checks; if (!(condition)) { fprintf(stderr, "call check at %d: %s\\n", __LINE__, #condition); abort(); } } while (0)
static size_t graph_live, graph_attempts, graph_fail_at;
static void *graph_allocate(size_t bytes) {
  if (++graph_attempts == graph_fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++graph_live; return value;
}
static void graph_release(void *value) { if (value) { CHECK(graph_live); --graph_live; free(value); } }
static void decode_hook(void);
static lean_object *encode_hook(lean_object *value);
#define LB_GRAPH_MALLOC graph_allocate
#define LB_GRAPH_FREE graph_release
#define LB_GRAPH_DECODE() decode_hook()
#define LB_GRAPH_ENCODE(value) encode_hook(value)
${generated.source}
typedef struct sample_allocation { struct sample_allocation *next; max_align_t alignment; unsigned char data[]; } sample_allocation;
static size_t sample_live;
static void *sample_allocate(sample_allocation **head, size_t count, size_t width) {
  if (!count) return NULL;
  sample_allocation *value = calloc(1, sizeof(*value) + count * width); CHECK(value);
  ++sample_live; value->next = *head; *head = value; return value->data;
}
static void sample_release(void *owner) {
  sample_allocation *value = owner;
  while (value) { sample_allocation *next = value->next; CHECK(sample_live); --sample_live; free(value); value = next; }
}
static void reply_release(void *owner) { ++owned_replies; sample_release(owner); }
static unsigned identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
`];
	for(const node of layout.nodes)
		lines.push(`static inline void sample_${id(node)}(${node.name} *, unsigned, unsigned, sample_allocation **);`
			, `static inline int equal_${id(node)}(const ${node.name} *, const ${node.name} *);`
			, `static inline void borrowed_${id(node)}(const ${node.name} *);`);
	for(const node of layout.nodes)
	{
		const sample = ["(void)seed; (void)depth; (void)arena;"], equal = [], borrowed = [];
		if(node.aggregate) borrowed.push("CHECK(!value->_bridge_owner && !value->_bridge_release);");
		if(node.kind === "primitive")
		{
			if(node.aggregate)
			{
				const integer = ["nat", "int"].includes(node.ref.name);
				if(integer) sample.push("out->length = seed % 3 ? 5 : 0;"
					, "uint32_t *limbs = sample_allocate(arena, out->length, sizeof(*limbs)); out->data = limbs;"
					, "for (size_t i = 0; i < out->length; ++i) limbs[i] = (uint32_t)(seed + i + 1);"
					, ...node.ref.name === "int" ? ["out->negative = out->length && seed % 2;"] : []);
				else sample.push('static const uint8_t text[] = {65, 0, 0xf0, 0x9f, 0x8c, 0xb1};'
					, "out->length = seed % 3 ? sizeof(text) : 0;"
					, "void *data = sample_allocate(arena, out->length, 1); if (out->length) memcpy(data, text, out->length); out->data = data;");
				equal.push(...node.ref.name === "int" ? ["if (left->negative != right->negative) return 0;"] : []
					, `return left->length == right->length && (!left->length || !memcmp(left->data, right->data, left->length * ${integer ? "sizeof(uint32_t)" : "1"}));`);
			}
			else
			{
				sample.push(`*out = (${node.name})(${node.ref.name === "unit" ? "0" : node.ref.name === "bool" ? "seed % 2" : "seed + 17"});`);
				equal.push("return *left == *right;"); borrowed.push("(void)value;");
			}
		}
		else if(node.element)
		{
			const child = table.get(node.element);
			sample.push("out->length = depth > 8 ? 0 : seed % 3;"
				, `${child.name} *data = sample_allocate(arena, out->length, sizeof(*data)); out->data = data;`
				, `for (size_t i = 0; i < out->length; ++i) sample_${id(child)}(&data[i], seed + (unsigned)i + 1, depth + 1, arena);`);
			equal.push("if (left->length != right->length) return 0;"
				, `for (size_t i = 0; i < left->length; ++i) if (!equal_${id(child)}(&left->data[i], &right->data[i])) return 0;`, "return 1;");
			borrowed.push(`for (size_t i = 0; i < value->length; ++i) borrowed_${id(child)}(&value->data[i]);`);
		}
		else
		{
			const fields = (values, base = "") => values.forEach((field, index) => {
				const child = table.get(field.type), slot = base + field.name;
				const address = variable => field.storage === "pointer" ? `${variable}->${slot}` : `&${variable}->${slot}`;
				if(field.storage === "pointer") sample.push(`out->${slot} = sample_allocate(arena, 1, sizeof(${child.name}));`);
				sample.push(`sample_${id(child)}((${child.name} *)${address("out")}, seed + ${index + 1}, depth + 1, arena);`);
				equal.push(`if (!equal_${id(child)}(${address("left")}, ${address("right")})) return 0;`);
				borrowed.push(`borrowed_${id(child)}(${address("value")});`);
			});
			if(node.kind === "variant")
			{
				sample.push(`out->kind = depth > 8 ? 0 : seed % ${node.cases.length};`, "switch (out->kind) {");
				equal.push("if (left->kind != right->kind) return 0;", "switch (left->kind) {");
				borrowed.push("switch (value->kind) {");
				node.cases.forEach((branch, index) => {
					for(const output of [sample, equal, borrowed]) output.push(`case ${index}:`);
					fields(branch.fields, `cases.${branch.name}.`);
					for(const output of [sample, equal, borrowed]) output.push("break;");
				});
				for(const output of [sample, equal, borrowed]) output.push("default: abort();", "}");
			}
			else
			{
				const flag = { option: "has_value", result: "is_ok" }[node.kind];
				if(flag)
				{ sample.push(`out->${flag} = seed % 3 != 0;`); equal.push(`if (left->${flag} != right->${flag}) return 0;`); }
				node.fields.forEach((field, index) => {
					if(flag) for(const [output, variable] of [[sample, "out"], [equal, "left"], [borrowed, "value"]]) output.push(`if (${index ? "!" : ""}${variable}->${flag}) {`);
					fields([field]);
					if(flag) for(const output of [sample, equal, borrowed]) output.push("}");
				});
			}
			equal.push("return 1;");
		}
		lines.push(`static inline void sample_${id(node)}(${node.name} *out, unsigned seed, unsigned depth, sample_allocation **arena) {`, ...sample, "}"
			, `static inline int equal_${id(node)}(const ${node.name} *left, const ${node.name} *right) {`, ...equal, "}"
			, `static inline void borrowed_${id(node)}(const ${node.name} *value) {`, ...borrowed, "}");
	}
	for(const [shape, ref] of Object.entries(structuredCallableShapes))
	{
		const node = payloads.copy(ref), n = node.name, key = id(node);
		const invoke = call(`call${shape}`), twice = call(`twice${shape}`), make = call(`make${shape}`), lease = closure(make.result);
		lines.push(`static uint32_t echo_${shape}(void *context, const ${n} *input, ${n} *out) {
  ++callbacks; borrowed_${key}(input);
  if (!context) { *out = *input; return NG_OK; }
  unsigned seed = *(unsigned *)context; sample_allocation *arena = NULL;
  sample_${key}(out, seed, 0, &arena);
  out->_bridge_owner = arena; out->_bridge_release = arena ? reply_release : NULL;
  return NG_OK;
}
static void shape_${shape}(void) {
  ++shapes;
  for (unsigned seed = 0; seed < 64; ++seed) {
    sample_allocation *arena = NULL;
    ${n} input = {0}, other = {0}, out = {0}, expected = {0};
    sample_${key}(&input, seed, 0, &arena); sample_${key}(&other, seed + 1, 0, &arena);
    ${cb(invoke.parameters[1])} host = { echo_${shape}, NULL };
    CHECK(${invoke.name}(&input, &host, &out) == NG_OK); CHECK(equal_${key}(&input, &out)); ${clear(node, "&out")}
    CHECK(${twice.name}(&input, &host, &out) == NG_OK); CHECK(equal_${key}(&input, &out)); ${clear(node, "&out")}
    uint64_t token = 0; unsigned before = identity_count();
    CHECK(${make.name}(&input, &token) == NG_OK && token); CHECK(identity_count() == before + 1);
    bool selected = true;
    CHECK(${lease.call}(token, &selected, &other, &out) == NG_OK); CHECK(equal_${key}(&input, &out)); ${clear(node, "&out")}
    selected = false;
    CHECK(${lease.call}(token, &selected, &other, &out) == NG_OK); CHECK(equal_${key}(&other, &out)); ${clear(node, "&out")}
    ${lease.dispose}(token); ${lease.dispose}(token); CHECK(identity_count() == before);
    out = other;
    CHECK(${lease.call}(token, &selected, &input, &out) == NG_INVALID); CHECK(equal_${key}(&other, &out)); ++rejections;
    CHECK(${lease.call}(UINT64_MAX, &selected, &input, &out) == NG_INVALID); CHECK(equal_${key}(&other, &out)); ++rejections;
    memset(&out, 0, sizeof(out));
    unsigned reply_seed = seed + 37; host.context = &reply_seed;
    sample_${key}(&expected, reply_seed, 0, &arena);
    CHECK(${invoke.name}(&input, &host, &out) == NG_OK); CHECK(equal_${key}(&expected, &out)); ${clear(node, "&out")}
    CHECK(!graph_live); sample_release(arena); CHECK(!sample_live);
  }
  for (unsigned seed = 0; seed < 16; ++seed) {
    sample_allocation *arena = NULL; ${n} input = {0}, out = {0};
    sample_${key}(&input, seed, 0, &arena); ${cb(invoke.parameters[1])} host = { echo_${shape}, NULL };
    graph_attempts = 0;
    CHECK(${twice.name}(&input, &host, &out) == NG_OK); size_t attempts = graph_attempts; ${clear(node, "&out")}
    for (size_t failure = 1; failure <= attempts; ++failure) {
      graph_attempts = 0; graph_fail_at = failure; out = input;
      CHECK(${twice.name}(&input, &host, &out) == NG_ALLOC); CHECK(!memcmp(&input, &out, sizeof(input))); CHECK(!graph_live);
      graph_fail_at = 0; ++failed_allocations;
    }
    sample_release(arena); CHECK(!sample_live && !graph_live);
  }
}
`);
	}
	for(const suffix of ["Alias", "Plain"])
	{
		const invoke = call(`callNested${suffix}`), make = call(`makeNested${suffix}`);
		const signature = model.copiedGraph.callbacks.find(item => item.id === invoke.parameters[1].id);
		const array = payloads.copy(signature.parameters[0]), record = payloads.copy(invoke.parameters[0]);
		const text = payloads.copy(invoke.result), lease = closure(make.result);
		lines.push(`static uint32_t nested_${suffix}(void *context, const ${array.name} *input, ${array.name} *out) {
  CHECK(!context); ++callbacks;
  borrowed_${id(array)}(input); CHECK(input->length == 3);
  CHECK(input->data[0].has_value && !input->data[1].has_value && input->data[2].has_value);
  *out = *input; return NG_OK;
}
static void alias_${suffix}(void) {
  ++alias_signatures;
  for (unsigned seed = 0; seed < 64; ++seed) {
    sample_allocation *arena = NULL; ${record.name} value = {0};
    sample_${id(record)}(&value, seed, 0, &arena);
    ${text.name} text = {0};
    ${cb(invoke.parameters[1])} host = { nested_${suffix}, NULL };
    CHECK(${invoke.name}(&value, &host, &text) == NG_OK);
    CHECK(text.length == value.text.length * 2 + 6);
    CHECK(!value.text.length || !memcmp(text.data, value.text.data, value.text.length));
    CHECK(!memcmp(text.data + value.text.length, "<none>", 6));
    CHECK(!value.text.length || !memcmp(text.data + value.text.length + 6, value.text.data, value.text.length));
    ${text.name}_clear(&text);
    uint64_t token = 0; ${array.name} empty = {0}, first = {0}, second = {0};
    CHECK(${make.name}(&value, &token) == NG_OK && token);
    CHECK(${lease.call}(token, &empty, &first) == NG_OK);
    CHECK(${lease.call}(token, &empty, &second) == NG_OK);
    CHECK(first._bridge_owner && second._bridge_owner && first._bridge_owner != second._bridge_owner);
    CHECK(first.length == 3 && equal_${id(array)}(&first, &second));
    CHECK(first.data[0].has_value && !first.data[1].has_value && first.data[2].has_value);
    CHECK(equal_${id(record)}(&first.data[0].value, &value));
    ${array.name}_clear(&first); ${lease.dispose}(token);
    CHECK(equal_${id(record)}(&second.data[2].value, &value));
    ${array.name}_clear(&second); sample_release(arena);
    CHECK(!graph_live && !sample_live && !identity_count());
  }
}
`);
	}
	const tree = payloads.copy(structuredCallableShapes.Recursive), n = tree.name;
	const invoke = call("callRecursive"), make = call("makeRecursive"), lease = closure(make.result);
	const record = payloads.copy(structuredCallableShapes.Record), retain = call("retainRecord"), recordLease = closure(retain.result);
	lines.push(`static uint64_t dispose_on_decode;
static int malformed_carrier;
static void decode_hook(void) { if (dispose_on_decode) { uint64_t token = dispose_on_decode; dispose_on_decode = 0; ${lease.dispose}(token); } }
static lean_object *encode_hook(lean_object *value) {
  if (malformed_carrier) { malformed_carrier = 0; lean_dec(value); return lean_box(0); }
  return value;
}
static uint64_t thread_token;
static uint32_t thread_status;
static void *wrong_thread(void *unused) {
  (void)unused; ${n} input = {0}, out = {0}; bool selected = false;
  thread_status = ${lease.call}(thread_token, &selected, &input, &out); return NULL;
}
static void *wrong_callback_thread(void *raw) {
  uint64_t token = *(uint64_t *)raw;
  CHECK(!lb_native_callback_lookup(token).invoke); CHECK(lb_native_callback_take_error() == 1);
  return NULL;
}
static uint32_t foreign_callback(void *context, const ${n} *input, ${n} *out) {
  (void)context; ++callbacks; pthread_t thread; uint64_t token = ng_call_frames[ng_call_depth - 1].tokens[0];
  CHECK(!pthread_create(&thread, NULL, wrong_callback_thread, &token)); CHECK(!pthread_join(thread, NULL));
  *out = *input; return NG_OK;
}
static void never_invoke(void) { CHECK(0); }
static unsigned nesting, nesting_limit, peak_nesting;
static uint32_t nested(void *context, const ${n} *input, ${n} *out) {
  (void)context; ++nesting; if (nesting > peak_nesting) peak_nesting = nesting;
  if (nesting == nesting_limit) { *out = *input; --nesting; return NG_OK; }
  ${cb(invoke.parameters[1])} host = { nested, NULL };
  uint32_t status = ${invoke.name}(input, &host, out); --nesting; return status;
}
static uint32_t failing(void *context, const ${n} *input, ${n} *out) {
  (void)context; (void)input; (void)out; ++callbacks; return NG_CALLBACK;
}
static uint32_t retiring(void *context, const ${n} *input, ${n} *out) {
  (void)input; (void)out; ++callbacks; lean_bridge_native_runtime_retire(); return context ? NG_CALLBACK : NG_OK;
}
static void lifecycle(void) {
  sample_allocation *arena = NULL; ${n} input = {0}, out = {0};
  sample_${id(tree)}(&input, 17, 0, &arena);
  ${cb(invoke.parameters[1])} host = { failing, NULL };
  unsigned before_calls = callbacks; out = input;
  CHECK(${call("twiceRecursive").name}(&input, &host, &out) == NG_CALLBACK);
  CHECK(callbacks == before_calls + 1 && equal_${id(tree)}(&input, &out)); CHECK(!graph_live); ++rejections;
  host.call = foreign_callback; before_calls = callbacks;
  CHECK(${call("twiceRecursive").name}(&input, &host, &out) == NG_INVALID);
  CHECK(callbacks == before_calls + 1 && !memcmp(&input, &out, sizeof(input))); CHECK(!graph_live); ++rejections;
  host.call = nested; nesting_limit = 8; memset(&out, 0, sizeof(out));
  CHECK(${invoke.name}(&input, &host, &out) == NG_OK); CHECK(equal_${id(tree)}(&input, &out)); ${clear(tree, "&out")}
  CHECK(peak_nesting == 8 && !nesting);
  nesting_limit = 65; out = input;
  CHECK(${invoke.name}(&input, &host, &out) == NG_LIMIT); CHECK(equal_${id(tree)}(&input, &out)); CHECK(peak_nesting == 64 && !nesting && !graph_live); ++rejections;
  uint64_t token = 0; CHECK(${make.name}(&input, &token) == NG_OK);
  thread_token = token; pthread_t thread;
  CHECK(!pthread_create(&thread, NULL, wrong_thread, NULL)); CHECK(!pthread_join(thread, NULL)); CHECK(thread_status == NG_INVALID); ++rejections;
  ${record.name} record = {0}, record_out = {0};
  CHECK(${recordLease.call}(token, &record, &record_out) == NG_INVALID); ++rejections;
  pid_t child = fork(); CHECK(child >= 0);
  if (!child) { bool selected = false; memset(&out, 0, sizeof(out)); _exit(${lease.call}(token, &selected, &input, &out) == NG_INVALID ? 0 : 1); }
  int result = 0; CHECK(waitpid(child, &result, 0) == child && WIFEXITED(result) && WEXITSTATUS(result) == 0); ++rejections;
  bool selected = true; dispose_on_decode = token; memset(&out, 0, sizeof(out));
  CHECK(${lease.call}(token, &selected, &input, &out) == NG_OK); CHECK(equal_${id(tree)}(&input, &out)); ${clear(tree, "&out")}
  CHECK(${lease.call}(token, &selected, &input, &out) == NG_INVALID && !identity_count()); ++rejections;
  ${cb(retain.parameters[0])} retained_host = { echo_Record, NULL }; uint64_t retained = 0;
  CHECK(${retain.name}(&retained_host, &retained) == NG_OK && retained);
  before_calls = callbacks;
  CHECK(${recordLease.call}(retained, &record, &record_out) == NG_INVALID); CHECK(callbacks == before_calls); ++rejections;
  ${recordLease.dispose}(retained); CHECK(!identity_count());
  ${n} spine[65] = {0}; uint32_t limb = 17;
  spine[0].cases.leaf.value.data = &limb; spine[0].cases.leaf.value.length = 1;
  host.call = echo_Recursive;
  for (size_t depth = 0; depth <= 64; ++depth) {
    if (depth) { spine[depth].kind = 1; spine[depth].cases.branch.children.data = &spine[depth - 1]; spine[depth].cases.branch.children.length = 1; }
    memset(&out, 0, sizeof(out));
    CHECK(${invoke.name}(&spine[depth], &host, &out) == (depth < 64 ? NG_OK : NG_LIMIT));
    if (depth < 64) { CHECK(equal_${id(tree)}(&spine[depth], &out)); ${clear(tree, "&out")} }
    CHECK(!graph_live);
  }
  /* Exhaustion must reject instead of recycling a creating-thread identity. */
  const uint64_t previous_thread = ng_closure_thread, previous_serial = ng_closure_thread_serial;
  ng_closure_thread = 0; ng_closure_thread_serial = UINT64_MAX; token = 0;
  CHECK(${make.name}(&input, &token) == NG_ALLOC && !token); CHECK(!identity_count() && !graph_live); ++rejections;
  ng_closure_thread = previous_thread; ng_closure_thread_serial = previous_serial;
  uint64_t borrowed_tokens[4096];
  for (size_t i = 0; i < 4096; ++i) { borrowed_tokens[i] = lb_native_callback_register(never_invoke, NULL); CHECK(borrowed_tokens[i]); }
  out = input; before_calls = callbacks;
  CHECK(${invoke.name}(&input, &host, &out) == NG_ALLOC); CHECK(callbacks == before_calls && !memcmp(&input, &out, sizeof(input))); ++rejections;
  for (size_t i = 0; i < 4096; ++i) lb_native_callback_release(borrowed_tokens[i]);
  uint64_t tokens[4096] = {0};
  for (size_t i = 0; i < 4096; ++i) CHECK(${make.name}(&input, &tokens[i]) == NG_OK && tokens[i]);
  CHECK(identity_count() == 4096); token = 0;
  CHECK(${make.name}(&input, &token) == NG_ALLOC && !token); ++rejections;
  for (size_t i = 0; i < 4096; ++i) ${lease.dispose}(tokens[i]);
  CHECK(!identity_count());
  sample_release(arena); CHECK(!sample_live && !graph_live && !ng_call_depth);
}
int main(int argc, char **argv) {
  if (argc > 1 && !strcmp(argv[1], "malformed")) {
    ${n} input = {0}, out = {0};
    ${cb(invoke.parameters[1])} host = { echo_Recursive, NULL }; malformed_carrier = 1;
    CHECK(${call("twiceRecursive").name}(&input, &host, &out) == NG_RESULT);
    CHECK(callbacks == 0 && !graph_live && !ng_call_depth);
    CHECK(${invoke.name}(&input, &host, &out) == NG_RUNTIME); return 0;
  }
  if (argc > 1) {
    ${n} input = {0}, out = {0};
    ${cb(invoke.parameters[1])} host = { retiring, argc > 2 ? &input : NULL };
    CHECK(${call("twiceRecursive").name}(&input, &host, &out) == (argc > 2 ? NG_CALLBACK : NG_RUNTIME));
    CHECK(callbacks == 1 && !graph_live && !sample_live && !ng_call_depth);
    CHECK(${invoke.name}(&input, &host, &out) == NG_RUNTIME); return 0;
  }
  ${Object.keys(structuredCallableShapes).map(shape => `shape_${shape}();`).join("\n  ")}
  alias_Alias(); alias_Plain();
  lifecycle();
  printf("{\\"checks\\":%u,\\"callbacks\\":%u,\\"shapes\\":%u,\\"rejections\\":%u,\\"ownedReplies\\":%u,\\"allocationFailures\\":%u,\\"reentryDepth\\":%u,\\"aliasSignatures\\":%u}\\n", checks, callbacks, shapes, rejections, owned_replies, failed_allocations, peak_nesting, alias_signatures);
  return 0;
}
`);
	return { generated, source: lines.join("\n") };
};
