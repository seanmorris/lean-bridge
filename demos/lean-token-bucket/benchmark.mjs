/**
 * Compare compiled Lean token-bucket traces with matched numeric JavaScript output.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

const enforce = process.argv.includes("--assert") || process.argv.includes("--check");
for(const configuration of [
	{ operationCount: 1024, maxMedianMs: .35, maxRatio: 12 }
	, { operationCount: 4096, maxMedianMs: 1.5, maxRatio: 12 }
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
		process.stdout.write(`${benchmark.operationCount} requests, ${benchmark.allowedCount} allowed: `
			+ `Lean ${median.toFixed(3)} ms, JS ${javascript[12].toFixed(3)} ms, `
			+ `${ratio.toFixed(1)}x, Lean p95 ${lean[23].toFixed(3)} ms\n`);
		if(enforce && (!Number.isFinite(ratio) || median > configuration.maxMedianMs || ratio > configuration.maxRatio))
			throw new Error(`Token bucket exceeded ${configuration.maxMedianMs} ms / ${configuration.maxRatio}x budget`);
	}
	finally
	{ benchmark.dispose(); }
}
