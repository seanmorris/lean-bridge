/**
 * Interactive grid adapter for the generic proven Dijkstra runtime.
 *
 * @file
 */

import { prepareShortestPath, ready, shortestPath } from "./runtime.mjs";
import {
	attachBrowserBenchmark, measureSyncBenchmark
} from "../shared/browser-benchmark.mjs";

const COLUMNS = 28;
const ROWS = 18;
const VERTEX_COUNT = COLUMNS * ROWS;
const grid = document.querySelector("#grid");
const status = document.querySelector("#status");
const steps = document.querySelector("#steps");
const visited = document.querySelector("#visited");
const walls = new Uint8Array(VERTEX_COUNT);
const cells = [];
let start = 2 * COLUMNS + 2;
let target = 15 * COLUMNS + 25;
let path = [];
let mode = "wall";
let drawing = false;
let drawValue = true;
let solveVersion = 0;

grid.style.setProperty("--columns", COLUMNS);

for(let index = 0; index < VERTEX_COUNT; index += 1)
{
	const cell = document.createElement("button");
	cell.className = "cell";
	cell.dataset.index = index;
	cell.type = "button";
	cell.setAttribute("aria-label", `Cell ${index % COLUMNS + 1}, ${Math.floor(index / COLUMNS) + 1}`);
	grid.append(cell);
	cells.push(cell);
}

const installMaze = () => {
	const randomValues = new Uint32Array(VERTEX_COUNT + COLUMNS + ROWS);
	crypto.getRandomValues(randomValues);
	let randomIndex = 0;
	const random = () => randomValues[randomIndex++] / 0x1_0000_0000;
	for(let index = 0; index < VERTEX_COUNT; index += 1)
	{
		walls[index] = Number(index !== start && index !== target && random() < 0.24);
	}

	// Carve a differently shaped monotone route so every generated maze is solvable.
	let current = start;
	walls[current] = 0;
	while(current !== target)
	{
		const x = current % COLUMNS;
		const y = Math.floor(current / COLUMNS);
		const targetX = target % COLUMNS;
		const targetY = Math.floor(target / COLUMNS);
		const canMoveHorizontally = x !== targetX;
		const canMoveVertically = y !== targetY;
		if(canMoveHorizontally && (!canMoveVertically || random() < 0.5))
		{
			current += x < targetX ? 1 : -1;
		}
		else
		{
			current += y < targetY ? COLUMNS : -COLUMNS;
		}
		walls[current] = 0;
	}
};

installMaze();

const animateInitialMaze = duration => new Promise(resolve => {
	let started;
	grid.classList.add("maze-cycling");
	const nextFrame = async timestamp => {
		started ??= timestamp;
		installMaze();
		path = [];
		render();
		await solve();
		if(timestamp - started < duration) requestAnimationFrame(nextFrame);
		else
		{
			grid.classList.remove("maze-cycling");
			resolve();
		}
	};
	requestAnimationFrame(nextFrame);
});

const setMode = nextMode => {
	mode = nextMode;
	for(const button of document.querySelectorAll(".mode"))
	{
		const active = button.dataset.mode === mode;
		button.classList.toggle("active", active);
		button.setAttribute("aria-checked", String(active));
	}
};

const render = () => {
	const pathCells = new Set(path);
	for(let index = 0; index < VERTEX_COUNT; index += 1)
	{
		const cell = cells[index];
		cell.className = "cell";
		if(walls[index]) cell.classList.add("wall");
		else if(pathCells.has(index)) cell.classList.add("path");
		if(index === start) cell.classList.add("start");
		if(index === target) cell.classList.add("end");
	}
};

const graphCsr = () => {
	const offsets = new Uint32Array(VERTEX_COUNT + 1);
	const edgeTargets = [];
	for(let vertex = 0; vertex < VERTEX_COUNT; vertex += 1)
	{
		offsets[vertex] = edgeTargets.length;
		if(walls[vertex]) continue;
		const x = vertex % COLUMNS;
		const y = Math.floor(vertex / COLUMNS);
		const neighbors = [
			x > 0 ? vertex - 1 : -1
			, x + 1 < COLUMNS ? vertex + 1 : -1
			, y > 0 ? vertex - COLUMNS : -1
			, y + 1 < ROWS ? vertex + COLUMNS : -1
		];
		for(const neighbor of neighbors)
		{
			if(neighbor >= 0 && !walls[neighbor]) edgeTargets.push(neighbor);
		}
	}
	offsets[VERTEX_COUNT] = edgeTargets.length;
	const targets = Uint32Array.from(edgeTargets);
	return { offsets, targets, weights: new Uint32Array(targets.length).fill(1) };
};

