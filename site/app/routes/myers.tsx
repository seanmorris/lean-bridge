/**
 * Host the Myers pilot using the existing published Lean artifacts and shared controls.
 *
 * @file
 */

import MyersWorkbench from "../demos/MyersWorkbench";
import { ProofViewer } from "../components/ProofViewer";
import { BenchmarkPanel } from "../components/BenchmarkPanel";
import type { BenchmarkConfig, BenchmarkWorkload } from "../components/BenchmarkPanel";
import { assetHref } from "../urls";

/** Metadata returned by the unchanged Myers workload. */
interface MyersBenchmark extends BenchmarkWorkload {
	beforeLength: number;
	afterLength: number;
	distance: number;
}

const benchmarkConfig: BenchmarkConfig<MyersBenchmark> = {
	title: <>What does a proven<br />shortest diff cost?</>
	, description: "Lean/Wasm and JavaScript compare the same token sequences. Five excluded runs warm both solvers before 100 measured samples. Each comparison checks the edit count and replays the returned script."
	, initialSummary: "Preparing the edit-script benchmark."
	, histogramLabel: "Histogram of compiled Lean Myers latency"
	, summarize: (benchmark, trialCount) => `${trialCount} checked shortest scripts from ${benchmark.beforeLength} to `
		+ `${benchmark.afterLength} tokens, each requiring ${benchmark.distance} edits. `
		+ "Both return every operation. Lean certification is timed; tokenization, setup and warmup are excluded."
};

const proofConfig = {
	core: "EditSpec.lean", proof: "Myers.lean"
	, namespace: "LeanMyers", comparator: "solve_total"
	, dependencies: [
		"EditProofs.lean", "EditReference.lean", "ArrayScriptCheck.lean"
		, "ScoreCertificate.lean", "MyersCore.lean", "EditCertificate.lean"
	]
	, theorems: [
		"LeanMyers.solve_total", "LeanMyers.exported_shortest"
		, "LeanMyers.exported_reconstructs", "LeanMyers.potential_lower_bound"
	]
	, coreTab: "MyersCore.lean", title: "The target reconstructed."
	, emphasis: "The fewest edits proved."
	, description: "Lean proves that applying the returned script produces the target sequence and that no insertion/deletion script uses fewer edits."
	, sourceLabels: { "EditSpec.lean": "Edit definitions", "EditProofs.lean": "Edit lemmas", "EditReference.lean": "Total reference", "ArrayScriptCheck.lean": "Array script validation", "ScoreCertificate.lean": "Weighted-score certificate", "EditCertificate.lean": "Certificate checks" }
};

/** Preserve the algorithm name in direct loads and client navigation. */
export const meta = () => [{ title: "Myers shortest edit script | Lean Bridge" }];

/** Mount independently owned workbench, benchmark, and proof lifetimes. */
export default function Myers()
{
	const artifactBase = assetHref("/lean-myers/");
	return <main id="main-content" className="demo-page myers-page"><MyersWorkbench artifactBase={artifactBase} /><BenchmarkPanel artifactBase={artifactBase} config={benchmarkConfig} /><ProofViewer artifactBase={artifactBase} config={proofConfig} /></main>;
}
