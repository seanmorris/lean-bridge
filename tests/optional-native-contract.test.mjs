/**
 * Native C and C++ prepared APIs preserve full arity while exposing omission.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { optionalParameterIr } from "./helpers/optional-parameter-ir.mjs";

const trailingDefaultsIr = () => {
	const ir = optionalParameterIr(), declaration = ir.declarations[0];
	const optional = structuredClone(declaration.parameters[0]);
	declaration.parameters = [
		{ ...structuredClone(optional), name: "required", optional: false, default: null }
		, { ...structuredClone(optional), name: "middle", default: { kind: "integer", value: "7" } }
		, { ...structuredClone(optional), name: "last", default: { kind: "integer", value: "9" } }
	];
	ir.declarations = [declaration];
	return ir;
};

test("C macros dispatch omitted suffixes to authenticated default wrappers", () => {
	const files = generateCBindingPackage(optionalParameterIr());
	const header = files["include/defaults.h"], implementation = files["src/defaults.c"];
	assert.match(header, /defaults_status defaults_word\(uint32_t value0, uint32_t \*out, defaults_error \*error\);/u);
	assert.match(header, /static inline defaults_status defaults_word_default_0\(uint32_t \*out, defaults_error \*error\)/u);
	assert.match(header, /const uint32_t defaults_word_default_0_0_0 = UINT32_C\(7\);/u);
	assert.match(header, /#define defaults_word\(\.\.\.\) DEFAULTS_WORD_DEFAULT_SELECT\(__VA_ARGS__, defaults_word, defaults_word_default_0\)\(__VA_ARGS__\)/u);
	assert.match(header, /static const uint32_t defaults_natural_default_0_0_0_limbs\[\]/u);
	assert.match(header, /static const char defaults_text_default_0_0_0_bytes\[\]/u);
	assert.match(header, /defaults_option_uint32_value defaults_maybe_default_0_0_0 = \{0\};/u);
	assert.match(header, /defaults_present_default_0_0_0\.has_value = 1;/u);
	assert.match(implementation, /#define DEFAULTS_DISABLE_DEFAULT_ARGUMENTS 1/u);
	assert.doesNotMatch(implementation, /defaults_word_default_0/u);
});

test("C rejects a positional default before a required argument", () => {
	const ir = optionalParameterIr(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...structuredClone(declaration.parameters[0])
		, name: "required", optional: false, default: null });
	assert.throws(() => generateCBindingPackage(ir), error =>
		error.code === "nontrailing-optional-parameter");
});

test("C dispatches every trailing-default arity without changing the full symbol", () => {
	const header = generateCBindingPackage(trailingDefaultsIr())["include/defaults.h"];
	assert.match(header, /defaults_word\(uint32_t required, uint32_t middle, uint32_t last, uint32_t \*out, defaults_error \*error\);/u);
	assert.match(header, /defaults_word_default_1\(uint32_t required, uint32_t \*out, defaults_error \*error\)/u);
	assert.match(header, /defaults_word_default_2\(uint32_t required, uint32_t middle, uint32_t \*out, defaults_error \*error\)/u);
	assert.match(header, /DEFAULTS_WORD_DEFAULT_SELECT\(__VA_ARGS__, defaults_word, defaults_word_default_2, defaults_word_default_1\)/u);
});

test("C++20 wrappers carry authenticated defaults and keep C calls full arity", () => {
	const files = generateCppBindingPackage(optionalParameterIr());
	const header = files["include/defaults.hpp"];
	assert.match(header, /inline uint32_t word\(uint32_t value0 = static_cast<uint32_t>\(UINT32_C\(7\)\)\)/u);
	assert.match(header, /inline Nat natural\(Nat const& value0 = Nat\{"184467440737095516160"\}\)/u);
	assert.match(header, /std::string const& value0 = std::string\{/u);
	assert.match(header, /char32_t value0 = static_cast<char32_t>\(0x3bb\)/u);
	assert.match(header, /std::optional<uint32_t> const& value0 = std::nullopt/u);
	assert.match(header, /std::optional<uint32_t>\{static_cast<uint32_t>\(UINT32_C\(9\)\)\}/u);
	assert.match(header, /defaults_word\(_lb_arg0\.value, &_lb_result, &_lb_error\)/u);
});

test("C++ rejects a positional default before a required argument", () => {
	const ir = optionalParameterIr(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...structuredClone(declaration.parameters[0])
		, name: "required", optional: false, default: null });
	assert.throws(() => generateCppBindingPackage(ir)
		, /default before a required positional parameter/u);
});

test("C++ emits one native default for every trailing optional parameter", () => {
	const header = generateCppBindingPackage(trailingDefaultsIr())["include/defaults.hpp"];
	assert.match(header, /word\(uint32_t required, uint32_t middle = static_cast<uint32_t>\(UINT32_C\(7\)\), uint32_t last = static_cast<uint32_t>\(UINT32_C\(9\)\)\)/u);
});

test("C11 and C++20 consumers compile both omitted and supplied calls", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-defaults-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "include")); await mkdir(join(root, "internal")); await mkdir(join(root, "src"));
	const ir = optionalParameterIr();
	// The prepared C++ archive supplies pinned Boost. Keep this local syntax
	// check compiler-only while the static contract above covers the Nat default.
	ir.declarations = ir.declarations.filter(declaration => declaration.name !== "natural");
	const c = generateCBindingPackage(ir);
	const cpp = generateCppBindingPackage(ir);
	for(const [path, source] of Object.entries(c))
		if(path.endsWith(".h") || path.endsWith(".c")) await writeFile(join(root, path), source);
	await writeFile(join(root, "include/defaults.hpp"), cpp["include/defaults.hpp"]);
	await writeFile(join(root, "consumer.c"), `#include "defaults.h"
void calls(void) {
  defaults_error error = {0}; uint32_t word = 0;
  defaults_string text = {0}; defaults_option_uint32_value maybe = {0};
  (void)defaults_word(&word, &error); (void)defaults_word(UINT32_C(11), &word, &error);
  (void)defaults_text(&text, &error);
  (void)defaults_character(&word, &error); (void)defaults_maybe(&maybe, &error);
  (void)defaults_present(&maybe, &error);
}
`);
	await writeFile(join(root, "consumer.cpp"), `#include "defaults.hpp"
void calls() {
  using namespace lean_bridge::defaults;
  (void)word(); (void)word(11); (void)text();
  (void)character(); (void)maybe(); (void)present();
}
`);
	const options = { cwd: root, encoding: "utf8", stdio: "pipe" };
	execFileSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-Iinclude", "-Iinternal", "-fsyntax-only", "src/defaults.c", "consumer.c"], options);
	execFileSync("c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-Iinclude", "-fsyntax-only", "consumer.cpp"], options);
});

test("C11 matrix caller compiles and C++ caller names every optional case", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-default-callers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "include"));
	await mkdir(join(root, "internal"));
	await mkdir(join(root, "src"));
	const ir = optionalParameterIr();
	const c = generateCBindingPackage(ir);
	const cpp = generateCppBindingPackage(ir);
	for(const [path, source] of Object.entries(c))
		if(path.endsWith(".h") || path.endsWith(".c"))
			await writeFile(join(root, path), source);
	await writeFile(join(root, "include/defaults.hpp"), cpp["include/defaults.hpp"]);
	await writeFile(join(root, "consumer.c"), await readFile(
		"tests/fixtures/optional-parameter-consumers/c.c"));
	const options = { cwd: root, encoding: "utf8", stdio: "pipe" };
	execFileSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-Iinclude", "-Iinternal", "-fsyntax-only", "src/defaults.c"
		, "consumer.c"], options);
	const cppSource = await readFile(
		"tests/fixtures/optional-parameter-consumers/cpp.cpp", "utf8");
	for(const name of [
		"word", "natural", "text", "character", "maybe", "present"
		, "unit_value"
	]) assert.match(cppSource, new RegExp(`api::${name}\\(`, "u"));
});
