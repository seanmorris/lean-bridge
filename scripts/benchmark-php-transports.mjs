#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { collectReleaseTree } from "../src/release/reproducibility.mjs";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!name?.startsWith("--") || !value) throw new Error(`invalid option ${name ?? ""}`);
  options.set(name, value);
}
const pathOption = (name, fallback) => resolve(projectRoot, options.get(name) ?? fallback);
const reportDirectory = pathOption("--output", "build/php-performance");
const phpSource = pathOption("--php-source", "build/php-wasm-sdk/php8.4-src");
const emsdk = pathOption("--emsdk", ".toolchains/emsdk-php-wasm");
const phpWasmRoot = pathOption("--php-wasm", "build/php-wasm-host/node_modules/php-wasm");
const supplied = {
  native: options.has("--native-package") ? pathOption("--native-package") : null,
  lazy: options.has("--lazy-package") ? pathOption("--lazy-package") : null,
  startup: options.has("--startup-package") ? pathOption("--startup-package") : null,
};
if (new Set(Object.values(supplied).map(Boolean)).size > 1) {
  throw new Error("--native-package, --lazy-package, and --startup-package must be supplied together");
}

const run = async (command, args, runOptions = {}) => execute(command, args, {
  cwd: projectRoot,
  maxBuffer: 64 * 1024 * 1024,
  ...runOptions,
});

const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};
const summary = values => ({
  samples: values.length,
  median: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  min: Math.min(...values),
  max: Math.max(...values),
});
const packageSize = async directory => {
  const files = await collectReleaseTree(directory);
  return {
    files: files.size,
    bytes: [...files.values()].reduce((total, bytes) => total + bytes.length, 0),
  };
};

