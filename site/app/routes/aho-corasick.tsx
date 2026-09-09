/**
 * React aho-corasick page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/aho-corasick.css";
const proofConfig = {
	"core": "AhoCorasickCore.lean"
	, "proof": "AhoCorasick.lean"
	, "namespace": "LeanAhoCorasick"
	, "comparator": "scan_result_correct"
	, "dependencies": []
	, "theorems": [
		"LeanAhoCorasick.compile_trie_invariant"
		, "LeanAhoCorasick.compile_failure_invariant"
		, "LeanAhoCorasick.scan_result_correct"
		, "LeanAhoCorasick.scan_matches_sound"
		, "LeanAhoCorasick.scan_matches_complete"
	]
	, "title": "Every reported hit."
	, "emphasis": "Every real hit."
	, "description": "The compiled result is checked in both directions: each emitted span equals its named pattern, and every pattern occurrence in the input appears in the result—even when spans overlap or patterns are duplicates."
	, "coreTab": "AhoCorasickCore.lean"
};
const benchmarkConfig = {
	title: <>{"What does a checked"}<br />{"multi-pattern scan cost?"}</>
	, description: "The 28-pattern automata are prepared once. Five excluded runs warm both solvers, then Lean/Wasm and typed-array JavaScript scan the same 4,200-byte log 100 times. Every Lean result is checked for exact soundness and completeness."
	, initialSummary: "No benchmark run yet."
	, histogramLabel: "Histogram of checked Lean Aho–Corasick latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Signal scanner · Proven Lean Aho–Corasick | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-aho-corasick/");
	return <main id="main-content" className="demo-page workbench-page aho-corasick-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Scan once."}
						<br />
						<em>
							{"Catch every signal."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"Search for many byte patterns at the same time. Lean/Wasm reports every exact occurrence—including nested, overlapping, and duplicate signatures."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to use it"}
					</p>
					<h2 id="guide-title">
						{"Choose a feed."}
						<br />
						<em>
							{"Watch hits stack."}
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
								{"Pick a scenario"}
							</b>
							<p>
								{"Try operations logs, moderation rules, or threat signatures."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Edit either side"}
							</b>
							<p>
								{"Patterns compile into one automaton; input is scanned as UTF-8 bytes."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Inspect overlaps"}
							</b>
							<p>
								{"Select a signature to isolate its exact spans in the shared result."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab matcher-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive proof adapter"}
						</p>
						<h2 id="lab-title">
							{"Multi-signal workbench"}
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
								{"Lean’s result"}
							</p>
							<h3 id="verdict-title">
								{"Compiling signatures…"}
							</h3>
							<p id="verdict-copy">
								{"The verified byte matcher is loading."}
							</p>
						</div>
						<div className="verdict-metrics">
							<span>
								<b id="match-count">
									{"—"}
								</b>
								{" matches"}
							</span>
							<span>
								<b id="overlap-count">
									{"—"}
								</b>
								{" overlaps"}
							</span>
							<span>
								<b id="scan-time">
									{"—"}
								</b>
								{" Lean/Wasm"}
							</span>
						</div>
					</div>
					<div className="scenario-bar" role="group" aria-label="Scanner scenario">
						<div>
							<p className="label">
								{"Sample feeds"}
							</p>
							<b>
								{"Same algorithm, different rule sets"}
							</b>
						</div>
						<div className="scenario-tabs">
							<button data-scenario="operations" aria-pressed="true">
								{"Operations log"}
							</button>
							<button data-scenario="moderation" aria-pressed="false">
								{"Moderation queue"}
							</button>
							<button data-scenario="threats" aria-pressed="false">
								{"Threat signatures"}
							</button>
						</div>
					</div>
					<div className="editor-grid">
						<label className="editor-panel patterns-panel">
							<span>
								<b>
									{"Patterns"}
								</b>
								<small>
									{"One exact UTF-8 pattern per line. Duplicates stay distinct."}
								</small>
							</span>
							<textarea id="patterns" spellCheck="false" aria-label="Patterns, one per line" defaultValue=""/>
						</label>
						<label className="editor-panel input-panel">
							<span>
								<b>
									{"Incoming text"}
								</b>
								<small id="input-note">
									{"Edit the feed; scanning updates automatically."}
								</small>
							</span>
							<textarea id="input" spellCheck="false" aria-label="Text to scan" defaultValue=""/>
						</label>
					</div>
					<section className="inspection" aria-labelledby="inspection-title">
						<div className="inspection-heading">
							<div>
								<p className="label">
									{"Checked output"}
								</p>
								<h3 id="inspection-title">
									{"Overlap inspector"}
								</h3>
							</div>
							<button id="show-all" className="secondary" disabled>
								{"Show every signature"}
							</button>
						</div>
						<div id="highlighted-text" className="highlighted-text" aria-label="Input with matched spans" data-workbench-leaf=""/>
						<div id="pattern-results" className="pattern-results" aria-label="Matched pattern filters" data-workbench-leaf=""/>
					</section>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				<b>
					{"The text editor remains browser code."}
				</b>
				{" Lean receives a generic finite pattern table and byte sequence, then checks the exact match triples it returns."}
			</p>
			<a href={artifactBase + "AhoCorasick.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
