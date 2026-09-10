/**
 * Paired steady-state measurements for command-line demo benchmarks.
 *
 * @file
 */

import { setImmediate as yieldToRuntime } from "node:timers/promises";
import { measureSyncBenchmark } from "./browser-benchmark.mjs";

/**
 * Prewarm both operations, alternate measurement order, and check results outside timing.
 * Each sample uses the same adaptive batching as the browser benchmarks.
 *
 * @param left First synchronous operation.
 * @param right Second synchronous operation.
 * @param options Sample counts, result checker, and injectable measurement dependencies.
 * @param options.iterations Number of measured pairs.
 * @param options.warmupCount Number of excluded warmup pairs.
 * @param options.minimumMs Target elapsed time for each adaptive batch.
 * @param options.check Checks the last result from both batches outside timing.
 * @param options.sample Measures one operation; injectable for deterministic tests.
 * @param options.pause Yields between pairs; injectable for deterministic tests.
 */
export const measurePairedBenchmark = async (left, right, {
	iterations = 50, warmupCount = 5, minimumMs = 12, check = () => {}
	, sample = measureSyncBenchmark, pause = yieldToRuntime
} = {}) => {
	if(!Number.isSafeInteger(iterations) || iterations < 1)
		throw new RangeError("Benchmark iterations must be a positive safe integer");
	if(!Number.isSafeInteger(warmupCount) || warmupCount < 1)
		throw new RangeError("Benchmark warmupCount must be a positive safe integer");
	if(!Number.isFinite(minimumMs) || minimumMs <= 0)
		throw new RangeError("Benchmark minimumMs must be positive and finite");
	const leftSamples = [];
	const rightSamples = [];
	for(let index = 0; index < warmupCount + iterations; index += 1)
	{
		let leftSample;
		let rightSample;
		if(index % 2 === 0)
		{
			leftSample = sample(left, minimumMs);
			rightSample = sample(right, minimumMs);
		}
		else
		{
			rightSample = sample(right, minimumMs);
			leftSample = sample(left, minimumMs);
		}
		for(const measured of [leftSample, rightSample])
			if(!Number.isFinite(measured.milliseconds) || measured.milliseconds <= 0)
				throw new Error("Benchmark samples must be positive and finite");
		check(leftSample.result, rightSample.result);
		if(index >= warmupCount)
		{
			leftSamples.push(leftSample.milliseconds);
			rightSamples.push(rightSample.milliseconds);
		}
		// Let pending Wasm/JavaScript optimization finish between pairs, outside timing.
		await pause();
	}
	const summarize = samples => {
		samples.sort((a, b) => a - b);
		return {
			medianMs: samples[Math.floor(samples.length / 2)]
			, p95Ms: samples[Math.min(samples.length - 1, Math.ceil(samples.length * .95) - 1)]
		};
	};
	return { left: summarize(leftSamples), right: summarize(rightSamples) };
};
