/**
 * React tarjan page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/tarjan.css";
const proofConfig = {
	"core": "TarjanCore.lean"
	, "proof": "Tarjan.lean"
	, "namespace": "LeanTarjan"
	, "comparator": "solve_total"
	, "dependencies": [
		"TarjanReachability.lean"
		, "TarjanCertificate.lean"
		, "TarjanChecks.lean"
		, "TarjanTotal.lean"
	]
	, "theorems": [
		"LeanTarjan.solve_total"
		, "LeanTarjan.exported_same_iff"
		, "LeanTarjan.solve_maximal"
		, "LeanTarjan.condensation_acyclic"
	]
	, "title": "One group exactly when"
	, "emphasis": "both directions connect."
	, "description": "The graph supplies directed links. Lean proves that two vertices share a returned component exactly when each can reach the other through those links."
	, "coreTab": "TarjanCore.lean"
	, "sourceLabels": {
		"TarjanReachability.lean": "Reachability"
		, "TarjanCertificate.lean": "Certificate lemmas"
		, "TarjanChecks.lean": "Result checks"
		, "TarjanTotal.lean": "Totality proofs"
	}
};
const benchmarkConfig = {
	title: <>{"What does proven"}<br />{"grouping cost?"}</>
	, description: "Lean/Wasm and JavaScript classify the same directed graph. Five excluded runs warm both solvers before 100 measured samples. Each comparison checks that both partitions agree."
	, initialSummary: "Preparing the component benchmark."
	, histogramLabel: "Histogram of compiled Lean Tarjan latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Find the groups · Proven Lean Tarjan | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-tarjan/");
	return <main id="main-content" className="demo-page workbench-page tarjan-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Find the modules"}
						<br />
						<em>
							{"tied together."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"A dependency loop can involve a whole group of modules. Tarjan finds every group whose members can all reach one another. Collapse those groups to see the dependencies between them."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to read it"}
					</p>
					<h2 id="guide-title">
						{"Follow the arrows."}
						<br />
						<em>
							{"Find the groups."}
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
								{"Compare the colors"}
							</b>
							<p>
								{"Modules with the same color belong to one strongly connected group."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Add a feedback edge"}
							</b>
							<p>
								{"One import can join several existing groups into a larger dependency loop."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Collapse the groups"}
							</b>
							<p>
								{"Each group becomes one node. No directed loop remains between groups."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab module-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive proof adapter"}
						</p>
						<h2 id="lab-title">
							{"Module dependency workbench"}
						</h2>
					</div>
					<p id="runtime-status" className="runtime-status" role="status">
						{"Loading Lean/Wasm…"}
					</p>
				</div>
				<div className="module-workbench">
					<div className="result-summary" role="status" aria-live="polite">
						<div>
							<p className="label">
								{"Strongly connected components"}
							</p>
							<h3 id="result-title">
								{"Finding the module groups…"}
							</h3>
							<p id="result-copy">
								{"Lean is preparing the dependency graph."}
							</p>
						</div>
						<dl className="summary-metrics">
							<div>
								<dt>
									{"Modules"}
								</dt>
								<dd id="module-count">
									{"8"}
								</dd>
							</div>
							<div>
								<dt>
									{"Groups"}
								</dt>
								<dd id="group-count">
									{"—"}
								</dd>
							</div>
							<div>
								<dt>
									{"Groups with loops"}
								</dt>
								<dd id="cyclic-count">
									{"—"}
								</dd>
							</div>
						</dl>
					</div>
					<div className="graph-toolbar">
						<div className="preset-controls" role="group" aria-label="Dependency example">
							<button type="button" data-preset="groups" aria-pressed="true">
								{"Mutual groups"}
							</button>
							<button type="button" data-preset="acyclic" aria-pressed="false">
								{"Acyclic example"}
							</button>
						</div>
						<div className="graph-actions">
							<button id="add-module" className="secondary" type="button">
								{"+ Add module"}
							</button>
							<button id="collapse-groups" type="button" aria-pressed="false">
								{"Collapse groups"}
							</button>
						</div>
					</div>
					<div className="feedback-toolbar">
						<div>
							<span className="try-label">
								{"Try one change"}
							</span>
							<p id="feedback-copy">
								{"Metrics → Routes closes a loop across three groups."}
							</p>
						</div>
						<button id="toggle-feedback" className="secondary" type="button" aria-pressed="false">
							{"Add feedback edge "}
							<span aria-hidden="true">
								{"↶"}
							</span>
						</button>
					</div>
					<div className="graph-workspace">
						<div className="graph-panel">
							<div className="canvas-heading">
								<div>
									<p className="label" id="graph-label">
										{"Original module graph"}
									</p>
									<h3 id="graph-title">
										{"Every module, every import"}
									</h3>
								</div>
								<button id="show-all" className="quiet" type="button" disabled>
									{"Show all groups"}
								</button>
							</div>
							<div className="graph-scroll">
								<div id="graph-canvas" className="graph-canvas" tabIndex={-1}>
									<svg id="graph-svg" className="graph-svg" aria-hidden="true"/>
									<div id="node-layer" className="node-layer" data-workbench-leaf=""/>
								</div>
							</div>
							<div className="graph-legend">
								<span>
									<i className="legend-arrow" aria-hidden="true">
										{"→"}
									</i>
									{"A imports B"}
								</span>
								<span>
									<i className="legend-group" aria-hidden="true"/>
									{"Same color = same group"}
								</span>
								<span id="view-note">
									{"Drag modules to move them."}
								</span>
							</div>
							<p id="graph-hint" className="graph-hint">
								{"Select a module to edit its imports. Select a group to highlight all its members."}
							</p>
						</div>
						<aside className="graph-inspector">
							<section className="group-inspector" aria-labelledby="groups-title">
								<div className="inspector-heading">
									<p className="label" id="groups-title">
										{"Groups found by Lean"}
									</p>
									<span id="group-list-count">
										{"—"}
									</span>
								</div>
								<div id="group-list" className="group-list" data-workbench-leaf=""/>
								<p id="group-members" className="group-members">
									{"Each module will belong to exactly one group."}
								</p>
							</section>
							<section className="module-editor" aria-labelledby="editor-title">
								<p className="label" id="editor-title">
									{"Edit a module"}
								</p>
								<label className="module-name" htmlFor="module-name">
									{"Module name"}
									<input id="module-name" maxLength={32} autoComplete="off" spellCheck="false" defaultValue="Routes"/>
								</label>
								<p className="imports-title">
									<b id="imports-title">
										{"Routes imports"}
									</b>
									<span>
										{"Toggle an arrow"}
									</span>
								</p>
								<div id="import-list" className="import-list" data-workbench-leaf=""/>
								<button id="remove-module" className="remove-module secondary" type="button">
									{"Remove this module"}
								</button>
							</section>
						</aside>
					</div>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				{"Lean classifies a generic directed graph. The module names, card positions, and collapsed view come from the browser adapter."}
			</p>
			<a href={artifactBase + "Tarjan.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
