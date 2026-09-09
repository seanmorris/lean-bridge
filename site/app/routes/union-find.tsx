/**
 * React union-find page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/union-find.css";
const proofConfig = {
	"core": "UnionFindCore.lean"
	, "proof": "UnionFind.lean"
	, "namespace": "LeanUnionFind"
	, "comparator": "solvePartition_correct"
	, "dependencies": []
	, "theorems": [
		"LeanUnionFind.fastRepresentatives_correct"
		, "LeanUnionFind.solvePartition_correct"
	]
	, "title": "Equal roots mean"
	, "emphasis": "connected inputs."
	, "description": "The checked result uses real input links as witnesses. Every input link remains inside one returned class, and every equal representative has a witnessed link path."
	, "coreTab": "UnionFindCore.lean"
};
const benchmarkConfig = {
	title: <>{"What does checked"}<br />{"connectivity cost?"}</>
	, description: "The connected graph is prepared once. Five excluded runs warm both solvers, then Lean/Wasm and optimized typed-array JavaScript partition the same 653 elements and 2,611 links 100 times. Every result pair must describe the same connected components."
	, initialSummary: "No benchmark run yet."
	, histogramLabel: "Histogram of checked Lean partition latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Percolation lab · Proven Lean union-find | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-union-find/");
	return <main id="main-content" className="demo-page workbench-page union-find-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Will water"}
						<br />
						<em>
							{"get through?"}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"Open pores in a material sample. Water enters connected pores from the top. Lean/Wasm identifies the first cluster that reaches the outlet."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to read it"}
					</p>
					<h2 id="guide-title">
						{"One partition,"}
						<br />
						<em>
							{"two scales."}
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
								{"Open pores"}
							</b>
							<p>
								{"Click, drag, step, or run a randomized opening order."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Watch water enter"}
							</b>
							<p>
								{"Cyan pores belong to the open cluster connected to the inlet."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Reach the outlet"}
							</b>
							<p>
								{"The material percolates when that wet cluster crosses the sample."}
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
							{"Percolation lab"}
						</h2>
					</div>
					<p id="runtime-status" className="runtime-status" role="status">
						{"Loading Lean/Wasm…"}
					</p>
				</div>
				<div className="workspace">
					<div className="result-card" role="status" aria-live="polite">
						<p className="label">
							{"Current result"}
						</p>
						<div>
							<h3 id="result-title">
								{"Preparing the sample…"}
							</h3>
							<p id="result-copy">
								{"The checked module is loading."}
							</p>
						</div>
					</div>
					<aside className="controls">
						<dl className="metrics">
							<div>
								<dt>
									{"Open passages"}
								</dt>
								<dd id="active-count">
									{"0 / 651"}
								</dd>
							</div>
							<div>
								<dt>
									{"Porosity"}
								</dt>
								<dd id="density">
									{"0.0%"}
								</dd>
							</div>
							<div>
								<dt>
									{"Pore clusters"}
								</dt>
								<dd id="component-count">
									{"0"}
								</dd>
							</div>
							<div>
								<dt>
									{"Lean/Wasm"}
								</dt>
								<dd id="runtime">
									{"—"}
								</dd>
							</div>
						</dl>
						<div className="control-group">
							<p className="label">
								{"Random sequence"}
							</p>
							<div className="button-grid">
								<button id="run">
									{"Resume"}
								</button>
								<button id="pause">
									{"Pause"}
								</button>
								<button id="step">
									{"Open one"}
								</button>
								<button id="reset">
									{"Restart"}
								</button>
							</div>
							<button id="new-material" className="wide secondary">
								{"New maze"}
							</button>
						</div>
						<div className="control-group draw-panel">
							<p className="label">
								{"Draw tool"}
							</p>
							<div className="draw-tools" role="group" aria-label="Maze drawing tool">
								<button id="tool-open" aria-pressed="true" title="Draw open passages (O)">
									<i className="open-swatch"/>
									{"Open"}
								</button>
								<button id="tool-seal" aria-pressed="false" title="Close passages (C)">
									<i className="close-swatch"/>
									{"Close"}
								</button>
								<button id="tool-wall" aria-pressed="false" title="Draw walls (W)">
									<i className="wall-swatch"/>
									{"Wall"}
								</button>
							</div>
							<p id="edit-status" className="edit-status">
								{"Open tool selected. Drag across the maze to draw open passages."}
							</p>
						</div>
						<div className="seed">
							<label htmlFor="seed">
								{"Maze seed"}
							</label>
							<div>
								<input id="seed" inputMode="text" maxLength={10} spellCheck="false" aria-label="Maze seed in hexadecimal"/>
								<button id="apply-seed" type="button">
									{"Load"}
								</button>
							</div>
						</div>
					</aside>
					<div className="sample-panel">
						<div className="sample-toolbar">
							<div>
								<p className="label">
									{"Live sample"}
								</p>
								<b id="sample-title">
									{"Porous material"}
								</b>
							</div>
							<p>
								{"Water enters through open passages along the inlet."}
							</p>
						</div>
						<div className="sample-scroll">
							<div className="sample-shell">
								<div id="top-boundary" className="boundary top">
									{"Inlet"}
								</div>
								<div id="site-grid" className="site-grid" role="grid" aria-label="Editable percolation sample" data-workbench-leaf=""/>
								<div id="bottom-boundary" className="boundary bottom">
									{"Outlet"}
								</div>
							</div>
						</div>
						<div id="legend" className="legend" aria-hidden="true" data-workbench-leaf=""/>
					</div>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				<b>
					{"The grid adapter remains browser code."}
				</b>
				{" Lean proves the finite-index partition returned for the pairs it receives."}
			</p>
			<a href={artifactBase + "UnionFind.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