const solve = async () => {
	const version = ++solveVersion;
	status.className = "status";
	status.innerHTML = '<span class="spinner"></span> Lean is checking…';
	const started = performance.now();
	try
	{
		const result = await shortestPath({ vertexCount: VERTEX_COUNT, ...graphCsr(), start, target });
		if(version !== solveVersion) return;
		path = result;
		const elapsed = performance.now() - started;
		steps.textContent = result.length ? result.length - 1 : "—";
		visited.textContent = VERTEX_COUNT - walls.reduce((sum, wall) => sum + wall, 0);
		if(result.length)
		{
			status.className = "status ready";
			status.innerHTML = `<span class="spinner"></span> Certified in ${elapsed.toFixed(1)} ms`;
		}
		else
		{
			status.className = "status no-path ready";
			status.innerHTML = '<span class="spinner"></span> No certified path';
		}
		render();
	}
	catch(error)
	{
		if(version !== solveVersion) return;
		status.className = "status no-path ready";
		status.innerHTML = '<span class="spinner"></span> Runtime error';
		console.error(error);
	}
};

const edit = (index, solveAfter = true) => {
	if(mode === "wall")
	{
		if(index === start || index === target) return;
		walls[index] = Number(drawValue);
	}
	else if(mode === "start")
	{
		if(index === target) return;
		walls[index] = 0;
		start = index;
	}
	else
	{
		if(index === start) return;
		walls[index] = 0;
		target = index;
	}
	path = [];
	render();
	if(solveAfter) solve();
};

grid.addEventListener("pointerdown", event => {
	const cell = event.target.closest(".cell");
	if(!cell) return;
	event.preventDefault();
	const index = Number(cell.dataset.index);
	drawing = mode === "wall";
	drawValue = !walls[index];
	edit(index, !drawing);
});

grid.addEventListener("pointerover", event => {
	if(!drawing || mode !== "wall") return;
	const cell = event.target.closest(".cell");
	if(cell) edit(Number(cell.dataset.index), false);
});

globalThis.addEventListener("pointerup", () => {
	if(drawing) solve();
	drawing = false;
});

for(const button of document.querySelectorAll(".mode"))
{
	button.addEventListener("click", () => setMode(button.dataset.mode));
}

document.querySelector("#clear").addEventListener("click", () => {
	walls.fill(0);
	render();
	solve();
});

document.querySelector("#maze").addEventListener("click", () => {
	installMaze();
	render();
	solve();
});

globalThis.addEventListener("keydown", event => {
	if(event.key === "1") setMode("wall");
	if(event.key === "2") setMode("start");
	if(event.key === "3") setMode("end");
});

const makeBenchmarkGraph = () => {
	const offsets = new Uint32Array(VERTEX_COUNT + 1);
	const targets = [];
	const weights = [];
	for(let vertex = 0; vertex < VERTEX_COUNT; vertex += 1)
	{
		const x = vertex % COLUMNS;
		const y = Math.floor(vertex / COLUMNS);
		const neighbors = [
			x > 0 ? vertex - 1 : -1
			, x + 1 < COLUMNS ? vertex + 1 : -1
			, y > 0 ? vertex - COLUMNS : -1
			, y + 1 < ROWS ? vertex + COLUMNS : -1
		];
		for(const neighbor of neighbors)
		{
			if(neighbor < 0) continue;
			targets.push(neighbor);
			weights.push(1 + ((vertex * 17 + neighbor * 31) % 9));
		}
		offsets[vertex + 1] = targets.length;
	}
	return { offsets, targets: Uint32Array.from(targets), weights: Uint32Array.from(weights) };
};

