/**
 * Tests the PHP zend extension behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import { generatePhpNativeRuntimePackage } from "../src/backends/php/native-runtime.mjs";
import {
	PhpZendGenerationError,
	generatePhpZendExtensionPackage,
} from "../src/backends/php/zend-extension.mjs";

const run = promisify(execFile);
const clone = value => structuredClone(value);

const writePackage = async (directory, files) => {
	for(const [relativePath, source] of Object.entries(files))
	{
		const destination = join(directory, relativePath);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, source);
	}
};

const nativeRuntimeFixture = `#include "lean_alpha_runtime.h"
#include "lean_bridge_native_runtime.h"

#include <stdlib.h>
#include <string.h>

static void release_heap(void *owner) { free(owner); }

static uint64_t next_identity = 0;
static uint32_t live_identities = 0;

uint64_t lean_bridge_native_identity_acquire(const char *kind, const void *pointer)
{
    (void)kind;
    if (pointer == NULL) return 0;
    live_identities++;
    return ++next_identity;
}

int lean_bridge_native_identity_release(uint64_t token, const char *kind, const void *pointer)
{
    (void)kind;
    if (token == 0 || pointer == NULL || live_identities == 0) return -1;
    live_identities--;
    return 1;
}

void lean_bridge_native_snapshot_read(lean_bridge_native_snapshot *out)
{
    *out = (lean_bridge_native_snapshot){
        .abi_version = 1,
        .runtime_state = 2,
        .runtime_init_runs = 1,
        .component_init_runs = 1,
        .attached_components = 1,
        .live_identities = live_identities,
        .runtime_instance_id = 101,
        .identity_domain_id = 202,
    };
}

void lean_alpha_native_runtime_detach(void) {}

static void *copy_bytes(const void *source, size_t length)
{
    if (length == 0) return NULL;
    void *copy = malloc(length);
    if (copy != NULL) memcpy(copy, source, length);
    return copy;
}

static lean_alpha_status initialize(void *context, lean_alpha_error *error)
{
    (void)context;
    (void)error;
    return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_create(void *context, uint32_t value, uintptr_t *out, lean_alpha_error *error)
{
    (void)context;
    (void)error;
    *out = (uintptr_t)value + 1u;
    return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_read(void *context, uintptr_t self, uint32_t *out, lean_alpha_error *error)
{
    (void)context;
    if (self == 1000u) {
        error->code = LEAN_ALPHA_ERROR_DISPOSED_RESOURCE;
        error->message = "fixture rejected the resource";
        error->message_length = sizeof("fixture rejected the resource") - 1;
        return LEAN_ALPHA_STATUS_DECLARED_ERROR;
    }
    *out = (uint32_t)(self - 1u);
    return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status box_identity(void *context, uintptr_t self, uintptr_t *out, lean_alpha_error *error)
{
    (void)context;
    (void)error;
    *out = self;
    return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status round_trip(void *context, const lean_alpha_payload *payload, lean_alpha_payload *out, lean_alpha_error *error)
{
    (void)context;
    (void)error;
    char *label = copy_bytes(payload->label.data, payload->label.length);
    uint8_t *bytes = copy_bytes(payload->bytes.data, payload->bytes.length);
    uint32_t *values = copy_bytes(payload->values.data, payload->values.length * sizeof(uint32_t));
    if ((payload->label.length && !label) || (payload->bytes.length && !bytes) || (payload->values.length && !values)) return LEAN_ALPHA_STATUS_UNEXPECTED_ERROR;
    *out = (lean_alpha_payload){
        .enabled = !payload->enabled,
        .count = payload->count + 1u,
        .label = {label, payload->label.length, label, release_heap},
        .bytes = {bytes, payload->bytes.length, bytes, release_heap},
        .values = {values, payload->values.length, values, release_heap},
    };
    return LEAN_ALPHA_STATUS_OK;
}

static lean_alpha_status with_callback(void *context, uint32_t value, const lean_alpha_transform *transform, uint32_t *out, lean_alpha_error *error)
{
    (void)context;
    uint32_t transformed = 0;
    lean_alpha_status status = transform->call(transform->context, value + 1u, &transformed, error);
    if (status == LEAN_ALPHA_STATUS_OK) *out = transformed + 1u;
    return status;
}

static lean_alpha_status make_adder(void *context, uint32_t base, uintptr_t *out, lean_alpha_error *error)
{
    (void)context;
    (void)error;
    *out = (uintptr_t)base;
    return LEAN_ALPHA_STATUS_OK;
}

static void box_dispose(void *context, uintptr_t value) { (void)context; (void)value; }

static lean_alpha_status transform_call(void *context, uintptr_t self, uint32_t value, uint32_t *out, lean_alpha_error *error)
{
    (void)context;
    (void)error;
    *out = (uint32_t)self + value;
    return LEAN_ALPHA_STATUS_OK;
}

static void transform_dispose(void *context, uintptr_t value) { (void)context; (void)value; }

const lean_alpha_runtime_v1 *lean_alpha_native_runtime_v1(void)
{
    static const lean_alpha_runtime_v1 runtime = {
        .abi_version = LEAN_ALPHA_BINDING_ABI_VERSION,
        .initialize = initialize,
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
    return &runtime;
}
`;

test("Zend generator emits one typed handler for every PHP transport operation", () => {
  const files = generatePhpZendExtensionPackage(alpha.bindingIr);
  assert.deepEqual(files, generatePhpZendExtensionPackage(clone(alpha.bindingIr)));
  const manifest = JSON.parse(files["zend-manifest.json"]);
  assert.equal(manifest.bindingIrSha256, alpha.bindingIrSha256);
  assert.equal(manifest.extension, "lean_alpha");
  assert.equal(manifest.transportClass, "LeanAlpha\\Internal\\NativeTransport");
  assert.deepEqual(manifest.operations, [
    "initialize"
    , "leanAlphaBox"
    , "leanAlphaBoxRead"
    , "bridgeAlphaBoxIdentity"
    , "leanAlphaRoundTrip"
    , "leanAlphaWithCallback"
    , "leanAlphaMakeAdder"
    , "boxClose"
    , "transformCall"
    , "transformClose"
  ]);
  assert.deepEqual(manifest.sourceFiles, Object.keys(files).filter(path => path !== "zend-manifest.json").sort());
  for(const [path, hash] of Object.entries(manifest.filesSha256))
{
    assert.equal(createHash("sha256").update(files[path], "utf8").digest("hex"), hash);
}
  for(const operation of manifest.operations.slice(1))
{
    assert.match(files["lean_alpha_zend.c"], new RegExp(`PHP_METHOD\\(LeanAlpha_NativeTransport, ${operation}\\)`));
}
  assert.match(files["lean_alpha_zend.c"], /Z_PARAM_FUNC\(context\.fci, context\.fcc\)/);
  assert.match(files["lean_alpha_zend.c"], /lean_bridge_native_identity_acquire/);
  assert.match(files["lean_alpha_zend.c"], /runtimeSnapshot/);
  assert.match(files["lean_alpha_zend.c"], /lean_alpha_payload_clear\(&output\)/);
  assert.doesNotMatch(files["lean_alpha_zend.c"], /PHP_FUNCTION|\bccall\b|\bcwrap\b|json_/i);

  const unsupported = clone(alpha.bindingIr);
  unsupported.types.find(type => type.id === "lean:Alpha.Payload").fields.push({
    name: "extra"
    , type: { kind: "primitive", name: "uint32" }
    , mutability: "immutable"
    , documentation: { summary: "Unsupported fixture field.", details: "" }
  });
  assert.throws(
    () => generatePhpZendExtensionPackage(unsupported),
    error => error instanceof PhpZendGenerationError && error.code === "unsupported-zend-shape",
  );
});

test("generated Zend extension executes the Composer API without consumer adapters", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zend-"));
  try
{
    const extensionFiles = { ...generatePhpZendExtensionPackage(alpha.bindingIr) };
    const nativeFiles = generatePhpNativeRuntimePackage(alpha.bindingIr);
    extensionFiles["lean_bridge_native_runtime.h"] = nativeFiles["include/lean_bridge_native_runtime.h"];
    extensionFiles["config.m4"] = extensionFiles["config.m4"].replace(
      "src/lean_alpha.c]",
      "src/lean_alpha.c native_runtime_fixture.c]",
    );
    extensionFiles["native_runtime_fixture.c"] = nativeRuntimeFixture;
    await writePackage(directory, extensionFiles);
    await run("phpize", [], { cwd: directory });
    await run("./configure", ["--enable-lean-alpha"], { cwd: directory });
    await run("make", ["-j2"], { cwd: directory });

    const packageDirectory = join(directory, "package");
    await writePackage(packageDirectory, generatePhpBindingPackage(alpha.bindingIr));
    await run("composer", ["dump-autoload", "--quiet", "--no-interaction"], { cwd: packageDirectory });
    await writeFile(join(directory, "consumer.php"), `<?php
declare(strict_types=1);
require __DIR__ . '/package/vendor/autoload.php';

use LeanAlpha\\Box;
use LeanAlpha\\Bytes;
use LeanAlpha\\CallbackThrew;
use LeanAlpha\\DisposedResource;
use LeanAlpha\\Payload;
use function LeanAlpha\\makeAdder;
use function LeanAlpha\\roundTrip;
use function LeanAlpha\\withCallback;

$box = new Box(41);
$same = $box->identity();
$payload = roundTrip(new Payload(false, 8, 'typed', Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]));
$adder = makeAdder(2);
$declared = new Box(999);
try {
    $declared->read();
    $declaredFailure = false;
} catch (DisposedResource $error) {
    $declaredFailure = $error->getMessage() === 'fixture rejected the resource';
}
try {
    withCallback(40, static function (int $value): int {
        throw new RuntimeException("callback failed at $value");
    });
    $callbackFailure = null;
} catch (CallbackThrew $error) {
    $transportError = $error->getPrevious();
    $originalError = $transportError?->getPrevious();
    $callbackFailure = [
        $error->getMessage(),
        $originalError?->getMessage(),
        $originalError instanceof RuntimeException,
    ];
}
$trace = [
    'read' => $box->read(),
    'identity' => $same === $box,
    'payload' => [$payload->enabled, $payload->count, $payload->label, bin2hex($payload->bytes->toString()), $payload->values],
    'callback' => withCallback(40, static fn(int $value): int => $value),
    'callbackFailure' => $callbackFailure,
    'usableAfterCallbackFailure' => $box->read(),
    'closure' => $adder(40),
    'declared' => $declaredFailure,
    'hash' => \\LeanAlpha\\Internal\\NativeTransport::BINDING_IR_SHA256,
    'runtime' => (new \\LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot(),
];
$adder->close();
$declared->close();
$box->close();
echo json_encode($trace, JSON_THROW_ON_ERROR);
`);
    const extension = join(directory, "modules", "lean_alpha.so");
    const { stdout, stderr } = await run("php", ["-n", "-d", `extension=${extension}`, "consumer.php"], { cwd: directory });
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(stdout), {
      read: 41
      , identity: true
      , payload: [true, 9, "typed", "007fff", [1, 5, 13]]
      , callback: 42
      , callbackFailure: ["PHP callback threw", "callback failed at 41", true]
      , usableAfterCallbackFailure: 41
      , closure: 42
      , declared: true
      , hash: alpha.bindingIrSha256
      , runtime: {
        abiVersion: 1
        , runtimeState: 2
        , runtimeInitRuns: 1
        , componentInitRuns: 1
        , attachedComponents: 1
        , liveIdentities: 3
        , runtimeInstanceId: "101"
        , identityDomainId: "202"
      }
    });
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});
