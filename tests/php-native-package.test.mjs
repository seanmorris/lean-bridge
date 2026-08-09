import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  PhpNativePackageError,
  generatePhpNativePackageSources,
  readPhpNativePackageInputs,
  validatePhpNativePackageManifest,
} from "../src/backends/php/native-package.mjs";

const run = promisify(execFile);
const manifestPath = "poc/lean-link-spike/bindings/php-native.package.json";
const sha256 = value => createHash("sha256").update(value).digest("hex");

const collectFiles = async directory => {
  const files = {};
  const visit = async current => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) files[relative(directory, absolute)] = await readFile(absolute);
    }
  };
  await visit(directory);
  return files;
};

const reservePort = async () => await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(error => error ? reject(error) : resolve(port));
  });
});

const waitForServer = async url => {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`PHP server returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("PHP development server did not become ready", { cause: lastError });
};

test("native PHP package manifest closes every input, target, and output field", async () => {
  const schema = JSON.parse(await readFile("schema/php-native-package.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);

  const inputs = await readPhpNativePackageInputs({
    projectRoot: process.cwd(),
    manifestPath,
  });
  assert.equal(inputs.manifest.bindingIr.semanticSha256, alpha.bindingIrSha256);
  assert.equal(inputs.bindingIr.component.id, alpha.bindingIr.component.id);
  assert.equal(validatePhpNativePackageManifest(inputs.manifest), true);

  const generated = generatePhpNativePackageSources(inputs);
  assert.equal(JSON.parse(generated.composer["binding-manifest.json"]).bindingIrSha256, alpha.bindingIrSha256);
  assert.equal(JSON.parse(generated.zend["zend-manifest.json"]).bindingIrSha256, alpha.bindingIrSha256);
  assert.equal(JSON.parse(generated.runtime["native-runtime-manifest.json"]).bindingIrSha256, alpha.bindingIrSha256);

  const unknown = structuredClone(inputs.manifest);
  unknown.target.vendor = "ambient-default";
  assert.throws(
    () => validatePhpNativePackageManifest(unknown),
    error => error instanceof PhpNativePackageError && error.code === "invalid-native-package-manifest",
  );
  const escaped = structuredClone(inputs.manifest);
  escaped.bindingIr.path = "../alpha.binding-ir.json";
  assert.throws(
    () => validatePhpNativePackageManifest(escaped),
    error => error instanceof PhpNativePackageError && error.code === "invalid-native-package-manifest",
  );
});

test("clean native PHP package rebuilds are byte-identical and run without wrapper code", async context => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-release-"));
  try {
    const first = join(directory, "first");
    const second = join(directory, "second");
    for (const output of [first, second]) {
      await run(process.execPath, [
        "scripts/build-php-native-package.mjs",
        "--manifest", manifestPath,
        "--output", output,
      ], { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024 });
    }

    const firstFiles = await collectFiles(first);
    const secondFiles = await collectFiles(second);
    assert.deepEqual(Object.keys(firstFiles).sort(), Object.keys(secondFiles).sort());
    for (const path of Object.keys(firstFiles)) {
      assert.deepEqual(firstFiles[path], secondFiles[path], `rebuild drift in ${path}`);
    }

    const metadataDirectory = join(first, "share/lean-bridge");
    const release = JSON.parse(await readFile(join(metadataDirectory, "release-manifest.json"), "utf8"));
    assert.equal(release.packageId, "poc/lean-alpha-php-native@0.0.0");
    assert.equal(release.bindingIr.semanticSha256, alpha.bindingIrSha256);
    assert.equal(release.observedTarget.threadSafety, "nts");
    assert.equal(release.observedTarget.architecture, "x86_64");
    assert.equal(release.sharedRuntime.abiVersion, 1);
    assert.equal(release.reproducibility.releaseCriterion, "byte-identical");
    for (const artifact of release.artifacts) {
      assert.equal(sha256(firstFiles[artifact.path]), artifact.sha256);
      assert.equal(firstFiles[artifact.path].length, artifact.bytes);
    }
    const hashLines = (await readFile(join(metadataDirectory, "sha256.txt"), "utf8")).trim().split("\n");
    assert.equal(hashLines.length, Object.keys(firstFiles).length - 1);
    for (const line of hashLines) {
      const match = line.match(/^([0-9a-f]{64})  (.+)$/);
      assert.ok(match);
      assert.equal(sha256(firstFiles[match[2]]), match[1]);
    }

    const runtime = join(first, "lib/liblean_bridge_native.so");
    const extension = join(first, "lib/php/lean_alpha.so");
    const { stdout: dynamicSection } = await run("readelf", ["-d", extension]);
    assert.match(dynamicSection, /Shared library: \[liblean_bridge_native\.so\]/);
    assert.equal((await run("patchelf", ["--print-rpath", extension])).stdout.trim(), "$ORIGIN/..");

    const composerPackage = join(first, "share/php/component");
    await run("composer", ["dump-autoload", "--quiet", "--no-interaction"], { cwd: composerPackage });
    const consumer = join(directory, "consumer.php");
    await writeFile(consumer, `<?php
declare(strict_types=1);
require ${JSON.stringify(join(composerPackage, "vendor/autoload.php"))};

use LeanAlpha\\Box;
use LeanAlpha\\Bytes;
use LeanAlpha\\CallbackThrew;
use LeanAlpha\\DisposedResource;
use LeanAlpha\\Payload;
use function LeanAlpha\\makeAdder;
use function LeanAlpha\\roundTrip;
use function LeanAlpha\\withCallback;

$extension = new ReflectionExtension('lean_alpha');
$transport = new ReflectionClass(LeanAlpha\\Internal\\NativeTransport::class);
$payloadType = new ReflectionClass(Payload::class);
$box = new Box(41);
$payload = roundTrip(new Payload(false, 8, 'release', Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]));
$adder = makeAdder(2);
try {
    withCallback(40, static function (int $value): int {
        throw new RuntimeException("release callback failed at $value");
    });
    $failure = null;
} catch (CallbackThrew $error) {
    $failure = [$error::ID, $error->getPrevious()?->getPrevious()?->getMessage()];
}
$identity = $box->identity() === $box;
$closure = $adder(40);
$box->close();
try {
    $box->read();
    $closed = null;
} catch (DisposedResource $error) {
    $closed = $error::ID;
}
$adder->close();
$snapshot = (new LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
$binding = json_decode(file_get_contents(${JSON.stringify(join(composerPackage, "binding-manifest.json"))}), true, flags: JSON_THROW_ON_ERROR);
$reflection = json_decode(file_get_contents(${JSON.stringify(join(composerPackage, "reflection.json"))}), true, flags: JSON_THROW_ON_ERROR);
echo json_encode([
    'extensionVersion' => $extension->getVersion(),
    'bindingHash' => $transport->getConstant('BINDING_IR_SHA256'),
    'composerHash' => $binding['bindingIrSha256'],
    'reflectionHash' => $reflection['bindingIrSha256'],
    'payloadReadonly' => $payloadType->isReadOnly(),
    'payload' => [$payload->enabled, $payload->count, $payload->label, bin2hex($payload->bytes->toString()), $payload->values],
    'callback' => withCallback(40, static fn(int $value): int => $value),
    'failure' => $failure,
    'identity' => $identity,
    'closure' => $closure,
    'closed' => $closed,
    'liveAfterClose' => $snapshot['liveIdentities'],
    'runtimeInitRuns' => $snapshot['runtimeInitRuns'],
], JSON_THROW_ON_ERROR);
`);
    const execution = await run("php", ["-n", "-d", `extension=${extension}`, consumer]);
    assert.equal(execution.stderr, "");
    assert.deepEqual(JSON.parse(execution.stdout), {
      extensionVersion: "0.0.0",
      bindingHash: alpha.bindingIrSha256,
      composerHash: alpha.bindingIrSha256,
      reflectionHash: alpha.bindingIrSha256,
      payloadReadonly: true,
      payload: [true, 9, "release", "007fff", [1, 5, 13]],
      callback: 42,
      failure: ["error:callback-threw", "release callback failed at 41"],
      identity: true,
      closure: 42,
      closed: "error:disposed-resource",
      liveAfterClose: 0,
      runtimeInitRuns: 1,
    });

    const router = join(directory, "router.php");
    await writeFile(router, `<?php
declare(strict_types=1);
require ${JSON.stringify(join(composerPackage, "vendor/autoload.php"))};
$box = new LeanAlpha\\Box(41);
$value = $box->read();
$box->close();
$snapshot = (new LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
header('Content-Type: application/json');
echo json_encode([
    'value' => $value,
    'runtimeInstanceId' => $snapshot['runtimeInstanceId'],
    'runtimeInitRuns' => $snapshot['runtimeInitRuns'],
    'componentInitRuns' => $snapshot['componentInitRuns'],
    'liveIdentities' => $snapshot['liveIdentities'],
], JSON_THROW_ON_ERROR);
`);
    const port = await reservePort();
    const server = spawn("php", [
      "-n",
      "-d", `extension=${extension}`,
      "-S", `127.0.0.1:${port}`,
      router,
    ], { cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
    let serverErrors = "";
    server.stderr.on("data", chunk => { serverErrors += chunk; });
    try {
      const firstRequest = await waitForServer(`http://127.0.0.1:${port}/first`);
      const secondRequest = await (await fetch(`http://127.0.0.1:${port}/second`)).json();
      assert.deepEqual(firstRequest, secondRequest);
      assert.deepEqual(secondRequest, {
        value: 41,
        runtimeInstanceId: secondRequest.runtimeInstanceId,
        runtimeInitRuns: 1,
        componentInitRuns: 1,
        liveIdentities: 0,
      });
      assert.match(secondRequest.runtimeInstanceId, /^\d+$/);
    } finally {
      server.kill("SIGTERM");
      await new Promise(resolve => server.once("exit", resolve));
    }
    assert.doesNotMatch(serverErrors, /Fatal error|Warning:/);

    context.diagnostic(`native PHP release bytes ${JSON.stringify({
      runtime: firstFiles["lib/liblean_bridge_native.so"].length,
      extension: firstFiles["lib/php/lean_alpha.so"].length,
      files: Object.keys(firstFiles).length,
    })}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
