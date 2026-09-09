/**
 * Owns the lifecycle of an isolated benchmark scaffold and its compiled solver.
 *
 * @file
 */

import { useEffect, useRef } from "react";
import type { ReactNode, Ref } from "react";
import { attachBrowserBenchmark } from "../../../demos/shared/browser-benchmark.mjs";
import type { BenchmarkSample } from "../../../demos/shared/browser-benchmark.mjs";
import "./demo-page.css";

/** Copy and summary projection supplied by each algorithm's route. */
export interface BenchmarkConfig<T extends BenchmarkWorkload> {
	title: ReactNode;
	description: string;
	initialSummary: string;
	histogramLabel: string;
	summarize(benchmark: T, trialCount: number): string;
}

/** Artifact directory containing the unchanged benchmark module. */
interface BenchmarkPanelProps<T extends BenchmarkWorkload> {
	artifactBase: string;
	config: BenchmarkConfig<T>;
}

/** Prepared ownership contract exposed by the original benchmark workload. */
export interface BenchmarkWorkload {
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
 * @param root0.config Algorithm copy and checked-workload summary.
 */
export const BenchmarkPanel = <T extends BenchmarkWorkload,>({ artifactBase, config }: BenchmarkPanelProps<T>) => {
	const root = useRef<HTMLElement>(null);
	useEffect(() => {
		const element = root.current;
		if(!element) return;
		let disposed = false;
		let lifetime = 0;
		let benchmark: T | undefined;
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
				const module = await import(/* @vite-ignore */ url) as {createBenchmark(): Promise<T>};
				if(disposed || current !== lifetime) return;
				const prepared = await module.createBenchmark();
				if(disposed || current !== lifetime) prepared.dispose();
				else benchmark = prepared;
			}
			, sample: index => {
				if(!benchmark) throw new Error("The benchmark solver is not ready");
				return benchmark.sample(index);
			}
			, summarize: ({ trialCount }) => config.summarize(benchmark!, trialCount)
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
	}, [artifactBase, config]);
	return <BenchmarkScaffold rootRef={root} config={config} />;
};

/** Shared React markup, also used by the scoped grid and graph controllers. */
interface BenchmarkScaffoldProps {
	rootRef?: Ref<HTMLElement>;
	config: Pick<BenchmarkConfig<BenchmarkWorkload>, "title" | "description" | "initialSummary" | "histogramLabel">;
}

/** Render the same benchmark controls and metric leaves on every demo route. */
export function BenchmarkScaffold({ rootRef, config }: BenchmarkScaffoldProps)
{
	return <section ref={rootRef} id="browser-benchmark" className="browser-benchmark" aria-labelledby="benchmark-title">
		<div className="browser-benchmark-copy"><p className="label">Live browser benchmark</p>
			<h2 id="benchmark-title">{config.title}</h2>
			<p id="benchmark-description">{config.description}</p>
			<div className="browser-benchmark-actions"><button type="button" data-benchmark-run>Run again</button>
				<button type="button" data-benchmark-cancel className="secondary" disabled>Cancel</button></div></div>
		<div className="browser-benchmark-card"><div className="browser-benchmark-summary">
			<b data-benchmark-summary>{config.initialSummary}</b>
			<span data-benchmark-progress role="status">Waiting to enter view</span></div>
		<dl className="browser-benchmark-metrics"><div><dt>Lean median</dt><dd data-benchmark-lean>—</dd></div>
			<div><dt>Lean p95</dt><dd data-benchmark-p95>—</dd></div>
			<div><dt>JS median</dt><dd data-benchmark-js>—</dd></div>
			<div><dt>Relative cost</dt><dd data-benchmark-ratio>—</dd></div></dl>
		<svg className="browser-benchmark-histogram" data-benchmark-histogram role="img"
			aria-label={config.histogramLabel} viewBox="0 0 620 200" /></div>
	</section>;
}
