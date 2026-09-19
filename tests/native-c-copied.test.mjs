/**
 * Installed ordinary C/C++ arrays and records, including deep failure cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkGmpCopiedFaults } from "./helpers/c-gmp-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_C_TEST === "1";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2"), LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const scalars = [
	["unit", "Unit", "std::monostate", "{}"], ["bool", "Bool", "bool", "true"]
	, ...[8, 16, 32, 64].map(n => [`u${n}`, `UInt${n}`, `uint${n}_t`, `UINT${n}_MAX`])
	, ...[8, 16, 32, 64].map(n => [`i${n}`, `Int${n}`, `int${n}_t`, `INT${n}_MIN`])
	, ["nat", "Nat", "api::Nat", "(api::Nat(1) << 64)"]
	, ["integer", "Int", "api::Int", "-(api::Int(1) << 32)"]
	, ["f32", "Float32", "float", "-0.0f"], ["f64", "Float", "double", "-0.0"]
	, ["text", "String", "std::string", 'std::string("a\\0\\xce\\xbb", 4)']
	, ["bytes", "ByteArray", "std::vector<uint8_t>", "std::vector<uint8_t>{0, 255}"]
];

const project = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${name}"\n`);
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}
structure ZLeaf where
${(name === "Archive" ? [...scalars].reverse() : scalars).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Envelope where
  title : String
  leaf : ZLeaf
  rows : Array (Array ZLeaf)
structure Word where
  bits : ${name === "Archive" ? "UInt64" : "UInt32"}
structure Empty where
${scalars.map(([label, type]) => `def echo_${label} (xs : Array ${type}) := xs`).join("\n")}
def echo_record (value : Envelope) := value
def choose (left right : Envelope) (pick : Bool) := if pick then left else right
def echo_rows (value : Array (Array ZLeaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : Empty) := value
def echo_words (value : Array Word) := value
def echo_markers (value : Array Empty) := value
def grow (value : String) : Array String := #[value, value]
def matrix (value : Array UInt32) : Array (Array UInt32) := #[value, value.reverse]
theorem echo_rows_spec (value : Array (Array ZLeaf)) : echo_rows value = value := rfl
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: [name]
		, exports: [...scalars.map(([label]) => `${name}.echo_${label}`), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "echo_words", "echo_markers", "grow", "matrix"].map(fn => `${name}.${fn}`)]
		, targets: { c: { name: `${name.toLowerCase()}-c`, version: "1.0.0" }
			, cpp: { name: `${name.toLowerCase()}-cpp`, version: "1.0.0" } } }));
};

const cppConsumer = p => `#include "${p}.hpp"
#include <cassert>
#include <cmath>
#include <limits>
#include <thread>
namespace api = lean_bridge::${p};
int main() {
  ${scalars.map(([label, , host, value]) => `std::vector<${host}> input_${label}{${value}, ${value}};
  auto copied_${label} = api::echo_${label}(input_${label}); assert(copied_${label}.size() == 2);
  ${["f32", "f64"].includes(label) ? `assert(std::signbit(copied_${label}[0]));` : `assert(copied_${label} == input_${label});`}
  assert(api::echo_${label}({}).empty());`).join("\n  ")}
  api::ZLeaf leaf{${(p === "archive" ? [...scalars].reverse() : scalars).map(([, , , value]) => value).join(", ")}};
  api::Envelope source{"packet", leaf, {{leaf, leaf}, {}, {leaf}}};
  for (int i = 0; i < 100; ++i) {
    auto result = api::echo_record(source);
    assert(result.title == source.title && result.leaf.v_text == source.leaf.v_text);
    ${scalars.map(([label]) => label.startsWith("f") ? `assert(std::signbit(result.leaf.v_${label}));` : `assert(result.leaf.v_${label} == leaf.v_${label});`).join("\n    ")}
    assert(result.rows.size() == 3 && result.rows[0].size() == 2 && result.rows[1].empty());
    assert(result.rows[2][0].v_nat == leaf.v_nat);
    result.rows[0][0].v_text = "independent"; assert(source.rows[0][0].v_text == leaf.v_text);
  }
  auto rows = api::echo_rows(source.rows); assert(rows[0][0].v_u64 == UINT64_MAX);
  auto other = source; other.title = "other";
  assert(api::choose(source, other, true).title == source.title);
  assert(api::choose(source, other, false).title == other.title);
  auto floating = api::echo_f64({std::numeric_limits<double>::quiet_NaN(), INFINITY, -INFINITY});
  assert(std::isnan(floating[0]) && std::isinf(floating[1]) && std::signbit(floating[2]));
  assert(api::echo_word({UINT32_MAX}).bits == UINT32_MAX); (void)api::echo_empty({});
  assert(api::echo_words({{UINT32_MAX}, {0}})[0].bits == UINT32_MAX);
  assert(api::echo_markers({{}, {}}).size() == 2);
  assert(api::matrix({1, 2, 3}) == std::vector<std::vector<uint32_t>>({{1, 2, 3}, {3, 2, 1}}));
  assert(api::grow("hello") == std::vector<std::string>({"hello", "hello"}));
  bool negative_array = false, negative_field = false;
  try { (void)api::echo_nat({api::Nat(-1)}); }
  catch(const api::Error&) { negative_array = true; }
  auto invalid = source; invalid.rows[0][0].v_nat = -1;
  try { (void)api::echo_record(invalid); }
  catch(const api::Error&) { negative_field = true; }
  assert(negative_array && negative_field);
  assert(api::echo_record(source).rows[0][0].v_nat == leaf.v_nat);
  bool failed = false;
  try { (void)api::grow(std::string(6 * 1024 * 1024, 'x')); }
  catch(const api::Error& error) { failed = error.status == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT; }
  assert(failed);
  std::vector<std::thread> workers;
  for (int i = 0; i < 4; ++i) workers.emplace_back([&] { for (int j = 0; j < 50; ++j) assert(api::echo_record(source).rows.size() == 3); });
  for (auto& worker : workers) worker.join();
}
`;

const cConsumer = p => `#include "${p}.h"
#include <assert.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#define OK(call) assert((call) == ${p.toUpperCase()}_STATUS_OK)
int main(void) {
  ${p}_error error = {0};
  ${p}_zleaf leaf; ${p}_zleaf_init(&leaf);
  leaf.v_u64 = UINT64_MAX; leaf.v_i64 = INT64_MIN;
  mpz_setbit(leaf.v_nat, 64);
  const char text[] = "a\\0\\xce\\xbb"; leaf.v_text = (${p}_string){text, 4, NULL, NULL};
  ${p}_array_lean_${p}_zleaf_span row = {&leaf, 1, NULL, NULL};
  ${p}_array_array_lean_${p}_zleaf_span rows = {&row, 1, NULL, NULL}, copied_rows = {0};
  ${p}_envelope source, result; ${p}_envelope_init(&source); ${p}_envelope_init(&result);
  source.title = (${p}_string){"packet", 6, NULL, NULL}; source.rows = rows;
  source.leaf.v_u64 = leaf.v_u64; source.leaf.v_i64 = leaf.v_i64; source.leaf.v_text = leaf.v_text;
  mpz_set(source.leaf.v_nat, leaf.v_nat);
  for (int i = 0; i < 100; ++i) {
    OK(${p}_echo_record(&source, &result, &error));
    assert(result.leaf.v_u64 == UINT64_MAX && result.leaf.v_i64 == INT64_MIN);
    assert(result.rows.length == 1 && result.rows.data[0].length == 1);
    assert(mpz_cmp(result.rows.data[0].data[0].v_nat, leaf.v_nat) == 0);
    assert(result.leaf.v_text.data != leaf.v_text.data && memcmp(result.leaf.v_text.data, text, 4) == 0);
    ${p}_envelope_clear(&result); ${p}_envelope_clear(&result);
  }
  OK(${p}_echo_rows(&rows, &copied_rows, &error)); ${p}_array_array_lean_${p}_zleaf_span_clear(&copied_rows);
  rows.length = SIZE_MAX;
  assert(${p}_echo_rows(&rows, &copied_rows, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  assert(copied_rows.data == NULL);
  result.title = (${p}_string){"unchanged", 9, NULL, NULL};
  source.leaf.v_unit = 1;
  assert(${p}_echo_record(&source, &result, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  assert(result.title.length == 9); source.leaf.v_unit = 0;
  leaf.v_text = (${p}_string){"\\xed\\xa0\\x80", 3, NULL, NULL};
  assert(${p}_echo_record(&source, &result, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  assert(result.title.length == 9); leaf.v_text = (${p}_string){text, 4, NULL, NULL};
  mpz_set_si(leaf.v_nat, -1);
  assert(${p}_echo_record(&source, &result, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  assert(result.title.length == 9); mpz_set_ui(leaf.v_nat, 0); mpz_setbit(leaf.v_nat, 64);
  source.rows.data = NULL;
  assert(${p}_echo_record(&source, &result, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  ${p}_envelope_clear(&result);
  uint8_t octets[] = {0, 255};
  ${scalars.map(([label, lean]) => {
	const type = ({ Unit: "unit", Float32: "float32", Float: "float64", String: "string", ByteArray: "bytes" }[lean] ?? lean.toLowerCase());
	const aggregate = ["nat", "int", "string", "bytes"].includes(type);
	const ctype = aggregate ? `${p}_${type}` : ({ unit: "uint8_t", bool: "bool", float32: "float", float64: "double" }[type] ?? `${type}_t`);
	if(["nat", "int"].includes(type)) return `{ mpz_t values[2]; mpz_init(values[0]); mpz_init(values[1]);
    mpz_setbit(values[0], 64); mpz_setbit(values[1], 16384); ${type === "int" ? "mpz_neg(values[1], values[1]);" : ""}
    ${p}_array_${type}_span input = {values, 2, NULL, NULL}, output = {0};
    OK(${p}_echo_${label}(&input, &output, &error)); assert(output.length == 2);
    assert(!mpz_cmp(output.data[0], values[0]) && !mpz_cmp(output.data[1], values[1]));
    ${p}_array_${type}_span_clear(&output); ${p}_array_${type}_span_clear(&output);
    ${type === "nat" ? `mpz_set_si(values[1], -1); assert(${p}_echo_${label}(&input, &output, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT && !output.data);` : ""}
    input.data = NULL; input.length = 0; OK(${p}_echo_${label}(&input, &output, &error)); assert(!output.length);
    ${p}_array_${type}_span_clear(&output); mpz_clear(values[0]); mpz_clear(values[1]);
  }`;
	const value = ({ unit: "0", bool: "true", float32: "-0.0f", float64: "-0.0", nat: "{limbs, 3, NULL, NULL}", int: "{limbs, 3, NULL, NULL, true}", string: "{text, 4, NULL, NULL}", bytes: "{octets, 2, NULL, NULL}" }[type] ?? `${type.toUpperCase()}_${type.startsWith("uint") ? "MAX" : "MIN"}`);
	return `{ ${ctype} values[] = {${value}, ${value}};
    ${p}_array_${type}_span input = {values, 2, NULL, NULL}, output = {0};
    OK(${p}_echo_${label}(&input, &output, &error)); assert(output.length == 2);
    ${aggregate ? `assert(output.data[0].length == values[0].length && output.data[0].data != values[0].data);` : type.startsWith("float") ? "assert(signbit(output.data[0]));" : "assert(output.data[0] == values[0]);"}
    ${p}_array_${type}_span_clear(&output); ${p}_array_${type}_span_clear(&output);
    input.data = NULL; input.length = 0; OK(${p}_echo_${label}(&input, &output, &error)); assert(output.length == 0);
    ${p}_array_${type}_span_clear(&output);
  }`;
  }).join("\n  ")}
  ${p}_word word = {UINT32_MAX}, word_out = {0};
  OK(${p}_echo_word(&word, &word_out, &error)); assert(word_out.bits == UINT32_MAX);
  ${p}_empty empty = {0}, empty_out = {0}; OK(${p}_echo_empty(&empty, &empty_out, &error));
  size_t large = 6 * 1024 * 1024; char *buffer = malloc(large); assert(buffer); memset(buffer, 'x', large);
  ${p}_string big = {buffer, large, NULL, NULL}; ${p}_array_string_span grown = {0};
  assert(${p}_grow(&big, &grown, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  assert(grown.data == NULL); free(buffer);
  ${p}_envelope_clear(&source); ${p}_zleaf_clear(&leaf);
  return 0;
}
`;

const allocationFailures = async (working, output, p) => {
	const binding = join(output, "native/c-binding"), component = join(output, "native/component"), runtime = join(output, "native/runtime");
	const receipt = await json(join(component, "native-component.json"));
	const original = await readFile(join(binding, "src/native.c"), "utf8");
	const declarations = "#include <stddef.h>\nvoid *lb_test_malloc(size_t);\nvoid *lb_test_calloc(size_t, size_t);\nvoid *lb_test_realloc(void *, size_t);\nvoid lb_test_free(void *);\n";
	await saveLakeFile(working, `${p}-fault.c`, declarations + original.replace(/\b(malloc|calloc|realloc|free)\b/g, "lb_test_$1"));
	await saveLakeFile(working, `${p}-allocations.c`, `#include "${p}.h"
#include <assert.h>
#include <stdlib.h>
#include <string.h>
static int remaining = -1, live = 0;
static int allowed(void) { if (remaining == 0) return 0; if (remaining > 0) --remaining; return 1; }
void *lb_test_malloc(size_t n) { if (!allowed()) return NULL; void *p = malloc(n); if (p) ++live; return p; }
void *lb_test_calloc(size_t n, size_t w) { if (!allowed()) return NULL; void *p = calloc(n, w); if (p) ++live; return p; }
void *lb_test_realloc(void *old, size_t n) { if (!allowed()) return NULL; int fresh = old == NULL; void *p = realloc(old, n); if (fresh && p) ++live; return p; }
void lb_test_free(void *p) { if (p) { --live; free(p); } }
int main(void) {
  ${p}_error error = {0}; uint32_t limbs[] = {0, 0, 1}; uint8_t bytes[] = {0, 255};
  ${p}_zleaf leaf = {0}; leaf.v_nat = (${p}_nat){limbs, 3, NULL, NULL};
  leaf.v_text = (${p}_string){"leaf", 4, NULL, NULL}; leaf.v_bytes = (${p}_bytes){bytes, 2, NULL, NULL};
  ${p}_array_lean_${p}_zleaf_span row = {&leaf, 1, NULL, NULL};
  ${p}_array_array_lean_${p}_zleaf_span rows = {&row, 1, NULL, NULL};
  ${p}_envelope source = {{"envelope", 8, NULL, NULL}, leaf, rows};
  int succeeded = 0;
  for (int limit = 0; limit < 100; ++limit) {
    remaining = limit; ${p}_envelope out = {0};
    ${p}_status status = ${p}_echo_record(&source, &out, &error);
    if (status == ${p.toUpperCase()}_STATUS_OK) {
      assert(limit >= 8); ${p}_envelope_clear(&out); ${p}_envelope_clear(&out);
      assert(live == 0); succeeded = 1; break;
    }
    assert(status == ${p.toUpperCase()}_STATUS_UNEXPECTED_ERROR);
    assert(out.title.data == NULL && out.rows.data == NULL && live == 0);
  }
  assert(succeeded); remaining = -1;
  size_t length = 6 * 1024 * 1024; char *buffer = malloc(length); assert(buffer); memset(buffer, 'x', length);
  ${p}_string input = {buffer, length, NULL, NULL}; ${p}_array_string_span out = {0};
  assert(${p}_grow(&input, &out, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  assert(live == 0 && out.data == NULL); free(buffer);
}
`);
	const executable = join(working, `${p}-faults`);
	await run("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-I", join(binding, "include"), "-I", join(binding, "internal")
		, "-I", component, "-I", join(runtime, "include")
		, join(working, `${p}-fault.c`), join(binding, `src/${p}.c`)
		, join(working, `${p}-allocations.c`)
		, "-L", component, "-L", join(runtime, "lib")
		, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${component}`, `-Wl,-rpath,${join(runtime, "lib")}`
		, "-o", executable], working);
	await run(executable, [], working, { PATH: "/usr/bin:/bin" });
};

test("copied C admission rejects cycles, ambiguous type names and field spellings at the export", () => {
	const input = nativeMetadataFixture();
	const model = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	const base = { id: "lean:Sample.Item", name: "Item", kind: "record", typeParameters: [], fields: [] };
	for(const change of [
		ir => { ir.types[0].fields = [{ name: "next", type: { kind: "named", id: base.id } }]; }
		, ir => { ir.types[0].name = "Nat"; }
		, ir => { ir.types[0].fields = [{ name: "class", type: { kind: "primitive", name: "uint32" } }]; }
		, ir => { ir.declarations[0].name = "item_clear"; }
		, ir => { ir.types[0].name = "ArrayUint32Span"; ir.types[0].fields = [{ name: "values", type: { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint32" }] } }]; }
	]) {
		const ir = structuredClone(model.bindingIr); ir.types = [structuredClone(base)];
		ir.declarations[0].parameters[0].type = { kind: "named", id: base.id }; change(ir);
		assert.throws(() => compilePrimitiveCSurface(ir), error => error.code === "unsupported-native-c-signature" && error.details.source.path === "Sample.lean");
	}
});

test("copied type identity survives canonical JSON property order", () => {
	const input = nativeMetadataFixture(), declaration = input.metadata.modules[0].declarations[0];
	const word = declaration.projection.result;
	const record = { kind: "record", name: "Sample.Item", lean: "Sample.Item", constructor: "Sample.Item.mk", fields: [{ name: "value", projection: "Sample.Item.value", type: word }], abi: word.abi };
	declaration.projection.result = { kind: "array", element: record, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	const model = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	const surface = compilePrimitiveCSurface(JSON.parse(canonicalJson(model.bindingIr)));
	assert.equal(surface.copy({ kind: "named", id: "lean:Sample.Item" }).name, "sample_item");
	assert.equal(surface.copy({ kind: "apply", constructor: "array", arguments: [{ kind: "named", id: "lean:Sample.Item" }] }).name, "sample_array_lean_sample_item_span");
});

test("copied native C/C++ packages execute nested records and every primitive array after relocation", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-c-copied-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	for(const name of ["Parcel", "Archive"])
	{
		const p = name.toLowerCase(), source = join(working, name), relocated = join(working, `${name}-relocated`);
		await project(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [i, projectRoot] of [source, relocated].entries()) builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${i}`), targets: ["c", "cpp"], environment }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].projections, builds[1].projections);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		for(const projection of builds[0].projections)
		{
			const target = projection.ecosystem, install = join(working, `installed-${p}-${target}`); await mkdir(install);
			await run("tar", ["-xzf", join(builds[0].output, "archives", projection.packages[0].archive), "-C", install], working);
			const root = join(install, (await readdir(install))[0]), receipt = await json(join(root, "lean-bridge-package.json"));
			await verifyNativeFiles(root, receipt.files);
			const ext = target === "cpp" ? "cpp" : "c", main = join(working, `${p}.${ext}`);
			await saveLakeFile(working, `${p}.${ext}`, target === "cpp" ? cppConsumer(p) : cConsumer(p));
			const env = { PATH: "/usr/bin:/bin", PKG_CONFIG_PATH: join(root, "lib/pkgconfig") };
			const flags = (await run("pkg-config", ["--cflags", "--libs", receipt.pkgConfig], working, env)).stdout.trim().split(/\s+/);
			const executable = join(working, `${p}-${target}`);
			await run(target === "cpp" ? "c++" : "cc", [target === "cpp" ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", main, ...flags, "-pthread", "-o", executable], working, env);
			await run(executable, [], working, env);
			const cmakeRoot = join(working, `cmake-${p}-${target}`);
			await saveLakeFile(cmakeRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)\nproject(installed LANGUAGES ${target === "cpp" ? "CXX" : "C"})\nfind_package(${receipt.cmakePackage} 1.0.0 EXACT CONFIG REQUIRED)\nadd_executable(consumer "${main}")\nfind_package(Threads REQUIRED)\ntarget_link_libraries(consumer PRIVATE ${receipt.cmakeTarget} Threads::Threads)\n`);
			await run("cmake", ["-S", cmakeRoot, "-B", join(cmakeRoot, "build"), `-DCMAKE_PREFIX_PATH=${root}`], working, env);
			await run("cmake", ["--build", join(cmakeRoot, "build")], working, env);
			await run(join(cmakeRoot, "build/consumer"), [], working, env);
		}
		await allocationFailures(working, builds[0].output, p);
		const gmpFaults = await checkGmpCopiedFaults(builds[0].output, join(working, `${p}-gmp-faults`), p, environment);
		t.diagnostic(`${p}: ${gmpFaults} GMP allocation-failure checks`);
	}
});