const javascriptShortestPath = ({ vertexCount, offsets, targets, weights, start: source, target: goal }) => {
	const distances = new Float64Array(vertexCount);
	distances.fill(Number.POSITIVE_INFINITY);
	const previous = new Int32Array(vertexCount);
	previous.fill(-1);
	const heapVertices = [];
	const heapDistances = [];
	const push = (vertex, distance) => {
		let index = heapVertices.length;
		heapVertices.push(vertex);
		heapDistances.push(distance);
		while(index > 0)
		{
			const parent = Math.floor((index - 1) / 2);
			if(heapDistances[parent] <= distance) break;
			heapVertices[index] = heapVertices[parent];
			heapDistances[index] = heapDistances[parent];
			index = parent;
		}
		heapVertices[index] = vertex;
		heapDistances[index] = distance;
	};
	const pop = () => {
		const vertex = heapVertices[0];
		const distance = heapDistances[0];
		const lastVertex = heapVertices.pop();
		const lastDistance = heapDistances.pop();
		if(heapVertices.length > 0)
		{
			let index = 0;
			while(true)
			{
				const left = index * 2 + 1;
				if(left >= heapVertices.length) break;
				const right = left + 1;
				const child = right < heapVertices.length && heapDistances[right] < heapDistances[left]
					? right : left;
				if(heapDistances[child] >= lastDistance) break;
				heapVertices[index] = heapVertices[child];
				heapDistances[index] = heapDistances[child];
				index = child;
			}
			heapVertices[index] = lastVertex;
			heapDistances[index] = lastDistance;
		}
		return { distance, vertex };
	};
	distances[source] = 0;
	push(source, 0);
	while(heapVertices.length > 0)
	{
		const current = pop();
		if(current.distance !== distances[current.vertex]) continue;
		if(current.vertex === goal) break;
		for(let edge = offsets[current.vertex]; edge < offsets[current.vertex + 1]; edge += 1)
		{
			const next = targets[edge];
			const candidate = current.distance + weights[edge];
			if(candidate >= distances[next]) continue;
			distances[next] = candidate;
			previous[next] = current.vertex;
			push(next, candidate);
		}
	}
	if(!Number.isFinite(distances[goal])) return [];
	const result = [];
	for(let vertex = goal; vertex >= 0; vertex = previous[vertex])
	{
		result.push(vertex);
		if(vertex === source) break;
	}
	return result.reverse();
};

const benchmarkPathCost = (graph, route) => {
	let cost = 0;
	for(let index = 1; index < route.length; index += 1)
	{
		const source = route[index - 1];
		const target = route[index];
		let weight = -1;
		for(let edge = graph.offsets[source]; edge < graph.offsets[source + 1]; edge += 1)
		{
			if(graph.targets[edge] === target) weight = graph.weights[edge];
		}
		if(weight < 0) throw new Error("A benchmark solver returned a nonexistent edge");
		cost += weight;
	}
	return cost;
};

const benchmarkGraph = makeBenchmarkGraph();
let benchmarkSolve;
const benchmarkRequest = index => {
	const source = (index * 47 + 11) % VERTEX_COUNT;
	let goal = (index * 193 + VERTEX_COUNT - 7) % VERTEX_COUNT;
	if(goal === source) goal = (goal + Math.floor(VERTEX_COUNT / 2)) % VERTEX_COUNT;
	return { vertexCount: VERTEX_COUNT, ...benchmarkGraph, start: source, target: goal };
};

render();
const demoReady = ready().then(() => animateInitialMaze(200));
const benchmarkReady = demoReady.then(async () => {
	benchmarkSolve = await prepareShortestPath({ vertexCount: VERTEX_COUNT, ...benchmarkGraph });
});
demoReady.catch(error => {
	status.className = "status no-path ready";
	status.innerHTML = '<span class="spinner"></span> Lean/Wasm failed to load';
	console.error(error);
});

attachBrowserBenchmark({
	root: document.querySelector("#browser-benchmark")
	, prepare: () => benchmarkReady
	, sample: async (index, warmup) => {
		const request = benchmarkRequest(index + (warmup ? 10_000 : 0));
		const lean = measureSyncBenchmark(() => benchmarkSolve(request.start, request.target));
		const javascript = measureSyncBenchmark(() => javascriptShortestPath(request));
		const leanPath = lean.result;
		const javascriptPath = javascript.result;
		if(leanPath[0] !== request.start || leanPath.at(-1) !== request.target)
		{
			throw new Error("Lean returned incorrect benchmark endpoints");
		}
		if(benchmarkPathCost(request, leanPath) !== benchmarkPathCost(request, javascriptPath))
		{
			throw new Error("Lean and JavaScript found paths with different costs");
		}
		return { javascriptMs: javascript.milliseconds, leanMs: lean.milliseconds };
	}
	, summarize: ({ javascriptMedian, leanMedian, trialCount }) =>
		`${VERTEX_COUNT} vertices · ${benchmarkGraph.targets.length} directed edges · `
		+ `${trialCount} costs agreed · +${(leanMedian - javascriptMedian).toFixed(2)} ms`
});
