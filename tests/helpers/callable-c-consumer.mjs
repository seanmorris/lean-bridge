/**
 * Independent C caller built against only the installed public header.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { callablePrimitives } from "./callable-fixture.mjs";

const callbackName = (parameters, result, owned = false) => `${owned ? "callables_owned_" : "callables_"}callback${sha256(canonicalJson({ parameters: parameters.map(name => ({ kind: "primitive", name })), result: { kind: "primitive", name: result } })).slice(0, 20)}`;
const cTypes = { unit: "uint8_t", bool: "bool", char: "uint32_t", usize: "uint64_t", isize: "int64_t", float32: "float", float64: "double", string: "callables_string", bytes: "callables_bytes", nat: "callables_nat", int: "callables_int" };
const dynamic = type => ["string", "bytes", "nat", "int"].includes(type);
const cType = type => cTypes[type] ?? `${type}_t`;
const spelling = name => name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

export const cLifetimeSignature = { name: "Callables.retainCallback"
	, parameters: [{ callback: { parameters: ["uint32"], result: "uint32" } }]
	, result: { callback: { parameters: ["uint32"], result: "uint32" } } };

/** Build the standalone C consumer from the independent fixture contract. */
export const callableCConsumer = () => {
	const definitions = [], suites = [];
	for(const [lean, type] of callablePrimitives)
	{
		const c = cType(type), cb = callbackName([type], type), closure = callbackName(["bool", type], type, true), f = spelling(lean);
		const input = dynamic(type) ? `const ${c} *value` : `${c} value`;
		const output = type === "unit" ? "" : `${c} *out, `;
		const arg = dynamic(type) ? "&value" : "value", out = type === "unit" ? "" : "&result, ";
		const equal = type === "unit" ? "1" : dynamic(type)
			? `result.length == value.length && (!value.length || !memcmp(result.data, value.data, value.length * sizeof(*value.data)))${type === "int" ? " && result.negative == value.negative" : ""}`
			: type.startsWith("float") ? "(isnan(value) ? isnan(result) : result == value && !!signbit(result) == !!signbit(value))" : "result == value";
		let values;
		if(type === "unit") values = `${c} values[] = {0};`;
		else if(type === "bool") values = `${c} values[] = {false, true};`;
		else if(type === "char") values = `${c} values[] = {0, 0x7f, 0xd7ff, 0xe000, 0xffff, 0x10000, 0x1f642, 0x10ffff};`;
		else if(type.startsWith("float")) values = `${c} values[] = {0.0, -0.0, 1.25, -1.25, INFINITY, -INFINITY, NAN, ${type === "float32" ? "FLT" : "DBL"}_TRUE_MIN, ${type === "float32" ? "FLT" : "DBL"}_MAX};`;
		else if(type === "string") values = `${c} values[] = {{0}, {.data="a\\0z", .length=3}, {.data="\\xf0\\x9f\\x99\\x82", .length=4}, {.data="hello", .length=5}};`;
		else if(type === "bytes") values = `uint8_t data[] = {0, 0xff, 1, 0, 0x80}; ${c} values[] = {{0}, {.data=data, .length=5}};`;
		else if(type === "nat" || type === "int") values = `uint32_t data[160] = {0xffffffff, 0xffffffff, 0x12345678, 0x87654321, 0, 0, 0, 0x80000000}; data[159] = 0x80000000; ${c} values[] = {{0}, {.data=data, .length=8}, {.data=data, .length=160}${type === "int" ? ", {.data=data, .length=160, .negative=true}" : ""}};`;
		else if(type.startsWith("u")) values = `${c} values[] = {0, 1, (${c})-1, (${c})-2, (${c})UINT64_C(2147483648), (${c})UINT64_C(4294967296), (${c})UINT64_C(9007199254740991), (${c})UINT64_C(9007199254740992)};`;
		else values = `${c} values[] = {0, 1, -1, INT${type === "isize" ? "64" : type.slice(3)}_MIN, INT${type === "isize" ? "64" : type.slice(3)}_MAX, (${c})INT64_C(2147483647), (${c})INT64_C(4294967296), (${c})INT64_C(9007199254740991), (${c})INT64_C(9007199254740992)};`;
		definitions.push(`static callables_status echo_${f}(void *raw, ${input}, ${output}callables_error *error) {
  struct context *ctx = raw; ++ctx->calls; (void)value; (void)error;
  ${dynamic(type) ? "CHECK(!value->owner && !value->release);" : ""}
  ${type !== "unit" ? `*out = ${dynamic(type) ? "*value" : "value"};` : ""}
  ${type !== "unit" ? `if (ctx->mode == 5) *out = *(const ${c} *)ctx->replacement;` : ""}
  if (ctx->mode == 1) { *error = (callables_error){CALLABLES_ERROR_INVALID_ARGUMENT, "host failure", 12}; return CALLABLES_STATUS_DECLARED_ERROR; }
  if (ctx->mode == 8) { *error = (callables_error){CALLABLES_ERROR_INVALID_ARGUMENT, "host\\0failure", 12}; return CALLABLES_STATUS_DECLARED_ERROR; }
  ${dynamic(type) ? `if (ctx->mode == 2) { out->data = NULL; out->length = 1; }` : type === "char" ? "if (ctx->mode == 2) *out = 0xd800;" : ""}
  ${dynamic(type) ? "if (ctx->mode == 6) out->length = 16u * 1024u * 1024u + 1;" : ""}
  ${type === "string" ? 'if (ctx->mode == 7) { out->data = "\\xed\\xa0\\x80"; out->length = 3; }' : ""}
  ${dynamic(type) ? "if (ctx->mode == 3 || ctx->mode == 4) { void *data = value->length ? malloc(value->length * sizeof(*value->data)) : NULL; CHECK(!value->length || data); if (data) memcpy(data, value->data, value->length * sizeof(*value->data)); out->data = data; out->owner = data; out->release = release_result; if (ctx->mode == 4) { *error = (callables_error){CALLABLES_ERROR_INVALID_ARGUMENT, \"owned failure\", 13}; return CALLABLES_STATUS_DECLARED_ERROR; } }" : ""}
  return CALLABLES_STATUS_OK;
}`);
		suites.push(`static void check_${f}(void) {
  ${values}
  struct context ctx = {0}; ${cb} callback = {echo_${f}, &ctx};
  callables_error error = {0};
  for (unsigned iteration = 0; iteration < 128; ++iteration) {
    ${c} value = values[iteration % (sizeof(values) / sizeof(values[0]))];
    ${type !== "unit" ? `${c} result = {0};` : ""}
    ctx.calls = 0;
    CHECK(callables_call_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_OK);
    CHECK(ctx.calls == 1 && !error.code); CHECK(${equal});
    ${dynamic(type) ? `${c}_clear(&result);` : ""}
    CHECK(callables_twice_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_OK);
    CHECK(ctx.calls == 3); CHECK(${equal});
    ${dynamic(type) ? `${c}_clear(&result);` : ""}
    ${closure} *owned = NULL;
    CHECK(callables_make_${f}(${arg}, &owned, &error) == CALLABLES_STATUS_OK && owned);
    CHECK(${closure}_call(owned, false, ${arg}, ${out}&error) == CALLABLES_STATUS_OK); CHECK(${equal});
    ${dynamic(type) ? `${c}_clear(&result);` : ""}
    CHECK(${closure}_call(owned, true, ${arg}, ${out}&error) == CALLABLES_STATUS_OK); CHECK(${equal});
    ${dynamic(type) ? `${c}_clear(&result);` : ""}
    ${c} alternative = values[(iteration + 1) % (sizeof(values) / sizeof(values[0]))];
    CHECK(${closure}_call(owned, true, ${dynamic(type) ? "&alternative" : "alternative"}, ${out}&error) == CALLABLES_STATUS_OK); CHECK(${equal});
    ${dynamic(type) ? `${c}_clear(&result);` : ""}
    CHECK(${closure}_call(owned, false, ${dynamic(type) ? "&alternative" : "alternative"}, ${out}&error) == CALLABLES_STATUS_OK); CHECK(${equal.replaceAll(/\bvalue\b/g, "alternative")});
    ${dynamic(type) ? `${c}_clear(&result);` : ""}
    ${closure}_dispose(&owned); CHECK(!owned); ${closure}_dispose(&owned);
    CHECK(${closure}_call(owned, false, ${arg}, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  }
  ${c} value = values[sizeof(values) / sizeof(values[0]) - 1]; ${type !== "unit" ? `${c} result = {0};` : ""}
  ctx.mode = 1; ctx.calls = 0;
  CHECK(callables_twice_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_DECLARED_ERROR);
  CHECK(ctx.calls == 1 && error.code == CALLABLES_ERROR_INVALID_ARGUMENT && error.message_length == 12 && !memcmp(error.message, "host failure", 12));
  ctx.mode = 8; ctx.calls = 0;
  CHECK(callables_twice_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_DECLARED_ERROR);
  CHECK(ctx.calls == 1 && error.message_length == 12 && !memcmp(error.message, "host\\0failure", 12));
  ctx.mode = 0;
  CHECK(callables_call_${f}(${arg}, NULL, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  ${cb} empty = {0}; CHECK(callables_call_${f}(${arg}, &empty, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  ${type !== "unit" ? `CHECK(callables_call_${f}(${arg}, &callback, NULL, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);` : ""}
  ${dynamic(type) || type === "char" ? `ctx.mode = 2; CHECK(callables_call_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT); ctx.mode = 0;` : ""}
  ${dynamic(type) ? `ctx.mode = 6; CHECK(callables_call_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT); ctx.mode = 0;` : ""}
  ${type === "string" ? `ctx.mode = 7; CHECK(callables_call_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT); ctx.mode = 0;` : ""}
  ${["unit", "char"].includes(type) ? `CHECK(callables_call_${f}(${type === "char" ? "0xdfff" : "1"}, &callback, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT);` : ""}
  ${dynamic(type) ? `CHECK(callables_call_${f}(NULL, &callback, ${out}&error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  for (ctx.mode = 3; ctx.mode <= 4; ++ctx.mode) {
    unsigned before = releases;
    CHECK(callables_call_${f}(${arg}, &callback, ${out}&error) == (ctx.mode == 3 ? CALLABLES_STATUS_OK : CALLABLES_STATUS_DECLARED_ERROR));
    CHECK(releases == before + 1);
    if (ctx.mode == 3) { CHECK(${equal}); ${c}_clear(&result); }
  } ctx.mode = 0;` : ""}
  CHECK(callables_call_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_OK); CHECK(${equal});
  ${dynamic(type) ? `${c}_clear(&result);` : ""}
  ctx.mode = 5; ctx.replacement = &values[0]; ctx.calls = 0;
  CHECK(callables_twice_${f}(${arg}, &callback, ${out}&error) == CALLABLES_STATUS_OK);
  CHECK(ctx.calls == 2); CHECK(${equal.replaceAll(/\bvalue\b/g, "values[0]")});
  ${dynamic(type) ? `${c}_clear(&result);` : ""}
}`);
	}
	const uintCallback = callbackName(["uint32"], "uint32");
	const uintClosure = callbackName(["uint32"], "uint32", true);
	const capturedClosure = callbackName(["bool", "uint32"], "uint32", true);
	const unitClosure = callbackName(["bool", "unit"], "unit", true);
	return `#include <callables.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <float.h>
#include <pthread.h>
#include <dlfcn.h>
static _Atomic unsigned checks, releases;
#define CHECK(expression) do { ++checks; if (!(expression)) { fprintf(stderr, "C callable check failed at %d: %s\\n", __LINE__, #expression); exit(1); } } while (0)
struct context { unsigned calls, mode; const void *replacement; };
static void release_result(void *data) { ++releases; free(data); }
${definitions.join("\n")}
${suites.join("\n")}
static callables_status nested(void *raw, uint32_t value, uint32_t *out, callables_error *error) {
  unsigned *depth = raw;
  if (!(*depth)--) { *out = value; return CALLABLES_STATUS_OK; }
  ${uintCallback} cb = {nested, raw}; return callables_call_uint32(value, &cb, out, error);
}
static void *foreign_thread(void *raw) {
  uint32_t result = 99; callables_error error = {0};
  CHECK(${capturedClosure}_call(raw, true, 1, &result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT && result == 99);
  CHECK(strstr(error.message, "wrong-thread"));
  unsigned depth = 4; ${uintCallback} cb = {nested, &depth};
  CHECK(callables_call_uint32(123, &cb, &result, &error) == CALLABLES_STATUS_OK && result == 123);
  ${unitClosure} *unit = NULL;
  CHECK(callables_make_unit(0, &unit, &error) == CALLABLES_STATUS_OK);
  CHECK(${unitClosure}_call(unit, true, 0, &error) == CALLABLES_STATUS_OK);
  ${unitClosure}_dispose(&unit);
  return NULL;
}
struct snapshot { uint32_t abi, state, runs, components, attached, identities; uint64_t runtime, domain; };
static unsigned identities(void) {
  void (*read_snapshot)(struct snapshot *) = (void (*)(struct snapshot *))dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
  CHECK(read_snapshot); struct snapshot snapshot; read_snapshot(&snapshot); return snapshot.identities;
}
static void check_lifetimes(void) {
  unsigned before = identities();
  struct context ctx = {0}; ${uintCallback} cb = {echo_uint32, &ctx}; callables_error error = {0};
  ${uintClosure} *expired = NULL; uint32_t result = 99;
  CHECK(callables_retain_callback(&cb, &expired, &error) == CALLABLES_STATUS_OK);
  CHECK(identities() == before + 1);
  CHECK(${uintClosure}_call(expired, 42, &result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT && result == 99);
  CHECK(ctx.calls == 0 && strstr(error.message, "Expired"));
  CHECK(callables_call_uint32(42, &cb, &result, &error) == CALLABLES_STATUS_OK && ctx.calls == 1);
  result = 99;
  CHECK(${uintClosure}_call(expired, 42, &result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT && result == 99);
  CHECK(ctx.calls == 1); ${uintClosure}_dispose(&expired); CHECK(identities() == before);
  ${capturedClosure} *captured = NULL;
  CHECK(callables_make_uint32(123, &captured, &error) == CALLABLES_STATUS_OK);
  CHECK(${uintClosure}_call((const ${uintClosure} *)captured, 42, &result, &error) == CALLABLES_STATUS_INVALID_ARGUMENT);
  CHECK(strstr(error.message, "wrong-signature"));
  ${unitClosure} *unit = NULL; CHECK(callables_make_unit(0, &unit, &error) == CALLABLES_STATUS_OK);
  pthread_t thread; CHECK(!pthread_create(&thread, NULL, foreign_thread, captured)); CHECK(!pthread_join(thread, NULL));
  CHECK(${unitClosure}_call(unit, false, 0, &error) == CALLABLES_STATUS_OK);
  ${unitClosure}_dispose(&unit);
  CHECK(${capturedClosure}_call(captured, true, 7, &result, &error) == CALLABLES_STATUS_OK && result == 123);
  CHECK(${capturedClosure}_call(captured, false, 7, &result, &error) == CALLABLES_STATUS_OK && result == 7);
  ${capturedClosure}_dispose(&captured); CHECK(identities() == before);
  ${capturedClosure} *many[4096] = {0};
  for (unsigned i = 0; i < 4096; ++i) CHECK(callables_make_uint32(i, &many[i], &error) == CALLABLES_STATUS_OK);
  CHECK(identities() == before + 4096);
  CHECK(callables_make_uint32(999, &captured, &error) == CALLABLES_STATUS_UNEXPECTED_ERROR && !captured);
  CHECK(strstr(error.message, "registry full"));
  for (unsigned i = 0; i < 4096; ++i) ${capturedClosure}_dispose(&many[i]);
  CHECK(identities() == before);
  CHECK(callables_make_uint32(321, &captured, &error) == CALLABLES_STATUS_OK);
  CHECK(${capturedClosure}_call(captured, true, 0, &result, &error) == CALLABLES_STATUS_OK && result == 321);
  ${capturedClosure}_dispose(&captured); CHECK(identities() == before);
}
int main(void) {
  uint32_t bits; callables_error error = {0};
  CHECK(callables_word_bits(&bits, &error) == CALLABLES_STATUS_OK && bits == 64);
  unsigned initial = identities();
  ${callablePrimitives.map(([lean]) => `check_${spelling(lean)}();`).join("\n  ")}
  unsigned depth = 8; uint32_t result = 0; ${uintCallback} cb = {nested, &depth};
  CHECK(callables_call_uint32(42, &cb, &result, &error) == CALLABLES_STATUS_OK && result == 42);
  depth = 80; result = 0;
  CHECK(callables_call_uint32(42, &cb, &result, &error) == CALLABLES_STATUS_UNEXPECTED_ERROR && result == 0);
  CHECK(strstr(error.message, "reentry limit"));
  depth = 2; CHECK(callables_call_uint32(43, &cb, &result, &error) == CALLABLES_STATUS_OK && result == 43 && !error.code);
  check_lifetimes(); CHECK(identities() == initial);
  printf("callable-c-ok:%u\\n", checks); return 0;
}
`;
};
