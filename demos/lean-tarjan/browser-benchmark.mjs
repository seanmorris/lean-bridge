/**
 * Shared, automatically starting and prewarmed Tarjan browser benchmark.
 *
 * @file
 */

import { attachBrowserBenchmark } from "../shared/browser-benchmark.mjs";
import { createBenchmark } from "./benchmark-workload.mjs";

/**
 * Mount the matched Tarjan comparison into the standard benchmark section.
 *
 * @returns {object} Shared benchmark controls.
 */
export const mountBenchmark = () => {
	let benchmark;
	let preparing;
	let lifetime = 0;
	const controls = attachBrowserBenchmark({
		root: globalThis.document.querySelector("#browser-benchmark")
		, prepare: async () => {
			if(benchmark) return;
			if(preparing) return preparing;
			const current = lifetime;
			const pending = createBenchmark().then(prepared => {
				if(current !== lifetime) prepared.dispose();
				else benchmark = prepared;
			}).finally(() => {
				if(preparing === pending) preparing = undefined;
			});
			preparing = pending;
			return pending;
		}
		, sample: index => benchmark.sample(index)
		, summarize: ({ trialCount, samples }) => `${trialCount} checked partitions of `
			+ `${benchmark.vertexCount} vertices and ${benchmark.edgeCount} edges into ${samples[0].componentCount} components. `
			+ "Both use iterative Tarjan and return the same members and condensation edges. Setup and warmup are excluded."
	});
	globalThis.addEventListener("pagehide", () => {
		lifetime += 1;
		controls.cancel();
		benchmark?.dispose();
		benchmark = undefined;
		preparing = undefined;
	});
	return controls;
};
