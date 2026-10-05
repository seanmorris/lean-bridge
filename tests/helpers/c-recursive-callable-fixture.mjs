/**
 * Public C/GMP recursive callable acceptance with independently built values.
 * Tests use named constructors, GMP integers and generated deep-copy operations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { compileCallableGraphPackageModel } from "../../src/backends/c/callable-graph-model.mjs";
import { cIdentifier } from "../../src/backends/c/generate.mjs";
import { nativeRecursiveCallableReviewedIr } from "./native-recursive-callable-fixture.mjs";
import { structuredCallableShapes } from "./structured-callable-fixture.mjs";
import { recursiveCallableCEdges } from "./c-recursive-callable-edges.mjs";

const consumer = ({ faults = false } = {}) => {
	const ir = nativeRecursiveCallableReviewedIr(), model = compileCallableGraphPackageModel(ir, ["c"]);
	const nodes = new Map(model.layout.nodes.map((node, index) => {
		const entry = { ...node, index, integer: ["nat", "int"].includes(node.ref.name) };
		return [node.id, entry];
	}));
	const get = ref => nodes.get(model.payloads.copy(ref).id);
	const at = (node, value) => node.integer ? `*(${value})` : value;
	const cbName = callback => `structured_${cIdentifier(ir.types.find(type => type.id === callback.id).name)}`;
	const owned = callback => cbName(callback).replace("structured_", "structured_owned_");
	const lines = [`#include "structured.h"
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <dlfcn.h>
#include <stdatomic.h>
static _Atomic unsigned checks;
static unsigned callbacks, shapes, aliases, option_coverage, nested_result_coverage, result_coverage;
#define CHECK(test) do { ++checks; if (!(test)) { fprintf(stderr, "line %d: %s\\n", __LINE__, #test); abort(); } } while (0)
struct snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static unsigned identities(void) {
  void (*read_snapshot)(struct snapshot *) = (void (*)(struct snapshot *))dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
  CHECK(read_snapshot); struct snapshot snapshot; read_snapshot(&snapshot); return snapshot.identities;
}
struct allocation { struct allocation *next; void (*clear)(void *); size_t count, width; max_align_t alignment; unsigned char data[]; };
typedef struct { struct allocation *head; } arena;
static void *allocate(arena *owner, size_t count, size_t width, void (*clear)(void *)) {
  if (!count) return NULL;
  struct allocation *value = calloc(1, sizeof(*value) + count * width); CHECK(value);
  *value = (struct allocation){ .next = owner->head, .clear = clear, .count = count, .width = width };
  owner->head = value; return value->data;
}
static void release(arena *owner) {
  while (owner->head) {
    struct allocation *value = owner->head; owner->head = value->next;
    for (size_t i = 0; i < value->count; ++i) value->clear(value->data + i * value->width);
    free(value);
  }
}
`];
	if(faults) lines.push(`
static int fault_layer = -1, remaining = -1;
static size_t live[2];
static struct { unsigned cases, failures; } fault_stats[11][2];
static void (*edge_allocation_hook)(unsigned);
static void *fault_allocate(unsigned layer, size_t bytes) {
  if (edge_allocation_hook) edge_allocation_hook(layer);
  if ((int)layer == fault_layer && remaining >= 0) { if (!remaining) return NULL; --remaining; }
  void *value = malloc(bytes); if (value) ++live[layer]; return value;
}
static void fault_release(unsigned layer, void *value) {
  if (value) { CHECK(live[layer]); --live[layer]; free(value); }
}
void *probe_native_malloc(size_t bytes) { return fault_allocate(0, bytes); }
void probe_native_free(void *value) { fault_release(0, value); }
void *probe_gmp_malloc(size_t bytes) { return fault_allocate(1, bytes); }
void probe_gmp_free(void *value) { fault_release(1, value); }
`);
	for(const node of nodes.values())
	{
		const n = node.name, k = node.index;
		lines.push(`static inline void init${k}(${n} *value) { ${node.aggregate ? `${n}_init(${at(node, "value")});` : "*value = 0;"} }`
			, `static inline void clear${k}(void *raw) { ${n} *value = raw; ${node.aggregate ? `${n}_clear(${at(node, "value")});` : "(void)value;"} }`
			, `static inline void sample${k}(${n} *, unsigned, unsigned, arena *);`
			, `static inline int equal${k}(const ${n} *, const ${n} *);`
			, `static inline void borrowed${k}(const ${n} *);`);
	}
	for(const node of nodes.values())
	{
		const n = node.name, k = node.index;
		const sample = ["(void)seed; (void)depth; (void)owner;"], equal = [], borrowed = ["(void)value;"];
		if(node.aggregate && !node.integer) borrowed.push("CHECK(!value->_bridge_owner && !value->_bridge_release);");
		const fields = (items, prefix, sampleSeed = "seed + 1") => {
			for(const field of items)
			{
				const child = nodes.get(field.type), slot = `${prefix}${field.name}`, ptr = field.storage === "pointer";
				if(ptr) sample.push(`{ ${child.name} *data = allocate(owner, 1, sizeof(*data), clear${child.index}); init${child.index}(data); out->${slot} = data; sample${child.index}(data, ${sampleSeed}, depth + 1, owner); }`);
				else sample.push(`sample${child.index}(&out->${slot}, ${sampleSeed}, depth + 1, owner);`);
				equal.push(`if (!equal${child.index}(${ptr ? "" : "&"}left->${slot}, ${ptr ? "" : "&"}right->${slot})) return 0;`);
				borrowed.push(`borrowed${child.index}(${ptr ? "" : "&"}value->${slot});`);
			}
		};
		if(node.integer)
		{
			sample.push("mpz_set_ui(*out, 0); if (seed % 3) { mpz_set_ui(*out, 1); mpz_mul_2exp(*out, *out, seed % 2 ? 4097 : 257); mpz_add_ui(*out, *out, seed); }"
				, ...node.ref.name === "int" ? ["mpz_neg(*out, *out);"] : []);
			equal.push("return mpz_cmp(*left, *right) == 0;");
		}
		else if(node.kind === "primitive")
		{
			if(["bytes", "string"].includes(node.ref.name))
			{
				const bytes = node.ref.name === "bytes";
				sample.push(`static const ${bytes ? "uint8_t" : "char"} data[] = ${bytes ? "{0, 255, 128, 1}" : '"a\\0z\\xf0\\x9f\\x99\\x82"'};`
					, `out->data = data; out->length = seed % 3 ? sizeof(data)${bytes ? "" : " - 1"} : 0;`);
				equal.push("return left->length == right->length && (!left->length || !memcmp(left->data, right->data, left->length));");
			}
			else
			{
				sample.push(`*out = ${node.ref.name === "unit" ? "0" : node.ref.name === "bool" ? "seed % 2" : `(${n})(UINT64_MAX - seed)`};`);
				equal.push("return *left == *right;");
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			sample.push("size_t count = depth > 8 ? 0 : seed % 4;"
				, `${child.name} *data = allocate(owner, count, sizeof(*data), clear${child.index});`
				, "out->data = data; out->length = count;"
				, `for (size_t i = 0; i < count; ++i) { init${child.index}(data + i); sample${child.index}(data + i, seed + (unsigned)i + 1, depth + 1, owner); }`);
			equal.push("if (left->length != right->length) return 0;"
				, `for (size_t i = 0; i < left->length; ++i) if (!equal${child.index}(left->data + i, right->data + i)) return 0;`);
			borrowed.push(`for (size_t i = 0; i < value->length; ++i) borrowed${child.index}(value->data + i);`);
		}
		else if(node.kind === "variant")
		{
			sample.push(`switch (depth > 8 ? 0 : seed % ${node.cases.length}) {`);
			equal.push("if (left->kind != right->kind) return 0;", "switch (left->kind) {");
			borrowed.push("switch (value->kind) {");
			node.cases.forEach((branch, index) => {
				sample.push(`case ${index}: CHECK(${n}_select(out, ${branch.tag}) == STRUCTURED_STATUS_OK);`);
				equal.push(`case ${branch.tag}:`); borrowed.push(`case ${branch.tag}:`);
				fields(branch.fields, `cases.${branch.name}.`, `seed / ${node.cases.length}`);
				sample.push("break;"); equal.push("return 1;"); borrowed.push("break;");
			});
			for(const group of [sample, equal, borrowed]) group.push("default: abort();", "}");
		}
		else
		{
			const flag = { option: "has_value", result: "is_ok" }[node.kind];
			if(flag)
			{ sample.push(`out->${flag} = ${node.kind === "option" ? "seed % 3 != 0" : "seed % 2"};`); equal.push(`if (left->${flag} != right->${flag}) return 0;`); }
			node.fields.forEach((field, index) => {
				if(flag) for(const [group, value] of [[sample, "out"], [equal, "left"], [borrowed, "value"]]) group.push(`if (${index ? "!" : ""}${value}->${flag}) {`);
				fields([field], "", flag ? "seed / 2" : "seed + 1");
				if(flag) for(const group of [sample, equal, borrowed]) group.push("}");
			});
		}
		lines.push(`static inline void sample${k}(${n} *out, unsigned seed, unsigned depth, arena *owner) {\n${sample.map(line => `  ${line}`).join("\n")}\n}`
			, `static inline int equal${k}(const ${n} *left, const ${n} *right) {\n${equal.map(line => `  ${line}`).join("\n")}\n  return 1;\n}`
			, `static inline void borrowed${k}(const ${n} *value) {\n${borrowed.map(line => `  ${line}`).join("\n")}\n}`);
	}
	const tests = [];
	for(const [shapeIndex, [shape, ref]] of Object.entries(structuredCallableShapes).entries())
	{
		const node = get(ref), n = node.name, k = node.index;
		const fn = name => model.functions.find(fn => fn.declaration.name === name + shape);
		const cb = fn("call").parameters[1], closure = fn("make").result;
		lines.push(`typedef struct { const ${n} *expected, *replacement; unsigned calls, mode; } context_${shape};`
			, `static structured_status echo_${shape}(void *raw, const ${n} *value, ${n} *out, structured_error *error) {`
			, `  context_${shape} *self = raw; borrowed${k}(value);`
			, `  CHECK(equal${k}(value, self->calls && self->mode == 1 ? self->replacement : self->expected)); ++self->calls; ++callbacks;`
			, `  structured_status status = ${n}_copy(self->mode == 1 ? self->replacement : value, out, error);`
			, "  if (status) return status;"
			, "  if (self->mode == 2) { *error = (structured_error){STRUCTURED_ERROR_NATIVE_CALLBACK_FAILURE, \"first callback failure\", 22}; return STRUCTURED_STATUS_DECLARED_ERROR; }"
			, "  return STRUCTURED_STATUS_OK;", "}");
		tests.push(`  for (unsigned seed = 0; seed < 12; ++seed) {
    arena source_owner = {0}, other_owner = {0};
    ${n} source, other, result, snapshot; init${k}(&source); init${k}(&other); init${k}(&result); init${k}(&snapshot);
    sample${k}(&source, seed, 0, &source_owner); sample${k}(&other, seed + 1, 0, &other_owner);
${shape === "Option" ? "    option_coverage |= !source.has_value ? 1 : !source.value.has_value ? 2 : 4;" : ""}
${shape === "Result" ? "    result_coverage |= source.is_ok ? source.ok.has_value ? 8 : 4 : source.error.length ? 2 : 1;" : ""}
${shape === "Record" ? "    nested_result_coverage |= !source.nested.has_value ? 1 : source.nested.value.is_ok ? 4 : 2;" : ""}
    structured_error error = {0}; context_${shape} state = {&source, &other, 0, 0};
    ${cbName(cb)} callback = {echo_${shape}, &state};
    CHECK(${fn("call").name}(&source, &callback, &result, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal${k}(&source, &result) && state.calls == 1);
    CHECK(${fn("twice").name}(&source, &callback, &result, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal${k}(&source, &result) && state.calls == 3);
    state.mode = 1; state.calls = 0;
    CHECK(${fn("twice").name}(&source, &callback, &result, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal${k}(&other, &result) && state.calls == 2);
    state.mode = 2; state.calls = 0;
    CHECK(${fn("twice").name}(&source, &callback, &result, &error) == STRUCTURED_STATUS_DECLARED_ERROR);
    CHECK(equal${k}(&other, &result) && state.calls == 1);
    CHECK(error.code == STRUCTURED_ERROR_NATIVE_CALLBACK_FAILURE && error.message_length == 22 && !memcmp(error.message, "first callback failure", 22));
${shape === "Record" ? `    {
      state.calls = 0;
      structured_scalar_string_t text; structured_scalar_string_t_init(&text);
      text.data = "unchanged"; text.length = 9;
      CHECK(structured_after_failure(&source, &callback, &text, &error) == STRUCTURED_STATUS_DECLARED_ERROR);
      CHECK(state.calls == 1 && text.length == 9 && !memcmp(text.data, "unchanged", 9));
      CHECK(error.code == STRUCTURED_ERROR_NATIVE_CALLBACK_FAILURE && error.message_length == 22 && !memcmp(error.message, "first callback failure", 22));
      structured_scalar_string_t_clear(&text);
      state.mode = 0; state.calls = 0;
      ${owned(cb)} *expired = NULL;
      CHECK(structured_retain_record(&callback, &expired, &error) == STRUCTURED_STATUS_OK);
      CHECK(${owned(cb)}_call(expired, &source, &result, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
      CHECK(state.calls == 0 && equal${k}(&other, &result));
      ${owned(cb)}_dispose(&expired); CHECK(!expired);
    }` : ""}
    CHECK(${n}_copy(&source, &snapshot, &error) == STRUCTURED_STATUS_OK);
    CHECK(${n}_copy(&snapshot, &snapshot, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal${k}(&source, &snapshot));
${faults ? `    {
      ${owned(closure)} *held = NULL;
      CHECK(${fn("make").name}(&source, &held, &error) == STRUCTURED_STATUS_OK);
      const unsigned identities_before = identities(); const size_t before_live[2] = {live[0], live[1]};
      for (unsigned layer = 0; layer < 2; ++layer) for (unsigned operation = 0; operation < 5; ++operation) {
        int succeeded = 0; ++fault_stats[${shapeIndex}][layer].cases;
        for (int checkpoint = 0; checkpoint < 8192; ++checkpoint) {
          ${n} scratch; init${k}(&scratch); unsigned char unchanged[sizeof(scratch)]; memcpy(unchanged, &scratch, sizeof(scratch));
          ${owned(closure)} *fresh = NULL; state.calls = 0; state.mode = 0;
          fault_layer = (int)layer; remaining = checkpoint; structured_status status;
          if (operation == 0) status = ${fn("call").name}(&source, &callback, &scratch, &error);
          else if (operation == 1) status = ${fn("twice").name}(&source, &callback, &scratch, &error);
          else if (operation == 2) {
            status = ${fn("make").name}(&source, &fresh, &error);
            if (!status) status = ${owned(closure)}_call(fresh, true, &other, &scratch, &error);
          } else if (operation == 3) status = ${owned(closure)}_call(held, true, &other, &scratch, &error);
          else status = ${n}_copy(&source, &scratch, &error);
          fault_layer = -1; remaining = -1; ${owned(closure)}_dispose(&fresh);
          if (!status) { CHECK(equal${k}(&source, &scratch)); succeeded = 1; }
          else { CHECK(status == STRUCTURED_STATUS_UNEXPECTED_ERROR); CHECK(!memcmp(unchanged, &scratch, sizeof(scratch))); ++fault_stats[${shapeIndex}][layer].failures; }
          clear${k}(&scratch); CHECK(identities() == identities_before);
          CHECK(live[0] == before_live[0] && live[1] == before_live[1]);
          if (succeeded) break;
        }
        CHECK(succeeded);
      }
      ${owned(closure)}_dispose(&held);
    }` : ""}
    ${owned(closure)} *closure = NULL;
    CHECK(${fn("make").name}(&source, &closure, &error) == STRUCTURED_STATUS_OK);
    CHECK(${fn("make").name}(&source, &closure, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    clear${k}(&source); release(&source_owner);
    CHECK(${owned(closure)}_call(closure, true, &other, &result, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal${k}(&snapshot, &result));
    CHECK(${owned(closure)}_call(closure, false, &other, &result, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal${k}(&other, &result));
    ${owned(closure)}_dispose(&closure); CHECK(!closure); ${owned(closure)}_dispose(&closure);
    CHECK(${owned(closure)}_call(closure, true, &other, &result, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(equal${k}(&other, &result));
    clear${k}(&snapshot); clear${k}(&result); clear${k}(&other); release(&other_owner);
    CHECK(identities() == baseline);
  }
  ++shapes;`);
	}
	for(const suffix of ["Alias", "Plain"])
	{
		const call = model.functions.find(fn => fn.declaration.name === "callNested" + suffix);
		const make = model.functions.find(fn => fn.declaration.name === "makeNested" + suffix);
		const cb = call.parameters[1], nested = get(cb.result), record = nodes.get(call.parameters[0].id);
		const n = nested.name, k = nested.index, rk = record.index;
		lines.push(`typedef struct { const ${record.name} *expected; unsigned fail; } alias_context_${suffix};`
			, `static structured_status echo_nested_${suffix}(void *raw, const ${n} *value, ${n} *out, structured_error *error) {`
			, `  alias_context_${suffix} *self = raw; ++callbacks; borrowed${k}(value);`
			, "  CHECK(value->length == 3 && value->data[0].has_value && !value->data[1].has_value && value->data[2].has_value);"
			, `  CHECK(equal${rk}(&value->data[0].value, self->expected) && equal${rk}(&value->data[2].value, self->expected));`
			, `  structured_status status = ${n}_copy(value, out, error); if (status) return status;`
			, "  if (self->fail) { *error = (structured_error){STRUCTURED_ERROR_NATIVE_CALLBACK_FAILURE, \"alias failure\", 13}; return STRUCTURED_STATUS_DECLARED_ERROR; }"
			, "  return STRUCTURED_STATUS_OK;", "}");
		tests.push(`  for (unsigned seed = 0; seed < 12; ++seed) {
    arena source_owner = {0}; ${record.name} source, snapshot; init${rk}(&source); init${rk}(&snapshot);
    sample${rk}(&source, seed, 0, &source_owner); structured_error error = {0};
    alias_context_${suffix} state = {&source, 0}; ${cbName(cb)} callback = {echo_nested_${suffix}, &state};
    structured_scalar_string_t text; structured_scalar_string_t_init(&text);
    CHECK(${call.name}(&source, &callback, &text, &error) == STRUCTURED_STATUS_OK);
    CHECK(text.length == source.text.length * 2 + 6);
    if (source.text.length) CHECK(!memcmp(text.data, source.text.data, source.text.length));
    CHECK(!memcmp(text.data + source.text.length, "<none>", 6));
    if (source.text.length) CHECK(!memcmp(text.data + source.text.length + 6, source.text.data, source.text.length));
    state.fail = 1;
    CHECK(${call.name}(&source, &callback, &text, &error) == STRUCTURED_STATUS_DECLARED_ERROR);
    CHECK(text.length == source.text.length * 2 + 6 && !memcmp(text.data + source.text.length, "<none>", 6));
    CHECK(error.code == STRUCTURED_ERROR_NATIVE_CALLBACK_FAILURE && error.message_length == 13 && !memcmp(error.message, "alias failure", 13));
    structured_scalar_string_t_clear(&text);
    CHECK(${record.name}_copy(&source, &snapshot, &error) == STRUCTURED_STATUS_OK);
    ${owned(make.result)} *closure = NULL;
    CHECK(${make.name}(&source, &closure, &error) == STRUCTURED_STATUS_OK);
    clear${rk}(&source); release(&source_owner);
    ${n} input, output; init${k}(&input); init${k}(&output);
    CHECK(${owned(make.result)}_call(closure, &input, &output, &error) == STRUCTURED_STATUS_OK);
    CHECK(output.length == 3 && output.data[0].has_value && !output.data[1].has_value && output.data[2].has_value);
    CHECK(equal${rk}(&output.data[0].value, &snapshot) && equal${rk}(&output.data[2].value, &snapshot));
${faults ? `    {
      const unsigned identities_before = identities(); const size_t before_live[2] = {live[0], live[1]};
      state.expected = &snapshot; state.fail = 0;
      for (unsigned layer = 0; layer < 2; ++layer) for (unsigned operation = 0; operation < 5; ++operation) {
        int succeeded = 0; ++fault_stats[${suffix === "Alias" ? 9 : 10}][layer].cases;
        for (int checkpoint = 0; checkpoint < 8192; ++checkpoint) {
          ${n} scratch; init${k}(&scratch); unsigned char unchanged[sizeof(scratch)]; memcpy(unchanged, &scratch, sizeof(scratch));
          structured_scalar_string_t scratch_text; structured_scalar_string_t_init(&scratch_text);
          unsigned char unchanged_text[sizeof(scratch_text)]; memcpy(unchanged_text, &scratch_text, sizeof(scratch_text));
          ${owned(make.result)} *fresh = NULL;
          fault_layer = (int)layer; remaining = checkpoint; structured_status status;
          if (operation == 0) status = ${call.name}(&snapshot, &callback, &scratch_text, &error);
          else if (operation == 1) status = ${owned(make.result)}_call(closure, &output, &scratch, &error);
          else if (operation == 2) {
            status = ${make.name}(&snapshot, &fresh, &error);
            if (!status) status = ${owned(make.result)}_call(fresh, &input, &scratch, &error);
          } else if (operation == 3) status = ${owned(make.result)}_call(closure, &input, &scratch, &error);
          else status = ${n}_copy(&output, &scratch, &error);
          fault_layer = -1; remaining = -1; ${owned(make.result)}_dispose(&fresh);
          if (!status) {
            if (operation) CHECK(equal${k}(&output, &scratch));
            else { CHECK(scratch_text.length == snapshot.text.length * 2 + 6); CHECK(!memcmp(scratch_text.data + snapshot.text.length, "<none>", 6)); }
            succeeded = 1;
          } else {
            CHECK(status == STRUCTURED_STATUS_UNEXPECTED_ERROR); CHECK(!memcmp(unchanged, &scratch, sizeof(scratch)));
            CHECK(!memcmp(unchanged_text, &scratch_text, sizeof(scratch_text))); ++fault_stats[${suffix === "Alias" ? 9 : 10}][layer].failures;
          }
          clear${k}(&scratch); structured_scalar_string_t_clear(&scratch_text); CHECK(identities() == identities_before);
          CHECK(live[0] == before_live[0] && live[1] == before_live[1]);
          if (succeeded) break;
        }
        CHECK(succeeded);
      }
    }` : ""}
    ${owned(make.result)}_dispose(&closure); CHECK(!closure);
    clear${k}(&input); clear${k}(&output); clear${rk}(&snapshot); CHECK(identities() == baseline);
  }
  ++aliases;`);
	}
	lines.push(recursiveCallableCEdges(model, { faults }));
	lines.push("int main(int argc, char **argv) { (void)argv; CHECK(structured_initialize(NULL) == STRUCTURED_STATUS_OK); if (argc > 1) return 0;"
		, "  const unsigned baseline = identities();", ...tests
		, "  CHECK(option_coverage == 7 && nested_result_coverage == 7 && result_coverage == 15); recursive_edges();");
	if(faults) lines.push('  CHECK(live[0] == 0 && live[1] == 0);'
		, '  printf("{\\"checks\\":%u,\\"callbacks\\":%u,\\"shapes\\":%u,\\"aliases\\":%u,\\"faults\\":[", checks, callbacks, shapes, aliases);'
		, '  const char *names[] = {"array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive", "nested-alias", "nested-plain"};'
		, '  for (unsigned i = 0; i < 11; ++i) printf("%s{\\"shape\\":\\"%s\\",\\"nativeCases\\":%u,\\"nativeFailures\\":%u,\\"gmpCases\\":%u,\\"gmpFailures\\":%u}", i ? "," : "", names[i], fault_stats[i][0].cases, fault_stats[i][0].failures, fault_stats[i][1].cases, fault_stats[i][1].failures);'
		, '  printf("],\\"optionCases\\":%u,\\"nestedResultCases\\":%u,\\"resultCases\\":%u", option_coverage, nested_result_coverage, result_coverage);');
	else lines.push('  printf("{\\"checks\\":%u,\\"callbacks\\":%u,\\"shapes\\":%u,\\"aliases\\":%u,\\"optionCases\\":%u,\\"nestedResultCases\\":%u,\\"resultCases\\":%u", checks, callbacks, shapes, aliases, option_coverage, nested_result_coverage, result_coverage);');
	lines.push('  printf(",\\"edgeRejections\\":%u,\\"acceptedDepths\\":%u,\\"wrongThreads\\":%u,\\"wrongProcesses\\":%u,\\"activeDisposals\\":%u}\\n", edge_rejections, edge_depths, edge_threads, edge_processes, edge_active_disposals); return 0; }');
	return lines.join("\n");
};

/** Build an installed consumer without private carrier symbols or Lean headers. */
export const recursiveCallableCConsumer = () => consumer();

/** Exercise every native-graph and GMP-facade allocation checkpoint. */
export const recursiveCallableCFaultConsumer = () => consumer({ faults: true });

/**
 * Check that each recursive and nonrecursive public C shape actually ran.
 *
 * @param text - Output from the installed C executable.
 */
export const parseRecursiveCallableCResult = text => {
	const result = JSON.parse(text);
	assert.equal(result.shapes, 9); assert.equal(result.aliases, 2);
	assert.equal(result.callbacks, 9 * 12 * 6 + 12 + 2 * 12 * 2);
	assert.equal(result.optionCases, 7); assert.equal(result.nestedResultCases, 7);
	assert.equal(result.resultCases, 15);
	assert.equal(result.edgeRejections, 52); assert.equal(result.acceptedDepths, 64);
	assert.equal(result.wrongThreads, 17); assert.equal(result.wrongProcesses, 1);
	assert.equal(result.activeDisposals, 0);
	assert.ok(result.checks > 2000);
	return result;
};
