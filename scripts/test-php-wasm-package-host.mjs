#!/usr/bin/env node
/**
 * Tests the PHP Wasm package host workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

const packageRoot = resolve(option("--package") ?? "build/php-wasm-package");
const phpWasmRoot = resolve(option("--php-wasm") ?? "build/php-wasm-host/node_modules/php-wasm");
const run = promisify(execFile);
const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-consumer-"));

try
{
	await writeFile(join(consumer, "package.json"), `${JSON.stringify({
		name: "lean-bridge-php-wasm-consumer"
		, private: true
		, type: "module"
	}, null, 2)}\n`);
	const pack = async root => {
		const { stdout } = await run("npm", [
			"pack"
			, "--json"
			, "--ignore-scripts"
			, "--pack-destination", consumer
			, root
		], { cwd: consumer, maxBuffer: 64 * 1024 * 1024 });
		const records = JSON.parse(stdout);
		if(records.length !== 1 || typeof records[0].filename !== "string")
		{
			throw new Error(`npm pack returned an invalid record for ${root}`);
		}
		return join(consumer, records[0].filename);
	};
	const phpWasmArchive = await pack(phpWasmRoot);
	const packageArchive = await pack(packageRoot);
	await run("npm", [
		"install"
		, "--ignore-scripts"
		, "--no-audit"
		, "--no-fund"
		, phpWasmArchive
		, packageArchive
	], { cwd: consumer, maxBuffer: 64 * 1024 * 1024 });
	const [{ PhpNode }, { default: leanAlpha }] = await Promise.all([
		import(pathToFileURL(join(consumer, "node_modules/php-wasm/PhpNode.mjs")))
		, import(pathToFileURL(join(consumer, "node_modules/php-wasm-lean-alpha/index.mjs")))
	]);
	const php = new PhpNode({ version: "8.4", sharedLibs: [leanAlpha] });
	let stdout = "";
	let stderr = "";
	php.addEventListener("output", event => {
    for(const line of event.detail) stdout += line;
	});
	php.addEventListener("error", event => {
    for(const line of event.detail) stderr += line;
	});

	await php.binary;
	const status = await php.run(`<?php
require_once '/vendor/autoload.php';
$box = new LeanAlpha\\Box(${STEADY_STATE_BOX_VALUE});
$payload = LeanAlpha\\roundTrip(new LeanAlpha\\Payload(
    false,
    8,
    'wasm',
    LeanAlpha\\Bytes::fromString("\\x00\\x7f\\xff"),
    [1, 5, 13],
));
$adder = LeanAlpha\\makeAdder(2);
$iterations = ${STEADY_STATE_MEASURED_ITERATIONS};
for ($index = 0; $index < ${STEADY_STATE_WARMUP_ITERATIONS}; ++$index) $box->read();
$checksum = 0;
$started = hrtime(true);
for ($index = 0; $index < $iterations; ++$index) $checksum += $box->read();
$durationNanoseconds = hrtime(true) - $started;
$result = [
    'extension' => extension_loaded('lean_alpha'),
    'box' => $box->read(),
    'identity' => $box->identity() === $box,
    'betaRead' => LeanBeta\\read($box),
    'betaIdentity' => LeanBeta\\identity($box) === $box,
    'payload' => [$payload->enabled, $payload->count, $payload->label, bin2hex($payload->bytes->toString()), $payload->values],
    'callback' => LeanAlpha\\withCallback(40, static fn(int $value): int => $value),
    'closure' => $adder(40),
    'performance' => ['iterations' => $iterations, 'durationNanoseconds' => $durationNanoseconds, 'checksum' => $checksum],
];
$adder->close();
$box->close();
$snapshot = (new LeanAlpha\\Internal\\NativeTransport())->runtimeSnapshot();
$result['runtimeInitRuns'] = $snapshot['runtimeInitRuns'];
$result['componentInitRuns'] = $snapshot['componentInitRuns'];
$result['liveIdentities'] = $snapshot['liveIdentities'];
echo json_encode($result, JSON_THROW_ON_ERROR);
`);

	if(status !== 0 || stderr !== "")
	{
		throw new Error(`PHP-Wasm host failed with status ${status}: ${stderr || stdout}`);
	}
	const result = JSON.parse(stdout);
	const performance = result.performance;
	delete result.performance;
	const expected = {
		extension: true
		, box: STEADY_STATE_BOX_VALUE
		, identity: true
		, betaRead: STEADY_STATE_BOX_VALUE
		, betaIdentity: true
		, payload: [true, 9, "wasm", "007fff", [1, 5, 13]]
		, callback: 42
		, closure: 42
		, runtimeInitRuns: 1
		, componentInitRuns: 2
		, liveIdentities: 0
	};
	if(JSON.stringify(result) !== JSON.stringify(expected))
	{
		throw new Error(`PHP-Wasm result mismatch: ${JSON.stringify(result)}`);
	}
	if(performance.checksum !== STEADY_STATE_BOX_VALUE * performance.iterations) throw new Error("PHP-Wasm performance checksum failed");
	if(process.env.LEAN_BRIDGE_CONSUMER_PHP_WASM_PROFILE !== "side-startup")
	{
		await writeConsumerPerformance({
			consumer: "php-wasm"
			, operation: STEADY_STATE_OPERATION
			, timingMode: "steady-state"
			, scope: "steady-state generated PHP API call through the lazy PHP-Wasm transport"
			, iterations: performance.iterations
			, durationNanoseconds: performance.durationNanoseconds
		});
	}
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally
{
	await rm(consumer, { recursive: true, force: true });
}
