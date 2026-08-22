/**
 * Runs the interactive percolation lab through the checked Lean partition.
 *
 * @file
 */

import { partition, ready } from "./runtime.mjs";
import {
	GRAPH_COUNT, HEIGHT, SITE_COUNT, WIDTH, activationOrder, activeFromPrefix, analyzePartition,
	inletDistances, linksForActive, mazeWalls
} from "./percolation.mjs";

const COPY = {
	noun: "open passages"
	, spanning: "Water reached the outlet."
	, waiting: "Water has not crossed the material."
};

const byId = id => document.getElementById(id);
const elements = {
	activeCount: byId("active-count")
	, applySeed: byId("apply-seed")
	, benchJs: byId("bench-js")
	, benchLean: byId("bench-lean")
	, benchP95: byId("bench-p95")
	, benchRatio: byId("bench-ratio")
	, bottom: byId("bottom-boundary")
	, cancelTrials: byId("cancel-trials")
	, componentCount: byId("component-count")
	, density: byId("density")
	, editStatus: byId("edit-status")
	, grid: byId("site-grid")
	, histogram: byId("histogram")
	, legend: byId("legend")
	, newMaterial: byId("new-material")
	, pause: byId("pause")
	, reset: byId("reset")
	, resultCopy: byId("result-copy")
	, resultTitle: byId("result-title")
	, run: byId("run")
	, runtime: byId("runtime")
	, runtimeStatus: byId("runtime-status")
	, runTrials: byId("run-trials")
	, sampleTitle: byId("sample-title")
	, seed: byId("seed")
	, step: byId("step")
	, top: byId("top-boundary")
	, toolOpen: byId("tool-open")
	, toolSeal: byId("tool-seal")
	, toolWall: byId("tool-wall")
	, trialProgress: byId("trial-progress")
	, trialSummary: byId("trial-summary")
};

let active = new Uint8Array(SITE_COUNT);
let walls = new Uint8Array(SITE_COUNT);
let order;
let cursor = 0;
let seed = 0;
let running = false;
let runFrame = 0;
let solveRevision = 0;
let view = "sample";
let firstSpanCount = null;
let sequenceIntact = true;
let trialRevision = 0;
let painting = false;
let drawTool = "open";
let dragSolveFrame = 0;
const previousWet = new Uint8Array(SITE_COUNT);

const cells = Array.from({ length: SITE_COUNT }, (_, site) => {
	const cell = document.createElement("button");
	cell.className = "site";
	cell.type = "button";
	cell.dataset.site = String(site);
	cell.tabIndex = site === 0 ? 0 : -1;
	cell.setAttribute("role", "gridcell");
	cell.setAttribute("aria-rowindex", String(Math.floor(site / WIDTH) + 1));
	cell.setAttribute("aria-colindex", String(site % WIDTH + 1));
	cell.addEventListener("animationend", () => cell.classList.remove("filling"));
	elements.grid.append(cell);
	return cell;
});
elements.grid.setAttribute("aria-rowcount", String(HEIGHT));
elements.grid.setAttribute("aria-colcount", String(WIDTH));

const freshSeed = () => {
	const values = new Uint32Array(1);
	crypto.getRandomValues(values);
	return values[0] || 1;
};

const showSeed = () => {
	elements.seed.value = seed.toString(16).padStart(8, "0");
	elements.seed.setAttribute("aria-invalid", "false");
};

const syncView = () => {
	elements.legend.innerHTML = `<span><i class="wall-key"></i>Maze wall</span><span><i></i>Unopened passage</span><span><i class="active-key"></i>Dry clusters</span><span><i class="wet-key"></i>Water from inlet</span><span><i class="span-key"></i>Outlet contact</span>`;
	for(const tab of document.querySelectorAll("[role=tab][data-view]"))
	{
		const selected = tab.dataset.view === view;
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
		byId(tab.getAttribute("aria-controls")).hidden = !selected;
	}
};

