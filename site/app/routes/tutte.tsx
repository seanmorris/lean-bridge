/**
 * Tutte's squared-rectangle construction with the shared Lean proof viewer.
 *
 * @file
 */
import TutteWorkbench from "../demos/TutteWorkbench";
import { ProofViewer } from "../components/ProofViewer";
import { BenchmarkPanel } from "../components/BenchmarkPanel";
import { assetHref } from "../urls";
import "../components/workbench-page.css";

const proofConfig = {
	core: "TutteCore.lean", proof: "Tutte.lean", dependencies: []
	, namespace: "LeanTutte", comparator: "exported_certificate"
	, theorems: ["LeanTutte.exported_certificate", "LeanTutte.current_eq_side", "LeanTutte.junction_balanced", "LeanTutte.closed_walk_zero", "LeanTutte.exported_simple", "LeanTutte.exported_threeConnected"]
	, title: "Exact fit.", emphasis: "Checked equations."
	, description: "The compiled Lean checker verifies every unit cell, each wire’s voltage drop, and each junction’s current balance. Separate proofs cover closed walks, the simplicity check, and connectivity after deleting up to two vertices."
};
const benchmarkConfig = {
	title: <>What does the<br />exact check cost?</>
	, description: "Lean/Wasm and JavaScript check the same nine squares: coverage, electrical equations, simplicity, unequal sizes, and connectivity. Five excluded runs warm both implementations."
	, initialSummary: "Preparing the squared-rectangle certificate."
	, histogramLabel: "Histogram of Lean squared-rectangle certificate latency"
	, summarize: (_: unknown, trials: number) => `${trials} matched full-certificate checks. This measures verification, not construction of a new tiling.`
};

/** Name the mathematical construction on direct loads and client navigation. */
export const meta = () => [{ title: "Tutte’s squared rectangles | Lean Bridge" }];

/** Load the circuit construction and its independently inspectable proof sources. */
export default function Tutte()
{
	const artifactBase = assetHref("/lean-tutte/");
	return <main id="main-content" className="demo-page workbench-page tutte-page"><TutteWorkbench artifactBase={artifactBase} /><BenchmarkPanel artifactBase={artifactBase} config={benchmarkConfig} /><ProofViewer artifactBase={artifactBase} config={proofConfig} /></main>;
}