const iterations = Object.freeze({ warmup: 1_000, reads: 20_000, callbacks: 3_000, copiedValues: 2_000, cleanup: 3_000 });
const phpIterations = `[${Object.entries(iterations).map(([name, count]) => `'${name}' => ${count}`).join(", ")}]`;
const logicalCopiedBytes = 1 + 4 + 9 + 3 + (3 * 4);
const benchmarkPhp = `<?php
$packageRoot = getenv('LEAN_BRIDGE_BENCHMARK_PACKAGE_ROOT') ?: '/vendor';
$autoload = getenv('LEAN_BRIDGE_BENCHMARK_AUTOLOAD') ?: $packageRoot . '/autoload.php';
$autoloadStart = hrtime(true);
require_once $autoload;
$autoloadNanoseconds = hrtime(true) - $autoloadStart;

$firstStart = hrtime(true);
$firstBox = new LeanAlpha\\Box(41);
$firstValue = $firstBox->read();
$firstBox->close();
$firstAlphaNanoseconds = hrtime(true) - $firstStart;

$betaFirstNanoseconds = null;
if (function_exists('LeanBeta\\read')) {
    $betaBox = new LeanAlpha\\Box(41);
    $betaStart = hrtime(true);
    $betaValue = LeanBeta\\read($betaBox);
    $betaIdentity = LeanBeta\\identity($betaBox) === $betaBox;
    $betaFirstNanoseconds = hrtime(true) - $betaStart;
    if ($betaValue !== 41 || !$betaIdentity) throw new RuntimeException('Beta benchmark identity failed');
    $betaBox->close();
}

for ($index = 0; $index < ${iterations.warmup}; ++$index) {
    $box = new LeanAlpha\\Box($index);
    $box->read();
    $box->close();
}

$checksum = $firstValue;
$retained = new LeanAlpha\\Box(73);
$start = hrtime(true);
for ($index = 0; $index < ${iterations.reads}; ++$index) $checksum += $retained->read();
$warmReadNanoseconds = hrtime(true) - $start;
$retained->close();

$callback = static fn(int $value): int => $value;
$start = hrtime(true);
for ($index = 0; $index < ${iterations.callbacks}; ++$index) $checksum += LeanAlpha\\withCallback(40, $callback);
$callbackNanoseconds = hrtime(true) - $start;

$payload = new LeanAlpha\\Payload(false, 8, 'benchmark', LeanAlpha\\Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]);
$start = hrtime(true);
for ($index = 0; $index < ${iterations.copiedValues}; ++$index) {
    $copy = LeanAlpha\\roundTrip($payload);
    $checksum += $copy->count;
}
$copiedNanoseconds = hrtime(true) - $start;

$start = hrtime(true);
for ($index = 0; $index < ${iterations.cleanup}; ++$index) {
    $box = new LeanAlpha\\Box($index);
    $box->close();
}
$cleanupNanoseconds = hrtime(true) - $start;

$snapshot = (new LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
$status = @file_get_contents('/proc/self/status');
$rssKiB = null;
$peakRssKiB = null;
if (is_string($status)) {
    if (preg_match('/^VmRSS:\\s+(\\d+) kB$/m', $status, $match)) $rssKiB = (int) $match[1];
    if (preg_match('/^VmHWM:\\s+(\\d+) kB$/m', $status, $match)) $peakRssKiB = (int) $match[1];
}
if ($checksum === 0 || $snapshot['liveIdentities'] !== 0) throw new RuntimeException('benchmark cleanup failed');
echo json_encode([
    'iterations' => ${phpIterations},
    'logicalCopiedBytesPerCall' => ${logicalCopiedBytes},
    'measurements' => [
        'autoloadMilliseconds' => $autoloadNanoseconds / 1000000,
        'firstAlphaCallMicroseconds' => $firstAlphaNanoseconds / 1000,
        'firstBetaCallMicroseconds' => $betaFirstNanoseconds === null ? null : $betaFirstNanoseconds / 1000,
        'warmReadNanosecondsPerCall' => $warmReadNanoseconds / ${iterations.reads},
        'callbackNanosecondsPerCall' => $callbackNanoseconds / ${iterations.callbacks},
        'copiedValueMicrosecondsPerCall' => ($copiedNanoseconds / ${iterations.copiedValues}) / 1000,
        'copiedValueCallsPerSecond' => ${iterations.copiedValues} / ($copiedNanoseconds / 1000000000),
        'logicalCopiedBytesPerSecond' => (${iterations.copiedValues} * ${logicalCopiedBytes}) / ($copiedNanoseconds / 1000000000),
        'cleanupMicrosecondsPerObject' => ($cleanupNanoseconds / ${iterations.cleanup}) / 1000,
    ],
    'memory' => [
        'phpCurrentBytes' => memory_get_usage(true),
        'phpPeakBytes' => memory_get_peak_usage(true),
        'processRssKiB' => $rssKiB,
        'processPeakRssKiB' => $peakRssKiB,
    ],
    'runtime' => $snapshot,
], JSON_THROW_ON_ERROR);
`;

const runNative = async ({ packageRoot, scratch }) => {
  const composerRoot = join(packageRoot, "share/php/component");
  const extension = join(packageRoot, "lib/php/lean_alpha.so");
  const size = await packageSize(packageRoot);
  await run("composer", ["dump-autoload", "--quiet", "--no-interaction"], { cwd: composerRoot });
  const startupProbe = join(scratch, "native-startup.php");
  await writeFile(startupProbe, `<?php require ${JSON.stringify(join(composerRoot, "vendor/autoload.php"))}; echo "ok";\n`);
  const startupMilliseconds = [];
  for (let sample = 0; sample < 5; sample += 1) {
    const start = performance.now();
    const { stdout } = await run("php", ["-n", "-d", `extension=${extension}`, startupProbe]);
    if (stdout !== "ok") throw new Error("native PHP startup probe failed");
    startupMilliseconds.push(performance.now() - start);
  }
  const sourcePath = join(scratch, "native-benchmark.php");
  await writeFile(sourcePath, benchmarkPhp);
  const { stdout, stderr } = await run("php", ["-n", "-d", `extension=${extension}`, sourcePath], {
    env: {
      ...process.env,
      LEAN_BRIDGE_BENCHMARK_PACKAGE_ROOT: composerRoot,
      LEAN_BRIDGE_BENCHMARK_AUTOLOAD: join(composerRoot, "vendor/autoload.php"),
    },
  });
  if (stderr !== "") throw new Error(`native PHP benchmark wrote stderr: ${stderr}`);
  return {
    transport: "native-zend",
    startup: { processExtensionAndAutoloadMilliseconds: summary(startupMilliseconds) },
    package: size,
    ...JSON.parse(stdout),
  };
};

