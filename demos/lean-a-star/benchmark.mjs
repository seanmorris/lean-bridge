/**
 * Compare compiled Lean A* with an independent typed-array JavaScript heap A*.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

const enforce = process.argv.includes("--assert");
for(const configuration of [
	{ width: 36, height: 28, maxMedianMs: 3, maxRatio: 10 }
	, { width: 48, height: 36, maxMedianMs: 6, maxRatio: 10 }
]){
	const benchmark = await createBenchmark(configuration);
	try
	{
		for(let index = 0; index < 5; index += 1) benchmark.sample(index);
		const samples = Array.from({ length: 25 }, (_, index) => benchmark.sample(index));
		const lean = samples.map(sample => sample.leanMs).sort((a, b) => a - b);
		const javascript = samples.map(sample => sample.javascriptMs).sort((a, b) => a - b);
		const median = lean[12];
		const ratio = median / javascript[12];
		process.stdout.write(`${benchmark.vertexCount} vertices / ${benchmark.edgeCount} edges, `
			+ `${samples[0].expanded} expanded: Lean ${median.toFixed(2)} ms, `
			+ `JS ${javascript[12].toFixed(2)} ms, ${ratio.toFixed(1)}x, Lean p95 ${lean[23].toFixed(2)} ms\n`);
		if(enforce && (!Number.isFinite(ratio) || median > configuration.maxMedianMs || ratio > configuration.maxRatio))
			throw new Error(`A* exceeded ${configuration.maxMedianMs} ms / ${configuration.maxRatio}x budget`);
	}
	finally
	{ benchmark.dispose(); }
}
