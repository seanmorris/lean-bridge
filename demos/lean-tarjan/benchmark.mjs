/**
 * Benchmark compiled Lean Tarjan against a typed-array JavaScript Tarjan baseline.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

const enforce = process.argv.includes("--assert") || process.argv.includes("--check");
for(const configuration of [
	{ vertexCount: 1024, blockSize: 8, maxMedianMs: 3, maxRatio: 12 }
	, { vertexCount: 2560, blockSize: 16, maxMedianMs: 7, maxRatio: 12 }
]){
	const benchmark = await createBenchmark(configuration);
	try
	{
		for(let index = 0; index < 5; index += 1) benchmark.sample(index);
		const samples = Array.from({ length: 25 }, (_, index) => benchmark.sample(index));
		const lean = samples.map(sample => sample.leanMs).sort((left, right) => left - right);
		const javascript = samples.map(sample => sample.javascriptMs).sort((left, right) => left - right);
		const median = lean[12];
		const ratio = median / javascript[12];
		process.stdout.write(`${benchmark.vertexCount} vertices / ${benchmark.edgeCount} edges, `
			+ `${samples[0].componentCount} components: Lean ${median.toFixed(2)} ms, `
			+ `JS ${javascript[12].toFixed(2)} ms, ${ratio.toFixed(1)}x, Lean p95 ${lean[23].toFixed(2)} ms\n`);
		if(enforce && (!Number.isFinite(ratio) || median > configuration.maxMedianMs || ratio > configuration.maxRatio))
			throw new Error(`Tarjan exceeded ${configuration.maxMedianMs} ms / ${configuration.maxRatio}x budget`);
	}
	finally
	{ benchmark.dispose(); }
}
