#!/usr/bin/env node
/**
 * Tests the PHP Wasm package host workflow.
 *
 * @file
 */


import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertConsumerJsonResult, runConsumerCommand } from "../src/adoption/consumer-checks.mjs";

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
const run = runConsumerCommand;
const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-consumer-"));

try
{
	await cp(new URL("../tests/fixtures/documentation/consumers/php-wasm/", import.meta.url), consumer, { recursive: true });
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
	const documentationExpected = { box: "41", identity: true, payload: [true, "9", "consumer", "007fff", ["1", "5", "13"]], callback: "42", closure: "42" };
	const documentation = await run(process.execPath, ["main.mjs"], { cwd: consumer, maxBuffer: 16 * 1024 * 1024 })
		.catch(error => ({ status: error.code, signal: error.signal, stdout: error.stdout, stderr: error.stderr }));
	assertConsumerJsonResult({
		label: "PHP-Wasm documentation example"
		, ...documentation
		, expected: documentationExpected, allowNodeJsonImportWarning: true
	});
	if(documentation.stderr) process.stderr.write(documentation.stderr);
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
	const boundarySource = await readFile(new URL("../tests/fixtures/php-uint32-boundaries.php", import.meta.url), "utf8");
	const boundaryChecks = {};
	for(const [mode, strict] of [["strict", 1], ["weak", 0]])
	{
		await php.writeFile(`/uint32-${mode}.php`, boundarySource.replace("strict_types=1", `strict_types=${strict}`));
		const status = await php.run(`<?php require_once '/vendor/autoload.php'; echo json_encode(require '/uint32-${mode}.php', JSON_THROW_ON_ERROR);`);
		assert.equal(status, 0, stdout || stderr);
		assert.equal(stderr, "");
		const report = JSON.parse(stdout);
		assert.equal(report.integerBytes, 4);
		assert.deepEqual(report.values, ["0", "2147483647", "2147483648", "4294967295"]);
		assert.equal(report.liveIdentities, 0);
		assert.ok(report.checks >= 100);
		boundaryChecks[mode] = report.checks;
		stdout = "";
	}
	const status = await php.run(`<?php
require_once '/vendor/autoload.php';
use Brick\\Math\\BigInteger;
$box = new LeanAlpha\\Box(BigInteger::of('${STEADY_STATE_BOX_VALUE}'));
$payload = LeanAlpha\\roundTrip(new LeanAlpha\\Payload(
    false,
    BigInteger::of('8'),
    'wasm',
    LeanAlpha\\Bytes::fromString("\\x00\\x7f\\xff"),
    array_map(BigInteger::of(...), ['1', '5', '13']),
));
$adder = LeanAlpha\\makeAdder(BigInteger::of('2'));
$iterations = ${STEADY_STATE_MEASURED_ITERATIONS};
for ($index = 0; $index < ${STEADY_STATE_WARMUP_ITERATIONS}; ++$index) $box->read();
$checksum = 0;
$started = hrtime(true);
for ($index = 0; $index < $iterations; ++$index) $checksum += (int) (string) $box->read();
$durationNanoseconds = hrtime(true) - $started;
$result = [
    'extension' => extension_loaded('lean_alpha'),
    'box' => (string) $box->read(),
    'identity' => $box->identity() === $box,
    'betaRead' => (string) LeanBeta\\read($box),
    'betaIdentity' => LeanBeta\\identity($box) === $box,
    'payload' => [$payload->enabled, (string) $payload->count, $payload->label, bin2hex($payload->bytes->toString()), array_map(strval(...), $payload->values)],
    'callback' => (string) LeanAlpha\\withCallback(BigInteger::of('40'), static fn(BigInteger $value): BigInteger => $value),
    'closure' => (string) $adder(BigInteger::of('40')),
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
		, box: String(STEADY_STATE_BOX_VALUE)
		, identity: true
		, betaRead: String(STEADY_STATE_BOX_VALUE)
		, betaIdentity: true
		, payload: [true, "9", "wasm", "007fff", ["1", "5", "13"]]
		, callback: "42"
		, closure: "42"
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
			, scope: "steady-state generated PHP API call through the lazy PHP-Wasm transport, including BigInteger result and bounded checksum conversion"
			, iterations: performance.iterations
			, durationNanoseconds: performance.durationNanoseconds
		});
	}
	process.stdout.write(`${JSON.stringify({ ...result, boundaryChecks }, null, 2)}\n`);
} finally
{
	await rm(consumer, { recursive: true, force: true });
}
