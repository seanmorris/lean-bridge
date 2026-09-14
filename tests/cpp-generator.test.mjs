/**
 * Tests the C++ generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import {
	compileCppPackageModel,
	generateCppBindingPackage,
	renderCppPackageLayout,
} from "../src/backends/cpp/generate.mjs";

const run = promisify(execFile);

test("nested C++ result allocations release every owned C child on exceptions", async t => {
	const input = nativeMetadataFixture(), declaration = input.metadata.modules[0].declarations[0];
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	declaration.projection.result = { kind: "array", element: { kind: "primitive", name: "string", lean: "String", abi }, abi };
	const model = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	const c = generateCBindingPackage(model.bindingIr), cpp = generateCppBindingPackage(model.bindingIr);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-nested-cleanup-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "sample.h"), c["include/sample.h"]);
	await writeFile(join(directory, "sample.hpp"), cpp["include/sample.hpp"]);
	await writeFile(join(directory, "main.cpp"), `#include "sample.hpp"
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <new>
static int remaining = -1, live = 0;
void* operator new(std::size_t size) {
  if (remaining == 0) throw std::bad_alloc();
  if (remaining > 0) --remaining;
  if (void* value = std::malloc(size)) return value;
  throw std::bad_alloc();
}
void operator delete(void* value) noexcept { std::free(value); }
void operator delete(void* value, std::size_t) noexcept { std::free(value); }
static void release(void* raw) {
  auto* data = static_cast<sample_string*>(raw);
  for (int i = 0; i < 2; ++i) { std::free(data[i].owner); --live; }
  std::free(raw); --live;
}
extern "C" sample_status sample_increment(uint32_t, sample_array_string_span* out, sample_error*) {
  auto* data = static_cast<sample_string*>(std::calloc(2, sizeof(sample_string))); assert(data); ++live;
  for (int i = 0; i < 2; ++i) {
    auto* text = static_cast<char*>(std::malloc(100)); assert(text); ++live; std::memset(text, 'x', 100);
    data[i] = sample_string{text, 100, text, std::free};
  }
  *out = sample_array_string_span{data, 2, data, release}; return SAMPLE_STATUS_OK;
}
extern "C" void sample_array_string_span_clear(sample_array_string_span* value) {
  if (value->release) value->release(value->owner);
  *value = sample_array_string_span{};
}
int main() {
  for (int i = 0; i < 3; ++i) {
    remaining = i; bool caught = false;
    try { (void)lean_bridge::sample::increment(0); }
    catch(const std::bad_alloc&) { caught = true; }
    assert(caught && live == 0);
  }
  remaining = -1;
  auto result = lean_bridge::sample::increment(0);
  assert(result.size() == 2 && result[1] == std::string(100, 'x') && live == 0);
}
`);
	const executable = join(directory, "consumer");
	await run("c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-I", directory, join(directory, "main.cpp"), "-o", executable]);
	await run(executable);
});

test("ordinary C++ wrappers release copied C results when host allocation throws", async t => {
	const input = nativeMetadataFixture(), declaration = input.metadata.modules[0].declarations[0];
	const bytes = { kind: "primitive", name: "bytes", lean: "ByteArray", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	declaration.projection.parameters[0].type = bytes;
	declaration.projection.result = bytes;
	const model = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	const c = generateCBindingPackage(model.bindingIr), cpp = generateCppBindingPackage(model.bindingIr);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-cleanup-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "sample.h"), c["include/sample.h"]);
	await writeFile(join(directory, "sample.hpp"), cpp["include/sample.hpp"]);
	await writeFile(join(directory, "main.cpp"), `#include "sample.hpp"
#include <cassert>
#include <cstdlib>
#include <new>
static bool fail_allocation = false;
static int releases = 0;
void* operator new(std::size_t size) {
  if (fail_allocation) { fail_allocation = false; throw std::bad_alloc(); }
  if (void* value = std::malloc(size)) return value;
  throw std::bad_alloc();
}
void operator delete(void* value) noexcept { std::free(value); }
void operator delete(void* value, std::size_t) noexcept { std::free(value); }
static void release(void* owner) { ++releases; std::free(owner); }
extern "C" sample_status sample_increment(const sample_bytes*, sample_bytes* out, sample_error*) {
  auto* buffer = static_cast<uint8_t*>(std::malloc(3)); assert(buffer);
  buffer[0] = 1; buffer[1] = 2; buffer[2] = 3;
  *out = sample_bytes{buffer, 3, buffer, release}; return SAMPLE_STATUS_OK;
}
extern "C" void sample_bytes_clear(sample_bytes* value) {
  if (value->release) value->release(value->owner);
  *value = sample_bytes{};
}
int main() {
  std::vector<uint8_t> input{1, 2, 3};
  fail_allocation = true; bool caught = false;
  try { (void)lean_bridge::sample::increment(input); }
  catch(const std::bad_alloc&) { caught = true; }
  assert(caught && releases == 1);
  assert(lean_bridge::sample::increment(input) == input && releases == 2);
}
`);
	const executable = join(directory, "consumer");
	await run("c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-I", directory, join(directory, "main.cpp"), "-o", executable]);
	await run(executable);
});

test("C++ compile and render stages preserve generated bytes", () => {
	assert.deepEqual(
		renderCppPackageLayout(compileCppPackageModel(alpha.bindingIr))
		, generateCppBindingPackage(alpha.bindingIr),
	);
});

test("the C++20 projection is deterministic and contains callback exceptions at the C boundary", async () => {
  const first = generateCppBindingPackage(alpha.bindingIr);
  assert.deepEqual(first, generateCppBindingPackage(structuredClone(alpha.bindingIr)));
  assert.match(first["include/lean_alpha.hpp"], /class Box final/);
  assert.match(first["include/lean_alpha.hpp"], /class Transform final/);
  assert.match(first["include/lean_alpha.hpp"], /std::rethrow_exception/);

  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-generator-"));
  try
{
    const c = generateCBindingPackage(alpha.bindingIr);
    await mkdir(join(directory, "include"), { recursive: true });
    await writeFile(join(directory, "include/lean_alpha.h"), c["include/lean_alpha.h"]);
    await writeFile(join(directory, "include/lean_alpha.hpp"), first["include/lean_alpha.hpp"]);
    await writeFile(join(directory, "consumer.cpp"), `#include "lean_alpha.hpp"
#include <cassert>
#include <stdexcept>

extern "C" lean_alpha_status lean_alpha_with_callback(
    uint32_t value,
    const lean_alpha_transform *transform,
    uint32_t *out,
    lean_alpha_error *error)
{
  return transform->call(transform->context, value, out, error);
}

int main()
{
  bool caught = false;
  try {
    (void)lean_bridge::alpha::with_callback(41, [](uint32_t) -> uint32_t {
      throw std::runtime_error("host callback failed");
    });
  } catch (const std::runtime_error& error) {
    caught = std::string(error.what()) == "host callback failed";
  }
  assert(caught);
}
`);
    const executable = join(directory, "consumer");
    await run("c++", [
      "-std=c++20", "-Wall", "-Wextra", "-Werror"
      , "-I", join(directory, "include")
      , join(directory, "consumer.cpp"), "-o", executable
    ]);
    await run(executable);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});
