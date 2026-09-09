/**
 * React flood-fill page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/flood-fill.css";
const proofConfig = {
	"core": "FloodFillCore.lean"
	, "proof": "FloodFill.lean"
	, "namespace": "LeanFloodFill"
	, "comparator": "capabilityClosureCsr_correct"
	, "dependencies": []
	, "theorems": [
		"LeanFloodFill.floodFillCsr_correct"
		, "LeanFloodFill.capabilityClosureCsr_correct"
	]
	, "title": "Reachability—and the"
	, "emphasis": "least fixed point."
	, "description": "The final key set is proven stable and contained in every other stable set that contains the starting inventory."
	, "coreTab": "FloodFillCore.lean"
};
const benchmarkConfig = {
	title: <>{"How fast is the"}<br />{"key closure?"}</>
	, description: "The gated graph is prepared once. Five excluded runs warm both solvers, then Lean/Wasm and optimized JavaScript solve it 100 times and must return identical rooms and keys."
	, initialSummary: "No benchmark run yet."
	, histogramLabel: "Histogram of checked capability-closure latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Open rooms · Proven Lean flood fill | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-flood-fill/");
	return <main id="main-content" className="demo-page workbench-page flood-fill-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Which rooms are"}
						<br />
						<em>
							{"open to you?"}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"Begin at "}
					<b>
						{"◎"}
					</b>
					{". Bright tiles are places the player can reach right now; dark rooms are cut off by walls or locked doors. Tell the solver which keys were found and watch the reachable world change."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div className="guide-intro">
					<p className="label">
						{"How to read the demo"}
					</p>
					<h2 id="guide-title">
						{"One question,"}
						<br />
						<em>
							{"three steps."}
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
								{"Start at ◎"}
							</b>
							<p>
								{"The fill begins at the marked entrance in Room 01."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Choose found keys"}
							</b>
							<p>
								{"Keys enable matching doors. Bright rooms and tiles are reachable."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Try Auto-find"}
							</b>
							<p>
								{"Lean collects reachable keys and repeats until nothing new opens."}
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
							{"Reachability workbench"}
						</h2>
					</div>
					<p className="runtime-status">
						{"Generic directed graph"}
					</p>
				</div>
				<div className="workspace" aria-label="Editable room reachability demo">
					<aside className="controls">
						<div className="control-group">
							<p className="label">
								{"Key handling"}
							</p>
							<div className="segmented" role="radiogroup" aria-label="Inventory logic">
								<button className="inventory-mode active" data-inventory="manual" role="radio" aria-checked="true">
									{"Choose found"}
								</button>
								<button className="inventory-mode" data-inventory="auto" role="radio" aria-checked="false">
									{"Auto-find"}
								</button>
							</div>
							<p id="inventory-help" className="help">
								{"Click the keys below to say exactly which ones the player has found."}
							</p>
						</div>
						<div className="control-group">
							<p className="label">
								{"Keys found"}
							</p>
							<div id="keys" className="key-list" data-workbench-leaf=""/>
							<div className="result-summary" role="status" aria-live="polite">
								<div>
									<b id="result-title">
										{"Starting at the entrance…"}
									</b>
									<p id="result-explanation">
										{"Lean/Wasm is computing which floor tiles can be reached."}
									</p>
								</div>
								<div id="next-actions" className="next-actions" hidden data-workbench-leaf=""/>
							</div>
						</div>
						<details className="control-group editor-disclosure" open>
							<summary>
								<span>
									{"Room tile editor"}
								</span>
								<small id="editor-state">
									{"Active"}
								</small>
							</summary>
							<p id="editor-tool-help" className="help">
								{"Drag from floor to paint walls; start on a wall to erase them. Every edit is solved immediately by Lean/Wasm."}
							</p>
							<div className="tool-list" role="radiogroup" aria-label="Tile editing tool">
								<button className="tool active" data-tool="wall" role="radio" aria-checked="true">
									{"Toggle wall"}
								</button>
								<button className="tool" data-tool="key" role="radio" aria-checked="false">
									{"Place a key"}
								</button>
								<button className="tool" data-tool="ledge" role="radio" aria-checked="false">
									{"Paint ledges"}
								</button>
								<button className="tool" data-tool="entrance" role="radio" aria-checked="false">
									{"Move start"}
								</button>
							</div>
							<div className="picker-slot">
								<div id="key-picker" className="mini-picker" aria-label="Key to place" hidden data-workbench-leaf=""/>
								<div id="direction-picker" className="mini-picker" aria-label="One-edge or two-edge ledge mode" hidden data-workbench-leaf=""/>
							</div>
						</details>
						<div className="actions">
							<button id="new-map">
								{"New map"}
							</button>
							<button id="reset-edits" className="secondary">
								{"Reset edits"}
							</button>
						</div>
						<p className="seed">
							{"Map seed "}
							<button id="seed" title="Copy seed">
								{"—"}
							</button>
						</p>
					</aside>
					<div className="maps">
						<div className="panel overview-panel">
							<div className="panel-heading">
								<div>
									<p className="label">
										{"World graph"}
									</p>
									<h2>
										{"Connected rooms"}
									</h2>
								</div>
								<div id="status" className="status" role="status">
									{"Loading Lean/Wasm…"}
								</div>
							</div>
							<div className="connection-legend" aria-hidden="true">
								<span>
									<i className="open-link"/>
									{"Open"}
								</span>
								<span>
									<i className="closed-link"/>
									{"Closed"}
								</span>
								<span>
									<i className="keyed-link"/>
									{"Glyph/color = required key"}
								</span>
								<span className="missing-link">
									<i className="missing-key-link"/>
									{"Dim = key not held"}
								</span>
							</div>
							<div className="world-scroll">
								<div id="world" className="world" aria-label="Graph of connected rooms" data-workbench-leaf=""/>
							</div>
							<p className="map-help">
								<b>
									{"Bright room"}
								</b>
								{" = reachable from ◎. Each door marker combines an open/closed status badge with its required-key glyph; a dim connection needs a key you have not found. Select a room, then use its gold door tile to edit either property."}
							</p>
						</div>
						<div className="panel room-panel">
							<div className="panel-heading">
								<div>
									<p className="label">
										{"Room detail"}
									</p>
									<h2 id="room-name">
										{"—"}
									</h2>
								</div>
								<div className="metrics">
									<span>
										<b id="reachable-count">
											{"—"}
										</b>
										{" reachable tiles"}
									</span>
									<span>
										<b id="runtime">
											{"—"}
										</b>
										{" ms"}
									</span>
								</div>
							</div>
							<p className="room-edit-help">
								<b id="room-edit-state">
									{"Editing is active."}
								</b>
								<span id="room-edit-copy">
									{"Click or drag with the selected tool; gold door tiles have separate key and open/closed controls."}
								</span>
							</p>
							<div id="room-grid" className="room-grid" aria-label="Editable room tile map" data-workbench-leaf=""/>
							<div className="legend" aria-hidden="true">
								<span>
									{"◎ Start"}
								</span>
								<span>
									<i className="reach"/>
									{"Reachable floor"}
								</span>
								<span>
									<i className="blocked"/>
									{"Unreachable floor"}
								</span>
								<span>
									<i className="solid"/>
									{"Solid wall"}
								</span>
								<span>
									{"◆ Key"}
								</span>
								<span>
									<i className="ledge-symbol">
										{"→"}
									</i>
									{"One-way ledge"}
								</span>
								<span>
									{"▣ Door control"}
								</span>
							</div>
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
					{"The room model is not trusted Lean code."}
				</b>
				{" It becomes a generic directed CSR graph before the compiled solver sees it."}
			</p>
			<a href={artifactBase + "FloodFill.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