const draw = (result, elapsed) => {
	const analysis = analyzePartition(active, result.representatives, walls);
	const distances = running ? inletDistances(active, walls) : null;
	for(let site = 0; site < SITE_COUNT; site += 1)
	{
		const cell = cells[site];
		const isWall = Boolean(walls[site]);
		const isActive = Boolean(active[site]) && !isWall;
		const root = result.representatives[site];
		const topConnected = isActive && analysis.topRoots.has(root);
		const inSpanningCluster = isActive && analysis.spanningRoots.has(root);
		const outletContact = inSpanningCluster && site >= SITE_COUNT - WIDTH;
		const minimumSite = analysis.minimumSite.get(root);
		cell.classList.toggle("wall", isWall);
		cell.classList.toggle("active", isActive);
		cell.classList.toggle("top-connected", topConnected);
		cell.classList.toggle("spanning", outletContact);
		if(isActive && minimumSite !== undefined)
		{
			cell.style.setProperty("--cluster-hue", String((minimumSite * 137.508 + 203) % 360));
		}
		else cell.style.removeProperty("--cluster-hue");
		if(topConnected && !previousWet[site] && distances)
		{
			cell.style.setProperty("--fill-delay", `${Math.min(480, Math.max(0, distances[site]) * 12)}ms`);
			cell.classList.add("filling");
		}
		else if(!topConnected) cell.classList.remove("filling");
		previousWet[site] = Number(topConnected);
		cell.setAttribute("aria-pressed", String(isActive));
		cell.setAttribute("aria-label", `Row ${Math.floor(site / WIDTH) + 1}, column ${site % WIDTH + 1}: ${isWall ? "maze wall" : isActive ? "open passage" : "unopened passage"}${topConnected ? ", filled from inlet" : ""}${inSpanningCluster ? ", in spanning wet cluster" : ""}${outletContact ? ", touches outlet" : ""}`);
	}
	const spans = analysis.spans;
	elements.top.classList.toggle("engaged", analysis.topRoots.size > 0);
	elements.top.classList.toggle("connected", spans);
	elements.bottom.classList.toggle("connected", spans);
	elements.activeCount.textContent = `${analysis.activeCount} / ${order.length}`;
	elements.density.textContent = `${(analysis.activeCount / order.length * 100).toFixed(1)}%`;
	elements.componentCount.textContent = String(analysis.componentCount);
	elements.runtime.textContent = `${elapsed.toFixed(2)} ms`;
	if(spans)
	{
		if(firstSpanCount === null && sequenceIntact) firstSpanCount = analysis.activeCount;
		running = false;
		cancelAnimationFrame(runFrame);
	}
	if(spans)
	{
		elements.resultTitle.textContent = COPY.spanning;
		const threshold = firstSpanCount === null ? "This edited maze spans now." : `First span after ${(firstSpanCount / order.length * 100).toFixed(1)}% of its passages opened.`;
		elements.resultCopy.textContent = `${threshold} The wet cluster joins inlet and outlet.`;
	}
	else
	{
		elements.resultTitle.textContent = COPY.waiting;
		elements.resultCopy.textContent = `${analysis.activeCount} ${COPY.noun} form ${analysis.componentCount} separate ${analysis.componentCount === 1 ? "cluster" : "clusters"}. Cyan shows where inlet water can reach.`;
	}
	elements.pause.disabled = !running;
	elements.run.disabled = running || spans;
};

const solve = async () => {
	const revision = ++solveRevision;
	const snapshot = active.slice();
	const links = linksForActive(snapshot, walls, true);
	const started = performance.now();
	const result = await partition({ elementCount: GRAPH_COUNT, links });
	const elapsed = performance.now() - started;
	if(revision !== solveRevision) return null;
	draw(result, elapsed);
	return result;
};

const activateNext = count => {
	let changed = 0;
	while(cursor < order.length && changed < count)
	{
		const site = order[cursor++];
		if(!active[site])
		{ active[site] = 1; changed += 1; }
	}
	return changed;
};

const runLoop = async () => {
	if(!running) return;
	activateNext(7);
	elements.editStatus.textContent = "Opening pores in the seeded sequence.";
	await solve();
	if(running && cursor < order.length) runFrame = requestAnimationFrame(runLoop);
	else running = false;
};

const startRun = () => {
	if(running) return;
	running = true;
	elements.pause.disabled = false;
	elements.run.disabled = true;
	runFrame = requestAnimationFrame(runLoop);
};

const pause = message => {
	running = false;
	cancelAnimationFrame(runFrame);
	elements.pause.disabled = true;
	elements.run.disabled = false;
	if(message) elements.editStatus.textContent = message;
};

const reset = async () => {
	pause("Sequence reset.");
	active = new Uint8Array(SITE_COUNT);
	cursor = 0;
	firstSpanCount = null;
	sequenceIntact = true;
	await solve();
};

const loadMaterial = async nextSeed => {
	seed = nextSeed >>> 0;
	walls = mazeWalls(seed);
	order = activationOrder(seed ^ 0xa53c9e1d, walls);
	showSeed();
	await reset();
	elements.editStatus.textContent = `Maze ${elements.seed.value} loaded.`;
};