const runPhpWasm = async ({ profile, packageRoot }) => {
  const importStart = performance.now();
  const [{ PhpNode }, { default: descriptor }] = await Promise.all([
    import(pathToFileURL(join(phpWasmRoot, "PhpNode.mjs"))),
    import(`${pathToFileURL(join(packageRoot, "index.mjs")).href}?benchmark=${profile}-${Date.now()}`),
  ]);
  const descriptorImportMilliseconds = performance.now() - importStart;
  const moduleFactoryMilliseconds = [];
  const firstRequestMilliseconds = [];
  let benchmarkPhpNode;
  let benchmarkModule;
  for (let sample = 0; sample < 3; sample += 1) {
    const php = new PhpNode({ version: "8.4", sharedLibs: [descriptor] });
    let stdout = "";
    let stderr = "";
    php.addEventListener("output", event => { for (const line of event.detail) stdout += line; });
    php.addEventListener("error", event => { for (const line of event.detail) stderr += line; });
    const factoryStart = performance.now();
    const module = await php.binary;
    moduleFactoryMilliseconds.push(performance.now() - factoryStart);
    const requestStart = performance.now();
    const status = await php.run("<?php require_once '/vendor/autoload.php'; echo 'ok';");
    firstRequestMilliseconds.push(performance.now() - requestStart);
    if (status !== 0 || stderr !== "" || stdout !== "ok") throw new Error(`${profile} startup request failed: ${stderr || stdout}`);
    benchmarkPhpNode = php;
    benchmarkModule = module;
  }
  let stdout = "";
  let stderr = "";
  benchmarkPhpNode.addEventListener("output", event => { for (const line of event.detail) stdout += line; });
  benchmarkPhpNode.addEventListener("error", event => { for (const line of event.detail) stderr += line; });
  const status = await benchmarkPhpNode.run(benchmarkPhp);
  if (status !== 0 || stderr !== "") throw new Error(`${profile} benchmark failed: ${stderr || stdout}`);
  return {
    transport: profile,
    startup: {
      descriptorImportMilliseconds,
      moduleFactoryMilliseconds: summary(moduleFactoryMilliseconds),
      firstRequestMilliseconds: summary(firstRequestMilliseconds),
    },
    package: await packageSize(packageRoot),
    hostMemory: {
      wasmLinearMemoryBytes: benchmarkModule.HEAPU8.buffer.byteLength,
      nodeProcessRssBytesAfterThreeInstances: process.memoryUsage().rss,
    },
    ...JSON.parse(stdout),
  };
};

