#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const option = name => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};

const packageRoot = resolve(option("--package") ?? "build/php-wasm-package");
const phpWasmRoot = resolve(option("--php-wasm") ?? "build/php-wasm-host/node_modules/php-wasm");
const [{ PhpNode }, { default: leanAlpha }] = await Promise.all([
  import(pathToFileURL(`${phpWasmRoot}/PhpNode.mjs`)),
  import(pathToFileURL(`${packageRoot}/index.mjs`)),
]);

const php = new PhpNode({ version: "8.4", sharedLibs: [leanAlpha] });
let stdout = "";
let stderr = "";
php.addEventListener("output", event => {
  for (const line of event.detail) stdout += line;
});
php.addEventListener("error", event => {
  for (const line of event.detail) stderr += line;
});

await php.binary;
const status = await php.run(`<?php
require_once '/vendor/autoload.php';
$box = new LeanAlpha\\Box(41);
$payload = LeanAlpha\\roundTrip(new LeanAlpha\\Payload(
    false,
    8,
    'wasm',
    LeanAlpha\\Bytes::fromString("\\x00\\x7f\\xff"),
    [1, 5, 13],
));
$adder = LeanAlpha\\makeAdder(2);
$result = [
    'extension' => extension_loaded('lean_alpha'),
    'box' => $box->read(),
    'identity' => $box->identity() === $box,
    'payload' => [$payload->enabled, $payload->count, $payload->label, bin2hex($payload->bytes->toString()), $payload->values],
    'callback' => LeanAlpha\\withCallback(40, static fn(int $value): int => $value),
    'closure' => $adder(40),
];
$adder->close();
$box->close();
$snapshot = (new LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
$result['runtimeInitRuns'] = $snapshot['runtimeInitRuns'];
$result['componentInitRuns'] = $snapshot['componentInitRuns'];
$result['liveIdentities'] = $snapshot['liveIdentities'];
echo json_encode($result, JSON_THROW_ON_ERROR);
`);

if (status !== 0 || stderr !== "") {
  throw new Error(`PHP-Wasm host failed with status ${status}: ${stderr || stdout}`);
}
const result = JSON.parse(stdout);
const expected = {
  extension: true,
  box: 41,
  identity: true,
  payload: [true, 9, "wasm", "007fff", [1, 5, 13]],
  callback: 42,
  closure: 42,
  runtimeInitRuns: 1,
  componentInitRuns: 1,
  liveIdentities: 0,
};
if (JSON.stringify(result) !== JSON.stringify(expected)) {
  throw new Error(`PHP-Wasm result mismatch: ${JSON.stringify(result)}`);
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