const replaceMaterial = () => loadMaterial(freshSeed());

const paint = site => {
	const wasWall = Boolean(walls[site]);
	const wasActive = Boolean(active[site]);
	const nextWall = drawTool === "wall";
	const nextActive = drawTool === "open";
	if(wasWall === nextWall && wasActive === nextActive) return;
	walls[site] = Number(nextWall);
	active[site] = Number(nextActive && !nextWall);
	if(wasWall !== nextWall)
	{
		order = activationOrder(seed ^ 0xa53c9e1d, walls);
		cursor = 0;
	}
	sequenceIntact = false;
	firstSpanCount = null;
	cells[site].classList.toggle("wall", nextWall);
	cells[site].classList.toggle("active", nextActive && !nextWall);
	cells[site].classList.remove("top-connected", "spanning", "filling");
	if(nextActive && !nextWall)
	{
		cells[site].style.setProperty("--cluster-hue", String((site * 137.508 + 203) % 360));
	}
	else cells[site].style.removeProperty("--cluster-hue");
	previousWet[site] = 0;
	elements.editStatus.textContent = drawTool === "wall"
		? "Drawing maze walls. They will persist when the maze is re-run."
		: drawTool === "open" ? "Drawing open passages." : "Closing passages.";
	if(!dragSolveFrame)
	{
		dragSolveFrame = requestAnimationFrame(() => {
			dragSolveFrame = 0;
			void solve();
		});
	}
};

const selectTool = tool => {
	drawTool = tool;
	elements.grid.dataset.tool = tool;
	elements.toolOpen.setAttribute("aria-pressed", String(tool === "open"));
	elements.toolSeal.setAttribute("aria-pressed", String(tool === "seal"));
	elements.toolWall.setAttribute("aria-pressed", String(tool === "wall"));
	elements.editStatus.textContent = tool === "wall"
		? "Wall tool selected. Drag to draw walls that persist across re-runs."
		: tool === "open" ? "Open tool selected. Drag to draw open passages."
			: "Close tool selected. Drag across open passages to close them.";
};

elements.toolOpen.addEventListener("click", () => selectTool("open"));
elements.toolSeal.addEventListener("click", () => selectTool("seal"));
elements.toolWall.addEventListener("click", () => selectTool("wall"));
selectTool("open");

elements.grid.addEventListener("pointerdown", event => {
	const cell = event.target.closest(".site");
	if(!cell) return;
	event.preventDefault();
	pause();
	painting = true;
	paint(Number(cell.dataset.site));
	elements.grid.setPointerCapture(event.pointerId);
});
elements.grid.addEventListener("pointermove", event => {
	if(!painting) return;
	const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest(".site");
	if(hit && elements.grid.contains(hit)) paint(Number(hit.dataset.site));
});
const finishPaint = async event => {
	if(!painting) return;
	painting = false;
	cancelAnimationFrame(dragSolveFrame);
	dragSolveFrame = 0;
	if(elements.grid.hasPointerCapture(event.pointerId)) elements.grid.releasePointerCapture(event.pointerId);
	await solve();
};
elements.grid.addEventListener("pointerup", finishPaint);
elements.grid.addEventListener("pointercancel", finishPaint);
elements.grid.addEventListener("keydown", async event => {
	const cell = event.target.closest(".site");
	if(!cell) return;
	const site = Number(cell.dataset.site);
	const movements = { ArrowDown: WIDTH, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -WIDTH };
	if(event.key === " " || event.key === "Enter")
	{
		event.preventDefault(); pause(); paint(site); await solve(); return;
	}
	if(!(event.key in movements)) return;
	event.preventDefault();
	let target = site + movements[event.key];
	if(event.key === "ArrowLeft" && site % WIDTH === 0) target = site;
	if(event.key === "ArrowRight" && site % WIDTH === WIDTH - 1) target = site;
	target = Math.max(0, Math.min(SITE_COUNT - 1, target));
	cell.tabIndex = -1; cells[target].tabIndex = 0; cells[target].focus();
});

elements.run.addEventListener("click", startRun);
elements.pause.addEventListener("click", () => pause("Sequence paused."));
elements.step.addEventListener("click", async () => { pause(); activateNext(1); elements.editStatus.textContent = "Opened one site."; await solve(); });
elements.reset.addEventListener("click", async () => { await reset(); startRun(); });
elements.newMaterial.addEventListener("click", replaceMaterial);
const applySeed = async () => {
	const normalized = elements.seed.value.trim().replace(/^0x/iu, "");
	if(!/^[0-9a-f]{1,8}$/iu.test(normalized))
	{
		elements.seed.setAttribute("aria-invalid", "true");
		elements.editStatus.textContent = "Enter one to eight hexadecimal digits.";
		return;
	}
	await loadMaterial(Number.parseInt(normalized, 16));
};
elements.applySeed.addEventListener("click", applySeed);
elements.seed.addEventListener("keydown", event => {
	if(event.key === "Enter")
	{
		event.preventDefault();
		void applySeed();
	}
});

