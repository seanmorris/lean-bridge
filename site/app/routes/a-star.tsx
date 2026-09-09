/**
 * React a-star page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/a-star.css";
const proofConfig = {
	"core": "DijkstraCore.lean"
	, "proof": "AStar.lean"
	, "namespace": "LeanAStar"
	, "comparator": "solve_total"
	, "dependencies": [
		"Dijkstra.lean"
		, "AStarCore.lean"
		, "AStarPotential.lean"
		, "AStarChecks.lean"
		, "AStarTotal.lean"
	]
	, "theorems": [
		"LeanAStar.solve_total"
		, "LeanAStar.solve_path_shortest"
		, "LeanAStar.solve_unreachable"
		, "LeanAStar.exported_search_correct"
	]
	, "title": "A useful estimate."
	, "emphasis": "An optimal route."
	, "description": "Lean checks the graph algorithm and the conditions on its heuristic. A consistent estimate lets A* prioritize the goal while preserving the lowest total path cost."
	, "coreTab": "AStarCore.lean"
	, "sourceLabels": {
		"DijkstraCore.lean": "Dijkstra core"
		, "Dijkstra.lean": "Dijkstra proofs"
		, "AStarPotential.lean": "Heuristic lemmas"
		, "AStarChecks.lean": "Result checks"
		, "AStarTotal.lean": "Totality proofs"
	}
};
const benchmarkConfig = {
	title: <>{"What does proven"}<br />{"search cost?"}</>
	, description: "Lean/Wasm and JavaScript search the same weighted graph with the same heuristic. Five excluded runs warm both solvers before 100 measured samples."
	, initialSummary: "Preparing the search benchmark."
	, histogramLabel: "Histogram of compiled Lean A star latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Fewer detours · Proven Lean A* | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-a-star/");
	return <main id="main-content" className="demo-page workbench-page a-star-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Give search"}
						<br />
						<em>
							{"a sense of direction."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"A* uses a safe estimate of the distance left to focus its search. Paint the terrain and compare it with Dijkstra. Both find a route with the lowest total cost."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to read it"}
					</p>
					<h2 id="guide-title">
						{"Same terrain."}
						<br />
						<em>
							{"Less searching."}
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
								{"Paint either map"}
							</b>
							<p>
								{"Both maps share your walls, terrain costs, and endpoints."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Compare the tint"}
							</b>
							<p>
								{"Tinted tiles show where each algorithm actually searched."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Check the route cost"}
							</b>
							<p>
								{"A shorter route can cost more if it crosses water or forest."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab terrain-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive proof adapter"}
						</p>
						<h2 id="lab-title">
							{"Terrain route lab"}
						</h2>
					</div>
					<p id="runtime-status" className="runtime-status" role="status">
						{"Loading Lean/Wasm…"}
					</p>
				</div>
				<div className="terrain-workbench">
					<div className="result-summary" role="status" aria-live="polite">
						<div>
							<p className="label">
								{"One map, two searches"}
							</p>
							<h3 id="result-title">
								{"Preparing both routes…"}
							</h3>
							<p id="result-copy">
								{"You can paint the terrain while Lean loads."}
							</p>
						</div>
						<div className="savings">
							<b id="search-saving">
								{"—"}
							</b>
							<span id="search-saving-label">
								{"fewer tiles inspected"}
							</span>
						</div>
					</div>
					<div className="terrain-toolbar">
						<div className="terrain-actions">
							<button id="new-terrain" type="button">
								{"New terrain "}
								<span aria-hidden="true">
									{"↻"}
								</span>
							</button>
							<button id="clear-terrain" type="button" className="secondary">
								{"Clear terrain"}
							</button>
						</div>
						<form id="seed-form" className="seed-control">
							<label htmlFor="terrain-seed">
								{"Seed"}
							</label>
							<input id="terrain-seed" name="seed" defaultValue="1135cafe" maxLength={32} spellCheck="false" autoComplete="off"/>
							<button type="submit" className="secondary">
								{"Load"}
							</button>
						</form>
					</div>
					<div className="edit-toolbar">
						<div className="paint-tools" role="group" aria-label="Terrain drawing tool">
							<button type="button" data-tool="wall" aria-pressed="true" title="Paint permanent walls (W)">
								<i className="swatch wall"/>
								{"Wall"}
							</button>
							<button type="button" data-tool="floor" aria-pressed="false" title="Paint floor with an entry cost of 1 (F)">
								<i className="swatch floor"/>
								{"Floor "}
								<small>
									{"1"}
								</small>
							</button>
							<button type="button" data-tool="forest" aria-pressed="false" title="Paint forest with an entry cost of 4 (T)">
								<i className="swatch forest"/>
								{"Forest "}
								<small>
									{"4"}
								</small>
							</button>
							<button type="button" data-tool="water" aria-pressed="false" title="Paint water with an entry cost of 9 (R)">
								<i className="swatch water"/>
								{"Water "}
								<small>
									{"9"}
								</small>
							</button>
							<button type="button" data-tool="erase" aria-pressed="false" title="Erase walls and terrain back to floor (E)">
								<span className="eraser-glyph" aria-hidden="true">
									{"⌫"}
								</span>
								{"Erase"}
							</button>
						</div>
						<div className="endpoint-tools" role="group" aria-label="Move an endpoint">
							<button type="button" data-tool="start" aria-pressed="false" title="Place the start (S)">
								<i className="endpoint start">
									{"S"}
								</i>
								{"Start"}
							</button>
							<button type="button" data-tool="target" aria-pressed="false" title="Place the goal (G)">
								<i className="endpoint target">
									{"G"}
								</i>
								{"Goal"}
							</button>
						</div>
					</div>
					<div className="heuristic-toolbar">
						<fieldset className="heuristic-control">
							<legend>
								{"A* goal estimate"}
							</legend>
							<div role="group" aria-label="Heuristic strength">
								<button type="button" data-strength="0" aria-pressed="false">
									{"0%"}
								</button>
								<button type="button" data-strength="50" aria-pressed="false">
									{"50%"}
								</button>
								<button type="button" data-strength="100" aria-pressed="true">
									{"100%"}
								</button>
							</div>
						</fieldset>
						<p id="heuristic-copy">
							{"100% uses the grid distance to the goal. Each step costs at least 1, so this estimate never overstates the remaining cost."}
						</p>
					</div>
					<div className="map-comparison">
						<article className="search-panel astar-panel" aria-labelledby="astar-title">
							<header className="map-heading">
								<div>
									<p className="label">
										{"With a goal estimate"}
									</p>
									<h3 id="astar-title">
										{"A"}
										<span aria-hidden="true">
											{"✳"}
										</span>
										<span className="sr-only">
											{" star"}
										</span>
									</h3>
								</div>
								<span id="astar-estimate" className="estimate-tag">
									{"100% estimate"}
								</span>
							</header>
							<dl className="search-metrics">
								<div>
									<dt>
										{"Route cost"}
									</dt>
									<dd id="astar-cost">
										{"—"}
									</dd>
								</div>
								<div>
									<dt>
										{"Tiles inspected"}
									</dt>
									<dd id="astar-expanded">
										{"—"}
									</dd>
								</div>
								<div>
									<dt>
										{"Lean/Wasm"}
									</dt>
									<dd id="astar-time" title="Last search; graph preparation and drawing excluded.">
										{"—"}
									</dd>
								</div>
							</dl>
							<div className="map-surface">
								<canvas id="astar-map" width="990" height="630" tabIndex={0} role="img" aria-label="Editable A star terrain map. Use arrow keys to move and Space to apply the selected tool." aria-describedby="edit-hint"/>
							</div>
							<p id="astar-route" className="route-caption">
								{"Finding the cheapest route…"}
							</p>
						</article>
						<article className="search-panel dijkstra-panel" aria-labelledby="dijkstra-title">
							<header className="map-heading">
								<div>
									<p className="label">
										{"Without a goal estimate"}
									</p>
									<h3 id="dijkstra-title">
										{"Dijkstra"}
									</h3>
								</div>
								<span className="estimate-tag">
									{"0% estimate"}
								</span>
							</header>
							<dl className="search-metrics">
								<div>
									<dt>
										{"Route cost"}
									</dt>
									<dd id="dijkstra-cost">
										{"—"}
									</dd>
								</div>
								<div>
									<dt>
										{"Tiles inspected"}
									</dt>
									<dd id="dijkstra-expanded">
										{"—"}
									</dd>
								</div>
								<div>
									<dt>
										{"Lean/Wasm"}
									</dt>
									<dd id="dijkstra-time" title="Last search; graph preparation and drawing excluded.">
										{"—"}
									</dd>
								</div>
							</dl>
							<div className="map-surface">
								<canvas id="dijkstra-map" width="990" height="630" tabIndex={0} role="img" aria-label="Editable Dijkstra terrain map. Changes also update the A star map. Use arrow keys and Space to draw." aria-describedby="edit-hint"/>
							</div>
							<p id="dijkstra-route" className="route-caption">
								{"Finding the cheapest route…"}
							</p>
						</article>
					</div>
					<div className="map-legend" aria-label="Map legend">
						<span>
							<i className="route-swatch"/>
							{"Lowest-cost route"}
						</span>
						<span>
							<i className="inspected-swatch astar"/>
							{"A* inspected"}
						</span>
						<span>
							<i className="inspected-swatch dijkstra"/>
							{"Dijkstra inspected"}
						</span>
						<span className="terrain-cost-note">
							{"Terrain number = cost to enter a tile"}
						</span>
					</div>
					<p id="edit-hint" className="edit-hint">
						{"Wall tool: click or drag on either map. Choose Erase to remove walls. Arrow keys move the cursor; Space paints."}
					</p>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				{"Both panels run the same compiled Lean graph search. JavaScript turns terrain costs into graph edges."}
			</p>
			<a href={artifactBase + "AStar.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
