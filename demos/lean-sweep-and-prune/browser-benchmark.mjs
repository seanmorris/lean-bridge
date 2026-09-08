/**
 * Automatic prewarmed full-pair comparisons in the shared portfolio benchmark.
 *
 * @file
 */

import { attachBrowserBenchmark } from "../shared/browser-benchmark.mjs";
import { createBenchmark } from "./benchmark-workload.mjs";

/** Attach measurements and release prepared snapshots across browser navigation. */
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
		, summarize: ({ trialCount }) => `${trialCount} checked comparisons of ${benchmark.count} boxes: `
			+ `${benchmark.candidateCount} axis candidates and ${benchmark.overlapCount} exact overlaps. `
			+ "Both sort and return both complete pair lists. Snapshot setup, oracle checks and warmup are excluded."
	});
	globalThis.addEventListener("pagehide", () => {
		lifetime++;
		controls.cancel();
		benchmark?.dispose();
		benchmark = undefined;
		preparing = undefined;
	});
	return controls;
};
