/**
 * Owns the lifecycle of an isolated benchmark scaffold and its compiled solver.
 *
 * @file
 */

import { useEffect, useRef } from "react";
import { attachBrowserBenchmark } from "../../../demos/shared/browser-benchmark.mjs";
import type { BenchmarkSample } from "../../../demos/shared/browser-benchmark.mjs";

/** Artifact directory containing the unchanged Myers benchmark module. */
interface BenchmarkPanelProps { artifactBase: string; }

/** Prepared ownership contract exposed by the original benchmark workload. */
interface MyersBenchmark {
	beforeLength: number;
	afterLength: number;
	distance: number;
	sample(index: number): BenchmarkSample;
	dispose(): void;
}

/**
 * Render a static island whose metric and histogram leaves belong to the controller.
 * React owns the scaffold and effect; the controller owns only text, attributes,
 * and histogram children beneath it. Cleanup releases both owners' resources.
 *
 * @param root0 Component properties.
 * @param root0.artifactBase Directory containing the compiled algorithm artifacts.
 */
export const BenchmarkPanel = ({ artifactBase }: BenchmarkPanelProps) => {
	const root = useRef<HTMLElement>(null);
	useEffect(() => {
		const element = root.current;
		if(!element) return;
		let disposed = false;
		let lifetime = 0;
		let benchmark: MyersBenchmark | undefined;
		const progress = element.querySelector("[data-benchmark-progress]");
		if(progress) progress.textContent = "Waiting to enter view";
		const controls = attachBrowserBenchmark({
			root: element
			, prepare: async () => {
				if(benchmark || disposed) return;
				const current = lifetime;
				const base = new URL(artifactBase, globalThis.location.href);
				if(!base.pathname.endsWith("/")) base.pathname += "/";
				const url = new URL("benchmark-workload.mjs", base).href;
				const module = await import(/* @vite-ignore */ url) as {createBenchmark(): Promise<MyersBenchmark>};
				if(disposed || current !== lifetime) return;
				const prepared = await module.createBenchmark();
				if(disposed || current !== lifetime) prepared.dispose();
				else benchmark = prepared;
			}
			, sample: index => {
				if(!benchmark) throw new Error("The benchmark solver is not ready");
				return benchmark.sample(index);
			}
			, summarize: ({ trialCount }) => `${trialCount} checked shortest scripts from ${benchmark!.beforeLength} to `
				+ `${benchmark!.afterLength} tokens, each requiring ${benchmark!.distance} edits. `
				+ "Both return every operation. Lean certification is timed; tokenization, setup and warmup are excluded."
		});
		const hide = () => {
			lifetime++;
			controls.cancel();
			benchmark?.dispose();
			benchmark = undefined;
		};
		globalThis.addEventListener("pagehide", hide);
		return () => {
			disposed = true;
			hide();
			controls.dispose();
			globalThis.removeEventListener("pagehide", hide);
		};
	}, [artifactBase]);
	return <section ref={root} id="browser-benchmark" className="browser-benchmark" aria-labelledby="benchmark-title">
		<div className="browser-benchmark-copy"><p className="label">Live browser benchmark</p>
			<h2 id="benchmark-title">What does a proven<br />shortest diff cost?</h2>
			<p>Lean/Wasm and JavaScript compare the same token sequences. Five excluded runs warm both solvers before 100 measured samples. Each comparison checks the edit count and replays the returned script.</p>
			<div className="browser-benchmark-actions"><button type="button" data-benchmark-run>Run again</button>
				<button type="button" data-benchmark-cancel className="secondary" disabled>Cancel</button></div></div>
		<div className="browser-benchmark-card"><div className="browser-benchmark-summary">
			<b data-benchmark-summary>Preparing the edit-script benchmark.</b>
			<span data-benchmark-progress role="status">Waiting to enter view</span></div>
		<dl className="browser-benchmark-metrics"><div><dt>Lean median</dt><dd data-benchmark-lean>—</dd></div>
			<div><dt>Lean p95</dt><dd data-benchmark-p95>—</dd></div>
			<div><dt>JS median</dt><dd data-benchmark-js>—</dd></div>
			<div><dt>Relative cost</dt><dd data-benchmark-ratio>—</dd></div></dl>
		<svg className="browser-benchmark-histogram" data-benchmark-histogram role="img"
			aria-label="Histogram of compiled Lean Myers latency" viewBox="0 0 620 200" /></div>
	</section>;
};
