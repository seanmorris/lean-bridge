/**
 * Prewarmed CLI certificate comparison; browser measurements use the same workload.
 *
 * @file
 */
import { createBenchmark } from "./benchmark-workload.mjs";

const benchmark = await createBenchmark();
try
{
	for(let i = 0; i < 5; i++) benchmark.sample(i);
	const results = Array.from({ length: 25 }, (_, index) => benchmark.sample(index));
	const median = key => results.map(sample => sample[key]).sort((a, b) => a - b)[12];
	console.log(JSON.stringify({ samples: results.length, leanMs: median("leanMs"), javascriptMs: median("javascriptMs") }));
}
finally
{ benchmark.dispose(); }
