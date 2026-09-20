/**
 * Ordinary WIT packages cross the Component Model after relocation and installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compileCopiedWitModel, validateOrdinaryWasiSettings } from "../src/backends/wit/copied-model.mjs";
import { generateWitPackage, compileWitPackageModel, renderWitPackageLayout } from "../src/backends/wit/generate.mjs";
import { renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { packageOrdinaryWasi } from "../src/release/native-wasi.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_WIT_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;
const scalars = [
	["unit", "Unit", 'unit()']
	, ["bool", "Bool", "scalar(WASMTIME_COMPONENT_BOOL, 1)"]
	, ["u8", "UInt8", "scalar(WASMTIME_COMPONENT_U8, UINT8_MAX)"]
	, ["u16", "UInt16", "scalar(WASMTIME_COMPONENT_U16, UINT16_MAX)"]
	, ["u32", "UInt32", "scalar(WASMTIME_COMPONENT_U32, UINT32_MAX)"]
	, ["u64", "UInt64", "scalar(WASMTIME_COMPONENT_U64, UINT64_MAX)"]
	, ["i8", "Int8", "signed_value(WASMTIME_COMPONENT_S8, INT8_MIN)"]
	, ["i16", "Int16", "signed_value(WASMTIME_COMPONENT_S16, INT16_MIN)"]
	, ["i32", "Int32", "signed_value(WASMTIME_COMPONENT_S32, INT32_MIN)"]
	, ["i64", "Int64", "signed_value(WASMTIME_COMPONENT_S64, INT64_MIN)"]
	, ["nat", "Nat", "natural()"], ["integer", "Int", "integer()"]
	, ["f32", "Float32", "float_value(true, -0.0)"]
	, ["f64", "Float", "float_value(false, -0.0)"]
	, ["text", "String", 'text("a\\0λ🌿", 8)']
	, ["bytes", "ByteArray", "bytes()"]
];
const ordered = name => name === "Cobalt" ? scalars : [...scalars].reverse();
const sourceProject = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\n[[lean_lib]]\nname = "${name}"\n`);
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}
structure Leaf where
${ordered(name).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Packet where
  title : String
  leaf : Leaf
  rows : Array (Array Leaf)
structure Word where
  bits : ${name === "Cobalt" ? "UInt32" : "UInt64"}
structure Empty where
${scalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
def echo_record (value : Packet) := value
def echo_rows (value : Array (Array Leaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : Empty) := value
def array_empty (value : Array Empty) := value
def choose (left right : Packet) (pick : Bool) := if pick then left else right
def replicate (count : UInt32) : Array UInt8 := Array.replicate count.toNat 7
def answer : UInt32 := 42
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [name], exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "echo_rows", "echo_word", "echo_empty", "array_empty", "choose", "replicate", "answer"].map(label => `${name}.${label}`)], targets: { "wit-wasi": { name: `${name.toLowerCase()}-api`, version: "2.0.0-rc.1" } } }));
};

test("ordinary WIT emits each source function without Alpha dispatch", async t => {
	const ir = synthetic(), generated = compileCopiedWitModel(ir);
	assert.deepEqual(generateWitPackage(ir), renderWitPackageLayout(compileWitPackageModel(ir)));
	assert.equal(generateWitPackage(ir).wit, generated.wit);
	assert.deepEqual(compileCopiedWitModel(structuredClone(ir)).manifest, generated.manifest);
	assert.match(generated.wit, /increment: func\(arg0: u32\) -> u32/);
	assert.match(generated.wat, /export "lean-bridge:example\/api@1.0.0"/);
	assert.doesNotMatch(renderWitHostSource(generated, new Uint8Array()), /Alpha|read-box/);
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-wit-model-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	await saveLakeFile(working, "model.wat", generated.wat);
	await saveLakeFile(working, "model.wit", generated.wit);
	await run("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], working);
	await run("wasm-tools", ["validate", "model.wasm"], working);
	const binary = JSON.parse((await run("wasm-tools", ["component", "wit", "model.wasm", "--json"], working)).stdout);
	const source = JSON.parse((await run("wasm-tools", ["component", "wit", "model.wit", "--json"], working)).stdout);
	assert.deepEqual(binary.interfaces.find(item => item.name === "api").functions, source.interfaces.find(item => item.name === "api").functions);
	for(const primitive of ["unit", "nat", "int", "bytes", "float32", "float64"])
	{
		const copied = synthetic(); copied.declarations[0].parameters[0].type = { kind: "primitive", name: primitive }; copied.declarations[0].result.type = { kind: "primitive", name: primitive };
		await saveLakeFile(working, "copied.wat", compileCopiedWitModel(copied).wat);
		await run("wasm-tools", ["parse", "copied.wat", "-o", "copied.wasm"], working);
		await run("wasm-tools", ["validate", "copied.wasm"], working);
		await run("wasm-tools", ["component", "wit", "copied.wasm", "--json"], working);
	}
});

test("ordinary WIT admission rejects reserved names, partial projections and changed coordinates", () => {
	assert.throws(() => validateOrdinaryWasiSettings({ name: "bad/name" }), /coordinate/);
	assert.throws(() => validateOrdinaryWasiSettings({ version: "1.0.0-01" }), /semantic version/);
	const reserved = synthetic(); reserved.declarations[0].name = "world";
	assert.throws(() => compileCopiedWitModel(reserved), error => error.code === "unsupported-wit-signature" && error.details.source.path === "Sample.lean");
	const effectful = synthetic(); effectful.declarations[0].effects = ["nondeterministic"];
	assert.throws(() => compileCopiedWitModel(effectful), /pure/);
	const unsupported = synthetic(); unsupported.declarations[0].result.type = { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "uint32" }] };
	assert.throws(() => compileCopiedWitModel(unsupported), /compound values are not implemented/);
});

const helpers = `
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static void ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\\n", (int)message.size, message.data); abort();
}
static wasmtime_component_val_t scalar(int kind, uint64_t value) {
  wasmtime_component_val_t result = {.kind = kind};
  switch(kind) {
  case WASMTIME_COMPONENT_BOOL: result.of.boolean = value != 0; break;
  case WASMTIME_COMPONENT_U8: result.of.u8 = value; break;
  case WASMTIME_COMPONENT_U16: result.of.u16 = value; break;
  case WASMTIME_COMPONENT_U32: result.of.u32 = value; break;
  case WASMTIME_COMPONENT_U64: result.of.u64 = value; break;
  default: abort();
  } return result;
}
static wasmtime_component_val_t signed_value(int kind, int64_t value) {
  wasmtime_component_val_t result = {.kind = kind};
  switch(kind) {
  case WASMTIME_COMPONENT_S8: result.of.s8 = value; break;
  case WASMTIME_COMPONENT_S16: result.of.s16 = value; break;
  case WASMTIME_COMPONENT_S32: result.of.s32 = value; break;
  case WASMTIME_COMPONENT_S64: result.of.s64 = value; break;
  default: abort();
  } return result;
}
static wasmtime_component_val_t unit(void) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_ENUM};
  wasm_name_new(&value.of.enumeration, 4, "unit"); return value;
}
static wasmtime_component_val_t text(const char *data, size_t length) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&value.of.string, length, data); return value;
}
static wasmtime_component_val_t float_value(bool small, double number) {
  wasmtime_component_val_t value = {.kind = small ? WASMTIME_COMPONENT_F32 : WASMTIME_COMPONENT_F64};
  if (small) value.of.f32 = (float)number; else value.of.f64 = number; return value;
}
static wasmtime_component_val_t list(size_t count) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&value.of.list, count);
  if (count) memset(value.of.list.data, 0, count * sizeof(*value.of.list.data)); return value;
}
static wasmtime_component_val_t record(size_t count) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&value.of.record, count);
  if (count) memset(value.of.record.data, 0, count * sizeof(*value.of.record.data)); return value;
}
static void field(wasmtime_component_val_t *record, size_t index, const char *name, wasmtime_component_val_t value) {
  wasm_name_new(&record->of.record.data[index].name, strlen(name), name); record->of.record.data[index].val = value;
}
static wasmtime_component_val_t natural(void) {
  wasmtime_component_val_t value = list(129);
  for (size_t i = 0; i < 129; ++i) value.of.list.data[i] = scalar(WASMTIME_COMPONENT_U32, i == 0 || i == 128 ? 1 : 0);
  return value;
}
static wasmtime_component_val_t integer(void) {
  wasmtime_component_val_t value = record(2);
  field(&value, 0, "negative", scalar(WASMTIME_COMPONENT_BOOL, 1));
  field(&value, 1, "limbs", natural()); return value;
}
static wasmtime_component_val_t bytes(void) {
  wasmtime_component_val_t value = list(3);
  value.of.list.data[0] = scalar(WASMTIME_COMPONENT_U8, 0);
  value.of.list.data[1] = scalar(WASMTIME_COMPONENT_U8, 255);
  value.of.list.data[2] = scalar(WASMTIME_COMPONENT_U8, 128); return value;
}
static void equal(const wasmtime_component_val_t *a, const wasmtime_component_val_t *b) {
  assert(a->kind == b->kind);
  switch(a->kind) {
  case WASMTIME_COMPONENT_BOOL: assert(a->of.boolean == b->of.boolean); break;
  case WASMTIME_COMPONENT_U8: assert(a->of.u8 == b->of.u8); break;
  case WASMTIME_COMPONENT_U16: assert(a->of.u16 == b->of.u16); break;
  case WASMTIME_COMPONENT_U32: assert(a->of.u32 == b->of.u32); break;
  case WASMTIME_COMPONENT_U64: assert(a->of.u64 == b->of.u64); break;
  case WASMTIME_COMPONENT_S8: assert(a->of.s8 == b->of.s8); break;
  case WASMTIME_COMPONENT_S16: assert(a->of.s16 == b->of.s16); break;
  case WASMTIME_COMPONENT_S32: assert(a->of.s32 == b->of.s32); break;
  case WASMTIME_COMPONENT_S64: assert(a->of.s64 == b->of.s64); break;
  case WASMTIME_COMPONENT_F32: assert((isnan(a->of.f32) && isnan(b->of.f32)) || memcmp(&a->of.f32, &b->of.f32, 4) == 0); break;
  case WASMTIME_COMPONENT_F64: assert((isnan(a->of.f64) && isnan(b->of.f64)) || memcmp(&a->of.f64, &b->of.f64, 8) == 0); break;
  case WASMTIME_COMPONENT_ENUM: assert(a->of.enumeration.size == b->of.enumeration.size && memcmp(a->of.enumeration.data, b->of.enumeration.data, a->of.enumeration.size) == 0); break;
  case WASMTIME_COMPONENT_STRING: assert(a->of.string.size == b->of.string.size && (!a->of.string.size || memcmp(a->of.string.data, b->of.string.data, a->of.string.size) == 0)); break;
  case WASMTIME_COMPONENT_LIST:
    assert(a->of.list.size == b->of.list.size);
    for (size_t i = 0; i < a->of.list.size; ++i) equal(&a->of.list.data[i], &b->of.list.data[i]); break;
  case WASMTIME_COMPONENT_RECORD:
    assert(a->of.record.size == b->of.record.size);
    for (size_t i = 0; i < a->of.record.size; ++i) { assert(a->of.record.data[i].name.size == b->of.record.data[i].name.size); assert(memcmp(a->of.record.data[i].name.data, b->of.record.data[i].name.data, a->of.record.data[i].name.size) == 0); equal(&a->of.record.data[i].val, &b->of.record.data[i].val); } break;
  case WASMTIME_COMPONENT_TUPLE: assert(!a->of.tuple.size && !b->of.tuple.size); break;
  default: abort();
  }
}
`;

const consumerSource = name => {
	const p = name.toLowerCase();
	return `#include "${p}_wasmtime.h"
${helpers}
static ${p}_wasmtime *session;
static void round_trip(const char *name, wasmtime_component_val_t input) {
  wasmtime_component_val_t result = {0}; ok(${p}_wasmtime_call(session, name, &input, 1, &result));
  equal(&input, &result); wasmtime_component_val_delete(&input); wasmtime_component_val_delete(&result);
}
static void rejects(const char *name, wasmtime_component_val_t input) {
  wasmtime_component_val_t result = scalar(WASMTIME_COMPONENT_U64, UINT64_MAX);
  wasmtime_error_t *error = ${p}_wasmtime_call(session, name, &input, 1, &result);
  assert(error && result.kind == WASMTIME_COMPONENT_U64 && result.of.u64 == UINT64_MAX);
  wasmtime_error_delete(error); wasmtime_component_val_delete(&input);
}
static wasmtime_component_val_t leaf(void) {
  wasmtime_component_val_t value = record(${scalars.length});
${ordered(name).map(([label,, value], index) => `  field(&value, ${index}, "v-${label}", ${value});`).join("\n")}
  return value;
}
static void external_component(const char *path) {
  FILE *file = fopen(path, "rb"); assert(file);
  assert(fseek(file, 0, SEEK_END) == 0); long size = ftell(file); assert(size > 0);
  rewind(file); uint8_t *bytes = malloc((size_t)size); assert(bytes);
  assert(fread(bytes, 1, (size_t)size, file) == (size_t)size); fclose(file);
  wasm_config_t *config = wasm_config_new(); wasmtime_config_wasm_component_model_set(config, true);
  wasm_engine_t *engine = wasm_engine_new_with_config(config);
  wasmtime_component_t *component; ok(wasmtime_component_new(engine, bytes, (size_t)size, &component)); free(bytes);
  wasmtime_store_t *store = wasmtime_store_new(engine, NULL, NULL);
  wasmtime_context_t *context = wasmtime_store_context(store);
  wasmtime_component_linker_t *linker = wasmtime_component_linker_new(engine);
  ok(${p}_wasmtime_link(linker));
  wasmtime_component_instance_t instance; ok(wasmtime_component_linker_instantiate(linker, context, component, &instance));
  const char *name = "lean-bridge:${p}-api/api@2.0.0-rc.1";
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&instance, context, NULL, name, strlen(name)); assert(api);
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&instance, context, api, "echo-u32", 8); assert(index);
  wasmtime_component_func_t fn; assert(wasmtime_component_instance_get_func(&instance, context, index, &fn));
  wasmtime_component_val_t arg = scalar(WASMTIME_COMPONENT_U32, 73), out = {0};
  ok(wasmtime_component_func_call(&fn, context, &arg, 1, &out, 1)); assert(out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 73);
  wasmtime_component_val_delete(&out); wasmtime_component_export_index_delete(index); wasmtime_component_export_index_delete(api);
  wasmtime_component_linker_delete(linker); wasmtime_store_delete(store); wasmtime_component_delete(component); wasm_engine_delete(engine);
}
int main(int argc, char **argv) {
  assert(argc == 2); external_component(argv[1]);
  ok(${p}_wasmtime_open(&session));
${scalars.map(([label,, value]) => `  round_trip("echo-${label}", ${value});\n  { wasmtime_component_val_t input = list(2); input.of.list.data[0] = ${value}; input.of.list.data[1] = ${value}; round_trip("array-${label}", input); }\n  round_trip("array-${label}", list(0));`).join("\n")}
  round_trip("echo-nat", list(0)); round_trip("echo-text", text("", 0)); round_trip("echo-bytes", list(0));
  { wasmtime_component_val_t zero = record(2); field(&zero, 0, "negative", scalar(WASMTIME_COMPONENT_BOOL, 0)); field(&zero, 1, "limbs", list(0)); round_trip("echo-integer", zero); }
  for (int i = 0; i < 2; ++i) {
    round_trip(i ? "echo-f32" : "echo-f64", float_value(i, NAN));
    round_trip(i ? "echo-f32" : "echo-f64", float_value(i, INFINITY));
    round_trip(i ? "echo-f32" : "echo-f64", float_value(i, -INFINITY));
    round_trip(i ? "echo-f32" : "echo-f64", float_value(i, 1.0 / 3.0));
  }
  wasmtime_component_val_t rows = list(1); rows.of.list.data[0] = list(2);
  rows.of.list.data[0].of.list.data[0] = leaf(); rows.of.list.data[0].of.list.data[1] = leaf();
  wasmtime_component_val_t packet = record(3);
  field(&packet, 0, "title", text("hello", 5)); field(&packet, 1, "leaf", leaf()); field(&packet, 2, "rows", rows);
  wasmtime_component_val_t result = {0};
  for (size_t i = 0; i < 100; ++i) { ok(${p}_wasmtime_call(session, "echo-record", &packet, 1, &result)); equal(&packet, &result); wasmtime_component_val_delete(&result); }
  ok(${p}_wasmtime_call(session, "echo-record", &packet, 1, &result));
  assert(result.of.record.data != packet.of.record.data);
  packet.of.record.data[0].val.of.string.data[0] = 'X';
  assert(result.of.record.data[0].val.of.string.data[0] == 'h');
  wasmtime_component_val_delete(&result);
  wasmtime_component_val_t chosen[3] = {packet, record(0), scalar(WASMTIME_COMPONENT_BOOL, 1)};
  wasmtime_component_val_delete(&chosen[1]); wasmtime_component_val_clone(&packet, &chosen[1]);
  ok(${p}_wasmtime_call(session, "choose", chosen, 3, &result)); equal(&packet, &result);
  wasmtime_component_val_delete(&chosen[1]); wasmtime_component_val_delete(&result);
  wasmtime_component_val_t copied_rows = {0}; wasmtime_component_val_clone(&packet.of.record.data[2].val, &copied_rows);
  round_trip("echo-rows", copied_rows);
  wasmtime_component_val_t word = record(1);
  field(&word, 0, "bits", scalar(${name === "Cobalt" ? "WASMTIME_COMPONENT_U32, UINT32_MAX" : "WASMTIME_COMPONENT_U64, UINT64_MAX"})); round_trip("echo-word", word);
  wasmtime_component_val_t empty = {.kind = WASMTIME_COMPONENT_ENUM}; wasm_name_new(&empty.of.enumeration, 5, "empty");
  wasmtime_component_val_t empties = list(1); wasmtime_component_val_clone(&empty, &empties.of.list.data[0]);
  round_trip("echo-empty", empty); round_trip("array-empty", empties);
  rejects("echo-u32", scalar(WASMTIME_COMPONENT_U64, UINT64_MAX));
  rejects("echo-bool", scalar(WASMTIME_COMPONENT_U8, 1));
  rejects("echo-unit", scalar(WASMTIME_COMPONENT_BOOL, 0));
  rejects("echo-text", text("\\xff", 1));
  rejects("echo-text", text("\\xc0\\x80", 2));
  rejects("not-an-export", unit());
  wasmtime_component_val_t bad = list(1); bad.of.list.data[0] = scalar(WASMTIME_COMPONENT_U32, 0); rejects("echo-nat", bad);
  bad = record(2); field(&bad, 0, "negative", scalar(WASMTIME_COMPONENT_BOOL, 1)); field(&bad, 1, "limbs", list(0)); rejects("echo-integer", bad);
  bad = record(3); rejects("echo-record", bad);
  bad = list(1); bad.of.list.data[0] = unit(); rejects("array-u32", bad);
  /* Reject huge lengths before dereferencing the untrusted span. */
  bad = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_LIST, .of.list = {.size = SIZE_MAX, .data = &empty}};
  wasmtime_error_t *error = ${p}_wasmtime_call(session, "array-unit", &bad, 1, &result); assert(error); wasmtime_error_delete(error);
  for (int i = 0; i < 3; ++i) rejects("replicate", scalar(WASMTIME_COMPONENT_U32, 600000));
  ok(${p}_wasmtime_call(session, "answer", NULL, 0, &result)); assert(result.of.u32 == 42); wasmtime_component_val_delete(&result);
  ok(${p}_wasmtime_call(session, "echo-record", &packet, 1, &result));
  ${p}_wasmtime_close(session); equal(&packet, &result);
  wasmtime_component_val_delete(&packet); wasmtime_component_val_delete(&result);
  puts("Installed ${name}: exact copied WIT values and failure cleanup passed");
}
`;
};

const allocationFaultCheck = async (root, consumer, projection) => {
	const p = projection.surface.prefix;
	const record = projection.surface.copy(projection.surface.functions.find(fn => fn.field === "echo_record").declaration.result.type).name;
	const array = projection.surface.copy(projection.surface.functions.find(fn => fn.field === "replicate").declaration.result.type).name;
	const fault = join(consumer, "fault"); await mkdir(fault);
	await saveLakeFile(fault, "fault.h", `#include <stdlib.h>
