/**
 * Guard complete sweep-and-prune latency against a typed-array JavaScript baseline.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

const enforce = process.argv.includes("--assert") || process.argv.includes("--check");
for(const configuration of [
	{ count: 256, dimensions: 2, maxMedianMs: 1.75, maxRatio: 15 }
	, { count: 768, dimensions: 3, axis: 2, maxMedianMs: 7, maxRatio: 15 }
	, { count: 128, dimensions: 2, dense: true, maxMedianMs: 7, maxRatio: 20 }
]){
	const benchmark = await createBenchmark(configuration);
	try
	{
		for(let index = 0; index < 5; index++) benchmark.sample(index);
		const samples = Array.from({ length: 25 }, (_, index) => benchmark.sample(index));
		const lean = samples.map(sample => sample.leanMs).sort((a, b) => a - b);
		const javascript = samples.map(sample => sample.javascriptMs).sort((a, b) => a - b);
		const median = lean[12];
		const ratio = median / javascript[12];
		process.stdout.write(`${benchmark.count} boxes in ${benchmark.dimensions}D, `
			+ `${benchmark.candidateCount} candidates / ${benchmark.overlapCount} overlaps: `
			+ `Lean ${median.toFixed(3)} ms, JS ${javascript[12].toFixed(3)} ms, `
			+ `${ratio.toFixed(1)}x, Lean p95 ${lean[23].toFixed(3)} ms\n`);
		if(enforce && (!Number.isFinite(ratio) || median > configuration.maxMedianMs || ratio > configuration.maxRatio))
			throw new Error(`Sweep exceeded ${configuration.maxMedianMs} ms / ${configuration.maxRatio}x budget`);
	}
	finally
	{ benchmark.dispose(); }
}
