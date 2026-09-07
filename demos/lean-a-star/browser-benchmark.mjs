/**
 * Mount the shared automatically starting A* browser benchmark.
 *
 * @file
 */

import { attachBrowserBenchmark } from "../shared/browser-benchmark.mjs";
import { createBenchmark } from "./benchmark-workload.mjs";

/**
 * Attach the checked comparison and release prepared inputs when the page leaves.
 *
 * @returns {object} Shared benchmark controls.
 */
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
		, summarize: ({ trialCount, samples }) => `${trialCount} checked searches on a fixed `
			+ `${benchmark.vertexCount}-vertex weighted graph; ${samples[0].expanded} vertices expanded per search. `
			+ "Both use heap A* with the same heuristic and tie rules. Graph setup and warmup are excluded."
	});
	globalThis.addEventListener("pagehide", () => {
		lifetime += 1;
		controls.cancel();
		benchmark?.dispose();
		benchmark = undefined;
	});
	return controls;
};
