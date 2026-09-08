/**
 * React-owned capacity editing and visible flow from the compiled Lean solver.
 *
 * @file
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createNetworkSession, getBrowserNetworkSession } from "../../../demos/lean-dinic/network-session.mjs";
import type { Network, NetworkEdge, NetworkSession } from "../../../demos/lean-dinic/network-session.mjs";
import { createFlowController } from "../../../demos/lean-dinic/flow-controller.mjs";
import type { FlowController, FlowResult, FlowRuntime, FlowState } from "../../../demos/lean-dinic/flow-controller.mjs";
import "./dinic.css";

const shortName = (name: string) => name.replace("Relay ", "");
const edgeName = (network: Network, edge: NetworkEdge) => `${shortName(network.nodes[edge.source].name)} → ${shortName(network.nodes[edge.target].name)}`;
const fullEdgeName = (network: Network, edge: NetworkEdge) => `${network.nodes[edge.source].name} → ${network.nodes[edge.target].name}`;
const isCut = (result: FlowResult, edge: NetworkEdge) => Boolean(result.answer.sourceSide[edge.source]) && !result.answer.sourceSide[edge.target];
const cutEdges = (result: FlowResult) => result.network.edges.filter(edge => isCut(result, edge));
const cutKey = (result: FlowResult) => cutEdges(result).map(edge => edge.id).sort().join(",");
const flowThrough = (result: FlowResult, edge: NetworkEdge) => result.answer.flows[result.edgeIndex.get(edge.id)!];
const regions = [
	{ vertex: 0, x: 0, y: 0, width: 190, height: 460 }
	, { vertex: 1, x: 190, y: 0, width: 260, height: 230 }
	, { vertex: 2, x: 190, y: 230, width: 260, height: 230 }
	, { vertex: 3, x: 450, y: 0, width: 260, height: 230 }
	, { vertex: 4, x: 450, y: 230, width: 260, height: 230 }
	, { vertex: 5, x: 710, y: 0, width: 190, height: 460 }
];
const boundaries: [number, number, string][] = [
	[0, 1, "M190,0 V230"], [0, 2, "M190,230 V460"]
	, [1, 3, "M450,0 V230"], [2, 4, "M450,230 V460"]
	, [3, 5, "M710,0 V230"], [4, 5, "M710,230 V460"]
	, [1, 2, "M190,230 H450"], [3, 4, "M450,230 H710"]
];

/** Position curves and labels without deriving any flow or cut membership. */
const geometry = (network: Network, edge: NetworkEdge, width: number, nodeWidth: number) => {
	const source = network.nodes[edge.source];
	const target = network.nodes[edge.target];
	const inset = nodeWidth * 900 / width / 2;
	const start = { x: source.x + inset, y: source.y };
	const end = { x: target.x - inset - 3, y: target.y };
	const first = { x: start.x + (end.x - start.x) * .45, y: start.y };
	const second = { x: end.x - (end.x - start.x) * .45, y: end.y };
	const t = edge.labelAt;
	const u = 1 - t;
	const point = {
		x: u ** 3 * start.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * end.x
		, y: u ** 3 * start.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * end.y
	};
	if(edge.id === "a-d") point.y -= 10;
	if(edge.id === "b-c") point.y += 10;
	return { d: `M${start.x},${start.y} C${first.x},${first.y} ${second.x},${second.y} ${end.x},${end.y}`, point };
};

/** Present link-specific capacity, cut, and residual-room explanations. */
const explainEdge = (result: FlowResult, edge: NetworkEdge) => edge.capacity === 0
	? "This link is closed. It remains in the network so you can select and reopen it."
	: isCut(result, edge) ? "This link crosses the shown cut and is full. Widening it may raise throughput or reveal a different bottleneck."
		: !result.answer.sourceSide[edge.source] && result.answer.sourceSide[edge.target] ? "This arrow crosses the boundary toward the source side. Only links directed from the source side to the sink side count toward cut capacity."
			: flowThrough(result, edge) === edge.capacity ? "This link is full, but it is outside the shown minimum cut. A full link alone does not identify the network's limiting capacity."
				: "This link has room for more flow. Capacity elsewhere in the network limits how much reaches Sink.";

/**
 * Own graph state subscriptions, compiled solves, responsive geometry, and motion.
 *
 * @param root0 Published artifact location.
 * @param root0.artifactBase Directory containing the unchanged Lean runtime adapter.
 */