#include "${p}.h"
void *wit_test_calloc(size_t, size_t);
void wit_test_free(void *);
void wit_test_cleared(void);
static inline void wit_test_record_clear(${record} *value) { wit_test_cleared(); ${record}_clear(value); }
static inline void wit_test_array_clear(${array} *value) { wit_test_cleared(); ${array}_clear(value); }
#define calloc wit_test_calloc
#define free wit_test_free
#define ${record}_clear wit_test_record_clear
#define ${array}_clear wit_test_array_clear
`);
	await saveLakeFile(fault, "allocator.c", `#include <stdlib.h>
#include <assert.h>
static size_t target, attempted, outstanding, cleared;
void *wit_test_calloc(size_t count, size_t width) {
  if (target && ++attempted == target) return NULL;
  void *value = calloc(count, width); if (value) outstanding++; return value;
}
void wit_test_free(void *value) { if (value) { assert(outstanding); outstanding--; } free(value); }
void wit_test_cleared(void) { cleared++; }
void wit_test_fail(size_t allocation) { target = allocation; attempted = 0; }
size_t wit_test_outstanding(void) { return outstanding; }
size_t wit_test_clear_count(void) { return cleared; }
`);
	await saveLakeFile(fault, "driver.c", `#include "${p}_wasmtime.h"
