/**
 * Ordinary-source C/C++ admission and relocated, installed native consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { validateNativeCSettings, packageNativeCFamily } from "../src/release/native-c-family.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_C_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });

test("C/C++ source lowering shares C names and has no Alpha or Perl requirements", () => {
	const model = synthetic(), surface = compilePrimitiveCSurface(model.bindingIr);
	assert.equal(model.moduleName, undefined); assert.equal(model.exports[0].publicName, undefined);
	assert.equal(surface.functions[0].name, "sample_increment");
	const cpp = generateCppBindingPackage(model.bindingIr);
	assert.match(cpp["include/sample.hpp"], /namespace lean_bridge::sample/);
	assert.match(cpp["include/sample.hpp"], /inline uint32_t increment\(/);
	assert.doesNotMatch(cpp["include/sample.hpp"], /Alpha|alpha|Perl/);
	assert.deepEqual(cpp, generateCppBindingPackage(structuredClone(model.bindingIr)));
	assert.match(generateCBindingPackage(model.bindingIr)["include/sample.h"], /sample_increment/);
	assert.match(generateNativePrimitiveC(model, { initializer: "initialize_LeanBridgeNative0123456789abcdef" }), new RegExp(model.exports[0].symbol));
});

test("C/C++ admission rejects unsupported signatures and reserved names at the Lean source", () => {
	for(const change of [
		ir => { ir.declarations[0].parameters[0].type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint32" }] }; }
		, ir => { ir.declarations[0].name = "initialize"; }
		, ir => { ir.declarations[0].name = "class"; }
		, ir => { ir.declarations[0].parameters[0].name = "out"; }
		, ir => { ir.component.id = "leanshared@1.0.0"; }
		, ir => { ir.component.id = `${"a".repeat(160)}@1.0.0`; }
		, ir => { ir.declarations.push({ ...structuredClone(ir.declarations[0]), id: "lean:Other.increment" }); }
	]) {
		const ir = structuredClone(synthetic().bindingIr); change(ir);
		assert.throws(() => compilePrimitiveCSurface(ir), error => error.code === "unsupported-native-c-signature" && error.details.source.path === "Sample.lean");
	}
	for(const settings of [{ name: "../escape" }, { name: "$(touch unsafe)" }, { version: "1\n2" }]) assert.throws(() => validateNativeCSettings(settings));
});

const scalarTypes = [
	["unit", "Unit"], ["bool", "Bool"], ["u8", "UInt8"], ["u16", "UInt16"]
	, ["u32", "UInt32"], ["u64", "UInt64"], ["i8", "Int8"], ["i16", "Int16"]
	, ["i32", "Int32"], ["i64", "Int64"], ["nat", "Nat"], ["int", "Int"]
	, ["f32", "Float32"], ["f64", "Float"], ["text", "String"]
	, ["bytes", "ByteArray"]
];

const project = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\nversion = "1.2.3"\n[[lean_lib]]\nname = "${name}"\n`);
	const extra = name === "Survey" ? "def score (apply : Bool) (base : UInt64) (bonus : UInt32) : UInt64 := if apply then base + bonus.toUInt64 else base\ndef label (labelText : String) (index : Nat) : String := labelText ++ toString index\ndef duplicate {α : Type} [Add α] (value : α) : α := value + value\n" : "";
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}\n${scalarTypes.map(([label, type]) => `def echo_${label} (value : ${type}) : ${type} := value`).join("\n")}\ndef answer : UInt64 := 18446744073709551615\ntheorem echo_nat_spec (value : Nat) : echo_nat value = value := rfl\n${extra}end ${name}\n`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: [name]
		, exports: [...scalarTypes.map(([label]) => `${name}.echo_${label}`), `${name}.answer`, ...(name === "Survey" ? ["Survey.score", "Survey.label", "Survey.double_word"] : [])]
		, ...(name === "Survey" ? { specializations: [{ name: "Survey.double_word", declaration: "Survey.duplicate", types: ["UInt32"] }] } : {})
		, targets: { c: { name: `${name.toLowerCase()}-c`, version: "2.0.0" }
			, cpp: { name: `${name.toLowerCase()}-cpp`, version: "2.0.0" }
			, cpan: { module: "LeanBridge::Runtime" } } }));
};

const consumerC = p => `#include "${p}.h"
#include <assert.h>
#include <limits.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define OK(expression) assert((expression) == ${p.toUpperCase()}_STATUS_OK)
int main(void) {
  ${p}_error error = {0};
  OK(${p}_echo_unit(0, &error));
  assert(${p}_echo_unit(1, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  bool b = false; OK(${p}_echo_bool(true, &b, &error)); assert(b);
  ${[8, 16, 32, 64].map(bits => `uint${bits}_t u${bits} = 0; OK(${p}_echo_u${bits}(UINT${bits}_MAX, &u${bits}, &error)); assert(u${bits} == UINT${bits}_MAX);
  int${bits}_t i${bits} = 0; OK(${p}_echo_i${bits}(INT${bits}_MIN, &i${bits}, &error)); assert(i${bits} == INT${bits}_MIN);`).join("\n  ")}
  OK(${p}_answer(&u64, &error)); assert(u64 == UINT64_MAX);
  float f = 0; double d = 0; OK(${p}_echo_f32(-0.0f, &f, &error)); assert(signbit(f));
  OK(${p}_echo_f64(INFINITY, &d, &error)); assert(isinf(d));
  OK(${p}_echo_f64(NAN, &d, &error)); assert(isnan(d));
  const char text[] = "a\\0\\xf0\\x9f\\x8c\\xbf";
  ${p}_string input = {text, sizeof(text) - 1, NULL, NULL}, output = {0};
  for (int i = 0; i < 1000; ++i) { OK(${p}_echo_text(&input, &output, &error)); assert(output.length == input.length && memcmp(output.data, input.data, input.length) == 0); ${p}_string_clear(&output); ${p}_string_clear(&output); }
  const char invalid[] = "\\xed\\xa0\\x80"; input.data = invalid; input.length = 3;
  assert(${p}_echo_text(&input, &output, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT); assert(output.data == NULL);
  input.data = NULL; input.length = 1;
  assert(${p}_echo_text(&input, &output, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  input.length = 0; OK(${p}_echo_text(&input, &output, &error)); assert(output.length == 0); ${p}_string_clear(&output);
  assert(${p}_echo_text(&input, NULL, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  uint8_t octets[] = {0, 255, 128, 1}; ${p}_bytes bytes = {octets, 4, NULL, NULL}, copied = {0};
  OK(${p}_echo_bytes(&bytes, &copied, &error)); assert(copied.length == 4 && memcmp(copied.data, octets, 4) == 0); ${p}_bytes_clear(&copied);
  bytes.length = SIZE_MAX; assert(${p}_echo_bytes(&bytes, &copied, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT);
  size_t large = 8 * 1024 * 1024 + 1; uint8_t *buffer = calloc(large, 1); assert(buffer); bytes.data = buffer; bytes.length = large;
  assert(${p}_echo_bytes(&bytes, &copied, &error) == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT); assert(copied.data == NULL); free(buffer);
  uint32_t limbs[512]; for (size_t i = 0; i < 512; ++i) limbs[i] = UINT32_MAX - (uint32_t)i;
  ${p}_nat natural = {limbs, 512, NULL, NULL}, n = {0};
  OK(${p}_echo_nat(&natural, &n, &error)); assert(n.length == 512 && memcmp(n.data, limbs, sizeof(limbs)) == 0); ${p}_nat_clear(&n);
  ${p}_int integer = {limbs, 512, NULL, NULL, true}, z = {0};
  OK(${p}_echo_int(&integer, &z, &error)); assert(z.negative && z.length == 512 && memcmp(z.data, limbs, sizeof(limbs)) == 0); ${p}_int_clear(&z);
  integer.data = NULL; integer.length = 0; OK(${p}_echo_int(&integer, &z, &error)); assert(z.length == 0 && !z.negative); ${p}_int_clear(&z);
  assert(error.code == ${p.toUpperCase()}_ERROR_NONE);
  ${p === "survey" ? `OK(survey_score(true, 20, 5, &u64, &error)); assert(u64 == 25);
  OK(survey_score(false, 20, 5, &u64, &error)); assert(u64 == 20);
  OK(survey_double_word(21, &u32, &error)); assert(u32 == 42);
  uint32_t index_limb = 37; natural = (survey_nat){&index_limb, 1, NULL, NULL}; input = (survey_string){"sample:", 7, NULL, NULL};
  OK(survey_label(&input, &natural, &output, &error)); assert(output.length == 9 && memcmp(output.data, "sample:37", 9) == 0); survey_string_clear(&output);` : ""}
  return 0;
}
`;

const consumerCpp = p => `#include "${p}.hpp"
#include <cassert>
#include <cmath>
#include <limits>
#include <thread>

namespace api = lean_bridge::${p};
int main() {
  api::echo_unit({}); assert(api::echo_bool(true));
  ${[8, 16, 32, 64].map(bits => `assert(api::echo_u${bits}(UINT${bits}_MAX) == UINT${bits}_MAX); assert(api::echo_i${bits}(INT${bits}_MIN) == INT${bits}_MIN);`).join("\n  ")}
  assert(api::answer() == UINT64_MAX);
  assert(std::signbit(api::echo_f32(-0.0f))); assert(std::isnan(api::echo_f64(std::numeric_limits<double>::quiet_NaN())));
  std::string text("a\\0\\xf0\\x9f\\x8c\\xbf", 6); assert(api::echo_text(text) == text); assert(api::echo_text("").empty());
  assert(api::echo_bytes({0, 255, 128}) == std::vector<uint8_t>({0, 255, 128}));
  api::Nat nat{{0, 0, 1}}; assert(api::echo_nat(nat).limbs == nat.limbs);
  api::Int integer{true, {0, 0, 1}}; auto copied = api::echo_int(integer); assert(copied.negative && copied.limbs == integer.limbs);
  bool rejected = false;
  try { (void)api::echo_text(std::string("\\xc0\\x80", 2)); }
  catch(const api::Error& error) { rejected = error.status == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT; }
  assert(rejected);
  ${p === "survey" ? 'assert(api::score(true, 20, 5) == 25); assert(api::score(false, 20, 5) == 20); assert(api::double_word(21) == 42); assert(api::label("sample:", api::Nat{{37}}) == "sample:37");' : ""}
  std::vector<std::thread> threads;
  for (int i = 0; i < 4; ++i) threads.emplace_back([&] { for (int j = 0; j < 100; ++j) assert(api::echo_text(text) == text); });
  for (auto& thread : threads) thread.join();
}
`;

const consume = async (working, build, name) => {
	const p = name.toLowerCase();
	const manifest = await json(join(build, "native-release.json"));
	for(const projection of manifest.projections)
	{
		const archive = projection.packages[0], target = projection.ecosystem;
		assert.equal(sha256(await readFile(join(build, "archives", archive.archive))), archive.sha256);
		const install = join(working, `installed-${p}-${target}`); await mkdir(install);
		await run("tar", ["-xzf", join(build, "archives", archive.archive), "-C", install], working);
		const packageRoot = join(install, (await readdir(install))[0]);
		const receipt = await json(join(packageRoot, "lean-bridge-package.json"));
		await verifyNativeFiles(packageRoot, receipt.files);
		assert.equal(receipt.runtimeIdentity, manifest.nativeRuntimeIdentity);
		const ext = target === "cpp" ? "cpp" : "c", source = join(working, `${p}.${ext}`);
		await saveLakeFile(working, `${p}.${ext}`, target === "cpp" ? consumerCpp(p) : consumerC(p));
		const env = { PATH: "/usr/bin:/bin", PKG_CONFIG_PATH: join(packageRoot, "lib/pkgconfig") };
		const flags = (await run("pkg-config", ["--cflags", "--libs", receipt.pkgConfig], working, env)).stdout.trim().split(/\s+/);
		const executable = join(working, `${p}-${target}`);
		await run(target === "cpp" ? "c++" : "cc", [target === "cpp" ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", source, ...flags, "-pthread", "-o", executable], working, env);
		await run(executable, [], working, env);
		const cmakeRoot = join(working, `cmake-${p}-${target}`);
		await saveLakeFile(cmakeRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)\nproject(installed LANGUAGES ${target === "cpp" ? "CXX" : "C"})\nfind_package(${receipt.cmakePackage} 2.0.0 EXACT CONFIG REQUIRED)\nadd_executable(consumer "${source}")\nfind_package(Threads REQUIRED)\ntarget_link_libraries(consumer PRIVATE ${receipt.cmakeTarget} Threads::Threads)\n`);
		await run("cmake", ["-S", cmakeRoot, "-B", join(cmakeRoot, "build"), `-DCMAKE_PREFIX_PATH=${packageRoot}`], working, env);
		await run("cmake", ["--build", join(cmakeRoot, "build")], working, env);
		await run(join(cmakeRoot, "build/consumer"), [], working, env);
	}
};

test("ordinary C/C++ packages reproduce after relocation and run without Lean or Perl", { skip: !enabled, timeout: 600_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-c-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	for(const name of ["Mosaic", "Survey"])
	{
		const source = join(working, name), relocated = join(working, `${name}-relocated`);
		await project(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), results = [];
		for(const [index, projectRoot] of [source, relocated].entries())
		{
			const outputRoot = join(working, `${name}-build${index}`);
			results.push(await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }));
		}
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(results[0].projections, results[1].projections, "relocated package bytes and coordinates agree");
		t.diagnostic(canonicalJson({ project: name, archives: results[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		const componentRoot = join(results[0].output, "native/component");
		const verified = await readVerifiedNativeComponent(componentRoot, results[0].nativeRuntimeIdentity);
		assert.equal(verified.model.moduleName, undefined, "the invalid unused CPAN namespace does not affect C");
		assert.equal(verified.model.exports.length, name === "Survey" ? 20 : 17);
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		await consume(working, results[0].output, name);
		const adapterRoot = join(results[0].output, "native/c-binding"), library = join(adapterRoot, `lib/lib${name.toLowerCase()}.so`);
		const bytes = await readFile(library); bytes[bytes.length - 1] ^= 1;
		await saveLakeFile(adapterRoot, `lib/lib${name.toLowerCase()}.so`, bytes);
		await assert.rejects(() => packageNativeCFamily({
			working: join(working, "tampered"), adapterRoot
			, nativeRoot: componentRoot
			, runtimeRoot: join(results[0].output, "native/runtime"), leanPrefix
			, target: "c", glibcMinimumVersion: "2.38" }), /drift/);
	}
});

test("unsupported ordinary C exports fail atomically with source locations", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-c-reject-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"), outputRoot = join(working, "release"); await project(source, "Unsupported");
	await saveLakeFile(source, "Unsupported.lean", "namespace Unsupported\ndef values (a : Array UInt32) := a\nend Unsupported\n");
	await saveLakeFile(source, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Unsupported"], exports: ["Unsupported.values"] }));
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot, targets: ["c", "cpp"], environment }), error => error.code === "unsupported-native-c-signature" && error.details.source.path === "Unsupported.lean");
	assert.deepEqual(await readdir(working), ["source"]);
});