export default function DinicWorkbench({ artifactBase }: {artifactBase: string})
{
	const [snapshot, setSnapshot] = useState(() => createNetworkSession().getSnapshot());
	const [state, setState] = useState<FlowState>({ status: "pending" });
	const [reducedMotion, setReducedMotion] = useState(false);
	const [inactive, setInactive] = useState(false);
	const [dimensions, setDimensions] = useState({ width: 900, nodeWidth: 94, overflowing: false });
	const measuredDimensions = useRef(dimensions);
	const session = useRef<NetworkSession | null>(null);
	const controller = useRef<FlowController | null>(null);
	const svg = useRef<SVGSVGElement>(null);
	const canvas = useRef<HTMLDivElement>(null);
	const scroll = useRef<HTMLDivElement>(null);
	const nodes = useRef<HTMLDivElement>(null);
	const previousCut = useRef<string | null>(null);
	const result = state.status === "error" ? undefined : state.result;
	const ready = state.status === "ready";
	const motionPaused = snapshot.motionPaused ?? reducedMotion;
	const paused = motionPaused || inactive;

	useEffect(() => {
		const currentSession = getBrowserNetworkSession();
		session.current = currentSession;
		let alive = true;
		let pageHidden = false;
		let scheduledRevision = -1;
		const base = new URL(artifactBase, globalThis.location.href);
		const currentController = createFlowController({
			loadRuntime: () => import(/* @vite-ignore */ new URL("runtime.mjs", base).href) as Promise<FlowRuntime>
			, onState: next => {
				if(!alive) return;
				setState(next);
				if(next.status === "ready") currentSession.acceptBaseline(next.result.answer.value, cutKey(next.result));
			}
		});
		controller.current = currentController;
		const sync = () => {
			const next = currentSession.getSnapshot();
			setSnapshot(next);
			if(scheduledRevision === next.revision) return;
			scheduledRevision = next.revision;
			currentController.schedule(next.network);
		};
		const reconcileActivity = () => {
			const hidden = pageHidden || document.hidden;
			setInactive(hidden);
			if(hidden) currentController.suspend(); else currentController.resume();
		};
		const hide = () => { pageHidden = true; reconcileActivity(); svg.current?.pauseAnimations(); };
		const show = (event: PageTransitionEvent) => {
			if(!event.persisted) return;
			pageHidden = false;
			reconcileActivity();
		};
		const media = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
		const changeMotionPreference = () => setReducedMotion(media.matches);
		changeMotionPreference();
		media.addEventListener("change", changeMotionPreference);
		const unsubscribe = currentSession.subscribe(sync);
		sync();
		reconcileActivity();
		document.addEventListener("visibilitychange", reconcileActivity);
		globalThis.addEventListener("pagehide", hide);
		globalThis.addEventListener("pageshow", show);
		const mountedSvg = svg.current;
		return () => {
			alive = false;
			unsubscribe();
			currentController.dispose();
			mountedSvg?.pauseAnimations();
			controller.current = null;
			session.current = null;
			media.removeEventListener("change", changeMotionPreference);
			document.removeEventListener("visibilitychange", reconcileActivity);
			globalThis.removeEventListener("pagehide", hide);
			globalThis.removeEventListener("pageshow", show);
		};
	}, [artifactBase]);

	useEffect(() => {
		const element = canvas.current;
		const viewport = scroll.current;
		if(!element || !viewport) return;
		let alive = true;
		const measure = () => {
			if(!alive) return;
			const width = element.clientWidth || 900;
			const nodeWidth = nodes.current?.firstElementChild?.getBoundingClientRect().width ?? 94;
			const overflowing = viewport.scrollWidth > viewport.clientWidth;
			const previous = measuredDimensions.current;
			if(previous.width === width && previous.nodeWidth === nodeWidth && previous.overflowing === overflowing) return;
			const next = { width, nodeWidth, overflowing };
			measuredDimensions.current = next;
			// React can retain a queued updater after navigation. Queue plain numbers,
			// not a function whose lexical parent captures this observer's DOM nodes.
			setDimensions(next);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		observer.observe(viewport);
		if(nodes.current) observer.observe(nodes.current);
		measure();
		return () => { alive = false; observer.disconnect(); };
	}, []);

	useEffect(() => {
		if(paused) svg.current?.pauseAnimations(); else svg.current?.unpauseAnimations();
	}, [paused, result]);

	useEffect(() => {
		if(!result || !scroll.current || !canvas.current) return;
		const key = cutKey(result);
		if(previousCut.current === key) return;
		previousCut.current = key;
		const crossings = cutEdges(result);
		const center = crossings.reduce((sum, edge) => sum + geometry(result.network, edge, dimensions.width, dimensions.nodeWidth).point.x, 0) / Math.max(1, crossings.length);
		scroll.current.scrollLeft = center / 900 * canvas.current.clientWidth - scroll.current.clientWidth / 2;
	}, [result, dimensions.width, dimensions.nodeWidth]);

	const selectEdge = (id: string) => {
		session.current?.select(id);
		const label = canvas.current?.querySelector<HTMLButtonElement>(`[data-edge="${id}"]`);
		const viewport = scroll.current;
		if(!label || !viewport) return;
		const bounds = label.getBoundingClientRect();
		const view = viewport.getBoundingClientRect();
		if(bounds.right > view.right) viewport.scrollLeft += bounds.right - view.right + 16;
		if(bounds.left < view.left) viewport.scrollLeft -= view.left - bounds.left + 16;
	};
	const selected = snapshot.network.edges.find(edge => edge.id === snapshot.selected)!;
	const shownEdge = result?.network.edges.find(edge => edge.id === snapshot.selected);
	const gain = result ? result.answer.value - (snapshot.baseline?.value ?? result.answer.value) : 0;
	const widened = snapshot.network.edges.find(edge => edge.id === "c-sink")!;
	const error = state.status === "error" ? state.error instanceof Error ? state.error.message : String(state.error) : "";
	const resultTitle = state.status === "error" ? "The network did not finish solving." : !result ? "Finding the network's limit…"
		: result.answer.value === 0 ? "No flow can reach Sink." : `${result.answer.value} units per second can reach Sink.`;
	const resultCopy = error || (!result ? "Lean will return a feasible flow and a cut with the same capacity."
		: !snapshot.hasEdits ? "The flow uses the full capacity of the two links into Sink. Those links also certify the total limit."
			: gain > 0 ? `${gain} more than the initial example. ${cutKey(result) !== snapshot.baseline?.cut ? "The highlighted minimum cut has moved to a different set of links." : "The highlighted cut now has more capacity."}`
				: gain < 0 ? `${-gain} fewer than the initial example. The highlighted cut shows which links limit the reduced total.`
					: "The total matches the initial example. The highlighted cut still limits throughput, despite the capacity edits.");

	return <>
		<header className="hero"><div><p className="eyebrow"><span className="pulse" /> Lean 4 → WebAssembly</p><h1>How much gets through?<br /><em>Find the bottleneck.</em></h1></div><p className="lede">Each link has a capacity. Dinic finds the most flow the network can carry from its source to its sink, then identifies a set of links that proves no larger total can get through.</p></header>
		<section className="reading-guide" aria-labelledby="guide-title"><div><p className="label">How to read it</p><h2 id="guide-title">Follow the flow.<br /><em>Inspect the limit.</em></h2></div><ol><li><span>1</span><div><b>Read flow / capacity</b><p>A link marked 4 / 6 carries four units per second and has room for six.</p></div></li><li><span>2</span><div><b>Find the highlighted cut</b><p>These links cross from the source side to the sink side. Their total capacity equals the maximum flow.</p></div></li><li><span>3</span><div><b>Widen a bottleneck</b><p>Increase a highlighted link's capacity. Watch throughput change and see which links limit the new total.</p></div></li></ol></section>
		<section className="theme-lab flow-lab" aria-labelledby="lab-title">
			<div className="lab-heading"><div><p className="label">Interactive proof adapter</p><h2 id="lab-title">Network capacity workbench</h2></div><p id="runtime-status" className={`runtime-status${state.status === "error" ? " failed" : ""}`} role="status">{state.status === "error" ? "Lean/Wasm could not solve this network" : ready ? `Lean/Wasm ready · ${result!.milliseconds.toFixed(2)} ms` : "Updating the Lean flow and cut…"}</p></div>
			<div className={`flow-workbench${paused ? " motion-paused" : ""}`}>
				<div className="result-summary" aria-live="polite"><div><p className="label">Maximum flow = minimum cut</p><h3 id="result-title">{resultTitle}</h3><p id="result-copy">{resultCopy}</p></div><dl className="summary-metrics"><div><dt>Maximum flow</dt><dd><span id="flow-value">{result?.answer.value ?? "—"}</span><small>units / s</small></dd></div><div><dt>Minimum cut</dt><dd><span id="cut-value">{result?.answer.cutCapacity ?? "—"}</span><small>units / s</small></dd></div></dl></div>
				<div className="try-toolbar"><div><span className="try-label">Try one change</span><p id="try-copy">{widened.capacity >= 9 ? `C → Sink now has capacity ${widened.capacity}. Select any link to test the new limit, or reset the example.` : `Try raising C → Sink from ${widened.capacity} to 9. In the original example, this moves the bottleneck to the source links.`}</p></div><button id="widen-bottleneck" type="button" disabled={!ready || widened.capacity >= 9} onClick={() => session.current?.widen()}>Widen C → Sink to 9 <span aria-hidden="true">↗</span></button></div>
				<div className="flow-workspace">
					<div className="network-panel"><div className="canvas-heading"><div><p className="label">Directed capacity network</p><h3>From Source to Sink</h3></div><button id="toggle-motion" className="secondary" type="button" aria-pressed={motionPaused} onClick={() => session.current?.pauseMotion(!motionPaused)}>{motionPaused ? "Play flow animation" : "Pause flow animation"}</button></div>
						<p className="pan-note" hidden={!dimensions.overflowing}>Swipe the network sideways to see every relay.</p>
						<div ref={scroll} className="network-scroll"><div ref={canvas} id="network-canvas" className="network-canvas" aria-busy={!ready}>
							<svg ref={svg} id="network-svg" className="network-svg" viewBox="0 0 900 460" aria-hidden="true">
								<defs>{[["flow", "#8dded9"], ["cut", "#ffad9e"], ["idle", "#617184"]].map(([name, color]) => <marker key={name} id={`dinic-arrow-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L9,5 L1,9 Z" fill={color} /></marker>)}</defs>
								{result && <>
									{regions.map(({ vertex, ...box }) => <rect key={vertex} {...box} className={result.answer.sourceSide[vertex] ? "source-region" : "sink-region"} />)}
									{boundaries.filter(([left, right]) => Boolean(result.answer.sourceSide[left]) !== Boolean(result.answer.sourceSide[right])).map(([, , path]) => <path key={path} d={path} className="cut-boundary" />)}
									{result.network.edges.map(edge => {
										const { d } = geometry(result.network, edge, dimensions.width, dimensions.nodeWidth);
										const flow = flowThrough(result, edge);
										const cut = isCut(result, edge);
										const suffix = `${cut ? " in-cut" : ""}${edge.capacity === 0 ? " closed" : ""}`;
										const packetCount = Math.min(4, Math.ceil(flow / 2));
										const duration = packetCount * 2.4 / flow;
										return <g key={edge.id}>
											{edge.id === snapshot.selected && <path d={d} className="edge-selected" />}
											<path d={d} className={`edge-base${suffix}`} markerEnd={`url(#dinic-arrow-${flow ? cut ? "cut" : "flow" : "idle"})`} style={{ "--capacity-width": Math.min(9, 2 + edge.capacity * .3) } as CSSProperties} />
											{flow > 0 && <><path d={d} className={`edge-flow${cut ? " in-cut" : ""}`} style={{ "--flow-width": 1.5 + flow * .5 } as CSSProperties} /><path d={d} className={`flow-motion${cut ? " in-cut" : ""}`} style={{ "--travel-time": `${Math.max(.5, 3 / Math.sqrt(flow))}s` } as CSSProperties} />
												{Array.from({ length: packetCount }, (_, index) => <circle key={`${flow}-${index}`} className={`flow-packet${cut ? " in-cut" : ""}`} r={4.5 * 900 / dimensions.width} data-edge-packet={edge.id}><animateMotion path={d} dur={`${duration}s`} begin={`${-index * duration / packetCount}s`} repeatCount="indefinite" calcMode="paced" /></circle>)}
											</>}
										</g>;
									})}
									<g>{result.network.edges.map(edge => <path key={edge.id} d={geometry(result.network, edge, dimensions.width, dimensions.nodeWidth).d} className="edge-hit" onClick={() => selectEdge(edge.id)} />)}</g>
								</>}
							</svg>
							<div ref={nodes} id="node-layer" className="node-layer">{snapshot.network.nodes.map((node, index) => {
								const source = index === snapshot.network.source;
								const sink = index === snapshot.network.sink;
								const side = Boolean(result?.answer.sourceSide[index]);
								return <div key={node.id} className={`network-node${source || sink ? " terminal" : ""}${sink ? " sink" : ""}${side ? " on-source-side" : ""}`} style={{ left: `${node.x / 9}%`, top: `${node.y / 4.6}%` }}><b>{node.name}</b><small>{source ? "Flow enters" : sink ? "Flow leaves" : !result ? "Waiting for Lean" : side ? "Source side" : "Sink side"}</small></div>;
							})}</div>
							<div id="edge-labels" className="edge-labels">{result?.network.edges.map(edge => {
								const { point } = geometry(result.network, edge, dimensions.width, dimensions.nodeWidth);
								const cut = isCut(result, edge);
								const flow = flowThrough(result, edge);
								return <button key={edge.id} type="button" className={`edge-label${cut ? " in-cut" : ""}${edge.capacity === 0 ? " closed" : ""}`} data-edge={edge.id} aria-pressed={edge.id === snapshot.selected} aria-label={`${fullEdgeName(result.network, edge)}: flow ${flow}, capacity ${edge.capacity}${cut ? ", in the shown minimum cut" : ""}. Edit capacity.`} style={{ left: `${point.x / 9}%`, top: `${point.y / 4.6}%` }} onClick={() => selectEdge(edge.id)}><span>{flow}</span><span className="capacity-part"> / {edge.capacity}</span></button>;
							})}</div>
						</div></div>
						<div className="network-legend"><span><i className="legend-flow" aria-hidden="true" />Flow / capacity</span><span><i className="legend-cut" aria-hidden="true" />Links in one minimum cut</span><span><i className="legend-side" aria-hidden="true" />Source side</span></div><p className="network-hint">Select a link or its label to edit capacity. A full link is not necessarily part of the highlighted cut.</p>
					</div>
					<aside className="capacity-controls"><section className="edge-editor" aria-labelledby="edge-title"><p className="label">Selected link</p><h3 id="edge-title">{fullEdgeName(snapshot.network, selected)}</h3><p id="edge-membership" className={`edge-membership${result && shownEdge && isCut(result, shownEdge) ? " in-cut" : ""}`}>{!result || !shownEdge ? "Waiting for Lean's cut." : isCut(result, shownEdge) ? "In the highlighted minimum cut" : "Not in the highlighted minimum cut"}</p>
						<label className="capacity-label" htmlFor="edge-capacity">Capacity <span><input id="edge-capacity" type="number" min="0" max="20" step="1" value={selected.capacity} disabled={!result} onChange={event => session.current?.setCapacity(event.target.value)} /> units / s</span></label><input id="capacity-slider" type="range" min="0" max="20" step="1" value={selected.capacity} aria-label="Selected link capacity" disabled={!result} onChange={event => session.current?.setCapacity(event.target.value)} /><div className="range-endpoints"><span>0 closes the link</span><span>20</span></div>
						<dl className="edge-metrics"><div><dt>Flow through this link</dt><dd id="edge-flow">{result && shownEdge ? `${flowThrough(result, shownEdge)} units / s` : "—"}</dd></div><div><dt>Unused capacity</dt><dd id="edge-spare">{result && shownEdge ? `${shownEdge.capacity - flowThrough(result, shownEdge)} units / s` : "—"}</dd></div></dl><p id="edge-explanation" className="control-note">{result && shownEdge ? explainEdge(result, shownEdge) : "Editing capacity reruns the compiled Lean solver."}</p>
					</section><section className="cut-inspector" aria-labelledby="cut-title"><p className="label">One minimum cut</p><h3 id="cut-title">The links setting this limit</h3><div id="cut-links" className="cut-links">{result && cutEdges(result).map(edge => <button key={edge.id} type="button" className="cut-link" aria-pressed={edge.id === snapshot.selected} aria-label={`${fullEdgeName(result.network, edge)}, capacity ${edge.capacity}. Select this cut link.`} onClick={() => selectEdge(edge.id)}><span>{edgeName(result.network, edge)}</span><b>{edge.capacity}</b></button>)}</div><div className="cut-total"><span>Total cut capacity</span><b id="cut-total">{result ? `${result.answer.cutCapacity} units / s` : "—"}</b></div><p className="control-note">Several cuts can tie. Lean highlights one whose capacity matches the returned flow.</p></section>
					<button id="reset-network" className="secondary reset-network" type="button" disabled={!result && state.status !== "error"} onClick={() => { previousCut.current = null; session.current?.reset(); }}>Reset example</button>
					{state.status === "error" && <button type="button" className="retry-flow" onClick={() => controller.current?.schedule(snapshot.network, true)}>Retry Lean solver</button>}
					</aside>
				</div>
				<div className="cut-explanation"><span className="cut-mark" aria-hidden="true">=</span><div><h3 id="equality-title">{result ? `${result.answer.value} units can get through. No flow can exceed ${result.answer.cutCapacity}.` : "Two ways to certify the same number."}</h3><p id="equality-copy">{result ? `Lean returned a flow that respects every link's capacity and balances each relay. The highlighted cut has capacity ${cutEdges(result).map(edge => edge.capacity).join(" + ") || "0"} = ${result.answer.cutCapacity}, which bounds every possible flow through this network.` : "The returned flow shows how much can get through. A cut with that capacity proves that no larger flow is possible."}</p></div></div>
			</div>
		</section>
	</>;
}
