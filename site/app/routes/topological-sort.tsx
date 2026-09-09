/**
 * React topological-sort page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/topological-sort.css";
const proofConfig = {
	"core": "TopologicalSortCore.lean"
	, "proof": "TopologicalSort.lean"
	, "namespace": "LeanTopologicalSort"
	, "comparator": "solve_total"
	, "dependencies": [
		"TopologicalSortOrderLemmas.lean"
		, "TopologicalSortTotal.lean"
		, "TopologicalSortChecks.lean"
		, "TopologicalSortCycleLemmas.lean"
	]
	, "theorems": [
		"LeanTopologicalSort.solve_total"
		, "LeanTopologicalSort.solveGraph_total"
		, "LeanTopologicalSort.solve_result_correct"
		, "LeanTopologicalSort.solve_order_correct"
		, "LeanTopologicalSort.solve_cycle_correct"
	]
	, "title": "A full order,"
	, "emphasis": "or a real loop."
	, "description": "Every valid graph produces a result. Lean proves that a schedule contains every vertex exactly once with every edge pointing forward, or that a cycle closes through real input edges without repeated vertices."
	, "coreTab": "TopologicalSortCore.lean"
	, "sourceLabels": {
		"TopologicalSortTotal.lean": "Total solver"
		, "TopologicalSortChecks.lean": "Graph checks"
		, "TopologicalSortOrderLemmas.lean": "Order lemmas"
		, "TopologicalSortCycleLemmas.lean": "Cycle lemmas"
	}
};
const benchmarkConfig = {
	title: <>{"What does a checked"}<br />{"build schedule cost?"}</>
	, description: "The graph is prepared once. Five excluded runs warm both solvers, then Lean/Wasm and an optimized typed-array JavaScript Kahn solver schedule the same 512 tasks and 2,038 dependencies 100 times. Every returned order is validated."
	, initialSummary: "No benchmark run yet."
	, histogramLabel: "Histogram of checked Lean topological-sort latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Build graph · Proven Lean topological sort | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-topological-sort/");
	return <main id="main-content" className="demo-page workbench-page topological-sort-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Ship in order."}
						<br />
						<em>
							{"Catch every cycle."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"Edit a build graph. Lean/Wasm returns a complete legal schedule, or isolates the exact dependency loop that makes one impossible."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to use it"}
					</p>
					<h2 id="guide-title">
						{"Select a task."}
						<br />
						<em>
							{"Wire its inputs."}
						</em>
					</h2>
				</div>
				<ol>
					<li>
						<span>
							{"1"}
						</span>
						<div>
							<b>
								{"Choose a task"}
							</b>
							<p>
								{"Click a card in the graph to edit what must finish before it."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Toggle dependencies"}
							</b>
							<p>
								{"Every change is sent to the generic Lean graph solver."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Read the verdict"}
							</b>
							<p>
								{"Get a legal build order, or a highlighted cycle you can remove."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab build-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive proof adapter"}
						</p>
						<h2 id="lab-title">
							{"Dependency workbench"}
						</h2>
					</div>
					<p id="runtime-status" className="runtime-status" role="status">
						{"Loading Lean/Wasm…"}
					</p>
				</div>
				<div className="workbench">
					<div className="verdict" role="status" aria-live="polite">
						<div>
							<p className="label">
								{"Lean’s verdict"}
							</p>
							<h3 id="verdict-title">
								{"Checking the pipeline…"}
							</h3>
							<p id="verdict-copy">
								{"The verified module is loading."}
							</p>
						</div>
						<div className="verdict-metrics">
							<span>
								<b id="task-count">
									{"0"}
								</b>
								{" tasks"}
							</span>
							<span>
								<b id="edge-count">
									{"0"}
								</b>
								{" dependencies"}
							</span>
							<span>
								<b id="solve-time">
									{"—"}
								</b>
								{" Lean/Wasm"}
							</span>
						</div>
					</div>
					<div className="graph-panel">
						<div className="graph-toolbar">
							<div>
								<p className="label">
									{"Build graph"}
								</p>
								<b>
									{"Prerequisite → dependent task"}
								</b>
							</div>
							<div>
								<button id="healthy-preset" className="secondary">
									{"Healthy pipeline"}
								</button>
								<button id="cycle-preset">
									{"Introduce a cycle"}
								</button>
								<button id="new-graph" className="secondary">
									{"New graph"}
								</button>
							</div>
						</div>
						<div id="graph-canvas" className="graph-canvas" aria-label="Editable build dependency graph">
							<svg id="graph-edges" className="graph-edges" aria-hidden="true">
								<defs>
									<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
										<path d="M 0 0 L 10 5 L 0 10 z"/>
									</marker>
									<marker id="cycle-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
										<path d="M 0 0 L 10 5 L 0 10 z"/>
									</marker>
								</defs>
							</svg>
							<div id="task-layer" className="task-layer" data-workbench-leaf=""/>
						</div>
						<p className="graph-hint">
							{"Drag cards to arrange them. Click any dependency line to remove it."}
						</p>
					</div>
					<aside className="task-editor">
						<div>
							<p className="label">
								{"Selected task"}
							</p>
							<label className="task-name">
								<span>
									{"Name"}
								</span>
								<input id="task-name" maxLength={20} autoComplete="off"/>
							</label>
						</div>
						<div className="dependency-editor">
							<p className="label">
								{"Must run first"}
							</p>
							<p>
								{"Toggle every task that the selected task depends on."}
							</p>
							<div id="dependency-list" className="dependency-list" data-workbench-leaf=""/>
						</div>
						<div className="task-actions">
							<button id="add-task">
								{"+ Add task"}
							</button>
							<button id="delete-task" className="secondary">
								{"Delete selected"}
							</button>
						</div>
					</aside>
					<div className="schedule-panel">
						<div>
							<p className="label">
								{"Checked output"}
							</p>
							<h3 id="schedule-title">
								{"Build schedule"}
							</h3>
						</div>
						<div id="schedule" className="schedule" aria-label="Lean topological result" data-workbench-leaf=""/>
					</div>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				<b>
					{"The build editor remains browser code."}
				</b>
				{" Lean proves the finite directed-graph result returned for the endpoint pairs it receives."}
			</p>
			<a href={artifactBase + "TopologicalSort.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