const selectView = (nextView, updateHash = true) => {
	if(!["sample", "trials"].includes(nextView)) return;
	view = nextView;
	syncView();
	if(updateHash) history.replaceState(null, "", `#${view}`);
};
const tabs = [...document.querySelectorAll("[role=tab][data-view]")];
for(const tab of tabs)
{
	tab.addEventListener("click", () => selectView(tab.dataset.view));
	tab.addEventListener("keydown", event => {
		let target = tabs.indexOf(tab);
		if(event.key === "ArrowRight") target = (target + 1) % tabs.length;
		else if(event.key === "ArrowLeft") target = (target + tabs.length - 1) % tabs.length;
		else if(event.key === "Home") target = 0;
		else if(event.key === "End") target = tabs.length - 1;
		else return;
		event.preventDefault(); tabs[target].focus(); selectView(tabs[target].dataset.view);
	});
}
window.addEventListener("hashchange", () => selectView(location.hash.slice(1), false));

const jsPartition = ({ elementCount, links }) => {
	const parent = Uint32Array.from({ length: elementCount }, (_, index) => index);
	const sizes = new Uint32Array(elementCount);
	sizes.fill(1);
	const find = start => {
		let root = start;
		while(parent[root] !== root) root = parent[root];
		let vertex = start;
		while(parent[vertex] !== vertex)
		{
			const next = parent[vertex];
			parent[vertex] = root;
			vertex = next;
		}
		return root;
	};
	for(let index = 0; index < links.length; index += 2)
	{
		let left = find(links[index]);
		let right = find(links[index + 1]);
		if(left === right) continue;
		if(sizes[left] < sizes[right]) [left, right] = [right, left];
		parent[right] = left;
		sizes[left] += sizes[right];
	}
	const representatives = new Uint32Array(elementCount);
	for(let vertex = 0; vertex < elementCount; vertex += 1) representatives[vertex] = find(vertex);
	return { representatives };
};

const thresholdForOrder = async (trialOrder, solver = partition) => {
	let low = 1;
	let high = trialOrder.length;
	let calls = 0;
	let coreMs = 0;
	while(low < high)
	{
		const middle = Math.floor((low + high) / 2);
		const trialActive = activeFromPrefix(trialOrder, middle);
		const links = linksForActive(trialActive, walls, true);
		const started = performance.now();
		const result = await solver({ elementCount: GRAPH_COUNT, links });
		coreMs += performance.now() - started;
		calls += 1;
		const analysis = analyzePartition(trialActive, result.representatives, walls);
		if(analysis.spans) high = middle;
		else low = middle + 1;
	}
	return { calls, coreMs, count: low, percent: low / trialOrder.length * 100 };
};

