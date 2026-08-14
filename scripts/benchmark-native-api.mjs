/**
 * Benchmarks the native API workflow.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import os from "node:os";
import { performance } from "node:perf_hooks";

import createLazyModule from "../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

const coldSamples = 12;
const readSamples = 60;
const readsPerSample = 10_000;
const lifecycleSamples = 60;
const lifecyclesPerSample = 1_000;
const warmupLifecycles = 10_000;

const elapsed = async operation => {
	const start = performance.now();
	const value = await operation();
	return { value, milliseconds: performance.now() - start };
};

const percentile = (values, fraction) => {
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
	return sorted[index];
};

const summary = values => ({
	samples: values.length
	, median: percentile(values, 0.5)
	, p95: percentile(values, 0.95)
	, min: Math.min(...values)
	, max: Math.max(...values)
});

const sha256File = path =>
	execFileSync("sha256sum", [path], { encoding: "utf8" }).split(/\s+/, 1)[0];

const factoryMilliseconds = [];
const lazyLoadMilliseconds = [];
const firstLifecycleMicroseconds = [];
let warmAlpha;

for(let sample = 0; sample < coldSamples; sample += 1)
{
	const factory = await elapsed(() => createLazyModule());
	const libraries = createLibraryLoader(factory.value);
	const load = await elapsed(() => libraries.load(alpha));
	const firstLifecycle = await elapsed(() => {
    const box = new load.value.Box(42);
    if(box.read() !== 42) throw new Error("Box round trip returned the wrong value");
    box.dispose();
	});

	factoryMilliseconds.push(factory.milliseconds);
	lazyLoadMilliseconds.push(load.milliseconds);
	firstLifecycleMicroseconds.push(firstLifecycle.milliseconds * 1_000);
	warmAlpha = load.value;
}

for(let index = 0; index < warmupLifecycles; index += 1)
{
	const box = new warmAlpha.Box(index);
	box.read();
	box.dispose();
}

const warmReadNanoseconds = [];
const retainedBox = new warmAlpha.Box(73);
let checksum = 0;
for(let sample = 0; sample < readSamples; sample += 1)
{
	const start = performance.now();
	for(let index = 0; index < readsPerSample; index += 1)
	{
		checksum += retainedBox.read();
	}
	warmReadNanoseconds.push(
		((performance.now() - start) * 1_000_000) / readsPerSample,
	);
}
retainedBox.dispose();

const warmLifecycleMicroseconds = [];
for(let sample = 0; sample < lifecycleSamples; sample += 1)
{
	const start = performance.now();
	for(let index = 0; index < lifecyclesPerSample; index += 1)
	{
		const box = new warmAlpha.Box(index);
		checksum += box.read();
		box.dispose();
	}
	warmLifecycleMicroseconds.push(
		((performance.now() - start) * 1_000) / lifecyclesPerSample,
	);
}

if(checksum === 0) throw new Error("benchmark checksum was not updated");

const result = {
	schemaVersion: 1
	, measuredAt: new Date().toISOString()
	, scope: "POC browser-profile native JavaScript projection under Node"
	, environment: {
		platform: `${os.platform()} ${os.release()}`
		, architecture: os.arch()
		, node: process.version
		, cpu: os.cpus()[0]?.model ?? "unknown"
		, logicalCpuCount: os.cpus().length
	}
	, artifacts: {
		lazyMainSha256: sha256File("build/lean-link-spike/lazy/main.wasm")
		, alphaSideModuleSha256: sha256File(
			"build/lean-link-spike/lazy/alpha.so.wasm",
		)
		, graphLockSha256: sha256File("poc/lean-link-spike/graph-lock.json")
	}
	, method: {
		coldSamples
		, readSamples
		, readsPerSample
		, lifecycleSamples
		, lifecyclesPerSample
		, warmupLifecycles
	}
	, measurements: {
		moduleFactoryMilliseconds: summary(factoryMilliseconds)
		, lazyAlphaLoadMilliseconds: summary(lazyLoadMilliseconds)
		, firstBoxLifecycleMicroseconds: summary(firstLifecycleMicroseconds)
		, warmBoxReadNanoseconds: summary(warmReadNanoseconds)
		, warmBoxLifecycleMicroseconds: summary(warmLifecycleMicroseconds)
	}
	, limitations: [
		"The descriptor and native class projection are hand-authored POC stand-ins for generated bindings."
		, "The run uses Node and a warm filesystem cache. It does not measure browser download, compilation, or bundler startup."
		, "The sample covers one UInt32 field read and one identity-bearing Box lifecycle. It does not represent callbacks, promises, strings, arrays, or production workloads."
		, "The benchmark reports the public Box API. It does not compare against a private ccall or raw Wasm baseline."
	]
};

console.log(JSON.stringify(result, null, 2));
