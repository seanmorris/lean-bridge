/**
 * Attach the shared benchmark to its route-owned lifetime.
 *
 * @file
 */

import { createBenchmark } from "./benchmark-workload.mjs";

/**
 * Attach the checked comparison and release prepared inputs when the page leaves.
 *
 * @param scope Route-owned benchmark scaffold and resource lifetime.
 * @returns {object} Shared benchmark controls.
 */
export const mountBenchmark = scope => {
	let benchmark;
	let preparing;
	let lifetime = 0;
	const controls = scope.benchmark({
		root: scope.root.querySelector("#browser-benchmark")
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
		, summarize: ({ trialCount, samples }) => `${trialCount} checked searches on a fixed `
			+ `${benchmark.vertexCount}-vertex weighted graph; ${samples[0].expanded} vertices expanded per search. `
			+ "Both use heap A* with the same heuristic and tie rules. Graph setup and warmup are excluded."
	});
	scope.listen(globalThis, "pagehide", () => {
		lifetime += 1;
		controls.cancel();
		benchmark?.dispose();
		benchmark = undefined;
		preparing = undefined;
	});
	return controls;
};