const svgElement = (name, attributes = {}) => {
	const node = document.createElementNS("http://www.w3.org/2000/svg", name);
	for(const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
	return node;
};

let histogramValues = [];
const drawHistogram = values => {
	histogramValues = values;
	elements.histogram.replaceChildren();
	const chartWidth = Math.max(320, Math.round(elements.histogram.clientWidth));
	elements.histogram.setAttribute("viewBox", `0 0 ${chartWidth} 150`);
	const minimum = Math.floor(Math.min(...values) * 2) / 2;
	let maximum = Math.ceil(Math.max(...values) * 2) / 2;
	if(maximum <= minimum) maximum = minimum + .5;
	const binCount = 10;
	const bins = new Uint32Array(binCount);
	for(const value of values) bins[Math.min(binCount - 1, Math.floor((value - minimum) / (maximum - minimum) * binCount))] += 1;
	const maxBin = Math.max(...bins);
	const left = 18;
	const width = chartWidth - left * 2;
	const baseline = 124;
	for(let index = 0; index < binCount; index += 1)
	{
		const barWidth = width / binCount - 3;
		const height = bins[index] / maxBin * 108;
		const x = left + index * width / binCount;
		elements.histogram.append(svgElement("rect", { class: "bar", height, width: barWidth, x, y: baseline - height }));
		const label = svgElement("text", { class: "bar-label", "text-anchor": "middle", x: x + barWidth / 2, y: 142 });
		label.textContent = `${(minimum + index * (maximum - minimum) / binCount).toFixed(1)}`;
		elements.histogram.append(label);
	}
	const sorted = [...values].sort((leftValue, rightValue) => leftValue - rightValue);
	const median = sorted[Math.floor(sorted.length / 2)];
	const medianX = left + (median - minimum) / (maximum - minimum) * width;
	elements.histogram.append(svgElement("line", { class: "mean-line", x1: medianX, x2: medianX, y1: 12, y2: baseline }));
	elements.histogram.setAttribute("aria-label", `Histogram of 100 checked Lean threshold searches. Median ${median.toFixed(2)} milliseconds.`);
};

let histogramResizeFrame = 0;
new ResizeObserver(() => {
	if(histogramValues.length === 0 || histogramResizeFrame) return;
	histogramResizeFrame = requestAnimationFrame(() => {
		histogramResizeFrame = 0;
		drawHistogram(histogramValues);
	});
}).observe(elements.histogram);

const runTrials = async () => {
	const revision = ++trialRevision;
	elements.runTrials.disabled = true;
	elements.cancelTrials.disabled = false;
	const leanTimes = [];
	const javascriptTimes = [];
	const thresholds = [];
	let checkedPartitions = 0;
	const started = performance.now();
	for(let index = 0; index < 100; index += 1)
	{
		if(revision !== trialRevision) return;
		const trialSeed = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
		const trialOrder = activationOrder(trialSeed, walls);
		const lean = await thresholdForOrder(trialOrder);
		const javascript = await thresholdForOrder(trialOrder, jsPartition);
		if(lean.count !== javascript.count) throw new Error("Lean and JavaScript found different thresholds");
		leanTimes.push(lean.coreMs);
		javascriptTimes.push(javascript.coreMs);
		thresholds.push(lean.percent);
		checkedPartitions += lean.calls;
		elements.trialProgress.textContent = `${index + 1} / 100 compared`;
		if(index % 2 === 1) await new Promise(requestAnimationFrame);
	}
	leanTimes.sort((left, right) => left - right);
	javascriptTimes.sort((left, right) => left - right);
	thresholds.sort((left, right) => left - right);
	const leanMedian = leanTimes[50];
	const leanP95 = leanTimes[94];
	const javascriptMedian = javascriptTimes[50];
	const ratio = leanMedian / javascriptMedian;
	const leanTotal = leanTimes.reduce((sum, value) => sum + value, 0);
	elements.benchLean.textContent = `${leanMedian.toFixed(2)} ms`;
	elements.benchP95.textContent = `${leanP95.toFixed(2)} ms`;
	elements.benchJs.textContent = `${javascriptMedian.toFixed(2)} ms`;
	elements.benchRatio.textContent = `${ratio.toFixed(1)}×`;
	elements.trialSummary.textContent = `${checkedPartitions} checked partitions · ${(checkedPartitions / leanTotal * 1000).toFixed(0)} partitions/s · median crossing ${thresholds[50].toFixed(1)}%`;
	elements.trialProgress.textContent = `Completed in ${((performance.now() - started) / 1000).toFixed(1)} s`;
	drawHistogram(leanTimes);
	elements.runTrials.disabled = false;
	elements.cancelTrials.disabled = true;
};
elements.runTrials.addEventListener("click", runTrials);
elements.cancelTrials.addEventListener("click", () => {
	trialRevision += 1;
	elements.runTrials.disabled = false;
	elements.cancelTrials.disabled = true;
	elements.trialProgress.textContent = "Cancelled";
});

try
{
	await ready();
	elements.runtimeStatus.textContent = "Lean/Wasm ready";
	seed = freshSeed();
	walls = mazeWalls(seed);
	order = activationOrder(seed ^ 0xa53c9e1d, walls);
	showSeed();
	selectView(["sample", "trials"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "sample", false);
	elements.cancelTrials.disabled = true;
	await solve();
	if(matchMedia("(prefers-reduced-motion: reduce)").matches)
	{
		const threshold = await thresholdForOrder(order);
		active = activeFromPrefix(order, threshold.count);
		cursor = threshold.count;
		await solve();
	}
	else startRun();
}
catch(error)
{
	elements.runtimeStatus.textContent = "Lean/Wasm failed to load";
	elements.resultTitle.textContent = "The checked module did not start.";
	elements.resultCopy.textContent = error instanceof Error ? error.message : String(error);
	for(const button of document.querySelectorAll(".controls button, .trial-actions button")) button.disabled = true;
}
