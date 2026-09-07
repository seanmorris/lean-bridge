/**
 * Prewarmed LRU trace timings against an independent JavaScript Map cache.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

const enforce = process.argv.includes("--assert");
const workloads = [
	{ capacity: 8, kind: "mixed", maxMedianMs: 6, maxRatio: 20 }
	, { capacity: 32, kind: "mixed", maxMedianMs: 10, maxRatio: 25 }
	, { capacity: 128, kind: "scan", maxMedianMs: 30, maxRatio: 50 }
	, { capacity: 128, kind: "mru", maxMedianMs: 4, maxRatio: 10 }
];
for(const config of workloads)
{
	const benchmark = await createBenchmark(config);
	try
	{
		for(let index = 0; index < 5; index += 1) benchmark.sample(index);
		const samples = Array.from({ length: 20 }, (_, index) => benchmark.sample(index));
		const lean = samples.map(sample => sample.leanMs).sort((a, b) => a - b);
		const javascript = samples.map(sample => sample.javascriptMs).sort((a, b) => a - b);
		const median = lean[10];
		const ratio = median / javascript[10];
		process.stdout.write(`${config.kind}, capacity ${config.capacity}, ${benchmark.count} operations: `
			+ `Lean ${median.toFixed(2)} ms, JS ${javascript[10].toFixed(2)} ms, ${ratio.toFixed(1)}x, `
			+ `Lean p95 ${lean[Math.ceil(lean.length * .95) - 1].toFixed(2)} ms\n`);
		if(enforce && (!Number.isFinite(ratio) || median > config.maxMedianMs || ratio > config.maxRatio))
			throw new Error(`LRU ${config.kind}/${config.capacity} exceeded ${config.maxMedianMs} ms / ${config.maxRatio}x budget`);
	}
	finally
	{ benchmark.dispose(); }
}
