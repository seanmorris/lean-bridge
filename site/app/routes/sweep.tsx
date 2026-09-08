/**
 * Present the sweep-and-prune workbench with its unchanged proof and benchmark.
 *
 * @file
 */

import SweepWorkbench from "../demos/SweepWorkbench";
import { BenchmarkPanel } from "../components/BenchmarkPanel";
import type { BenchmarkConfig, BenchmarkWorkload } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";

interface SweepBenchmark extends BenchmarkWorkload { count: number; candidateCount: number; overlapCount: number; }

const benchmarkConfig: BenchmarkConfig<SweepBenchmark> = {
	title: <>What does a proven<br />pair search cost?</>
	, description: "Lean/Wasm and JavaScript process the same boxes. Five excluded runs warm both solvers before 100 measured samples. The benchmark checks both the candidate pairs and the final overlaps."
	, initialSummary: "Preparing the collision-pair benchmark."
	, histogramLabel: "Histogram of compiled Lean sweep-and-prune latency"
	, summarize: (benchmark, trialCount) => `${trialCount} checked comparisons of ${benchmark.count} boxes: `
		+ `${benchmark.candidateCount} axis candidates and ${benchmark.overlapCount} exact overlaps. `
		+ "Both sort and return both complete pair lists. Snapshot setup, oracle checks and warmup are excluded."
};

const proofConfig = {
	core: "SweepSpec.lean", proof: "Sweep.lean"
	, namespace: "LeanSweep", comparator: "solve_total"
	, dependencies: ["SweepProofs.lean", "SweepCore.lean"]
	, theorems: ["LeanSweep.solve_total", "LeanSweep.exported_candidates_exact", "LeanSweep.exported_overlaps_exact", "LeanSweep.exported_overlaps_unique"]
	, coreTab: "SweepCore.lean", title: "Every overlapping pair."
	, emphasis: "Reported exactly once."
	, description: "Lean checks that the returned candidate pairs match the chosen-axis overlaps and that the final pairs match overlap on every axis. Touching boundaries are included."
	, sourceLabels: { "SweepSpec.lean": "Box and pair definitions", "SweepProofs.lean": "Overlap lemmas" }
};

/** Keep the algorithm name on direct loads and client navigation. */
export const meta = () => [{ title: "Sweep-and-prune collision pairs | Lean Bridge" }];

/** Render independently owned solver, benchmark, and proof lifetimes. */
export default function Sweep()
{
	const artifactBase = assetHref("/lean-sweep-and-prune/");
	return <main id="main-content" className="demo-page sweep-page"><SweepWorkbench artifactBase={artifactBase} /><BenchmarkPanel artifactBase={artifactBase} config={benchmarkConfig} /><ProofViewer artifactBase={artifactBase} config={proofConfig} /><p className="demo-boundary">Lean accepts generic 2D and 3D integer boxes. This page draws 2D boxes and tests each displayed frame; it does not detect contact between frames.</p></main>;
}
