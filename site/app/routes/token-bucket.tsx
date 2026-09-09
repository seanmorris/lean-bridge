/**
 * React token-bucket page with a scoped editor and shared proof and benchmark panels.
 *
 * @file
 */
import { WorkbenchHost } from "../components/WorkbenchHost";
import { BenchmarkScaffold } from "../components/BenchmarkPanel";
import { ProofViewer } from "../components/ProofViewer";
import { assetHref } from "../urls";
import "../demos/token-bucket.css";
const proofConfig = {
	"core": "TokenBucketCore.lean"
	, "proof": "TokenBucket.lean"
	, "namespace": "LeanTokenBucket"
	, "comparator": "exportedRun_no_over_admission"
	, "dependencies": []
	, "theorems": [
		"LeanTokenBucket.refill_eq"
		, "LeanTokenBucket.exportedStep_admitted_iff"
		, "LeanTokenBucket.exportedRun_no_over_admission"
		, "LeanTokenBucket.retryDelay_earliest"
	]
	, "title": "Requests cannot spend"
	, "emphasis": "tokens they do not have."
	, "description": "Lean checks the bucket's capacity, elapsed-time refill, and admission decisions. A backward timestamp leaves the state unchanged. The returned retry delay comes from the same implementation."
	, "coreTab": "TokenBucketCore.lean"
};
const benchmarkConfig = {
	title: <>{"What does proven"}<br />{"rate limiting cost?"}</>
	, description: "Lean/Wasm and JavaScript process the same 1,024 timestamped requests, including bursts and backward timestamps. Five excluded runs warm both implementations before 100 measured samples. Each comparison checks every returned decision."
	, initialSummary: "Preparing the request benchmark."
	, histogramLabel: "Histogram of compiled Lean token-bucket latency"
};
/** Preserve the demo title on direct loads and client navigation. */
export const meta = () => [{ title: "Budget the burst · Proven Lean token bucket | Lean Bridge" }];
/** Mount the workbench without loading Wasm during prerender. */
export default function Demo()
{
	const artifactBase = assetHref("/lean-token-bucket/");
	return <main id="main-content" className="demo-page workbench-page token-bucket-page">
		<WorkbenchHost artifactBase={artifactBase}>
			<header className="hero">
				<div>
					<p className="eyebrow">
						<span className="pulse"/>
						{" Lean 4 → WebAssembly"}
					</p>
					<h1>
						{"Let a burst through."}
						<br />
						<em>
							{"Keep a steady limit."}
						</em>
					</h1>
				</div>
				<p className="lede">
					{"An API can accept several requests at once without accepting an unlimited stream. A token bucket spends a shared balance on each request and refills that balance over time."}
				</p>
			</header>
			<section className="reading-guide" aria-labelledby="guide-title">
				<div>
					<p className="label">
						{"How to read it"}
					</p>
					<h2 id="guide-title">
						{"Every request"}
						<br />
						<em>
							{"spends tokens."}
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
								{"Capacity permits a burst"}
							</b>
							<p>
								{"A full five-token bucket can accept five one-token requests together."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"2"}
						</span>
						<div>
							<b>
								{"Time restores the balance"}
							</b>
							<p>
								{"At two tokens per second, another token arrives every half second. The bucket never fills past capacity."}
							</p>
						</div>
					</li>
					<li>
						<span>
							{"3"}
						</span>
						<div>
							<b>
								{"Too little means throttled"}
							</b>
							<p>
								{"A rejected request spends nothing. It must try again after enough tokens arrive."}
							</p>
						</div>
					</li>
				</ol>
			</section>
			<section className="theme-lab bucket-lab" aria-labelledby="lab-title">
				<div className="lab-heading">
					<div>
						<p className="label">
							{"Interactive proof adapter"}
						</p>
						<h2 id="lab-title">
							{"Request budget workbench"}
						</h2>
					</div>
					<p id="runtime-status" className="runtime-status" role="status">
						{"Loading Lean/Wasm…"}
					</p>
				</div>
				<div className="bucket-workbench">
					<div className="result-summary">
						<div>
							<p className="label">
								{"Burst, then refill"}
							</p>
							<h3 id="result-title">
								{"Eight requests. Five tokens."}
							</h3>
							<p id="result-copy">
								{"Lean will show which requests pass and which need to try again."}
							</p>
						</div>
						<dl className="summary-metrics">
							<div>
								<dt>
									{"Allowed"}
								</dt>
								<dd id="allowed-count">
									{"—"}
								</dd>
							</div>
							<div>
								<dt>
									{"Throttled"}
								</dt>
								<dd id="throttled-count">
									{"—"}
								</dd>
							</div>
						</dl>
					</div>
					<div className="scenario-toolbar">
						<p id="scenario-copy">
							{"The example sends eight requests together, then one at 0.5 s and one at 1 s."}
						</p>
						<button id="replay-example" type="button" disabled>
							{"Replay burst & refill "}
							<span aria-hidden="true">
								{"↻"}
							</span>
						</button>
					</div>
					<div className="bucket-workspace">
						<div className="reservoir-panel">
							<div className="reservoir-heading">
								<div>
									<p className="label">
										{"Current balance"}
									</p>
									<h3>
										<span id="token-balance">
											{"—"}
										</span>
										<span className="balance-unit">
											{" tokens"}
										</span>
									</h3>
								</div>
								<div className="refill-badge">
									<span aria-hidden="true">
										{"↓"}
									</span>
									<b id="refill-label">
										{"2 tokens / second"}
									</b>
								</div>
							</div>
							<div className="reservoir-scene">
								<div id="capacity-scale" className="capacity-scale" aria-hidden="true" data-workbench-leaf=""/>
								<div id="reservoir" className="reservoir" role="meter" aria-label="Current token balance" aria-valuemin={0} aria-valuemax={5} aria-valuenow={5}>
									<div className="reservoir-fill" id="reservoir-fill" data-workbench-leaf=""/>
									<div id="reservoir-lines" className="reservoir-lines" aria-hidden="true" data-workbench-leaf=""/>
									<div className="reservoir-readout">
										<b id="reservoir-state">
											{"Full bucket"}
										</b>
										<span id="reservoir-copy">
											{"Five tokens available for the first burst."}
										</span>
									</div>
								</div>
							</div>
							<div className="clock-heading">
								<span>
									{"Simulation clock"}
								</span>
								<b id="clock-value">
									{"0.000 s"}
								</b>
								<span id="clock-state" className="clock-state">
									{"Paused"}
								</span>
							</div>
							<div className="clock-controls" role="group" aria-label="Simulation clock">
								<button id="play-clock" className="secondary" type="button" disabled>
									{"Play clock"}
								</button>
								<button type="button" className="secondary" data-advance="250" disabled>
									{"+250 ms"}
								</button>
								<button type="button" className="secondary" data-advance="1000" disabled>
									{"+1 s"}
								</button>
							</div>
							<p className="clock-note">
								{"The clock starts paused. Advancing it refills the bucket without sending requests."}
							</p>
						</div>
						<aside className="request-controls">
							<section aria-labelledby="config-title">
								<p className="label" id="config-title">
									{"Bucket settings"}
								</p>
								<label className="range-label" htmlFor="capacity">
									{"Burst capacity "}
									<output id="capacity-value" htmlFor="capacity">
										{"5 tokens"}
									</output>
								</label>
								<input id="capacity" type="range" min="1" max="20" step="1" defaultValue="5" disabled/>
								<label className="range-label" htmlFor="rate">
									{"Refill rate "}
									<output id="rate-value" htmlFor="rate">
										{"2 tokens / second"}
									</output>
								</label>
								<input id="rate" type="range" min="0" max="10" step="1" defaultValue="2" disabled/>
								<p className="control-note">
									{"Changing a setting starts a full bucket and clears the request history."}
								</p>
							</section>
							<section className="send-controls" aria-labelledby="send-title">
								<p className="label" id="send-title">
									{"Send requests now"}
								</p>
								<label className="cost-label" htmlFor="request-cost">
									{"Cost per request "}
									<span>
										<input id="request-cost" type="number" min="1" max="20" step="1" defaultValue="1" disabled/>
										{" tokens"}
									</span>
								</label>
								<button id="send-request" className="send-request" type="button" disabled>
									{"Send 1 request "}
									<span aria-hidden="true">
										{"→"}
									</span>
								</button>
								<div className="burst-controls" role="group" aria-label="Send a simultaneous burst">
									<button type="button" className="secondary" data-burst="5" disabled>
										{"Burst of 5"}
									</button>
									<button type="button" className="secondary" data-burst="10" disabled>
										{"Burst of 10"}
									</button>
								</div>
								<p className="control-note">
									{"Every request in a burst has the same timestamp. Throttled requests are not queued."}
								</p>
							</section>
							<button id="reset-bucket" className="secondary reset-bucket" type="button" disabled>
								{"Reset full bucket"}
							</button>
						</aside>
					</div>
					<div className="history-heading">
						<div>
							<p className="label">
								{"Arrivals"}
							</p>
							<h3>
								{"Each request gets its own decision."}
							</h3>
						</div>
						<div className="request-legend">
							<span>
								<i className="allowed" aria-hidden="true">
									{"✓"}
								</i>
								{"Allowed"}
							</span>
							<span>
								<i className="throttled" aria-hidden="true">
									{"×"}
								</i>
								{"Throttled"}
							</span>
						</div>
					</div>
					<div id="request-timeline" className="request-timeline" aria-label="Request history" data-workbench-leaf=""/>
					<section className="decision-panel" aria-labelledby="decision-title">
						<div className="decision-copy">
							<p id="decision-label" className="label">
								{"Selected request"}
							</p>
							<h3 id="decision-title">
								{"Loading the example…"}
							</h3>
							<p id="decision-explanation">
								{"Lean makes every admission and refill decision."}
							</p>
						</div>
						<dl className="decision-metrics">
							<div>
								<dt>
									{"Available then"}
								</dt>
								<dd id="decision-available">
									{"—"}
								</dd>
							</div>
							<div>
								<dt>
									{"Request cost"}
								</dt>
								<dd id="decision-cost">
									{"—"}
								</dd>
							</div>
							<div>
								<dt>
									{"Remaining then"}
								</dt>
								<dd id="decision-remaining">
									{"—"}
								</dd>
							</div>
							<div>
								<dt>
									{"Retry after"}
								</dt>
								<dd id="decision-retry">
									{"—"}
								</dd>
							</div>
						</dl>
					</section>
					<p id="interaction-status" className="sr-only" role="status" aria-live="polite"/>
				</div>
			</section>
			<BenchmarkScaffold config={benchmarkConfig}/>
		</WorkbenchHost>
		<ProofViewer artifactBase={artifactBase} config={proofConfig}/>
		<footer>
			<p>
				{"Lean handles generic integer credits and timestamps. This page displays 1,000 credits as one token and one tick as one millisecond."}
			</p>
			<a href={artifactBase + "TokenBucket.lean"}>
				{"Read the proof →"}
			</a>
		</footer>
	</main>;
}