${helpers}
extern void wit_test_fail(size_t);
extern size_t wit_test_outstanding(void);
extern size_t wit_test_clear_count(void);
int main(void) {
  ${p}_wasmtime *session; ok(${p}_wasmtime_open(&session));
  assert(wit_test_outstanding() == 1);
  wasmtime_component_val_t leaf = record(${scalars.length});
${ordered("Cobalt").map(([label,, value], i) => `  field(&leaf, ${i}, "v-${label}", ${value});`).join("\n")}
  wasmtime_component_val_t packet = record(3);
  field(&packet, 0, "title", text("hello", 5)); field(&packet, 1, "leaf", leaf); field(&packet, 2, "rows", list(0));
  wasmtime_component_val_t result = scalar(WASMTIME_COMPONENT_U64, UINT64_MAX);
  wit_test_fail(3);
  wasmtime_error_t *error = ${p}_wasmtime_call(session, "echo-record", &packet, 1, &result);
  assert(error && result.kind == WASMTIME_COMPONENT_U64 && result.of.u64 == UINT64_MAX);
  wasmtime_error_delete(error); assert(wit_test_outstanding() == 1);
  wit_test_fail(0);
  ok(${p}_wasmtime_call(session, "echo-record", &packet, 1, &result)); equal(&packet, &result);
  wasmtime_component_val_delete(&result); assert(wit_test_outstanding() == 1);
  size_t before = wit_test_clear_count();
  wasmtime_component_val_t count = scalar(WASMTIME_COMPONENT_U32, 600000);
  error = ${p}_wasmtime_call(session, "replicate", &count, 1, &result);
  assert(error); wasmtime_error_delete(error);
  assert(wit_test_clear_count() == before + 1 && wit_test_outstanding() == 1);
  ok(${p}_wasmtime_call(session, "answer", NULL, 0, &result)); assert(result.of.u32 == 42);
  wasmtime_component_val_delete(&packet);
  ${p}_wasmtime_close(session); assert(wit_test_outstanding() == 0);
  puts("Injected scratch failure frees every allocation; failed output clears native ownership");
}
`);
	const args = ["-std=c11", "-O2", "-g0", "-fPIC", "-I", join(root, "include")];
	await run("cc", [...args, "-include", join(fault, "fault.h"), "-c", join(root, `src/${p}_wasmtime.c`), "-o", "host.o"], fault);
	await run("cc", [...args, "-shared", "host.o", "allocator.c", "-L", join(root, "lib"), `-l${p}`, "-lwasmtime", "-o", `lib${p}_wasmtime.so`], fault);
	await run("cc", ["driver.c", "-I", join(root, "include"), "-L", fault, "-L", join(root, "lib"), `-l${p}_wasmtime`, `-l${p}`, "-lwasmtime", "-o", "driver"], fault);
	assert.match((await run(join(fault, "driver"), [], fault, { PATH: "/usr/bin:/bin", LD_LIBRARY_PATH: `${fault}:${join(root, "lib")}` })).stdout, /frees every allocation/);
};

test("ordinary WIT archives reproduce and execute all copied types after installation", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-wit-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const installed = [];
	for(const name of ["Cobalt", "Saffron"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await sourceProject(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${index}`), targets: ["wit-wasi", "c"], environment }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		const consumer = join(working, `consumer-${name}`); await mkdir(consumer);
		const archive = builds[0].packages.find(pkg => pkg.archive.endsWith("-wit-wasi.tar.gz"));
		await run("tar", ["-xzf", join(builds[0].output, "archives", archive.archive), "-C", consumer], working);
		const root = join(consumer, archive.archive.slice(0, -7));
		const clean = { PATH: "/usr/bin:/bin", PKG_CONFIG_PATH: join(root, "lib/pkgconfig"), LEAN_BRIDGE_LEAN_PREFIX: "/missing/lean", LEAN_BRIDGE_NATIVE_ROOT: "/must/not/use/overrides" };
		const flags = (await run("pkg-config", ["--cflags", "--libs", `${name.toLowerCase()}-api-wit`], consumer, clean)).stdout.trim().split(/\s+/);
		await saveLakeFile(consumer, "consumer.c", consumerSource(name));
		await run("cc", ["-std=c11", "-Wall", "-Wextra", "consumer.c", ...flags, "-o", "consumer"], consumer, clean);
		assert.match((await run(join(consumer, "consumer"), [join(root, "component", `${name.toLowerCase()}-api.wasm`)], consumer, clean)).stdout, /failure cleanup passed/);
		if(name === "Cobalt")
		{
			await allocationFaultCheck(root, consumer, compileCopiedWitModel(JSON.parse(await readFile(join(builds[0].output, "native/component/binding-ir.json"), "utf8"))));
			await cp(new URL("./fixtures/documentation/consumers/wit-wasi/ordinary.c", import.meta.url), join(consumer, "example.c"));
			await run("cc", ["example.c", ...flags, "-o", "example"], consumer, clean);
			assert.equal((await run(join(consumer, "example"), [], consumer, clean)).stdout.trim(), "42");
		}
		await run("wasm-tools", ["validate", join(root, "component", `${name.toLowerCase()}-api.wasm`)], consumer);
		installed.push(root);
		const witRoot = join(builds[0].output, "native/wit-adapter");
		const lib = join(witRoot, "lib", `lib${name.toLowerCase()}_wasmtime.so`), original = await readFile(lib); original[original.length - 1] ^= 1; await saveLakeFile(dirname(lib), lib.split("/").at(-1), original);
		await assert.rejects(() => packageOrdinaryWasi({ working: join(working, "bad-release"), nativeRoot: join(builds[0].output, "native/component"), runtimeRoot: join(builds[0].output, "native/runtime"), adapterRoot: join(builds[0].output, "native/c-binding"), witRoot, leanPrefix, settings: { name: `${name.toLowerCase()}-api`, version: "2.0.0-rc.1" }, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" }), /drift/);
	}
	await saveLakeFile(working, "composition.c", `#include "cobalt_wasmtime.h"
#include "saffron_wasmtime.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
extern void lean_bridge_native_snapshot_read(void *);
int main(void) {
  cobalt_wasmtime *a; saffron_wasmtime *b;
  assert(!cobalt_wasmtime_open(&a)); assert(!saffron_wasmtime_open(&b));
  wasmtime_component_val_t value = {0};
  assert(!cobalt_wasmtime_call(a, "answer", NULL, 0, &value) && value.of.u32 == 42);
  assert(!saffron_wasmtime_call(b, "answer", NULL, 0, &value) && value.of.u32 == 42);
  uint64_t snapshot[5] = {0}; lean_bridge_native_snapshot_read(snapshot);
  const uint32_t *counts = (const uint32_t *)snapshot;
  assert(counts[2] == 1 && counts[3] == 2 && counts[4] == 2);
  cobalt_wasmtime_close(a); saffron_wasmtime_close(b);
  puts("Two installed WIT components share one Lean runtime");
}
`);
	const flags = (await run("pkg-config", ["--cflags", "--libs", "cobalt-api-wit", "saffron-api-wit"], working, { PATH: "/usr/bin:/bin", PKG_CONFIG_PATH: installed.map(root => join(root, "lib/pkgconfig")).join(":") })).stdout.trim().split(/\s+/);
	await run("cc", ["composition.c", ...flags, "-L", join(installed[0], "lib"), "-llean_bridge_native", "-o", "composition"], working);
	assert.match((await run(join(working, "composition"), [], working, { PATH: "/usr/bin:/bin" })).stdout, /share one Lean runtime/);
});

test("ordinary WIT compilation fails atomically when its pinned engine is absent", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-wit-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await sourceProject(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "wit-wasi"], environment: { ...environment, LEAN_BRIDGE_WASMTIME_C_API: "/missing/wasmtime" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
