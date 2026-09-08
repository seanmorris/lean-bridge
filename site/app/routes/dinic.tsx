/**
 * Dinic's React workbench with unchanged proof artifacts and benchmark workload.
 *
 * @file
 */

import DinicWorkbench from "../demos/DinicWorkbench";
import { BenchmarkPanel } from "../components/BenchmarkPanel";
import type { BenchmarkConfig, BenchmarkWorkload } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";

/** Metadata returned by the existing max-flow benchmark preparation. */
interface FlowBenchmark extends BenchmarkWorkload { vertexCount: number; edgeCount: number; value: number; }

const benchmarkConfig: BenchmarkConfig<FlowBenchmark> = {
	title: <>What does proven<br />maximum flow cost?</>
	, description: "Lean/Wasm and JavaScript solve the same capacity network. Five excluded runs warm both solvers before 100 measured samples. Each comparison checks the flow value and validates the returned flow and cut."
	, initialSummary: "Preparing the flow benchmark."
	, histogramLabel: "Histogram of compiled Lean Dinic latency"
	, summarize: (benchmark, trialCount) => `${trialCount} checked maximum flows on ${benchmark.vertexCount} vertices and `
		+ `${benchmark.edgeCount} directed links. Each carries ${benchmark.value} units. `
		+ "Both return every edge flow and cut membership. Lean certification is timed; setup and warmup are excluded."
};
const proofConfig = {
	core: "FlowSpec.lean", proof: "Dinic.lean"
	, namespace: "LeanDinic", comparator: "solve_total"
	, dependencies: [
		"FlowProofs.lean", "FlowCertificate.lean", "FlowPaths.lean"
		, "FlowAugment.lean", "FlowDuality.lean", "FlowReference.lean"
		, "DinicCore.lean"
	]
	, theorems: [
		"LeanDinic.solve_total", "LeanDinic.exported_optimal"
		, "LeanDinic.exported_flow_cut_equal", "LeanDinic.flow_cut_upper_bound"
	]
	, coreTab: "DinicCore.lean", title: "A flow you can attain."
	, emphasis: "A cut you cannot exceed."
	, description: "Lean checks link capacities, conservation at each relay, and equality between the returned flow and cut capacity. Together these properties certify the maximum flow."
	, sourceLabels: { "FlowSpec.lean": "Flow definitions", "FlowProofs.lean": "Flow / cut lemmas", "FlowCertificate.lean": "Certificate checks", "FlowPaths.lean": "Residual reachability", "FlowAugment.lean": "Augmenting paths", "FlowDuality.lean": "Max-flow / min-cut equality", "FlowReference.lean": "Total reference" }
};

/** Preserve the algorithm name in direct loads and client navigation. */
export const meta = () => [{ title: "Dinic maximum flow / minimum cut | Lean Bridge" }];

/** Mount independent workbench, benchmark, and proof ownership scopes. */
export default function Dinic()
{
	const artifactBase = assetHref("/lean-dinic/");
	return <main id="main-content" className="demo-page dinic-page"><DinicWorkbench artifactBase={artifactBase} /><BenchmarkPanel artifactBase={artifactBase} config={benchmarkConfig} /><ProofViewer artifactBase={artifactBase} config={proofConfig} /></main>;
}
