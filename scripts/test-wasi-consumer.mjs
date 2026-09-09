#!/usr/bin/env node
/**
 * Tests the WASI consumer workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { buildWasiPackage } from "../src/release/wasi-package.mjs";
import { writeConsumerPerformance } from "../src/adoption/consumer-performance.mjs";

const execute = promisify(execFile);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if(!options.get("--bundle")) throw new Error("Usage: test-wasi-consumer.mjs --bundle PATH");
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-wasi-consumer-"));
try
{
	const release = await buildWasiPackage({ bundleRoot: resolve(options.get("--bundle")), outputRoot: join(scratch, "release") });
	const consumer = join(scratch, "consumer");
	await mkdir(consumer);
	await execute("tar", ["-xzf", release.archive, "-C", consumer]);
	const root = join(consumer, "lean-bridge-alpha-wasi-0.0.0");
	const host = join(root, "bin/lean-alpha-wasi-host");
	const component = join(root, "component/lean-alpha.component.wasm");
	const testLoader = process.env.LEAN_BRIDGE_TEST_GLIBC_LOADER;
	const invoke = (input = null) => testLoader
		? execute(testLoader, [
			"--library-path"
			, `${join(root, "lib")}:${process.env.LEAN_BRIDGE_TEST_GLIBC_LIBRARY_PATH}`
			, host
			, component
			, ...(input === null ? [] : [String(input)])
		])
		: execute(host, input === null ? [] : [component, String(input)]);
	const invocation = await invoke();
	if(invocation.stdout.trim() !== "42") throw new Error(`Component Model consumer returned ${invocation.stdout.trim()}`);
	await cp(new URL("../tests/fixtures/documentation/consumers/wit-wasi/run.sh", import.meta.url), join(consumer, "run.sh"));
	// The optional loader is for older developer hosts. CI runs the unchanged shell fixture.
	const loadedExample = testLoader ? await invoke(73) : null;
	const documentation = testLoader
		? { stdout: `${invocation.stdout}${loadedExample.stdout}`, stderr: `${invocation.stderr}${loadedExample.stderr}` }
		: await execute("sh", [join(consumer, "run.sh"), root]);
	if(documentation.stdout.trim() !== "42\n73" || documentation.stderr !== "")
	{
		throw new Error(`WIT/WASI documentation result mismatch: ${documentation.stderr || documentation.stdout}`);
	}
	await invoke();
	const iterations = 20;
	const started = process.hrtime.bigint();
	for(let index = 0; index < iterations; index += 1)
	{
		const measured = await invoke();
		if(measured.stdout.trim() !== "42") throw new Error(`Component Model performance invocation returned ${measured.stdout.trim()}`);
	}
	const durationNanoseconds = Number(process.hrtime.bigint() - started);
	await writeConsumerPerformance({
		consumer: "wit-wasi"
		, operation: "read-box host process"
		, timingMode: "whole-invocation"
		, scope: "installed Wasmtime host process and component startup"
		, iterations
		, durationNanoseconds
	});
	await execute("wasm-tools", ["validate", "--features", "component-model", component]);
	process.stdout.write(`${JSON.stringify({ result: "passed", package: release.archive.split("/").at(-1), componentResult: 42, realLeanExecution: true }, null, 2)}\n`);
} finally
{
	await rm(scratch, { recursive: true, force: true });
}
