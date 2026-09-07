/**
 * Measure complete prepared shortest-edit scripts against optimized JavaScript Myers.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

const enforce = process.argv.includes("--assert") || process.argv.includes("--check");
for(const configuration of [
	{ length: 384, repeated: false, maxMedianMs: .2, maxRatio: 20 }
	, { length: 1024, repeated: true, maxMedianMs: .4, maxRatio: 25 }
	, { length: 128, reordered: true, maxMedianMs: 2, maxRatio: 650 }
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
		process.stdout.write(`${benchmark.beforeLength} → ${benchmark.afterLength} tokens, ${benchmark.distance} edits: `
			+ `Lean ${median.toFixed(3)} ms, JS ${javascript[12].toFixed(3)} ms, `
			+ `${ratio.toFixed(1)}x, Lean p95 ${lean[23].toFixed(3)} ms\n`);
		if(enforce && (!Number.isFinite(ratio) || median > configuration.maxMedianMs || ratio > configuration.maxRatio))
			throw new Error(`Myers exceeded ${configuration.maxMedianMs} ms / ${configuration.maxRatio}x budget`);
	}
	finally
	{ benchmark.dispose(); }
}
