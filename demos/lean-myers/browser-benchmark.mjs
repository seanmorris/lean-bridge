/**
 * Automatic prewarmed edit-script timings in the portfolio's shared benchmark.
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
		, summarize: ({ trialCount }) => `${trialCount} checked shortest scripts from ${benchmark.beforeLength} to `
			+ `${benchmark.afterLength} tokens, each requiring ${benchmark.distance} edits. `
			+ "Both return every operation. Lean certification is timed; tokenization, setup and warmup are excluded."
	});
	globalThis.addEventListener("pagehide", () => {
		lifetime++;
		controls.cancel();
		benchmark?.dispose();
		benchmark = undefined;
	});
	return controls;
};
