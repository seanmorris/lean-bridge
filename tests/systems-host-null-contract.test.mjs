/**
 * Explicit HostNull projections for C, C++, Rust and WIT/WASI packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { renderGmpValues } from "../src/backends/c/gmp-values.mjs";
import { generateCallableBorrowViews } from "../src/backends/c/native-callables.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitConversions } from "../src/backends/wit/copied-conversions.mjs";
import { hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";

const surfaceOptions = Object.freeze({
	callables: true
	, structuredCallables: true
	, compounds: true
	, lists: true
	, variants: true
});
const available = command => spawnSync(command, ["--version"], { encoding: "utf8" }).status === 0;
const saveFiles = async (root, files) => {
	for(const [path, source] of Object.entries(files))
	{
		const file = join(root, path);
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, source);
	}
};

test("C and C++ keep HostNull typed, nested and checked in every callable direction", () => {
	const ir = hostNullReviewedIr(), surface = compilePrimitiveCSurface(ir, surfaceOptions);
	const c = generateCBindingPackage(ir), header = c["include/host_null_demo.h"];
	assert.deepEqual(c, generateCBindingPackage(structuredClone(ir)));
	for(const name of [
		"host_null_demo_host_null_uint32_value"
		, "host_null_demo_host_null_option_uint32_value"
		, "host_null_demo_option_host_null_uint32_value"
		, "host_null_demo_packet"
	]) assert.match(header, new RegExp(`typedef struct ${name}`, "u"));
	assert.match(header, /host_null_demo_call_host\([^]*host_null_demo_callback[^]*host_null_demo_host_null_option_uint32_value \*out/u);
	assert.match(header, /host_null_demo_make_closure\([^]*host_null_demo_owned_callback[^]*\*out/u);
	assert.doesNotMatch(header, /host-null/u);

	const gmp = renderGmpValues(surface);
	assert.match(gmp.declarations, /struct host_null_demo_gmp_host_null_uint32_value \{\n {2}uint8_t has_value;/u);
	assert.match(gmp.definitions, /if \(value->has_value > 1\) return 0;/u);
	const borrows = generateCallableBorrowViews(surface);
	assert.match(borrows, /if \(value->has_value\) \{/u);

	const cpp = generateCppBindingPackage(ir), source = cpp["include/host_null_demo.hpp"];
	assert.deepEqual(cpp, generateCppBindingPackage(structuredClone(ir)));
	assert.match(source, /std::optional<std::optional<uint32_t>> nullable_option/u);
	assert.match(source, /std::optional<std::optional<uint32_t>> optional_nullable/u);
	assert.match(source, /Native nullable value has an invalid tag/u);
	assert.match(source, /LeanClosure<std::optional<std::optional<uint32_t>>\(std::optional<uint32_t>\)>/u);
	assert.match(cpp["README.md"], /compiler-authenticated HostNull[^]*nested std::optional/u);
});

test("generated C and C++ HostNull APIs compile as strict public consumers", {
	skip: !available("cc") || !available("c++")
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-systems-host-null-c-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = hostNullReviewedIr();
	await saveFiles(root, { ...generateCBindingPackage(ir), ...generateCppBindingPackage(ir) });
	await writeFile(join(root, "probe.c"), `#include "host_null_demo.h"\nint main(void) {\n  host_null_demo_host_null_option_uint32_value left = {0};\n  host_null_demo_option_host_null_uint32_value right = {0};\n  return (int)(left.has_value + right.has_value);\n}\n`);
	for(const [command, arguments_] of [
		["cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I", join(root, "include"), "-fsyntax-only", join(root, "probe.c")]]
		, ["c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-I", join(root, "include"), "-fsyntax-only", join(root, "src/host_null_demo.cpp")]]
	]) {
		const result = spawnSync(command, arguments_, { encoding: "utf8" });
		assert.equal(result.status, 0, result.stdout + result.stderr);
	}
});

test("Rust HostNull uses nested Option without leaking private ABI flags", () => {
	const ir = hostNullReviewedIr(), model = compileCopiedRustModel(ir);
	const files = generateCopiedRustPackage(ir, null, { name: "host-null-demo", version: "1.0.0" });
	assert.deepEqual(files, generateCopiedRustPackage(structuredClone(ir), null
		, { name: "host-null-demo", version: "1.0.0" }));
	assert.deepEqual(model.surface.copies.filter(copy => copy.compound === "host-null")
		.map(copy => copy.publicType), ["Option<u32>", "Option<Option<u32>>"]);
	const source = files["src/lib.rs"], native = files["src/__runtime.rs"];
	assert.match(source, /pub direct: Option<u32>/u);
	assert.match(source, /pub nullable_option: Option<Option<u32>>/u);
	assert.match(source, /pub optional_nullable: Option<Option<u32>>/u);
	assert.match(source, /pub fn call_host\(value0: &Option<u32>, value1: impl FnMut\(Option<u32>\) -> Result<Option<Option<u32>>, Error>\)/u);
	assert.match(source, /LeanClosure<fn\(&Option<u32>\) -> Option<Option<u32>>>/u);
	assert.doesNotMatch(source, /has_value|extern "C"|c_void/u);
	assert.match(native, /match value\.has_value \{ 0 => Ok\(None\), 1 => Ok\(Some/u);
	assert.match(native, /_ => Err\(Error::InvalidNative\)/u);
	assert.match(files["README.md"], /directly nested HostNull remain nested Option/u);
});

test("WIT/WASI HostNull is a typed component option with validated tags", {
	skip: !available(process.env.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools")
}, async t => {
	const ir = hostNullReviewedIr();
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	const repeated = compileCopiedWitModel(structuredClone(ir), {}, { callables: true });
	assert.equal(model.wit, repeated.wit); assert.equal(model.wat, repeated.wat);
	assert.match(model.wit, /type bridge-value-1 = option<u32>;/u);
	assert.match(model.wit, /type bridge-value-3 = option<bridge-value-2>;/u);
	assert.match(model.wit, /type bridge-value-4 = option<bridge-value-1>;/u);
	assert.match(model.wit, /record packet \{ direct: bridge-value-1, nullable-option: bridge-value-3, optional-nullable: bridge-value-4 \}/u);
	assert.match(model.wit, /call-host: func\([^]*borrow<function-bridge-value-1-to-bridge-value-3>\) -> bridge-value-3/u);
	assert.match(model.wit, /make-closure: func\([^]*own<function-bridge-value-1-to-bridge-value-3>/u);
	const conversions = renderWitConversions(model);
	assert.ok((conversions.match(/has_value > 1/gu) ?? []).length >= 4);

	const root = await mkdtemp(join(tmpdir(), "lean-bridge-systems-host-null-wit-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "model.wat"), model.wat);
	await writeFile(join(root, "model.wit"), model.wit);
	const wasmTools = process.env.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	for(const arguments_ of [
		["parse", "model.wat", "-o", "model.wasm"]
		, ["validate", "--features", "component-model", "model.wasm"]
		, ["component", "wit", "model.wit", "--json"]
		, ["component", "wit", "model.wasm", "--json"]
	]) {
		const result = spawnSync(wasmTools, arguments_, { cwd: root, encoding: "utf8" });
		assert.equal(result.status, 0, result.stdout + result.stderr);
	}
});
