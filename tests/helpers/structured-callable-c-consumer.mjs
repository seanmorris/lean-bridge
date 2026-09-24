/**
 * Public C/GMP callers built from the independently specified structured API.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { cVariantTag } from "../../src/backends/c/generate.mjs";
import { structuredCallableReviewedIr, structuredCallableShapes } from "./structured-callable-fixture.mjs";

const consumer = ({ faults = false } = {}) => {
	const ir = structuredCallableReviewedIr();
	const surface = compilePrimitiveCSurface(ir, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const lines = [`#include "structured.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <dlfcn.h>
static _Atomic unsigned checks, released;
#define CHECK(condition) do { ++checks; if (!(condition)) { fprintf(stderr, "line %d: %s\\n", __LINE__, #condition); abort(); } } while (0)
static void release_memory(void *value) { ++released; free(value); }
static void *allocate(size_t bytes) { void *value = calloc(1, bytes); CHECK(value); return value; }
struct snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static unsigned identities(void) {
  void (*read_snapshot)(struct snapshot *) = (void (*)(struct snapshot *))dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
  CHECK(read_snapshot); struct snapshot snapshot; read_snapshot(&snapshot); return snapshot.identities;
}
`];
	if(faults) lines.push(`static int fail_layer = -1, remaining = -1;
static size_t live[2], attempts[2];
static int allowed(int layer) {
  ++attempts[layer]; if (fail_layer != layer || remaining < 0) return 1;
  if (!remaining) return 0;
  --remaining; return 1;
}
static void *probe_malloc(int layer, size_t bytes) { if (!allowed(layer)) return NULL; void *value = malloc(bytes); if (value) ++live[layer]; return value; }
static void *probe_calloc(int layer, size_t count, size_t bytes) { if (!allowed(layer)) return NULL; void *value = calloc(count, bytes); if (value) ++live[layer]; return value; }
static void *probe_realloc(int layer, void *value, size_t bytes) {
  if (!allowed(layer)) return NULL;
  int fresh = value == NULL; void *out = realloc(value, bytes); if (out && fresh) ++live[layer]; return out;
}
static void probe_free(int layer, void *value) { if (value) { CHECK(live[layer]); --live[layer]; free(value); } }
${["native", "gmp"].map((layer, index) => `void *probe_${layer}_malloc(size_t bytes) { return probe_malloc(${index}, bytes); }
void *probe_${layer}_calloc(size_t count, size_t bytes) { return probe_calloc(${index}, count, bytes); }
void *probe_${layer}_realloc(void *value, size_t bytes) { return probe_realloc(${index}, value, bytes); }
void probe_${layer}_free(void *value) { probe_free(${index}, value); }`).join("\n")}
`);
	const integer = copy => ["nat", "int"].includes(copy.scalarName);
	const dynamic = copy => copy.element || ["string", "bytes"].includes(copy.scalarName);
	const call = (action, copy, ...args) => `${action}_${copy.index}(${args.join(", ")})`;
	for(const copy of surface.copies)
	{
		const id = copy.index, n = copy.name, bigint = integer(copy);
		lines.push(`static inline void init_${id}(${n} *value) { ${copy.aggregate ? `${n}_init(${bigint ? "*value" : "value"});` : "memset(value, 0, sizeof(*value));"} }`
			, `static inline void clear_${id}(${n} *value) { ${copy.aggregate ? `${n}_clear(${bigint ? "*value" : "value"});` : "(void)value;"} }`);
		const sample = [], clone = [], equal = [], borrowed = [];
		if(bigint)
		{
			sample.push(`CHECK(mpz_set_str(*out, "${copy.scalarName === "int" ? "-" : ""}340282366920938463463374607431768211457", 10) == 0); mpz_add_ui(*out, *out, seed);`);
			clone.push("mpz_set(*out, *value);"); equal.push("return mpz_cmp(*left, *right) == 0;");
		}
		else if(copy.element)
		{
			const child = copy.element;
			lines.push(`struct owner_${id} { size_t length; ${child.name} data[]; };`
				, `static void release_${id}(void *raw) { struct owner_${id} *owner = raw; for (size_t index = 0; index < owner->length; ++index) ${call("clear", child, "&owner->data[index]")}; release_memory(raw); }`);
			const storage = length => [`size_t length = ${length};`
				, `struct owner_${id} *owner = length ? allocate(sizeof(*owner) + length * sizeof(${child.name})) : NULL;`
				, "if (owner) owner->length = length;"
				, `*out = (${n}){owner ? owner->data : NULL, length, owner, owner ? release_${id} : NULL};`];
			sample.push(...storage("seed % 4"), `for (size_t index = 0; index < length; ++index) { ${call("init", child, "&owner->data[index]")}; ${call("sample", child, "(unsigned)(seed + index + 1)", "&owner->data[index]")}; }`);
			clone.push(...storage("value->length"), `for (size_t index = 0; index < length; ++index) { ${call("init", child, "&owner->data[index]")}; ${call("clone", child, "&value->data[index]", "&owner->data[index]")}; }`);
			equal.push("if (left->length != right->length) return 0;", `for (size_t index = 0; index < left->length; ++index) if (!${call("equal", child, "&left->data[index]", "&right->data[index]")}) return 0;`, "return 1;");
			borrowed.push("CHECK(!value->owner && !value->release);", `for (size_t index = 0; index < value->length; ++index) ${call("borrowed", child, "&value->data[index]")};`);
		}
		else if(dynamic(copy))
		{
			const byte = copy.scalarName === "bytes";
			sample.push(`static const ${byte ? "uint8_t" : "char"} data[] = ${byte ? "{0, 255, 1, 128, 0}" : '"a\\0z\\xf0\\x9f\\x99\\x82"'};`
				, `size_t length = seed % 3 == 0 ? 0 : ${byte ? "sizeof(data)" : "sizeof(data) - 1"};`
				, "void *storage = length ? allocate(length) : NULL; if (length) memcpy(storage, data, length);"
				, `*out = (${n}){storage, length, storage, storage ? release_memory : NULL};`);
			clone.push("void *storage = value->length ? allocate(value->length) : NULL; if (value->length) memcpy(storage, value->data, value->length);"
				, `*out = (${n}){storage, value->length, storage, storage ? release_memory : NULL};`);
			equal.push("return left->length == right->length && (!left->length || !memcmp(left->data, right->data, left->length));");
			borrowed.push("CHECK(!value->owner && !value->release);");
		}
		else if(copy.variant)
		{
			sample.push(`switch (seed % ${copy.cases.length}) {`);
			clone.push(`CHECK(${n}_select(out, value->kind) == STRUCTURED_STATUS_OK);`, "switch (value->kind) {");
			equal.push("if (left->kind != right->kind) return 0;", "switch (left->kind) {");
			borrowed.push("switch (value->kind) {");
			copy.cases.forEach((branch, branchIndex) => {
				const tag = cVariantTag(n, branch.name);
				sample.push(`case ${branchIndex}: CHECK(${n}_select(out, ${tag}) == STRUCTURED_STATUS_OK);`);
				for(const output of [clone, equal, borrowed]) output.push(`case ${tag}:`);
				for(const [index, field] of branch.fields.entries())
				{
					const slot = `cases.${branch.name}.${field.name}`, child = field.type;
					sample.push(`${call("sample", child, `seed + ${index + 1}`, `&out->${slot}`)};`);
					clone.push(`${call("clone", child, `&value->${slot}`, `&out->${slot}`)};`);
					equal.push(`if (!${call("equal", child, `&left->${slot}`, `&right->${slot}`)}) return 0;`);
					borrowed.push(`${call("borrowed", child, `&value->${slot}`)};`);
				}
				for(const output of [sample, clone, borrowed]) output.push("break;");
				equal.push("return 1;");
			});
			for(const output of [sample, clone, borrowed]) output.push("default: abort();", "}");
			equal.push("default: return 0;", "}");
		}
		else if(copy.aggregate)
		{
			const flag = { option: "has_value", result: "is_ok" }[copy.compound];
			if(flag)
			{
				sample.push(`out->${flag} = ${flag === "has_value" ? "seed % 3 != 0" : "seed % 2"};`);
				clone.push(`out->${flag} = value->${flag};`); equal.push(`if (left->${flag} != right->${flag}) return 0;`);
			}
			copy.fields.forEach((field, index) => {
				for(const [output, root] of [[sample, "out"], [clone, "value"], [equal, "left"], [borrowed, "value"]])
					if(flag) output.push(`if (${index === 1 ? "!" : ""}${root}->${flag}) {`);
				sample.push(`${call("sample", field.type, `seed + ${index + 1}`, `&out->${field.name}`)};`);
				clone.push(`${call("clone", field.type, `&value->${field.name}`, `&out->${field.name}`)};`);
				equal.push(`if (!${call("equal", field.type, `&left->${field.name}`, `&right->${field.name}`)}) return 0;`);
				borrowed.push(`${call("borrowed", field.type, `&value->${field.name}`)};`);
				if(flag) for(const output of [sample, clone, equal, borrowed]) output.push("}");
			});
			equal.push("return 1;");
		}
		else
		{
			sample.push(`*out = ${copy.scalarName === "unit" ? "0" : copy.scalarName === "bool" ? "seed % 2" : `(${n})(UINT64_C(9007199254740993) + seed)`};`);
			clone.push("*out = *value;"); equal.push("return *left == *right;");
		}
		lines.push(`static inline void sample_${id}(unsigned seed, ${n} *out) { (void)seed; ${sample.join("\n")} }`
			, `static inline void clone_${id}(const ${n} *value, ${n} *out) { ${clone.join("\n")} }`
			, `static inline int equal_${id}(const ${n} *left, const ${n} *right) { ${equal.join("\n")} }`
			, `static inline void borrowed_${id}(const ${n} *value) { (void)value; ${borrowed.join("\n")} }`);
	}
	lines.push("struct context { unsigned calls, mode; };");
	const suites = [], faultSuites = [];
	for(const [label, ref] of Object.entries(structuredCallableShapes).filter(([label]) => label !== "Recursive"))
	{
		const copy = surface.copy(ref), n = copy.name, id = copy.index;
		const fn = action => surface.functions.find(item => item.declaration.id === `lean:Structured.${action}${label}`);
		const callback = surface.callbacks.get(fn("call").declaration.parameters[1].type.id);
		const closure = surface.callbacks.get(fn("make").declaration.result.type.id);
		const owned = `structured_owned_${closure.field}`;
		const invalid = copy.element ? "out->length = 1; out->data = NULL;"
			: copy.variant ? "out->kind = UINT32_MAX;"
				: copy.compound === "option" ? "out->has_value = 2;"
					: copy.compound === "result" ? "out->is_ok = 2;"
						: label === "Tuple" ? "out->fst.length = 1; out->fst.data = NULL;" : "out->text.length = 1; out->text.data = NULL;";
		const oversize = copy.element ? "out->length = SIZE_MAX; out->data = value->data;"
			: copy.variant ? `CHECK(${n}_select(out, ${cVariantTag(n, "payload")}) == STRUCTURED_STATUS_OK); out->cases.payload.label.data = "x"; out->cases.payload.label.length = SIZE_MAX;`
				: copy.compound === "option" ? "out->has_value = 1; out->value.has_value = 1; out->value.value = 1;"
					: copy.compound === "result" ? "out->is_ok = 0; out->error.data = NULL; out->error.length = SIZE_MAX;"
						: label === "Tuple" ? 'out->fst.data = "x"; out->fst.length = SIZE_MAX;' : 'out->text.data = "x"; out->text.length = SIZE_MAX;';
		lines.push(`static structured_status echo_${label}(void *raw, const ${n} *value, ${n} *out, structured_error *error) {
  struct context *context = raw; ++context->calls; borrowed_${id}(value);
  if (context->mode == 2) { ${invalid} return STRUCTURED_STATUS_OK; }
  if (context->mode == 4) { ${oversize} return STRUCTURED_STATUS_OK; }
  if (context->mode == 3) {
    context->mode = 0; ${callback.name} callback = {echo_${label}, context};
    structured_status status = ${fn("call").name}(value, &callback, out, error);
    context->mode = 3; return status;
  }
  clone_${id}(value, out);
  if (context->mode == 1) { *error = (structured_error){STRUCTURED_ERROR_INVALID_ARGUMENT, "owned\\0failure", 13}; return STRUCTURED_STATUS_DECLARED_ERROR; }
  return STRUCTURED_STATUS_OK;
}
static void check_${label}(void) {
  struct context context = {0}; ${callback.name} callback = {echo_${label}, &context};
  structured_error error = {0};
  for (unsigned seed = 0; seed < 12; ++seed) {
    ${n} value, out, alternative, retained;
    init_${id}(&value); init_${id}(&out); init_${id}(&alternative); init_${id}(&retained);
    sample_${id}(seed, &value); sample_${id}(seed + 1, &alternative); clone_${id}(&value, &retained);
    context.mode = 0; context.calls = 0;
    CHECK(${fn("call").name}(&value, &callback, &out, &error) == STRUCTURED_STATUS_OK);
    CHECK(context.calls == 1 && equal_${id}(&value, &out)); clear_${id}(&out);
    CHECK(${fn("twice").name}(&value, &callback, &out, &error) == STRUCTURED_STATUS_OK);
    CHECK(context.calls == 3 && equal_${id}(&value, &out)); clear_${id}(&out);
    context.mode = 3; context.calls = 0;
    CHECK(${fn("call").name}(&value, &callback, &out, &error) == STRUCTURED_STATUS_OK);
    CHECK(context.calls == 2 && equal_${id}(&value, &out)); clear_${id}(&out); context.mode = 0;
    CHECK(${fn("call").name}(&value, NULL, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    ${callback.name} absent = {0};
    CHECK(${fn("call").name}(&value, &absent, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(${fn("call").name}(NULL, &callback, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(${fn("call").name}(&value, &callback, NULL, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    ${owned} *closure = NULL;
    CHECK(${fn("make").name}(&value, &closure, &error) == STRUCTURED_STATUS_OK && closure);
    clear_${id}(&value);
    CHECK(${owned}_call(closure, true, &alternative, &out, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal_${id}(&retained, &out)); clear_${id}(&out);
    CHECK(${owned}_call(closure, false, &alternative, &out, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal_${id}(&alternative, &out)); clear_${id}(&out);
    ${owned}_dispose(&closure); CHECK(!closure); ${owned}_dispose(&closure);
    CHECK(${owned}_call(closure, true, &alternative, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    clone_${id}(&retained, &out);
    context.mode = 1; context.calls = 0;
    CHECK(${fn("twice").name}(&alternative, &callback, &out, &error) == STRUCTURED_STATUS_DECLARED_ERROR);
    CHECK(context.calls == 1 && error.message_length == 13 && !memcmp(error.message, "owned\\0failure", 13));
    CHECK(equal_${id}(&retained, &out));
    context.mode = 2; context.calls = 0;
    CHECK(${fn("call").name}(&alternative, &callback, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(context.calls == 1 && equal_${id}(&retained, &out));
    context.mode = 4; context.calls = 0;
    CHECK(${fn("call").name}(&alternative, &callback, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
    CHECK(context.calls == 1 && equal_${id}(&retained, &out));
    context.mode = 0;
    CHECK(${fn("call").name}(&alternative, &callback, &out, &error) == STRUCTURED_STATUS_OK);
    CHECK(equal_${id}(&alternative, &out));
    clear_${id}(&out); clear_${id}(&value); clear_${id}(&alternative); clear_${id}(&retained);
  }
}
`);
		suites.push(`check_${label}();`);
		if(faults)
		{
			lines.push(`static void fault_${label}(void) {
  struct context context = {0}; ${callback.name} callback = {echo_${label}, &context};
  structured_error error = {0}; unsigned before = identities();
  for (unsigned seed = 0; seed < 12; ++seed) for (int layer = 0; layer < 2; ++layer) for (unsigned mode = 0; mode < 2; ++mode) {
    ${n} value, out, retained; init_${id}(&value); init_${id}(&out); init_${id}(&retained);
    sample_${id}(seed, &value); sample_${id}(seed + 1, &retained);
    int succeeded = 0;
    for (int limit = 0; limit < 512; ++limit) {
      clone_${id}(&retained, &out); context.calls = 0; context.mode = mode; remaining = limit; fail_layer = layer;
      structured_status status = ${fn("twice").name}(&value, &callback, &out, &error);
      fail_layer = -1;
      if (!mode && status == STRUCTURED_STATUS_OK) { CHECK(context.calls == 2 && equal_${id}(&value, &out)); succeeded = 1; }
      else {
        CHECK(status != STRUCTURED_STATUS_OK && equal_${id}(&retained, &out));
        if (mode && status == STRUCTURED_STATUS_DECLARED_ERROR) {
          CHECK(context.calls == 1 && error.message_length == 13 && !memcmp(error.message, "owned\\0failure", 13)); succeeded = 1;
        }
      }
      clear_${id}(&out); CHECK(!live[0] && !live[1] && identities() == before);
      if (succeeded) break;
    }
    CHECK(succeeded);
    ${owned} *closure = NULL; succeeded = 0;
    for (int limit = 0; limit < 512; ++limit) {
      remaining = limit; fail_layer = layer;
      structured_status status = ${fn("make").name}(&value, &closure, &error); fail_layer = -1;
      if (status == STRUCTURED_STATUS_OK) { CHECK(closure); succeeded = 1; }
      else CHECK(!closure);
      ${owned}_dispose(&closure); CHECK(!live[0] && !live[1] && identities() == before);
      if (succeeded) break;
    }
    CHECK(succeeded && ${fn("make").name}(&value, &closure, &error) == STRUCTURED_STATUS_OK);
    size_t baseline[2] = {live[0], live[1]}; succeeded = 0;
    for (int limit = 0; limit < 512; ++limit) {
      clone_${id}(&retained, &out); remaining = limit; fail_layer = layer;
      structured_status status = ${owned}_call(closure, true, &retained, &out, &error); fail_layer = -1;
      if (status == STRUCTURED_STATUS_OK) { CHECK(equal_${id}(&value, &out)); succeeded = 1; }
      else CHECK(equal_${id}(&retained, &out));
      clear_${id}(&out); CHECK(live[0] == baseline[0] && live[1] == baseline[1] && identities() == before + 1);
      if (succeeded) break;
    }
    CHECK(succeeded); ${owned}_dispose(&closure);
    clear_${id}(&value); clear_${id}(&retained); CHECK(!live[0] && !live[1] && identities() == before);
  }
}
`);
			faultSuites.push(`fault_${label}();`);
		}
	}
	const record = surface.copy(structuredCallableShapes.Record), rid = record.index;
	const callback = surface.callbacks.get(ir.declarations.find(fn => fn.name === "callRecord").parameters[1].type.id);
	const captured = surface.callbacks.get(ir.declarations.find(fn => fn.name === "makeRecord").result.type.id);
	const lease = `structured_owned_${callback.field}`, capturedLease = `structured_owned_${captured.field}`;
	lines.push(`static structured_status nested_record(void *raw, const structured_payload *value, structured_payload *out, structured_error *error) {
  unsigned *depth = raw; borrowed_${rid}(value);
  if (!*depth) { clone_${rid}(value, out); return STRUCTURED_STATUS_OK; }
  --*depth; ${callback.name} callback = {nested_record, raw};
  return structured_call_record(value, &callback, out, error);
}
static void *foreign_thread(void *raw) {
  structured_payload value, out; init_${rid}(&value); init_${rid}(&out); sample_${rid}(5, &value); clone_${rid}(&value, &out);
  structured_error error = {0};
  CHECK(${capturedLease}_call(raw, true, &value, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(equal_${rid}(&value, &out) && strstr(error.message, "wrong-thread"));
  unsigned depth = 4; ${callback.name} callback = {nested_record, &depth};
  CHECK(structured_call_record(&value, &callback, &out, &error) == STRUCTURED_STATUS_OK);
  CHECK(equal_${rid}(&value, &out)); clear_${rid}(&out); clear_${rid}(&value); return NULL;
}
static void check_lifetimes(void) {
  unsigned before = identities(); struct context context = {0}; ${callback.name} callback = {echo_Record, &context};
  structured_payload value, out; init_${rid}(&value); init_${rid}(&out); sample_${rid}(5, &value); clone_${rid}(&value, &out);
  structured_error error = {0}; ${lease} *expired = NULL;
  CHECK(structured_retain_record(&callback, &expired, &error) == STRUCTURED_STATUS_OK);
  CHECK(identities() == before + 1);
  CHECK(${lease}_call(expired, &value, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(context.calls == 0 && equal_${rid}(&value, &out) && strstr(error.message, "Expired"));
  CHECK(structured_call_record(&value, &callback, &out, &error) == STRUCTURED_STATUS_OK);
  CHECK(context.calls == 1 && equal_${rid}(&value, &out));
  CHECK(${lease}_call(expired, &value, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(context.calls == 1 && equal_${rid}(&value, &out));
  ${lease}_dispose(&expired); CHECK(!expired && identities() == before);
  structured_string text = {0};
  context.mode = 1; context.calls = 0;
  CHECK(structured_after_failure(&value, &callback, &text, &error) == STRUCTURED_STATUS_DECLARED_ERROR);
  CHECK(context.calls == 1 && !text.data && error.message_length == 13 && !memcmp(error.message, "owned\\0failure", 13));
  context.mode = 0;
  CHECK(structured_after_failure(&value, &callback, &text, &error) == STRUCTURED_STATUS_OK);
  CHECK(text.length == value.text.length && (!text.length || !memcmp(text.data, value.text.data, text.length))); structured_string_clear(&text);
  unsigned depth = 8; ${callback.name} nested = {nested_record, &depth};
  CHECK(structured_call_record(&value, &nested, &out, &error) == STRUCTURED_STATUS_OK && !depth);
  CHECK(equal_${rid}(&value, &out));
  depth = 80;
  CHECK(structured_call_record(&value, &nested, &out, &error) == STRUCTURED_STATUS_UNEXPECTED_ERROR);
  CHECK(equal_${rid}(&value, &out) && strstr(error.message, "reentry limit"));
  depth = 2;
  CHECK(structured_call_record(&value, &nested, &out, &error) == STRUCTURED_STATUS_OK && !depth && !error.code);
  ${capturedLease} *held = NULL;
  CHECK(structured_make_record(&value, &held, &error) == STRUCTURED_STATUS_OK);
  CHECK(${lease}_call((const ${lease} *)held, &value, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(equal_${rid}(&value, &out) && strstr(error.message, "wrong-signature"));
  pthread_t thread; CHECK(!pthread_create(&thread, NULL, foreign_thread, held)); CHECK(!pthread_join(thread, NULL));
  CHECK(${capturedLease}_call(held, true, &value, &out, &error) == STRUCTURED_STATUS_OK);
  CHECK(equal_${rid}(&value, &out)); ${capturedLease}_dispose(&held);
  size_t length = value.text.length; context.calls = 0; value.text.length = SIZE_MAX;
  CHECK(structured_call_record(&value, &callback, &out, &error) == STRUCTURED_STATUS_INVALID_ARGUMENT);
  CHECK(context.calls == 0); value.text.length = length; CHECK(equal_${rid}(&value, &out));
  CHECK(structured_call_record(&value, &callback, &out, &error) == STRUCTURED_STATUS_OK);
  CHECK(context.calls == 1 && equal_${rid}(&value, &out));
  clear_${rid}(&out); clear_${rid}(&value); CHECK(identities() == before);
}
`);
	lines.push(`int main(${faults ? "int argc, char **argv" : "void"}) { ${faults ? 'if (argc == 2 && !strcmp(argv[1], "--startup-only")) return 0;' : ""} unsigned before = identities(); ${suites.join(" ")} check_lifetimes(); ${faultSuites.join(" ")} CHECK(identities() == before && released > 0); ${faults ? "CHECK(!live[0] && !live[1] && attempts[0] && attempts[1]);" : ""} printf("structured-c:%u\\n", checks); return 0; }`);
	return lines.join("\n");
};

/** Produce installed public-header checks, not a compiler-output oracle. */
export const structuredCallableCConsumer = () => consumer();

/** Produce callers that exhaust every wrapper allocation checkpoint. */
export const structuredCallableCFaultConsumer = () => consumer({ faults: true });
