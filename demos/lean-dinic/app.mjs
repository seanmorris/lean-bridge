/**
 * Render compiled maximum flow and minimum cut on an editable capacity network.
 *
 * @file
 */

import { prepareGraph } from "./runtime.mjs";
import { mountBenchmark } from "./browser-benchmark.mjs";
import { createNetwork, buildGraphRequest, WIDEN_EDGE_ID, WIDEN_CAPACITY } from "./network.mjs";

const byId = id => globalThis.document.getElementById(id);
const elements = Object.fromEntries([
	"runtime-status", "result-title", "result-copy", "flow-value", "cut-value"
	, "try-copy"
	, "widen-bottleneck"
	, "toggle-motion"
	, "network-canvas"
	, "network-svg"
	, "node-layer", "edge-labels", "edge-title", "edge-membership", "edge-capacity"
	, "capacity-slider", "edge-flow", "edge-spare", "edge-explanation", "cut-links"
	, "cut-total", "reset-network", "equality-title", "equality-copy"
].map(id => [id, byId(id)]));
const workbench = globalThis.document.querySelector(".flow-workbench");
const graphScroll = globalThis.document.querySelector(".network-scroll");
const panNote = elementForPanNote();
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const element = (tag, className, text) => {
	const node = globalThis.document.createElement(tag);
	if(className) node.className = className;
	if(text !== undefined) node.textContent = text;
	return node;
};
const svgElement = (tag, attributes = {}) => {
	const node = globalThis.document.createElementNS(SVG_NAMESPACE, tag);
	for(const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
	return node;
};
const shortName = node => node.name.replace("Relay ", "");
const edgeName = (graph, edge) => `${shortName(graph.nodes[edge.source])} → ${shortName(graph.nodes[edge.target])}`;
const fullEdgeName = (graph, edge) => `${graph.nodes[edge.source].name} → ${graph.nodes[edge.target].name}`;

let network = createNetwork();
let displayed = network;
let result;
let edgeIndex = new Map();
let selected = WIDEN_EDGE_ID;
let baselineValue = null;
let baselineCut = "";
let hasEdits = false;
let motionPaused = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
let revision = 0;
let queuedFrame = 0;
let alive = true;

/**
 * Add a scroll hint without changing the network's accessible node labels.
 *
 * @returns {HTMLParagraphElement} Hint shown only when the graph overflows its viewport.
 */
function elementForPanNote()
{
	const note = globalThis.document.createElement("p");
	note.className = "pan-note";
	note.textContent = "Swipe the network sideways to see every relay.";
	note.hidden = true;
	graphScroll.before(note);
	return note;
}

const inCut = edge => Boolean(result?.sourceSide[edge.source]) && !result?.sourceSide[edge.target];
const flowThrough = edge => result?.flows[edgeIndex.get(edge.id)] ?? 0;
const cutEdges = () => displayed.edges.filter(inCut);
const cutKey = () => cutEdges().map(edge => edge.id).sort().join(",");

const renderMotion = () => {
	const paused = motionPaused || globalThis.document.hidden;
	workbench.classList.toggle("motion-paused", paused);
	if(paused) elements["network-svg"].pauseAnimations();
	else elements["network-svg"].unpauseAnimations();
	elements["toggle-motion"].textContent = motionPaused ? "Play flow animation" : "Pause flow animation";
	elements["toggle-motion"].setAttribute("aria-pressed", String(motionPaused));
};

const renderControls = () => {
	const edge = network.edges.find(item => item.id === selected);
	elements["edge-capacity"].disabled = !result;
	elements["capacity-slider"].disabled = !result;
	elements["reset-network"].disabled = !result;
	elements["widen-bottleneck"].disabled = !result || network.edges.find(item => item.id === WIDEN_EDGE_ID).capacity >= WIDEN_CAPACITY;
	elements["edge-capacity"].value = String(edge.capacity);
	elements["capacity-slider"].value = String(edge.capacity);
	renderMotion();
};

const renderInspector = () => {
	if(!result) return;
	const edge = displayed.edges.find(item => item.id === selected);
	const flow = flowThrough(edge);
	const cut = inCut(edge);
	elements["edge-title"].textContent = fullEdgeName(displayed, edge);
	elements["edge-membership"].textContent = cut ? "In the highlighted minimum cut" : "Not in the highlighted minimum cut";
	elements["edge-membership"].classList.toggle("in-cut", cut);
	elements["edge-flow"].textContent = `${flow} units / s`;
	elements["edge-spare"].textContent = `${edge.capacity - flow} units / s`;
	elements["edge-explanation"].textContent = edge.capacity === 0
		? "This link is closed. It remains in the network so you can select and reopen it."
		: cut ? "This link crosses the shown cut and is full. Widening it may raise throughput or reveal a different bottleneck."
			: !result.sourceSide[edge.source] && result.sourceSide[edge.target] ? "This arrow crosses the boundary toward the source side. Only links directed from the source side to the sink side count toward cut capacity."
				: flow === edge.capacity ? "This link is full, but it is outside the shown minimum cut. A full link alone does not identify the network's limiting capacity."
					: "This link has room for more flow. Capacity elsewhere in the network limits how much reaches Sink.";
	elements["cut-links"].replaceChildren(...cutEdges().map(item => {
		const button = element("button", "cut-link");
		button.type = "button";
		button.setAttribute("aria-pressed", String(item.id === selected));
		button.setAttribute("aria-label", `${fullEdgeName(displayed, item)}, capacity ${item.capacity}. Select this cut link.`);
		button.append(element("span", "", edgeName(displayed, item)), element("b", "", String(item.capacity)));
		button.addEventListener("click", () => selectEdge(item.id));
		return button;
	}));
	elements["cut-total"].textContent = `${result.cutCapacity} units / s`;
};

const renderSummary = () => {
	if(!result) return;
	const gain = result.value - baselineValue;
	elements["flow-value"].textContent = String(result.value);
	elements["cut-value"].textContent = String(result.cutCapacity);
	elements["result-title"].textContent = result.value === 0 ? "No flow can reach Sink." : `${result.value} units per second can reach Sink.`;
	elements["result-copy"].textContent = !hasEdits
		? "The flow uses the full capacity of the two links into Sink. Those links also certify the total limit."
		: gain > 0 ? `${gain} more than the initial example. ${cutKey() !== baselineCut ? "The highlighted minimum cut has moved to a different set of links." : "The highlighted cut now has more capacity."}`
			: gain < 0 ? `${-gain} fewer than the initial example. The highlighted cut shows which links limit the reduced total.`
				: "The total matches the initial example. The highlighted cut still limits throughput, despite the capacity edits.";
	const capacities = cutEdges().map(edge => edge.capacity).join(" + ");
	elements["equality-title"].textContent = `${result.value} units can get through. No flow can exceed ${result.cutCapacity}.`;
	elements["equality-copy"].textContent = `Lean returned a flow that respects every link's capacity and balances each relay. The highlighted cut has capacity ${capacities || "0"} = ${result.cutCapacity}, which bounds every possible flow through this network.`;
	elements["try-copy"].textContent = network.edges.find(edge => edge.id === WIDEN_EDGE_ID).capacity >= WIDEN_CAPACITY
		? `C → Sink now has capacity ${network.edges.find(edge => edge.id === WIDEN_EDGE_ID).capacity}. Select any link to test the new limit, or reset the example.`
		: `Try raising C → Sink from ${network.edges.find(edge => edge.id === WIDEN_EDGE_ID).capacity} to 9. In the original example, this moves the bottleneck to the source links.`;
};

/**
 * Layout-only curve geometry. Flow amounts and cut membership come from Lean.
 *
 * @param {object} edge Directed link with its label position.
 */
const geometry = edge => {
	const source = displayed.nodes[edge.source];
	const target = displayed.nodes[edge.target];
	const width = elements["node-layer"].firstElementChild?.getBoundingClientRect().width ?? 94;
	const inset = width * 900 / elements["network-canvas"].clientWidth / 2;
	const start = { x: source.x + inset, y: source.y };
	const end = { x: target.x - inset - 3, y: target.y };
	const first = { x: start.x + (end.x - start.x) * 0.45, y: start.y };
	const second = { x: end.x - (end.x - start.x) * 0.45, y: end.y };
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

const renderRegions = svg => {
	const side = vertex => Boolean(result.sourceSide[vertex]);
	const regions = [
		{ vertex: 0, x: 0, y: 0, width: 190, height: 460 }
		, { vertex: 1, x: 190, y: 0, width: 260, height: 230 }
		, { vertex: 2, x: 190, y: 230, width: 260, height: 230 }
		, { vertex: 3, x: 450, y: 0, width: 260, height: 230 }
		, { vertex: 4, x: 450, y: 230, width: 260, height: 230 }
		, { vertex: 5, x: 710, y: 0, width: 190, height: 460 }
	];
	for(const { vertex, ...box } of regions) svg.append(svgElement("rect", { ...box, class: side(vertex) ? "source-region" : "sink-region" }));
	const boundaries = [
		[0, 1, "M190,0 V230"], [0, 2, "M190,230 V460"]
		, [1, 3, "M450,0 V230"], [2, 4, "M450,230 V460"]
		, [3, 5, "M710,0 V230"], [4, 5, "M710,230 V460"]
		, [1, 2, "M190,230 H450"], [3, 4, "M450,230 H710"]
	];
	for(const [left, right, path] of boundaries) if(side(left) !== side(right)) svg.append(svgElement("path", { d: path, class: "cut-boundary" }));
};

const renderNetwork = () => {
	if(!result) return;
	const svg = elements["network-svg"];
	svg.replaceChildren();
	const defs = svgElement("defs");
	for(const [name, color] of [["flow", "#8dded9"], ["cut", "#ffad9e"], ["idle", "#617184"]])
	{
		const marker = svgElement("marker", { id: `arrow-${name}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, orient: "auto", markerUnits: "userSpaceOnUse" });
		marker.append(svgElement("path", { d: "M1,1 L9,5 L1,9 Z", fill: color }));
		defs.append(marker);
	}
	svg.append(defs);
	renderRegions(svg);
	const hits = svgElement("g");
	const labels = [];
	for(const edge of displayed.edges)
	{
		const { d, point } = geometry(edge);
		const flow = flowThrough(edge);
		const cut = inCut(edge);
		const suffix = `${cut ? " in-cut" : ""}${edge.capacity === 0 ? " closed" : ""}`;
		if(edge.id === selected) svg.append(svgElement("path", { d, class: "edge-selected" }));
		const base = svgElement("path", { d, class: `edge-base${suffix}`, "marker-end": `url(#arrow-${flow ? cut ? "cut" : "flow" : "idle"})` });
		base.style.setProperty("--capacity-width", String(Math.min(9, 2 + edge.capacity * 0.3)));
		svg.append(base);
		if(flow > 0)
		{
			const current = svgElement("path", { d, class: `edge-flow${cut ? " in-cut" : ""}` });
			current.style.setProperty("--flow-width", String(1.5 + flow * 0.5));
			const motion = svgElement("path", { d, class: `flow-motion${cut ? " in-cut" : ""}` });
			motion.style.setProperty("--travel-time", `${Math.max(0.5, 3 / Math.sqrt(flow))}s`);
			svg.append(current, motion);
			const packetCount = Math.min(4, Math.ceil(flow / 2));
			const duration = packetCount * 2.4 / flow;
			for(let index = 0; index < packetCount; index++)
			{
				const packet = svgElement("circle", {
					class: `flow-packet${cut ? " in-cut" : ""}`
					, r: 4.5 * 900 / elements["network-canvas"].clientWidth
					, "data-edge-packet": edge.id
				});
				packet.append(svgElement("animateMotion", {
					path: d, dur: `${duration}s`, begin: `${-index * duration / packetCount}s`
					, repeatCount: "indefinite", calcMode: "paced"
				}));
				svg.append(packet);
			}
		}
		const hit = svgElement("path", { d, class: "edge-hit" });
		hit.addEventListener("click", () => selectEdge(edge.id));
		hits.append(hit);
		const label = element("button", `edge-label${suffix}`);
		label.type = "button";
		label.dataset.edge = edge.id;
		label.style.left = `${point.x / 9}%`;
		label.style.top = `${point.y / 4.6}%`;
		label.setAttribute("aria-pressed", String(edge.id === selected));
		label.setAttribute("aria-label", `${fullEdgeName(displayed, edge)}: flow ${flow}, capacity ${edge.capacity}${cut ? ", in the shown minimum cut" : ""}. Edit capacity.`);
		label.append(element("span", "", String(flow)), element("span", "capacity-part", ` / ${edge.capacity}`));
		label.addEventListener("click", () => selectEdge(edge.id));
		labels.push(label);
	}
	svg.append(hits);
	elements["edge-labels"].replaceChildren(...labels);
	elements["node-layer"].replaceChildren(...displayed.nodes.map((node, index) => {
		const source = index === displayed.source;
		const sink = index === displayed.sink;
		const side = Boolean(result.sourceSide[index]);
		const card = element("div", `network-node${source || sink ? " terminal" : ""}${sink ? " sink" : ""}${side ? " on-source-side" : ""}`);
		card.style.left = `${node.x / 9}%`;
		card.style.top = `${node.y / 4.6}%`;
		card.append(element("b", "", node.name), element("small", "", source ? "Flow enters" : sink ? "Flow leaves" : side ? "Source side" : "Sink side"));
		return card;
	}));
	renderMotion();
};

const selectEdge = id => {
	selected = id;
	renderControls();
	renderInspector();
	renderNetwork();
	const label = elements["edge-labels"].querySelector(`[data-edge="${id}"]`);
	if(label)
	{
		const bounds = label.getBoundingClientRect();
		const view = graphScroll.getBoundingClientRect();
		if(bounds.right > view.right) graphScroll.scrollLeft += bounds.right - view.right + 16;
		if(bounds.left < view.left) graphScroll.scrollLeft -= view.left - bounds.left + 16;
	}
};

const solveNetwork = async () => {
	const currentRevision = ++revision;
	const snapshot = { ...network, nodes: network.nodes.map(node => ({ ...node })), edges: network.edges.map(edge => ({ ...edge })) };
	const packed = buildGraphRequest(snapshot);
	elements["runtime-status"].textContent = "Updating the Lean flow and cut…";
	let solve;
	try
	{
		solve = await prepareGraph(packed.request);
		if(currentRevision !== revision || !alive) return;
		const start = globalThis.performance.now();
		const next = solve();
		const elapsed = globalThis.performance.now() - start;
		const previousCut = result ? cutKey() : "";
		const initialDisplay = baselineValue === null;
		result = next;
		displayed = snapshot;
		edgeIndex = packed.edgeIndex;
		if(baselineValue === null)
		{
			baselineValue = result.value;
			baselineCut = cutKey();
		}
		elements["runtime-status"].classList.remove("failed");
		elements["runtime-status"].textContent = `Lean/Wasm ready · ${elapsed.toFixed(2)} ms`;
		renderControls();
		renderSummary();
		renderNetwork();
		renderInspector();
		if(initialDisplay || previousCut !== cutKey())
		{
			const crossings = cutEdges();
			const center = crossings.reduce((sum, edge) => sum + geometry(edge).point.x, 0) / Math.max(1, crossings.length);
			graphScroll.scrollLeft = center / 900 * elements["network-canvas"].clientWidth - graphScroll.clientWidth / 2;
		}
	}
	catch(error)
	{
		if(currentRevision !== revision || !alive) return;
		elements["runtime-status"].classList.add("failed");
		elements["runtime-status"].textContent = "Lean/Wasm could not solve this network";
		elements["result-title"].textContent = "The network did not finish solving.";
		elements["result-copy"].textContent = error instanceof Error ? error.message : String(error);
		console.error(error);
	}
	finally
	{ solve?.dispose(); }
};

const changeCapacity = value => {
	const capacity = Math.min(20, Math.max(0, Math.round(Number(value) || 0)));
	network.edges.find(edge => edge.id === selected).capacity = capacity;
	elements["edge-capacity"].value = String(capacity);
	elements["capacity-slider"].value = String(capacity);
	hasEdits = true;
	revision++;
	globalThis.cancelAnimationFrame(queuedFrame);
	queuedFrame = globalThis.requestAnimationFrame(() => {
		queuedFrame = 0;
		void solveNetwork();
	});
};

elements["capacity-slider"].addEventListener("input", event => changeCapacity(event.target.value));
elements["edge-capacity"].addEventListener("change", event => changeCapacity(event.target.value));
elements["widen-bottleneck"].addEventListener("click", () => {
	selected = WIDEN_EDGE_ID;
	changeCapacity(WIDEN_CAPACITY);
});
elements["reset-network"].addEventListener("click", () => {
	globalThis.cancelAnimationFrame(queuedFrame);
	queuedFrame = 0;
	network = createNetwork();
	selected = WIDEN_EDGE_ID;
	baselineValue = null;
	hasEdits = false;
	void solveNetwork();
});
elements["toggle-motion"].addEventListener("click", () => {
	motionPaused = !motionPaused;
	renderMotion();
});
globalThis.document.addEventListener("visibilitychange", renderMotion);
const resizeObserver = new globalThis.ResizeObserver(() => {
	panNote.hidden = graphScroll.scrollWidth <= graphScroll.clientWidth;
	renderNetwork();
});
resizeObserver.observe(elements["network-canvas"]);
resizeObserver.observe(graphScroll);
globalThis.addEventListener("pagehide", () => {
	alive = false;
	resizeObserver.disconnect();
	revision++;
	globalThis.cancelAnimationFrame(queuedFrame);
	queuedFrame = 0;
});
globalThis.addEventListener("pageshow", event => {
	if(event.persisted)
	{
		alive = true;
		resizeObserver.observe(elements["network-canvas"]);
		resizeObserver.observe(graphScroll);
		void solveNetwork();
	}
});

mountBenchmark();
renderControls();
void solveNetwork();
