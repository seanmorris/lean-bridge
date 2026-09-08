/**
 * Automatic prewarmed token-bucket timing with the gallery's shared benchmark layout.
 *
 * @file
 */

import { attachBrowserBenchmark } from "../shared/browser-benchmark.mjs";
import { createBenchmark } from "./benchmark-workload.mjs";

/**
 * Mount matched integer-credit traces with cancellation and prepared-state cleanup.
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
		, summarize: ({ trialCount }) => `${trialCount} checked traces of ${benchmark.operationCount} requests: `
			+ `${benchmark.allowedCount} allowed, ${benchmark.throttledCount} throttled, `
			+ `${benchmark.regressionCount} rejected clock regressions per trace. `
			+ "Both return all decisions, balances, refill amounts, and retry delays. Setup and warmup are excluded."
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
