/**
 * Tests the C generator behavior.
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
import {
	CBindingGenerationError,
	generateCBindingPackage,
} from "../src/backends/c/generate.mjs";
import { auditCPackage } from "../src/backends/c/package-audit.mjs";

const run = promisify(execFile);
const clone = value => structuredClone(value);

const writePackage = async (directory, files) => {
	for(const [relativePath, source] of Object.entries(files))
	{
		const destination = join(directory, relativePath);
		await mkdir(join(destination, ".."), { recursive: true });
		await writeFile(destination, source);
	}
};

test("the C backend emits typed values, opaque resources, callbacks, and direct functions", () => {
  const files = generateCBindingPackage(alpha.bindingIr);
  assert.deepEqual(files, generateCBindingPackage(clone(alpha.bindingIr)));
  const header = files["include/lean_alpha.h"];
  const internal = files["internal/lean_alpha_runtime.h"];

  assert.match(header, /typedef struct lean_alpha_payload/);
  assert.match(header, /bool enabled;/);
  assert.match(header, /uint32_t count;/);
  assert.match(header, /lean_alpha_string label;/);
  assert.match(header, /lean_alpha_bytes bytes;/);
  assert.match(header, /lean_alpha_array_uint32_span values;/);
  assert.match(header, /typedef struct lean_alpha_box lean_alpha_box;/);
  assert.match(header, /lean_alpha_box_create\(uint32_t value, lean_alpha_box \*\*out/);
  assert.match(header, /lean_alpha_box_read\(const lean_alpha_box \*self, uint32_t \*out/);
  assert.match(header, /lean_alpha_round_trip\(const lean_alpha_payload \*payload/);
  assert.match(header, /lean_alpha_with_callback\(uint32_t value, const lean_alpha_transform \*transform/);
  assert.match(header, /lean_alpha_owned_transform_call/);
  assert.doesNotMatch(header, /\b(?:ccall|cwrap|dispatch|invoke|uintptr_t|handle|token)\b|_bridge_|WebAssembly/i);

  assert.match(internal, /typedef struct lean_alpha_runtime_v1/);
  assert.match(internal, /\(\*box_create\)/);
  assert.match(internal, /\(\*round_trip\)/);
  assert.doesNotMatch(internal, /\(\*invoke\)|\(\*dispatch\)/);
  assert.deepEqual(auditCPackage(alpha.bindingIr, files).exports, [
    "lean_alpha_box_create"
    , "lean_alpha_box_read"
    , "lean_alpha_box_identity"
    , "lean_alpha_round_trip"
    , "lean_alpha_with_callback"
    , "lean_alpha_make_adder"
    , "lean_alpha_box_dispose"
  ]);

  const leaked = { ...files };
  leaked["include/lean_alpha.h"] += "\nuintptr_t public_handle;\n";
  assert.throws(
    () => auditCPackage(alpha.bindingIr, leaked),
    error => error.code === "raw-handle",
  );
});

test("generated C compiles and runs through native functions without consumer glue", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-c-generator-"));
  try
{
    await writePackage(directory, generateCBindingPackage(alpha.bindingIr));
    await writeFile(join(directory, "consumer.c"), `
#include "lean_alpha.h"
#include "lean_alpha_runtime.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

static unsigned initialized = 0;
static unsigned resource_disposals = 0;
static unsigned callable_disposals = 0;

static lean_alpha_status runtime_initialize(void *context, lean_alpha_error *error) {
  (void)context;
  (void)error;
  initialized += 1;
  return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_create(void *context, uint32_t value, uintptr_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = (uintptr_t)value + 1u;
  return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_read(void *context, uintptr_t self, uint32_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = (uint32_t)(self - 1u);
  return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_identity(void *context, uintptr_t self, uintptr_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = self;
  return LEAN_ALPHA_STATUS_OK;
}

static void release_heap(void *owner) { free(owner); }

static void *copy_bytes(const void *source, size_t length) {
  void *copy = malloc(length == 0 ? 1 : length);
  assert(copy != NULL);
  if (length != 0) memcpy(copy, source, length);
  return copy;
}

static lean_alpha_status round_trip(void *context, const lean_alpha_payload *payload, lean_alpha_payload *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  char *label = copy_bytes(payload->label.data, payload->label.length);
  uint8_t *bytes = copy_bytes(payload->bytes.data, payload->bytes.length);
  uint32_t *values = copy_bytes(payload->values.data, payload->values.length * sizeof(uint32_t));
  *out = (lean_alpha_payload){
    .enabled = !payload->enabled,
    .count = payload->count + 1u,
    .label = { label, payload->label.length, label, release_heap },
    .bytes = { bytes, payload->bytes.length, bytes, release_heap },
    .values = { values, payload->values.length, values, release_heap },
  };
  return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status with_callback(void *context, uint32_t value, const lean_alpha_transform *transform, uint32_t *out, lean_alpha_error *error) {
  (void)context;
  uint32_t transformed = 0;
  lean_alpha_status status = transform->call(transform->context, value + 1u, &transformed, error);
  if (status == LEAN_ALPHA_STATUS_OK) *out = transformed + 1u;
  return status;
}

static lean_alpha_status make_adder(void *context, uint32_t base, uintptr_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = (uintptr_t)base;
  return LEAN_ALPHA_STATUS_OK;
}

static void box_dispose(void *context, uintptr_t value) {
  (void)context;
  (void)value;
  resource_disposals += 1;
}

static lean_alpha_status transform_call(void *context, uintptr_t self, uint32_t value, uint32_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = (uint32_t)self + value;
  return LEAN_ALPHA_STATUS_OK;
}

static void transform_dispose(void *context, uintptr_t value) {
  (void)context;
  (void)value;
  callable_disposals += 1;
}

static lean_alpha_status host_transform(void *context, uint32_t value, uint32_t *out, lean_alpha_error *error) {
  (void)context;
  (void)error;
  *out = value;
  return LEAN_ALPHA_STATUS_OK;
}

int main(void) {
  lean_alpha_error error = {0};
  uint32_t number = 0;
  assert(lean_alpha_box_read(NULL, &number, &error) == LEAN_ALPHA_STATUS_RUNTIME_UNAVAILABLE);

  const lean_alpha_runtime_v1 runtime = {
    .abi_version = LEAN_ALPHA_BINDING_ABI_VERSION,
    .initialize = runtime_initialize,
    .box_create = box_create,
    .box_read = box_read,
    .box_identity = box_identity,
    .round_trip = round_trip,
    .with_callback = with_callback,
    .make_adder = make_adder,
    .box_dispose = box_dispose,
    .transform_call = transform_call,
    .transform_dispose = transform_dispose,
  };
  assert(lean_alpha_runtime_install_v1(&runtime, &error) == LEAN_ALPHA_STATUS_OK);
  assert(initialized == 1);

  lean_alpha_box *box = NULL;
  assert(lean_alpha_box_create(41, &box, &error) == LEAN_ALPHA_STATUS_OK);
  assert(lean_alpha_box_read(box, &number, &error) == LEAN_ALPHA_STATUS_OK);
  assert(number == 41);
  const lean_alpha_box *same = NULL;
  assert(lean_alpha_box_identity(box, &same, &error) == LEAN_ALPHA_STATUS_OK);
  assert(same == box);

  const uint8_t source_bytes[] = {0, 127, 255};
  const uint32_t source_values[] = {1, 5, 13};
  const lean_alpha_payload input = {
    .enabled = false,
    .count = 8,
    .label = {"typed", 5, NULL, NULL},
    .bytes = {source_bytes, 3, NULL, NULL},
    .values = {source_values, 3, NULL, NULL},
  };
  lean_alpha_payload output = {0};
  assert(lean_alpha_round_trip(&input, &output, &error) == LEAN_ALPHA_STATUS_OK);
  assert(output.enabled && output.count == 9);
  assert(output.label.length == 5 && memcmp(output.label.data, "typed", 5) == 0);
  assert(output.bytes.data != input.bytes.data);
  assert(output.values.data != input.values.data);
  lean_alpha_payload_clear(&output);
  assert(output.label.data == NULL && output.bytes.data == NULL && output.values.data == NULL);

  const lean_alpha_transform transform = { host_transform, NULL };
  assert(lean_alpha_with_callback(40, &transform, &number, &error) == LEAN_ALPHA_STATUS_OK);
  assert(number == 42);

  lean_alpha_owned_transform *add_two = NULL;
  assert(lean_alpha_make_adder(2, &add_two, &error) == LEAN_ALPHA_STATUS_OK);
  assert(lean_alpha_owned_transform_call(add_two, 40, &number, &error) == LEAN_ALPHA_STATUS_OK);
  assert(number == 42);
  lean_alpha_owned_transform_dispose(&add_two);
  assert(add_two == NULL && callable_disposals == 1);

  lean_alpha_box_dispose(&box);
  assert(box == NULL && resource_disposals == 1);
  return 0;
}
`);
    const executable = join(directory, "consumer");
    await run("cc", [
      "-std=c11"
      , "-Wall"
      , "-Wextra"
      , "-Werror"
      , "-I", join(directory, "include")
      , "-I", join(directory, "internal")
      , join(directory, "src/lean_alpha.c")
      , join(directory, "consumer.c")
      , "-o", executable
    ]);
    await run(executable);

    await writeFile(join(directory, "failed-init.c"), `
#include "lean_alpha.h"
#include "lean_alpha_runtime.h"

#include <assert.h>

static unsigned attempts = 0;

static lean_alpha_status fail_initialize(void *context, lean_alpha_error *error) {
  (void)context;
  (void)error;
  attempts += 1;
  return LEAN_ALPHA_STATUS_UNEXPECTED_ERROR;
}

int main(void) {
  lean_alpha_error error = {0};
  const lean_alpha_runtime_v1 runtime = {
    .abi_version = LEAN_ALPHA_BINDING_ABI_VERSION,
    .initialize = fail_initialize,
  };
  lean_alpha_box *box = NULL;
  assert(lean_alpha_runtime_install_v1(&runtime, &error) == LEAN_ALPHA_STATUS_UNEXPECTED_ERROR);
  assert(lean_alpha_runtime_install_v1(&runtime, &error) == LEAN_ALPHA_STATUS_UNEXPECTED_ERROR);
  assert(lean_alpha_box_create(1, &box, &error) == LEAN_ALPHA_STATUS_UNEXPECTED_ERROR);
  assert(attempts == 1);
  assert(box == NULL);
  return 0;
}
`);
    const failedExecutable = join(directory, "failed-init");
    await run("cc", [
      "-std=c11"
      , "-Wall"
      , "-Wextra"
      , "-Werror"
      , "-I", join(directory, "include")
      , "-I", join(directory, "internal")
      , join(directory, "src/lean_alpha.c")
      , join(directory, "failed-init.c")
      , "-o", failedExecutable
    ]);
    await run(failedExecutable);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("finite generic declarations become concrete C functions", () => {
  const ir = clone(alpha.bindingIr);
  const declaration = ir.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.name = "echo";
  declaration.overloadKey = "echo<T>(T)";
  declaration.typeParameters = [{ id: "T", representation: "copied", constraints: [] }];
  declaration.parameters = [{
    name: "value"
    , type: { kind: "parameter", id: "T" }
    , ownership: "copy"
    , lifetime: null
    , mutability: "immutable"
    , optional: false
    , default: null
  }];
  declaration.result = {
    type: { kind: "parameter", id: "T" }
    , ownership: "copy"
    , lifetime: null
  };
  declaration.source.extensions["lean-wasm.org/specializations"] = [
    { id: "uint32", type: { kind: "primitive", name: "uint32" } }
    , { id: "string", type: { kind: "primitive", name: "string" } }
  ];

  const files = generateCBindingPackage(ir);
  assert.match(files["include/lean_alpha.h"], /lean_alpha_echo_uint32\(uint32_t value, uint32_t \*out/);
  assert.match(files["include/lean_alpha.h"], /lean_alpha_echo_string\(const lean_alpha_string \*value, lean_alpha_string \*out/);
  assert.doesNotMatch(files["include/lean_alpha.h"], /\becho\s*\(|type_tag|specialization/);
  assert.match(files["internal/lean_alpha_runtime.h"], /\(\*echo_uint32\)/);
  assert.match(files["internal/lean_alpha_runtime.h"], /\(\*echo_string\)/);
});

test("unsupported asynchronous and open generic surfaces fail before emission", () => {
  const asynchronous = clone(alpha.bindingIr);
  const asyncDeclaration = asynchronous.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  asyncDeclaration.resultMode = "promise";
  asyncDeclaration.effects.push("async");
  assert.throws(
    () => generateCBindingPackage(asynchronous),
    error => error instanceof CBindingGenerationError && error.code === "unsupported-result-mode",
  );

  const generic = clone(alpha.bindingIr);
  const genericDeclaration = generic.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  genericDeclaration.typeParameters = [{ id: "T", representation: "copied", constraints: [] }];
  delete genericDeclaration.source.extensions["lean-wasm.org/specializations"];
  assert.throws(
    () => generateCBindingPackage(generic),
    error => error instanceof CBindingGenerationError && error.code === "missing-generic-specializations",
  );
});
