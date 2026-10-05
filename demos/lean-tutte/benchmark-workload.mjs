/**
 * Matched full-certificate costs, with comparison outside the timed calls.
 *
 * @file
 */
import { createChecker } from "./runtime.mjs";
import { certificateInput, createScene } from "./scenario.mjs";
import { checkReference } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/** Prepare the nine-square example, excluding runtime startup from measurement. */
export const createBenchmark = async () => {
	const check = await createChecker(), request = certificateInput(createScene());
	let disposed = false;
	return {
		/**
		 * Time both full certificates in alternating order.
		 *
		 * @param index Sample number.
		 */
		sample(index = 0) {
			if(disposed) throw new Error("Benchmark disposed");
			let lean, js;
			if(index % 2)
			{ js = measureSyncBenchmark(() => checkReference(request), 4); lean = measureSyncBenchmark(() => check(request), 4); }
			else
			{ lean = measureSyncBenchmark(() => check(request), 4); js = measureSyncBenchmark(() => checkReference(request), 4); }
			if(JSON.stringify(lean.result) !== JSON.stringify(js.result)) throw new Error("Lean and JavaScript certificate results differ");
			return { leanMs: lean.milliseconds, javascriptMs: js.milliseconds };
		}
		, /** Refuse samples after the owning benchmark leaves the page. */
		dispose() { disposed = true; }
	};
};