const markdownFor = report => {
  const rows = report.profiles.map(profile => {
    const startup = profile.transport === "native-zend"
      ? profile.startup.processExtensionAndAutoloadMilliseconds.median
      : profile.startup.moduleFactoryMilliseconds.median + profile.startup.firstRequestMilliseconds.median;
    const beta = profile.measurements.firstBetaCallMicroseconds === null
      ? "n/a"
      : `${profile.measurements.firstBetaCallMicroseconds.toFixed(3)} µs`;
    return `| ${profile.transport} | ${startup.toFixed(3)} ms | ${profile.measurements.firstAlphaCallMicroseconds.toFixed(3)} µs | ${beta} | ${profile.measurements.warmReadNanosecondsPerCall.toFixed(1)} ns | ${profile.measurements.callbackNanosecondsPerCall.toFixed(1)} ns | ${profile.measurements.copiedValueCallsPerSecond.toFixed(0)} calls/s | ${profile.measurements.cleanupMicrosecondsPerObject.toFixed(3)} µs | ${profile.package.bytes} |`;
  }).join("\n");
  return `# PHP Transport Performance Baseline

Status: measured POC evidence on one machine. The native startup value includes the PHP process, extension, and Composer autoload. Each PHP-Wasm startup value adds module factory time and the first PHP request. These paths are useful deployment observations, but they are not identical operations.

| Profile | Startup median | First Alpha call | First Beta call | Warm read | Callback | Copied-value throughput | Cleanup | Package bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

The copied-value fixture crosses \`Bool\`, \`UInt32\`, \`String\`, \`ByteArray\`, and \`Array UInt32\` through the generated typed frame. The logical byte rate counts ${report.method.logicalCopiedBytesPerCall} payload bytes per call. It excludes frame headers and wrapper allocation, so use calls per second for cross-version comparisons.

Every profile ended with zero live retained identities. PHP-Wasm used one ${report.profiles.find(profile => profile.transport === "php-wasm-lazy").hostMemory.wasmLinearMemoryBytes}-byte linear memory per instance. The Node RSS field is the process total after three live PhpNode instances, so it is not a per-instance allocation measurement.

Reproduce the measurements with:

\`\`\`sh
npm run benchmark:php
\`\`\`
`;
};

await mkdir(join(projectRoot, "build"), { recursive: true });
const scratch = supplied.native ? null : await mkdtemp(join(projectRoot, "build/php-performance-run-"));
const packages = supplied.native ? supplied : {
  native: join(scratch, "native"),
  lazy: join(scratch, "lazy"),
  startup: join(scratch, "startup"),
};
try {
  if (scratch) {
    await run(process.execPath, [
      "scripts/build-php-native-package.mjs",
      "--manifest", "poc/lean-link-spike/bindings/php-native.package.json",
      "--output", packages.native,
    ]);
    const baseManifest = JSON.parse(await readFile(join(projectRoot, "poc/lean-link-spike/bindings/php-wasm.package.json"), "utf8"));
    for (const [name, graphProfile] of [["lazy", "side-lazy"], ["startup", "side-startup"]]) {
      const manifest = structuredClone(baseManifest);
      manifest.graphLock.profile = graphProfile;
      const manifestPath = join(scratch, `${name}.package.json`);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await run(process.execPath, [
        "scripts/build-php-wasm-package.mjs",
        "--manifest", manifestPath,
        "--output", packages[name],
        "--php-source", phpSource,
        "--emsdk", emsdk,
      ]);
    }
  }
  const benchmarkScratch = scratch ?? await mkdtemp(join(projectRoot, "build/php-performance-source-"));
  const profiles = [];
  profiles.push(await runNative({ packageRoot: packages.native, scratch: benchmarkScratch }));
  profiles.push(await runPhpWasm({ profile: "php-wasm-lazy", packageRoot: packages.lazy }));
  profiles.push(await runPhpWasm({ profile: "php-wasm-startup", packageRoot: packages.startup }));
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    scope: "generated PHP API through native Zend, lazy PHP-Wasm, and startup PHP-Wasm",
    environment: {
      platform: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      node: process.version,
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
    },
    method: { ...iterations, logicalCopiedBytesPerCall: logicalCopiedBytes },
    profiles,
    limitations: [
      "The measurements use PHP CLI and PhpNode on one sandbox host. They do not measure a browser, network transfer, compression, Nginx, Apache, or PHP-FPM.",
      "Native and PHP-Wasm startup cover their ordinary deployment paths, which perform different host work.",
      "The copied byte rate counts logical payload bytes and excludes typed-frame headers and host wrapper allocation.",
      "The fixture covers one component API and one cross-component Beta call. It is not the planned 50-library slope suite.",
    ],
  };
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(join(reportDirectory, "performance.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(reportDirectory, "performance.md"), markdownFor(report));
  process.stdout.write(`PHP transport performance recorded for ${profiles.map(profile => profile.transport).join(", ")}.\n`);
  if (!scratch) await rm(benchmarkScratch, { recursive: true, force: true });
} finally {
  if (scratch) await rm(scratch, { recursive: true, force: true });
}
