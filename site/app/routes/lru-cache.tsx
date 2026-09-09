/**
 * React lru-cache page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/lru-cache.css";
const proofConfig = {
	"core": "LruCore.lean"
	, "proof": "Lru.lean"
	, "namespace": "LeanLRU"
	, "comparator": "put_full_evicts_oldest"
	, "dependencies": []
	, "theorems": [
		"LeanLRU.get_refines"
		, "LeanLRU.put_refines"
		, "LeanLRU.get_valid"
		, "LeanLRU.put_valid"
		, "LeanLRU.get_preserves_values"
		, "LeanLRU.put_lookup_written"
		, "LeanLRU.put_existing_no_eviction"
		, "LeanLRU.put_full_evicts_oldest"
		, "LeanLRU.get_preserves_other_order"
		, "LeanLRU.exported_get_correct"
		, "LeanLRU.exported_put_correct"
		, "LeanLRU.exported_batch_refines"
	]
	, "title": "Limited room."
	, "emphasis": "Specified behavior."
	, "description": "Lean checks the cache transitions: entries stay within capacity, each key appears once, a successful lookup promotes its entry, and inserting into a full cache evicts the least recently used entry."
	, "coreTab": "LruCore.lean"
};
const benchmarkConfig = {
	title: <>{"What does a proven"}<br />{"cache cost?"}</>
	, description: "Lean/Wasm and JavaScript process the same request trace. Five excluded runs warm both solvers before 100 measured comparisons."
	, initialSummary: "No benchmark run yet."
	, histogramLabel: "Histogram of Lean LRU cache latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Cache desk · Proven Lean LRU cache | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-lru-cache/");
	return <main id="main-content" className="demo-page workbench-page lru-cache-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Keep what you use."}
						<br />
						<em>
							{"Make room for more."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"A cache has limited room. Request a resource and watch Lean move it to the front, or evict the entry you have left unused longest."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to use it"}
					</p>
					<h2 id="guide-title">
						{"Follow a request."}
						<br />
						<em>
							{"See what stays."}
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
								{"Fill the cache"}
							</b>
							<p>
								{"Step through the timeline. A miss loads a resource into a slot."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Use it again"}
							</b>
							<p>
								{"A hit moves that resource to the most recently used end."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Run out of room"}
							</b>
							<p>
								{"The least recently used entry leaves when a new one needs its slot."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab cache-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive LRU cache"}
						</p>
						<h2 id="lab-title">
							{"Cache desk"}
						</h2>
					</div>
					<p id="runtime-status" className="runtime-status" role="status">
						{"Loading Lean/Wasm…"}
					</p>
				</div>
				<div className="workbench">
					<div className="scenario-bar">
						<div className="scenario-picker" role="group" aria-label="Request sequence">
							<button data-scenario="working" aria-pressed="true">
								{"Repeated working set"}
							</button>
							<button data-scenario="scan" aria-pressed="false">
								{"One-time scan"}
							</button>
						</div>
						<label className="capacity-control" htmlFor="capacity">
							{"Cache capacity "}
							<select id="capacity" disabled defaultValue="3">
								<option value="1">
									{"1 slot"}
								</option>
								<option value="2">
									{"2 slots"}
								</option>
								<option value="3">
									{"3 slots"}
								</option>
								<option value="4">
									{"4 slots"}
								</option>
								<option value="5">
									{"5 slots"}
								</option>
								<option value="6">
									{"6 slots"}
								</option>
							</select>
						</label>
					</div>
					<div className="cache-workspace">
						<section className="cache-stage" aria-labelledby="cache-title">
							<div className="cache-heading">
								<div>
									<p className="label">
										{"Current contents"}
									</p>
									<h3 id="cache-title">
										{"Your most recent resources."}
									</h3>
								</div>
								<span id="occupancy" className="occupancy">
									{"0 / 3 slots"}
								</span>
							</div>
							<div className="recency-axis">
								<span>
									<b>
										{"Most recently used"}
									</b>
									<small>
										{"New loads and hits arrive here"}
									</small>
								</span>
								<i aria-hidden="true">
									{"→"}
								</i>
								<span>
									<b>
										{"Least recently used"}
									</b>
									<small>
										{"First to leave when full"}
									</small>
								</span>
							</div>
							<div id="cache-slots" className="cache-slots" aria-label="Cache contents, most to least recently used" data-workbench-leaf=""/>
							<div id="request-result" className="request-result" role="status" aria-live="polite" aria-atomic="true">
								<div id="result-symbol" className="result-symbol">
									{"?"}
								</div>
								<div className="result-copy">
									<p id="result-kind" className="label">
										{"Ready for the first request"}
									</p>
									<h3 id="result-title">
										{"The cache is empty."}
									</h3>
									<p id="result-explanation">
										{"Choose Step to request A, or click any resource on the right."}
									</p>
								</div>
								<div id="eviction-detail" className="eviction-detail">
									<span>
										{"Evicted"}
									</span>
									<b id="eviction-name">
										{"None"}
									</b>
									<small id="eviction-reason">
										{"There is still room."}
									</small>
								</div>
							</div>
							<dl className="cache-metrics">
								<div>
									<dt>
										{"Hits"}
									</dt>
									<dd id="hit-count">
										{"0"}
									</dd>
								</div>
								<div>
									<dt>
										{"Misses"}
									</dt>
									<dd id="miss-count">
										{"0"}
									</dd>
								</div>
								<div>
									<dt>
										{"Evictions"}
									</dt>
									<dd id="eviction-count">
										{"0"}
									</dd>
								</div>
								<div>
									<dt>
										{"Hit rate"}
									</dt>
									<dd id="hit-rate">
										{"—"}
									</dd>
								</div>
							</dl>
						</section>
						<aside className="request-controls" aria-labelledby="request-title">
							<div>
								<p className="label">
									{"Try your own"}
								</p>
								<h3 id="request-title">
									{"Request a resource"}
								</h3>
								<p className="control-help">
									{"A hit uses the cached copy. A miss loads it and makes room if needed."}
								</p>
							</div>
							<div id="resource-buttons" className="resource-buttons" role="group" aria-label="Request a resource" data-workbench-leaf=""/>
							<p className="insertion-note">
								{"Your request goes into the timeline at the current step."}
							</p>
							<div className="playback-controls">
								<div className="next-request">
									<span>
										{"Up next"}
									</span>
									<b id="next-request">
										{"A · Atlas"}
									</b>
								</div>
								<div className="playback-buttons">
									<button id="step" className="primary" disabled>
										{"Step →"}
									</button>
									<button id="run" disabled>
										{"Run"}
									</button>
									<button id="replay" className="icon-button" title="Replay the sequence from an empty cache" aria-label="Replay the sequence from an empty cache" disabled>
										{"↺"}
									</button>
								</div>
							</div>
						</aside>
					</div>
					<section className="timeline-panel" aria-labelledby="timeline-title">
						<div className="timeline-heading">
							<div>
								<p className="label">
									{"Request timeline"}
								</p>
								<h3 id="timeline-title">
									{"A small working set gets reused."}
								</h3>
							</div>
							<span id="timeline-progress">
								{"0 / 12 requests"}
							</span>
						</div>
						<p id="scenario-explanation" className="scenario-explanation">
							{"A, B, and C repeat. A newcomer competes for cache space. Compare three slots with four and inspect the same requests again."}
						</p>
						<div id="request-timeline" className="request-timeline" aria-label="Choose a request to inspect the cache immediately after it" data-workbench-leaf=""/>
						<div className="timeline-legend">
							<span>
								<i className="hit-dot"/>
								{"Hit"}
							</span>
							<span>
								<i className="miss-dot"/>
								{"Miss"}
							</span>
							<span>
								<i className="queued-dot"/>
								{"Queued"}
							</span>
							<p>
								{"Click any request to inspect the cache after that step."}
							</p>
						</div>
					</section>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				<b>
					{"Every displayed hit and eviction comes from Lean/Wasm."}
				</b>
				{" Resource names and the timeline are browser controls for a generic key/value cache."}
			</p>
			<a href={artifactBase + "Lru.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
