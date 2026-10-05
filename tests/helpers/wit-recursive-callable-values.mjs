/**
 * Independent public graph samples and field-by-field WIT callable assertions.
 * No WIT wire decoder determines the expected values.
 *
 * @file
 */
import { structuredCallableShapes } from "./structured-callable-fixture.mjs";

/**
 * Return a source-free consumer using only public generated typed helpers.
 *
 * @param model - Authenticated package names, types and original signatures.
 * @param options - Optional independent value builders for allocation probes.
 * @param options.buildersOnly - Omit the installed session consumer.
 */
export const witRecursiveCallableValues = (model, { buildersOnly = false } = {}) => {
	const nodes = new Map(model.nodes.map(node => [node.id, node])), p = model.prefix;
	const fn = name => model.functions.find(item => item.declaration.name === name);
	const call = item => `${p}_wasmtime_value_${item.field}`;
	const field = callback => callback.publicName.slice(p.length + 1);
	const create = callback => `${p}_wasmtime_callback_${field(callback)}_create`;
	const invoke = callback => `${p}_wasmtime_function_${field(callback)}_call`;
	const lines = [`#include "${p}_wasmtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
static unsigned checks, callbacks, releases, rejections, shapes, aliases;
static unsigned option_cases, result_cases, nested_cases;
static size_t sample_live;
#define CHECK(value) do { ++checks; if (!(value)) { fprintf(stderr, "line %d: %s\\n", __LINE__, #value); abort(); } } while (0)
typedef struct allocation { struct allocation *next; max_align_t alignment; unsigned char data[]; } allocation;
static void *allocate(allocation **owner, size_t count, size_t width) {
  if (!count) return NULL;
  allocation *value = calloc(1, sizeof(*value) + count * width); CHECK(value);
  ++sample_live; value->next = *owner; *owner = value; return value->data;
}
static void release(allocation **owner) {
  while (*owner) { allocation *next = (*owner)->next; CHECK(sample_live); --sample_live; free(*owner); *owner = next; }
}
static void success(wasmtime_error_t *error) {
  ++checks;
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%.*s\\n", (int)message.size, message.data);
    wasm_name_delete(&message); wasmtime_error_delete(error); abort();
  }
}
static void rejected(wasmtime_error_t *error, const char *expected) {
  CHECK(error); ++rejections; wasm_name_t message; wasmtime_error_message(error, &message);
  if (expected) CHECK(message.size == strlen(expected) && !memcmp(message.data, expected, message.size));
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static void finalizer(void *data) { (void)data; ++releases; }
`];
	for(const node of nodes.values()) lines.push(`static inline void sample${node.index}(${node.name} *, unsigned, unsigned, allocation **);
static inline int equal${node.index}(const ${node.name} *, const ${node.name} *);
static inline void borrowed${node.index}(const ${node.name} *);`);
	for(const node of nodes.values())
	{
		const sample = ["(void)seed; (void)depth; (void)owner;"], equal = [], borrowed = ["(void)value;"];
		if(node.aggregate) borrowed.push("CHECK(!value->_bridge_owner && !value->_bridge_release);");
		const fields = (items, prefix, next = "seed + 1") => {
			for(const item of items)
			{
				const child = nodes.get(item.type), slot = prefix + item.name, pointer = item.storage === "pointer";
				const address = value => `${pointer ? "" : "&"}${value}->${slot}`;
				if(pointer) sample.push(`out->${slot} = allocate(owner, 1, sizeof(${child.name}));`);
				sample.push(`sample${child.index}((${child.name} *)${address("out")}, ${next}, depth + 1, owner);`);
				equal.push(`if (!equal${child.index}(${address("left")}, ${address("right")})) return 0;`);
				borrowed.push(`borrowed${child.index}(${address("value")});`);
			}
		};
		if(node.kind === "primitive")
		{
			const kind = node.ref.name;
			if(["nat", "int"].includes(kind))
			{
				sample.push("out->length = seed % 3 ? 129 : 0;"
					, "uint32_t *limbs = allocate(owner, out->length, sizeof(*limbs)); out->data = limbs;"
					, "for (size_t i = 0; i < out->length; ++i) limbs[i] = UINT32_MAX - seed - (uint32_t)i;");
				if(kind === "int")
				{ sample.push("out->negative = out->length && seed % 2;"); equal.push("if (left->negative != right->negative) return 0;"); }
				equal.push("return left->length == right->length && (!left->length || !memcmp(left->data, right->data, left->length * sizeof(uint32_t)));");
			}
			else if(["string", "bytes"].includes(kind))
			{
				sample.push(`static const ${kind === "string" ? "char" : "uint8_t"} bytes[] = {65, 0, ${kind === "string" ? "(char)0xf0, (char)0x9f, (char)0x99, (char)0x82" : "255, 128, 1"}};`
					, "out->length = seed % 3 ? sizeof(bytes) : 0;"
					, "void *data = allocate(owner, out->length, 1); if (out->length) memcpy(data, bytes, out->length); out->data = data;");
				equal.push("return left->length == right->length && (!left->length || !memcmp(left->data, right->data, left->length));");
			}
			else
			{
				const value = kind === "unit" ? "0" : kind === "bool" ? "seed % 2" : kind === "char" ? "0x1f642"
					: kind.startsWith("float") ? "seed % 4 == 0 ? -0.0 : seed % 4 == 1 ? NAN : seed % 4 == 2 ? INFINITY : -INFINITY"
						: `(${node.name})(UINT64_MAX - seed)`;
				sample.push(`*out = ${value};`);
				equal.push(kind.startsWith("float") ? "return (isnan(*left) && isnan(*right)) || (*left == *right && (!*left ? !!signbit(*left) == !!signbit(*right) : 1));" : "return *left == *right;");
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			sample.push("out->length = depth > 8 ? 0 : seed % 4;"
				, `${child.name} *data = allocate(owner, out->length, sizeof(*data)); out->data = data;`
				, `for (size_t i = 0; i < out->length; ++i) sample${child.index}(&data[i], seed + (unsigned)i + 1, depth + 1, owner);`);
			equal.push("if (left->length != right->length) return 0;"
				, `for (size_t i = 0; i < left->length; ++i) if (!equal${child.index}(&left->data[i], &right->data[i])) return 0;`);
			borrowed.push(`for (size_t i = 0; i < value->length; ++i) borrowed${child.index}(&value->data[i]);`);
		}
		else if(node.kind === "variant")
		{
			sample.push(`out->kind = depth > 8 ? 0 : seed % ${node.cases.length};`, "switch (out->kind) {");
			equal.push("if (left->kind != right->kind) return 0;", "switch (left->kind) {");
			borrowed.push("switch (value->kind) {");
			for(const [index, branch] of node.cases.entries())
			{
				for(const group of [sample, equal, borrowed]) group.push(`case ${index}:`);
				fields(branch.fields, `cases.${branch.name}.`, `seed / ${node.cases.length}`);
				for(const group of [sample, equal, borrowed]) group.push("break;");
			}
			for(const group of [sample, equal, borrowed]) group.push("default: abort();", "}");
		}
		else
		{
			const flag = { option: "has_value", result: "is_ok" }[node.kind];
			if(flag)
			{ sample.push(`out->${flag} = ${node.kind === "option" ? "seed % 3 != 0" : "seed % 2"};`); equal.push(`if (left->${flag} != right->${flag}) return 0;`); }
			for(const [index, item] of node.fields.entries())
			{
				if(flag) for(const [group, value] of [[sample, "out"], [equal, "left"], [borrowed, "value"]]) group.push(`if (${index ? "!" : ""}${value}->${flag}) {`);
				fields([item], "", flag ? "seed / 2" : "seed + 1");
				if(flag) for(const group of [sample, equal, borrowed]) group.push("}");
			}
		}
		lines.push(`static inline void sample${node.index}(${node.name} *out, unsigned seed, unsigned depth, allocation **owner) {
${sample.map(line => `  ${line}`).join("\n")}
}
static inline int equal${node.index}(const ${node.name} *left, const ${node.name} *right) {
${equal.map(line => `  ${line}`).join("\n")}
${node.kind !== "primitive" ? "  return 1;" : ""}
}
static inline void borrowed${node.index}(const ${node.name} *value) {
${borrowed.map(line => `  ${line}`).join("\n")}
}`);
	}
	if(buildersOnly) return lines.join("\n");
	const checks = [];
	for(const shape of Object.keys(structuredCallableShapes))
	{
		const valueCall = fn(`call${shape}`), twice = fn(`twice${shape}`), make = fn(`make${shape}`);
		const node = valueCall.parameters[0], cb = valueCall.parameters[1], owned = make.result, n = node.name, k = node.index;
		lines.push(`typedef struct { const ${n} *source, *other; unsigned count, mode; } context_${shape};
static wasmtime_error_t *echo_${shape}(void *raw, const ${n} *value, ${n} *out) {
  context_${shape} *self = raw; borrowed${k}(value);
  CHECK(equal${k}(value, self->mode == 1 && self->count ? self->other : self->source));
  ++self->count; ++callbacks;
  wasmtime_error_t *error = ${n}_wasmtime_copy(self->mode == 1 ? self->other : value, out);
  if (error) return error;
  return self->mode == 2 ? wasmtime_error_new("first callback failure") : NULL;
}`);
		checks.push(`for (unsigned seed = 0; seed < 12; ++seed) {
  allocation *source_owner = NULL, *other_owner = NULL;
  ${n} source = {0}, other = {0}, out = {0}, snapshot = {0};
  sample${k}(&source, seed, 0, &source_owner); sample${k}(&other, seed + 1, 0, &other_owner);
${shape === "Option" ? "  option_cases |= !source.has_value ? 1 : !source.value.has_value ? 2 : 4;" : ""}
${shape === "Result" ? "  result_cases |= source.is_ok ? source.ok.has_value ? 8 : 4 : source.error.length ? 2 : 1;" : ""}
${shape === "Record" ? "  nested_cases |= !source.nested.has_value ? 1 : source.nested.value.is_ok ? 4 : 2;" : ""}
  context_${shape} state = {&source, &other, 0, 0};
  ${p}_wasmtime_function callback = 0, closure = 0;
  unsigned released_before = releases;
  success(${create(cb)}(session, echo_${shape}, &state, finalizer, &callback));
  success(${call(valueCall)}(session, &source, callback, &out)); CHECK(equal${k}(&source, &out) && state.count == 1); ${n}_clear(&out);
  state.count = 0;
  success(${call(twice)}(session, &source, callback, &out)); CHECK(equal${k}(&source, &out) && state.count == 2); ${n}_clear(&out);
  state.mode = 1; state.count = 0;
  success(${call(twice)}(session, &source, callback, &out)); CHECK(equal${k}(&other, &out) && state.count == 2); ${n}_clear(&out);
  state.mode = 2; state.count = 0; out = other;
  unsigned char unchanged[sizeof(out)]; memcpy(unchanged, &out, sizeof(out));
  rejected(${call(twice)}(session, &source, callback, &out), "first callback failure");
  CHECK(state.count == 1 && !memcmp(unchanged, &out, sizeof(out)));
  out = (${n}){0}; state.mode = 0; state.count = 0;
  success(${call(valueCall)}(session, &source, callback, &out)); CHECK(equal${k}(&source, &out)); ${n}_clear(&out);
  rejected(${call(valueCall)}(foreign, &source, callback, &out), NULL); CHECK(!out._bridge_owner && state.count == 1);
  success(${n}_wasmtime_copy(&source, &snapshot));
  success(${call(make)}(session, &source, &closure)); CHECK(closure);
  rejected(${call(make)}(session, &source, &closure), NULL);
  release(&source_owner); source = (${n}){0};
  bool selected = true;
  success(${invoke(owned)}(session, closure, &selected, &other, &out)); CHECK(equal${k}(&snapshot, &out)); ${n}_clear(&out);
  selected = false;
  success(${invoke(owned)}(session, closure, &selected, &other, &out)); CHECK(equal${k}(&other, &out)); ${n}_clear(&out);
  ${p}_wasmtime_function stale = closure;
  success(${p}_wasmtime_function_close(session, &closure)); CHECK(!closure); success(${p}_wasmtime_function_close(session, &closure));
  rejected(${invoke(owned)}(session, stale, &selected, &other, &out), NULL); CHECK(!out._bridge_owner);
  rejected(${invoke(owned)}(session, callback, &selected, &other, &out), NULL); CHECK(!out._bridge_owner);
  success(${p}_wasmtime_function_close(session, &callback)); CHECK(!callback && releases == released_before + 1);
  ${n}_clear(&snapshot); release(&other_owner); CHECK(!sample_live);
}
++shapes;`);
	}
	for(const suffix of ["Alias", "Plain"])
	{
		const valueCall = fn(`callNested${suffix}`), make = fn(`makeNested${suffix}`), cb = valueCall.parameters[1], node = cb.result;
		const record = valueCall.parameters[0], item = nodes.get(node.element), n = node.name;
		lines.push(`static wasmtime_error_t *nested_${suffix}(void *data, const ${n} *value, ${n} *out) {
  const ${record.name} *expected = data; ++callbacks; borrowed${node.index}(value);
  CHECK(value->length == 3 && value->data[0].has_value && !value->data[1].has_value && value->data[2].has_value);
  CHECK(equal${record.index}(&value->data[0].value, expected) && equal${record.index}(&value->data[2].value, expected));
  return ${n}_wasmtime_copy(value, out);
}`);
		checks.push(`{
  allocation *owner = NULL; ${record.name} source = {0}; sample${record.index}(&source, 0, 0, &owner);
  ${p}_wasmtime_function callback = 0, closure = 0;
  success(${create(cb)}(session, nested_${suffix}, &source, finalizer, &callback));
  ${valueCall.result.name} text = {0}; success(${call(valueCall)}(session, &source, callback, &text));
  CHECK(text.length == source.text.length * 2 + 6);
  CHECK(!memcmp(text.data, source.text.data, source.text.length));
  CHECK(!memcmp(text.data + source.text.length, "<none>", 6));
  CHECK(!memcmp(text.data + source.text.length + 6, source.text.data, source.text.length));
  ${valueCall.result.name}_clear(&text);
  success(${call(make)}(session, &source, &closure));
  ${n} empty = {0}, out = {0};
  success(${invoke(make.result)}(session, closure, &empty, &out));
  ${item.name} elements[3] = {{.has_value = 1, .value = source}, {0}, {.has_value = 1, .value = source}};
  ${n} expected = {.data = elements, .length = 3}; CHECK(equal${node.index}(&expected, &out));
  ${n}_clear(&out); success(${p}_wasmtime_function_close(session, &closure));
  success(${p}_wasmtime_function_close(session, &callback)); release(&owner); CHECK(!sample_live); ++aliases;
}`);
	}
	lines.push(`int main(void) {
  ${p}_wasmtime *session = NULL, *foreign = NULL; success(${p}_wasmtime_open(&session));
  if (getenv("LEAN_BRIDGE_WIT_PROBE_COLD_ONLY")) { ${p}_wasmtime_close(session); puts("{\\"cold\\":true}"); return 0; }
  success(${p}_wasmtime_open(&foreign));
${checks.join("\n")}
  ${p}_wasmtime_close(foreign); ${p}_wasmtime_close(session);
  CHECK(shapes == 9 && aliases == 2 && releases == 110 && !sample_live);
  CHECK(callbacks == 758 && rejections == 540);
  CHECK(option_cases == 7 && result_cases == 15 && nested_cases == 7);
  printf("{\\"shapes\\":%u,\\"aliases\\":%u,\\"checks\\":%u,\\"callbacks\\":%u,\\"releases\\":%u,\\"rejections\\":%u,\\"optionCases\\":%u,\\"resultCases\\":%u,\\"nestedCases\\":%u}\\n", shapes, aliases, checks, callbacks, releases, rejections, option_cases, result_cases, nested_cases);
}
`);
	return lines.join("\n");
};
