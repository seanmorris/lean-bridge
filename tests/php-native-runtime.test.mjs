import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import {
  PhpNativeRuntimeGenerationError,
  generatePhpNativeRuntimePackage,
} from "../src/backends/php/native-runtime.mjs";
import { generatePhpZendExtensionPackage } from "../src/backends/php/zend-extension.mjs";

const run = promisify(execFile);

const writePackage = async (directory, files) => {
  for (const [relativePath, source] of Object.entries(files)) {
    const destination = join(directory, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
};

const parseFacts = output => Object.fromEntries(output
  .split("\n")
  .map(line => line.match(/^([a-z_]+)=(.*)$/))
  .filter(Boolean)
  .map(match => [match[1], match[2]]));

const configureExtension = ({ config, sources, leanIncludes, runtimeDirectory, variable }) => config.replace(
  /  PHP_NEW_EXTENSION\([^\n]+/,
  [
    ...leanIncludes.map(include => `  PHP_ADD_INCLUDE([${include}])`),
    `  PHP_ADD_LIBRARY_WITH_PATH([lean_bridge_native], [${runtimeDirectory}], [${variable}])`,
    `  PHP_SUBST([${variable}])`,
    `  PHP_NEW_EXTENSION([${variable === "LEAN_ALPHA_SHARED_LIBADD" ? "lean_alpha" : "lean_beta_probe"}], [${sources.join(" ")}], [$ext_shared])`,
  ].join("\n"),
);

const betaProbeSource = `#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include "Zend/zend_exceptions.h"
#include "lean_bridge_native_runtime.h"

#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>

#ifdef ZTS
#error "The native Lean runtime POC requires non-thread-safe PHP"
#endif

extern void *initialize_RuntimeProbe(uint8_t builtin);
extern uint32_t lean_link_php_runtime_probe_ping(uint32_t value);

static const char component_id[] = "poc/php-runtime-probe@0.0.0";
static zend_class_entry *probe_ce;

static void snapshot_result(zval *return_value)
{
    lean_bridge_native_snapshot snapshot = {0};
    lean_bridge_native_snapshot_read(&snapshot);
    char runtime_id[32], identity_id[32];
    snprintf(runtime_id, sizeof(runtime_id), "%" PRIu64, snapshot.runtime_instance_id);
    snprintf(identity_id, sizeof(identity_id), "%" PRIu64, snapshot.identity_domain_id);
    array_init(return_value);
    add_assoc_long(return_value, "abiVersion", snapshot.abi_version);
    add_assoc_long(return_value, "runtimeState", snapshot.runtime_state);
    add_assoc_long(return_value, "runtimeInitRuns", snapshot.runtime_init_runs);
    add_assoc_long(return_value, "componentInitRuns", snapshot.component_init_runs);
    add_assoc_long(return_value, "attachedComponents", snapshot.attached_components);
    add_assoc_long(return_value, "liveIdentities", snapshot.live_identities);
    add_assoc_string(return_value, "runtimeInstanceId", runtime_id);
    add_assoc_string(return_value, "identityDomainId", identity_id);
}

ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_initialize, 0, 0, IS_VOID, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_snapshot, 0, 0, IS_ARRAY, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_ping, 0, 1, IS_LONG, 0)
    ZEND_ARG_TYPE_INFO(0, value, IS_LONG, 0)
ZEND_END_ARG_INFO()

PHP_METHOD(LeanBetaProbe, initialize)
{
    ZEND_PARSE_PARAMETERS_NONE();
    if (!lean_bridge_native_component_initialize(component_id, initialize_RuntimeProbe)) {
        zend_throw_exception(zend_ce_error, "shared Lean runtime rejected the probe component", 0);
        RETURN_THROWS();
    }
}

PHP_METHOD(LeanBetaProbe, snapshot)
{
    ZEND_PARSE_PARAMETERS_NONE();
    snapshot_result(return_value);
}

PHP_METHOD(LeanBetaProbe, ping)
{
    zend_long value;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(value) ZEND_PARSE_PARAMETERS_END();
    if (value < 0 || (zend_ulong)value > UINT32_MAX) {
        zend_throw_exception(zend_ce_value_error, "value must fit UInt32", 0);
        RETURN_THROWS();
    }
    RETURN_LONG(lean_link_php_runtime_probe_ping((uint32_t)value));
}

static const zend_function_entry probe_methods[] = {
    PHP_ME(LeanBetaProbe, initialize, arginfo_initialize, ZEND_ACC_PUBLIC | ZEND_ACC_STATIC)
    PHP_ME(LeanBetaProbe, snapshot, arginfo_snapshot, ZEND_ACC_PUBLIC | ZEND_ACC_STATIC)
    PHP_ME(LeanBetaProbe, ping, arginfo_ping, ZEND_ACC_PUBLIC | ZEND_ACC_STATIC)
    PHP_FE_END
};

PHP_MINIT_FUNCTION(lean_beta_probe)
{
    zend_class_entry ce;
    INIT_NS_CLASS_ENTRY(ce, "LeanBeta\\\\Internal", "RuntimeProbe", probe_methods);
    probe_ce = zend_register_internal_class(&ce);
    probe_ce->ce_flags |= ZEND_ACC_FINAL;
    return SUCCESS;
}

PHP_MSHUTDOWN_FUNCTION(lean_beta_probe)
{
    lean_bridge_native_component_detach(component_id);
    return SUCCESS;
}

zend_module_entry lean_beta_probe_module_entry = {
    STANDARD_MODULE_HEADER,
    "lean_beta_probe",
    NULL,
    PHP_MINIT(lean_beta_probe),
    PHP_MSHUTDOWN(lean_beta_probe),
    NULL,
    NULL,
    NULL,
    "0.0.0-poc",
    STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_LEAN_BETA_PROBE
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(lean_beta_probe)
#endif
`;

test("native runtime generator emits one process broker and a hash-bound component provider", () => {
  const files = generatePhpNativeRuntimePackage(alpha.bindingIr);
  const manifest = JSON.parse(files["native-runtime-manifest.json"]);
  assert.equal(manifest.bindingIrSha256, alpha.bindingIrSha256);
  assert.equal(manifest.ownershipScope, "php-process");
  assert.equal(manifest.sharedRuntimeAbi, 1);
  assert.deepEqual(manifest.sourceFiles, [
    "include/lean_bridge_native_runtime.h",
    "src/lean_alpha_native.c",
    "src/lean_bridge_native_runtime.c",
  ]);
  for (const [path, hash] of Object.entries(manifest.filesSha256)) {
    assert.equal(createHash("sha256").update(files[path], "utf8").digest("hex"), hash);
  }
  assert.match(files["src/lean_bridge_native_runtime.c"], /runtime_init_runs\+\+/);
  assert.match(files["src/lean_bridge_native_runtime.c"], /lean_bridge_native_identity_acquire/);
  assert.match(files["src/lean_alpha_native.c"], /lean_link_alpha_round_trip/);
  assert.doesNotMatch(files["src/lean_alpha_native.c"], /json|ccall|cwrap/i);

  const unsupported = structuredClone(alpha.bindingIr);
  unsupported.types.find(type => type.id === "lean:Alpha.Payload").fields.push({
    name: "extra",
    type: { kind: "primitive", name: "uint32" },
    mutability: "immutable",
    documentation: { summary: "Unsupported fixture field.", details: "" },
  });
  assert.throws(
    () => generatePhpNativeRuntimePackage(unsupported),
    error => error instanceof PhpNativeRuntimeGenerationError && error.code === "unsupported-native-runtime-shape",
  );
});

test("two native PHP components execute through one real Lean runtime and identity domain", async context => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-php-"));
  try {
    const { stdout: buildOutput } = await run("bash", [join(process.cwd(), "scripts/build-lean-native-runtime.sh")], {
      cwd: process.cwd(),
      maxBuffer: 16 * 1024 * 1024,
    });
    const facts = parseFacts(buildOutput);
    assert.ok(facts.native_runtime_archive);
    assert.ok(facts.lean_init_archive);
    assert.ok(facts.lean_include_dir);
    assert.ok(facts.lean_config_include_dir);
    const leanExecutable = join(dirname(facts.lean_include_dir), "bin/lean");

    const generated = generatePhpNativeRuntimePackage(alpha.bindingIr);
    const runtimeDirectory = join(directory, "runtime");
    await writePackage(runtimeDirectory, generated);
    const runtimeLibraryDirectory = join(runtimeDirectory, "lib");
    await mkdir(runtimeLibraryDirectory, { recursive: true });
    const brokerObject = join(runtimeDirectory, "lean_bridge_native_runtime.o");
    await run("clang", [
      "-O2", "-fPIC", "-I", join(runtimeDirectory, "include"), "-I", facts.lean_config_include_dir, "-I", facts.lean_include_dir,
      "-c", join(runtimeDirectory, "src/lean_bridge_native_runtime.c"), "-o", brokerObject,
    ]);
    const runtimeLibrary = join(runtimeLibraryDirectory, "liblean_bridge_native.so");
    await run("clang++", [
      "-shared", brokerObject,
      "-Wl,--whole-archive", facts.lean_init_archive, facts.native_runtime_archive, "-Wl,--no-whole-archive",
      "-pthread", "-luv", "-ldl", "-Wl,-soname,liblean_bridge_native.so", "-o", runtimeLibrary,
    ]);

    const alphaDirectory = join(directory, "alpha");
    const alphaFiles = { ...generatePhpZendExtensionPackage(alpha.bindingIr) };
    alphaFiles["lean_bridge_native_runtime.h"] = generated["include/lean_bridge_native_runtime.h"];
    alphaFiles["src/lean_alpha_native.c"] = generated["src/lean_alpha_native.c"];
    alphaFiles["config.m4"] = configureExtension({
      config: alphaFiles["config.m4"],
      sources: ["lean_alpha_zend.c", "src/lean_alpha.c", "src/lean_alpha_native.c", "Alpha.c"],
      leanIncludes: [facts.lean_config_include_dir, facts.lean_include_dir],
      runtimeDirectory: runtimeLibraryDirectory,
      variable: "LEAN_ALPHA_SHARED_LIBADD",
    });
    await writePackage(alphaDirectory, alphaFiles);
    await run(leanExecutable, [
      "-R", join(process.cwd(), "poc/lean-link-spike"),
      "-o", join(alphaDirectory, "Alpha.olean"),
      "-c", join(alphaDirectory, "Alpha.c"),
      join(process.cwd(), "poc/lean-link-spike/Alpha.lean"),
    ]);
    await run("phpize", [], { cwd: alphaDirectory });
    await run("./configure", ["--enable-lean-alpha"], { cwd: alphaDirectory });
    await run("make", ["-j2"], { cwd: alphaDirectory });

    const betaDirectory = join(directory, "beta");
    await writePackage(betaDirectory, {
      "config.m4": configureExtension({
        config: `PHP_ARG_ENABLE([lean-beta-probe], [whether to enable the Lean beta probe], [AS_HELP_STRING([--enable-lean-beta-probe], [Enable the Lean beta probe])], [no])\nif test "$PHP_LEAN_BETA_PROBE" != "no"; then\n  PHP_NEW_EXTENSION([lean_beta_probe], [lean_beta_probe.c RuntimeProbe.c], [$ext_shared])\nfi\n`,
        sources: ["lean_beta_probe.c", "RuntimeProbe.c"],
        leanIncludes: [facts.lean_config_include_dir, facts.lean_include_dir],
        runtimeDirectory: runtimeLibraryDirectory,
        variable: "LEAN_BETA_PROBE_SHARED_LIBADD",
      }),
      "lean_beta_probe.c": betaProbeSource,
      "lean_bridge_native_runtime.h": generated["include/lean_bridge_native_runtime.h"],
    });
    await run(leanExecutable, [
      "-R", join(process.cwd(), "poc/php-native-runtime"),
      "-o", join(betaDirectory, "RuntimeProbe.olean"),
      "-c", join(betaDirectory, "RuntimeProbe.c"),
      join(process.cwd(), "poc/php-native-runtime/RuntimeProbe.lean"),
    ]);
    await run("phpize", [], { cwd: betaDirectory });
    await run("./configure", ["--enable-lean-beta-probe"], { cwd: betaDirectory });
    await run("make", ["-j2"], { cwd: betaDirectory });

    const packageDirectory = join(directory, "package");
    await writePackage(packageDirectory, generatePhpBindingPackage(alpha.bindingIr));
    await run("composer", ["dump-autoload", "--quiet", "--no-interaction"], { cwd: packageDirectory });
    await writeFile(join(directory, "consumer.php"), `<?php
declare(strict_types=1);
require __DIR__ . '/package/vendor/autoload.php';

use LeanAlpha\\Box;
use LeanAlpha\\Bytes;
use LeanAlpha\\CallbackThrew;
use LeanAlpha\\Payload;
use function LeanAlpha\\makeAdder;
use function LeanAlpha\\roundTrip;
use function LeanAlpha\\withCallback;

$box = new Box(41);
$payload = roundTrip(new Payload(false, 8, 'native', Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]));
$adder = makeAdder(2);
try {
    withCallback(40, static function (int $value): int {
        throw new RuntimeException("real callback failed at $value");
    });
    $callbackFailure = null;
} catch (CallbackThrew $error) {
    $callbackFailure = $error->getPrevious()?->getPrevious()?->getMessage();
}
\\LeanBeta\\Internal\\RuntimeProbe::initialize();
$alphaSnapshot = (new \\LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
$betaSnapshot = \\LeanBeta\\Internal\\RuntimeProbe::snapshot();
$temporary = new Box(7);
$withTemporary = (new \\LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot()['liveIdentities'];
unset($temporary);
gc_collect_cycles();
$afterFallback = (new \\LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot()['liveIdentities'];
$trace = [
    'read' => $box->read(),
    'identity' => $box->identity() === $box,
    'payload' => [$payload->enabled, $payload->count, $payload->label, bin2hex($payload->bytes->toString()), $payload->values],
    'callback' => withCallback(40, static fn(int $value): int => $value),
    'callbackFailure' => $callbackFailure,
    'usableAfterCallbackFailure' => $box->read(),
    'closure' => $adder(40),
    'probe' => \\LeanBeta\\Internal\\RuntimeProbe::ping(40),
    'sameRuntime' => $alphaSnapshot['runtimeInstanceId'] === $betaSnapshot['runtimeInstanceId'],
    'sameIdentityDomain' => $alphaSnapshot['identityDomainId'] === $betaSnapshot['identityDomainId'],
    'runtimeInitRuns' => $betaSnapshot['runtimeInitRuns'],
    'componentInitRuns' => $betaSnapshot['componentInitRuns'],
    'attachedComponents' => $betaSnapshot['attachedComponents'],
    'liveIdentitySlope' => [$alphaSnapshot['liveIdentities'], $withTemporary, $afterFallback],
];
$adder->close();
$box->close();
$trace['liveAfterClose'] = (new \\LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot()['liveIdentities'];
echo json_encode($trace, JSON_THROW_ON_ERROR);
`);

    const alphaExtension = join(alphaDirectory, "modules/lean_alpha.so");
    const betaExtension = join(betaDirectory, "modules/lean_beta_probe.so");
    const phpEnvironment = {
      ...process.env,
      LD_LIBRARY_PATH: [runtimeLibraryDirectory, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
    };
    let execution;
    try {
      execution = await run("php", [
        "-n",
        "-d", `extension=${alphaExtension}`,
        "-d", `extension=${betaExtension}`,
        "consumer.php",
      ], { cwd: directory, env: phpEnvironment });
    } catch (error) {
      throw new Error(`native PHP consumer failed\nstdout:\n${error.stdout ?? ""}\nstderr:\n${error.stderr ?? ""}`, { cause: error });
    }
    const { stdout, stderr } = execution;
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(stdout), {
      read: 41,
      identity: true,
      payload: [true, 9, "native", "007fff", [1, 5, 13]],
      callback: 42,
      callbackFailure: "real callback failed at 41",
      usableAfterCallbackFailure: 41,
      closure: 42,
      probe: 42,
      sameRuntime: true,
      sameIdentityDomain: true,
      runtimeInitRuns: 1,
      componentInitRuns: 2,
      attachedComponents: 2,
      liveIdentitySlope: [2, 3, 2],
      liveAfterClose: 0,
    });

    for (const extension of [alphaExtension, betaExtension]) {
      const { stdout: dynamicSection } = await run("readelf", ["-d", extension]);
      assert.match(dynamicSection, /Shared library: \[liblean_bridge_native\.so\]/);
    }
    const sizes = {
      sharedRuntime: (await stat(runtimeLibrary)).size,
      alphaExtension: (await stat(alphaExtension)).size,
      betaExtension: (await stat(betaExtension)).size,
    };
    assert.ok(sizes.sharedRuntime > sizes.alphaExtension);
    context.diagnostic(`native PHP artifact bytes ${JSON.stringify(sizes)}`);
    assert.match(await readFile(join(facts.build_root, "audit/build-facts.txt"), "utf8"), /tls_model=initial-exec/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
