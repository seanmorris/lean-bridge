/**
 * React dijkstra page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/dijkstra.css";
const proofConfig = {
	"core": "DijkstraCore.lean"
	, "proof": "Dijkstra.lean"
	, "namespace": "LeanDijkstra"
	, "comparator": "dijkstraCsr_correct"
	, "dependencies": []
	, "theorems": [
		"LeanDijkstra.dijkstra_correct"
		, "LeanDijkstra.dijkstraCsr_correct"
	]
	, "title": "Don’t trust the badge."
	, "emphasis": "Read the proof."
	, "description": "The displayed source is hashed against a receipt generated only after the pinned Lean compiler accepts every declaration."
	, "coreTab": "DijkstraCore.lean"
};
const benchmarkConfig = {
	title: <>{"How fast is a"}<br />{"checked shortest path?"}</>
	, description: "The weighted graph is prepared once. Five excluded runs warm both solvers, then Lean/Wasm and optimized JavaScript solve 100 endpoint requests and must return paths with the same cost."
	, initialSummary: "No benchmark run yet."
	, histogramLabel: "Histogram of checked Dijkstra latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Proven paths · Lean Dijkstra | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-dijkstra/");
	return <main id="main-content" className="demo-page workbench-page dijkstra-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Draw a problem."}
						<br />
						<em>
							{"Get a proven path."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"A generic weighted-graph Dijkstra implementation, compiled from Lean. The grid is only a graph-building interface."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to use it"}
					</p>
					<h2 id="guide-title">
						{"Draw a route."}
						<br />
						<em>
							{"Change the graph."}
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
								{"Paint walls"}
							</b>
							<p>
								{"Click or drag to remove cells from the graph."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Place endpoints"}
							</b>
							<p>
								{"Switch modes to move the start and destination."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Read the path"}
							</b>
							<p>
								{"Lean returns the lowest-cost valid route that remains."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive proof adapter"}
						</p>
						<h2 id="lab-title">
							{"Pathfinding workbench"}
						</h2>
					</div>
					<p className="runtime-status">
						{"Generic weighted graph"}
					</p>
				</div>
				<div className="workspace" aria-label="Dijkstra pathfinding demo">
					<aside className="controls">
						<div className="control-group">
							<p className="label">
								{"Edit mode"}
							</p>
							<div className="mode-list" role="radiogroup" aria-label="Grid edit mode">
								<button className="mode active" data-mode="wall" role="radio" aria-checked="true">
									<span className="mode-key">
										{"1"}
									</span>
									<span>
										<b>
											{"Walls"}
										</b>
										<small>
											{"Click or drag"}
										</small>
									</span>
								</button>
								<button className="mode" data-mode="start" role="radio" aria-checked="false">
									<span className="mode-key start-key">
										{"2"}
									</span>
									<span>
										<b>
											{"Start"}
										</b>
										<small>
											{"Place origin"}
										</small>
									</span>
								</button>
								<button className="mode" data-mode="end" role="radio" aria-checked="false">
									<span className="mode-key end-key">
										{"3"}
									</span>
									<span>
										<b>
											{"End"}
										</b>
										<small>
											{"Place target"}
										</small>
									</span>
								</button>
							</div>
						</div>
						<div className="actions">
							<button id="maze" className="secondary">
								{"New maze"}
							</button>
							<button id="clear" className="secondary">
								{"Clear walls"}
							</button>
						</div>
						<div className="proof-card">
							<div className="proof-icon">
								{"λ"}
							</div>
							<div>
								<b>
									{"Certified result"}
								</b>
								<p>
									{"Lean checks path validity, exact cost, and feasible distance labels before returning a route."}
								</p>
							</div>
						</div>
					</aside>
					<div className="board-panel">
						<div className="board-topline">
							<div id="status" className="status" role="status">
								<span className="spinner"/>
								{" Loading Lean/Wasm…"}
							</div>
							<div className="metrics">
								<span>
									<b id="steps">
										{"—"}
									</b>
									{" steps"}
								</span>
								<span>
									<b id="visited">
										{"—"}
									</b>
									{" vertices"}
								</span>
							</div>
						</div>
						<div id="grid" className="grid" aria-label="Editable pathfinding grid" data-workbench-leaf=""/>
						<div className="legend" aria-hidden="true">
							<span>
								<i className="start-swatch"/>
								{"Start"}
							</span>
							<span>
								<i className="end-swatch"/>
								{"End"}
							</span>
							<span>
								<i className="path-swatch"/>
								{"Shortest path"}
							</span>
							<span>
								<i className="wall-swatch"/>
								{"Wall"}
							</span>
						</div>
					</div>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				<b>
					{"Proof-backed, not JavaScript-backed."}
				</b>
				{" JavaScript constructs a sparse weighted graph; the route is computed by the compiled Lean core."}
			</p>
			<a href={artifactBase + "Dijkstra.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
