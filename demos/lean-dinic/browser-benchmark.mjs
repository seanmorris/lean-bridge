/**
 * Automatic prewarmed max-flow timings using the portfolio's shared benchmark.
 *
 * @file
 */

import { attachBrowserBenchmark } from "../shared/browser-benchmark.mjs";
import { createBenchmark } from "./benchmark-workload.mjs";

/** Attach checked samples and release prepared storage across browser navigation. */
export const mountBenchmark = () => {
	let benchmark;
	let lifetime = 0;
	const controls = attachBrowserBenchmark({
		root: globalThis.document.querySelector("#browser-benchmark")
		, prepare: async () => {
			if(benchmark) return;
			const current = lifetime;
			const prepared = await createBenchmark();
			if(current !== lifetime) prepared.dispose();
			else benchmark = prepared;
		}
		, sample: index => benchmark.sample(index)
		, summarize: ({ trialCount }) => `${trialCount} checked maximum flows on ${benchmark.vertexCount} vertices and `
			+ `${benchmark.edgeCount} directed links. Each carries ${benchmark.value} units. `
			+ "Both return every edge flow and cut membership. Lean certification is timed; setup and warmup are excluded."
	});
	globalThis.addEventListener("pagehide", () => {
		lifetime++;
		controls.cancel();
		benchmark?.dispose();
		benchmark = undefined;
	});
	return controls;
};
