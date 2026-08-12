#!/usr/bin/env node

import { execFile } from "node:child_process";
import { chmod, cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  STEADY_STATE_BOX_VALUE,
  STEADY_STATE_MEASURED_ITERATIONS,
  STEADY_STATE_OPERATION,
  STEADY_STATE_WARMUP_ITERATIONS,
  writeConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";

const option = name => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};

const packageRoot = resolve(option("--package") ?? "build/consumer-php-native");
const run = promisify(execFile);
const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-native-consumer-"));

const makeWritable = async path => {
  await chmod(path, 0o755);
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await makeWritable(child);
    else await chmod(child, 0o644);
  }
};

try {
  const composerPackage = join(consumer, "component");
  await cp(join(packageRoot, "share/php/component"), composerPackage, { recursive: true });
  await makeWritable(composerPackage);
  await run("composer", [
    "dump-autoload",
    "--working-dir", composerPackage,
    "--no-interaction",
    "--no-scripts",
    "--quiet",
  ], { maxBuffer: 16 * 1024 * 1024 });

  const program = join(consumer, "index.php");
  await writeFile(program, `<?php
declare(strict_types=1);

require __DIR__ . '/component/vendor/autoload.php';

use LeanAlpha\\Box;
use LeanAlpha\\Bytes;
use LeanAlpha\\Payload;
use function LeanAlpha\\makeAdder;
use function LeanAlpha\\roundTrip;
use function LeanAlpha\\withCallback;

$box = new Box(${STEADY_STATE_BOX_VALUE});
$same = $box->identity();
$payload = roundTrip(new Payload(false, 8, 'consumer', Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]));
$addTwo = makeAdder(2);
$iterations = ${STEADY_STATE_MEASURED_ITERATIONS};
for ($index = 0; $index < ${STEADY_STATE_WARMUP_ITERATIONS}; ++$index) $box->read();
$checksum = 0;
$started = hrtime(true);
for ($index = 0; $index < $iterations; ++$index) $checksum += $box->read();
$durationNanoseconds = hrtime(true) - $started;
$result = [
    'extension' => extension_loaded('lean_alpha'),
    'box' => $box->read(),
    'identity' => $same === $box,
    'payload' => [$payload->enabled, $payload->count, $payload->label, bin2hex($payload->bytes->toString()), $payload->values],
    'callback' => withCallback(40, static fn(int $value): int => $value),
    'closure' => $addTwo(40),
    'performance' => ['iterations' => $iterations, 'durationNanoseconds' => $durationNanoseconds, 'checksum' => $checksum],
];
$addTwo->close();
$box->close();
$snapshot = (new LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
$result['runtimeInitRuns'] = $snapshot['runtimeInitRuns'];
$result['componentInitRuns'] = $snapshot['componentInitRuns'];
$result['liveIdentities'] = $snapshot['liveIdentities'];
echo json_encode($result, JSON_THROW_ON_ERROR);
`);

  const extension = join(packageRoot, "lib/php/lean_alpha.so");
  const { stdout, stderr } = await run("php", ["-n", "-d", `extension=${extension}`, program], {
    maxBuffer: 16 * 1024 * 1024,
  });
  if (stderr !== "") throw new Error(`native PHP consumer wrote to stderr: ${stderr}`);
  const result = JSON.parse(stdout);
  const performance = result.performance;
  delete result.performance;
  const expected = {
    extension: true,
    box: STEADY_STATE_BOX_VALUE,
    identity: true,
    payload: [true, 9, "consumer", "007fff", [1, 5, 13]],
    callback: 42,
    closure: 42,
    runtimeInitRuns: 1,
    componentInitRuns: 1,
    liveIdentities: 0,
  };
  if (JSON.stringify(result) !== JSON.stringify(expected)) {
    throw new Error(`native PHP result mismatch: ${JSON.stringify(result)}`);
  }
  if (performance.checksum !== STEADY_STATE_BOX_VALUE * performance.iterations) throw new Error("native PHP performance checksum failed");
  await writeConsumerPerformance({
    consumer: "php-native",
    operation: STEADY_STATE_OPERATION,
    timingMode: "steady-state",
    scope: "steady-state generated PHP API call through the native Zend extension",
    iterations: performance.iterations,
    durationNanoseconds: performance.durationNanoseconds,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await rm(consumer, { recursive: true, force: true });
}
