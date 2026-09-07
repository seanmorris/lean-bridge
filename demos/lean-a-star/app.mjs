/**
 * Compares two compiled Lean searches over the same editable weighted terrain.
 *
 * @file
 */

import { initRuntime, prepareSearch } from "./runtime.mjs";
import { mountBenchmark } from "./browser-benchmark.mjs";
import { buildSearchRequest, createTerrain, TERRAIN } from "./terrain.mjs";

const byId = id => document.getElementById(id);
const maps = ["astar", "dijkstra"].map(name => ({
	name, canvas: byId(`${name}-map`), result: null, elapsed: 0
}));
const colors = {
	0: "#050b12", 1: "#1a2a3d", 4: "#294a36", 9: "#1d4663"
};
const toolDescriptions = {
	wall: "Wall tool: drag on either map to paint walls. Choose Erase to remove them."
	, floor: "Floor tool: drag to paint tiles with an entry cost of 1."
	, forest: "Forest tool: drag to paint tiles with an entry cost of 4."
	, water: "Water tool: drag to paint tiles with an entry cost of 9."
	, erase: "Eraser: drag to turn walls, forest, and water into floor with an entry cost of 1."
	, start: "Start tool: click or drag to move the start on both maps."
	, target: "Goal tool: click or drag to move the goal on both maps."
};
let terrain = createTerrain();
let strength = 100;
let tool = "wall";
let runtimeReady = false;
let searchesWarmed = false;
let revision = 0;
let solveFrame = 0;
let drag = null;
let cursor = null;
let focusedMap = null;

const drawMap = map => {
	const { canvas, result, name } = map;
	const bounds = canvas.getBoundingClientRect();
	const ratio = Math.min(globalThis.devicePixelRatio || 1, 3);
	const width = Math.max(1, bounds.width);
	const height = Math.max(1, bounds.height);
	const pixelWidth = Math.round(width * ratio);
	const pixelHeight = Math.round(height * ratio);
	if(canvas.width !== pixelWidth || canvas.height !== pixelHeight)
	{
		canvas.width = pixelWidth;
		canvas.height = pixelHeight;
	}
	const context = canvas.getContext("2d");
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, width, height);
	const tileWidth = width / terrain.columns;
	const tileHeight = height / terrain.rows;
	const unit = Math.min(tileWidth, tileHeight);
	const inspected = new Set(result?.expanded || []);
	for(let vertex = 0; vertex < terrain.cells.length; vertex += 1)
	{
		const x = (vertex % terrain.columns) * tileWidth;
		const y = Math.floor(vertex / terrain.columns) * tileHeight;
		const cost = terrain.cells[vertex];
		context.fillStyle = colors[cost];
		context.fillRect(x + .5, y + .5, tileWidth - 1, tileHeight - 1);
		if(cost === TERRAIN.wall)
		{
			context.strokeStyle = "#243446";
			context.lineWidth = .7;
			context.strokeRect(x + 1, y + 1, tileWidth - 2, tileHeight - 2);
		}
		else if(cost === TERRAIN.forest)
		{
			context.fillStyle = "#527959";
			context.beginPath();
			context.moveTo(x + tileWidth * .5, y + tileHeight * .27);
			context.lineTo(x + tileWidth * .73, y + tileHeight * .7);
			context.lineTo(x + tileWidth * .27, y + tileHeight * .7);
			context.fill();
		}
		else if(cost === TERRAIN.water)
		{
			context.strokeStyle = "#4f7995";
			context.lineWidth = Math.max(.7, unit * .055);
			for(const offset of [.39, .62])
			{
				context.beginPath();
				context.moveTo(x + tileWidth * .2, y + tileHeight * offset);
				context.quadraticCurveTo(x + tileWidth * .38, y + tileHeight * (offset - .2), x + tileWidth * .51, y + tileHeight * offset);
				context.quadraticCurveTo(x + tileWidth * .65, y + tileHeight * (offset + .12), x + tileWidth * .8, y + tileHeight * offset);
				context.stroke();
			}
		}
		if(cost !== TERRAIN.wall && inspected.has(vertex))
		{
			context.fillStyle = name === "astar" ? "rgba(177,218,113,.23)" : "rgba(116,187,236,.24)";
			context.fillRect(x + .5, y + .5, tileWidth - 1, tileHeight - 1);
			context.fillStyle = name === "astar" ? "#b4d98c" : "#9ccbeb";
			context.beginPath();
			context.arc(x + tileWidth * .5, y + tileHeight * .5, Math.max(.6, unit * .06), 0, Math.PI * 2);
			context.fill();
		}
	}
	if(result?.kind === "path" && result.path.length > 1)
	{
		context.beginPath();
		result.path.forEach((vertex, index) => {
			const x = (vertex % terrain.columns + .5) * tileWidth;
			const y = (Math.floor(vertex / terrain.columns) + .5) * tileHeight;
			if(index === 0) context.moveTo(x, y);
			else context.lineTo(x, y);
		});
		context.lineJoin = "round";
		context.lineCap = "round";
		context.strokeStyle = "#132232";
		context.lineWidth = Math.max(4, unit * .42);
		context.stroke();
		context.strokeStyle = "#ffe9a4";
		context.lineWidth = Math.max(2, unit * .2);
		context.shadowColor = "rgba(255,220,120,.55)";
		context.shadowBlur = 7;
		context.stroke();
		context.shadowBlur = 0;
	}
	for(const [vertex, label, color] of [
		[terrain.start, "S", "#d4f4a9"]
		, [terrain.target, terrain.start === terrain.target ? "S/G" : "G", "#ffdda6"]
	]) {
		const x = (vertex % terrain.columns + .5) * tileWidth;
		const y = (Math.floor(vertex / terrain.columns) + .5) * tileHeight;
		context.beginPath();
		context.arc(x, y, Math.max(5, unit * .48), 0, Math.PI * 2);
		context.fillStyle = color;
		context.fill();
		context.lineWidth = Math.max(1.2, unit * .08);
		context.strokeStyle = "#071422";
		context.stroke();
		context.fillStyle = "#102331";
		context.font = `800 ${Math.max(7, unit * (label === "S/G" ? .4 : .57))}px ui-sans-serif, system-ui, sans-serif`;
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillText(label, x, y + unit * .025);
	}
	if(cursor !== null)
	{
		context.strokeStyle = "#f4f6e4";
		context.lineWidth = 1.5;
		context.strokeRect((cursor % terrain.columns) * tileWidth + 1.2,
			Math.floor(cursor / terrain.columns) * tileHeight + 1.2, tileWidth - 2.4, tileHeight - 2.4);
	}
};

const drawMaps = () => maps.forEach(drawMap);
const renderResults = () => {
	for(const map of maps)
	{
		const { name, result, elapsed } = map;
		byId(`${name}-cost`).textContent = result?.kind === "path" ? String(result.cost) : "—";
		byId(`${name}-expanded`).textContent = result ? result.expanded.length.toLocaleString() : "—";
		byId(`${name}-time`).textContent = result ? `${elapsed.toFixed(2)} ms` : "—";
		byId(`${name}-route`).textContent = result?.kind === "path"
			? `${Math.max(0, result.path.length - 1)} steps · ${result.cost} total cost`
			: result ? "No route connects the start and goal." : "Finding the cheapest route…";
	}
	const [astar, dijkstra] = maps.map(map => map.result);
	if(!astar || !dijkstra) return;
	const bothFound = astar.kind === "path" && dijkstra.kind === "path";
	const savings = dijkstra.expanded.length ? (1 - astar.expanded.length / dijkstra.expanded.length) * 100 : 0;
	byId("search-saving").textContent = `${Math.abs(savings).toFixed(0)}%`;
	byId("search-saving-label").textContent = `${savings < 0 ? "more" : "fewer"} tiles inspected`;
	if(bothFound && astar.cost === dijkstra.cost)
	{
		byId("result-title").textContent = strength === 0
			? "At 0%, A* searches like Dijkstra."
			: savings > 0 ? `Same route cost. ${Math.round(savings)}% fewer tiles inspected.` : "Both searches found the lowest-cost route.";
		byId("result-copy").textContent = `Both routes cost ${astar.cost}. A* inspected ${astar.expanded.length} tiles; Dijkstra inspected ${dijkstra.expanded.length}. Change the terrain or move the goal to compare another search.`;
	}
	else if(astar.kind === "unreachable" && dijkstra.kind === "unreachable")
	{
		byId("result-title").textContent = "The walls block every route.";
		byId("result-copy").textContent = "Both searches confirmed the goal is unreachable. Erase a wall or move an endpoint to reconnect the map.";
	}
	else
	{
		byId("result-title").textContent = "The search results disagree.";
		byId("result-copy").textContent = "The two searches did not return the same reachability and optimal cost.";
	}
};

const solveMaps = async () => {
	if(!runtimeReady) return;
	const current = revision;
	const requests = [buildSearchRequest(terrain, strength), buildSearchRequest(terrain, 0)];
	const searches = [];
	try
	{
		for(const request of requests) searches.push(await prepareSearch(request));
		if(current !== revision) return;
		if(!searchesWarmed)
		{
			for(let warmup = 0; warmup < 5; warmup += 1)
				for(const search of searches) search();
			searchesWarmed = true;
		}
		for(let index = 0; index < maps.length; index += 1)
		{
			const started = performance.now();
			maps[index].result = searches[index]();
			maps[index].elapsed = performance.now() - started;
		}
		renderResults();
		drawMaps();
		byId("runtime-status").textContent = "Both searches run in Lean/Wasm";
		byId("runtime-status").classList.remove("failed");
	}
	catch(error)
	{
		byId("runtime-status").textContent = "Search could not complete";
		byId("runtime-status").classList.add("failed");
		byId("result-title").textContent = "The search could not run.";
		byId("result-copy").textContent = error.message;
	}
	finally
	{
		for(const search of searches) search.dispose();
	}
};

const changed = () => {
	revision += 1;
	for(const map of maps) map.result = null;
	drawMaps();
	if(solveFrame) return;
	solveFrame = requestAnimationFrame(() => {
		solveFrame = 0;
		void solveMaps();
	});
};

const chooseTool = next => {
	tool = next;
	for(const button of document.querySelectorAll("[data-tool]"))
		button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
	byId("edit-hint").textContent = `${toolDescriptions[tool]} Arrow keys move the cursor; Space paints.`;
};
const paint = vertex => {
	if(vertex === null) return false;
	if(tool === "start" || tool === "target")
	{
		if(terrain[tool] === vertex) return false;
		terrain[tool] = vertex;
		if(terrain.cells[vertex] === TERRAIN.wall) terrain.cells[vertex] = TERRAIN.floor;
		return true;
	}
	if(vertex === terrain.start || vertex === terrain.target) return false;
	const cost = tool === "erase" ? TERRAIN.floor : TERRAIN[tool];
	if(terrain.cells[vertex] === cost) return false;
	terrain.cells[vertex] = cost;
	return true;
};
const paintLine = (first, last) => {
	let x = first % terrain.columns;
	let y = Math.floor(first / terrain.columns);
	const endX = last % terrain.columns;
	const endY = Math.floor(last / terrain.columns);
	const dx = Math.abs(endX - x);
	const dy = -Math.abs(endY - y);
	const stepX = x < endX ? 1 : -1;
	const stepY = y < endY ? 1 : -1;
	let error = dx + dy;
	let edited = false;
	while(true)
	{
		edited = paint(y * terrain.columns + x) || edited;
		if(x === endX && y === endY) break;
		const twice = error * 2;
		if(twice >= dy)
		{
			error += dy;
			x += stepX;
		}
		if(twice <= dx)
		{
			error += dx;
			y += stepY;
		}
	}
	return edited;
};
const pointerVertex = (canvas, event) => {
	const bounds = canvas.getBoundingClientRect();
	const x = Math.floor((event.clientX - bounds.left) / bounds.width * terrain.columns);
	const y = Math.floor((event.clientY - bounds.top) / bounds.height * terrain.rows);
	return x < 0 || y < 0 || x >= terrain.columns || y >= terrain.rows ? null : y * terrain.columns + x;
};

for(const map of maps)
{
	const { canvas } = map;
	canvas.addEventListener("pointerdown", event => {
		if(event.button !== 0) return;
		event.preventDefault();
		canvas.focus({ preventScroll: true });
		cursor = pointerVertex(canvas, event);
		if(cursor === null) return;
		canvas.setPointerCapture(event.pointerId);
		drag = { pointerId: event.pointerId, canvas, last: cursor };
		if(paint(cursor)) changed();
		else drawMaps();
	});
	canvas.addEventListener("pointermove", event => {
		cursor = pointerVertex(canvas, event);
		if(drag?.canvas === canvas && drag.pointerId === event.pointerId && cursor !== null)
		{
			const edited = paintLine(drag.last, cursor);
			drag.last = cursor;
			if(edited) changed();
			else drawMaps();
		}
		else drawMaps();
	});
	const stopDrag = event => {
		if(drag?.pointerId !== event.pointerId) return;
		drag = null;
		if(canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
	};
	canvas.addEventListener("pointerup", stopDrag);
	canvas.addEventListener("pointercancel", stopDrag);
	canvas.addEventListener("lostpointercapture", () => { drag = null; });
	canvas.addEventListener("pointerleave", () => {
		if(drag || focusedMap === canvas) return;
		cursor = null;
		drawMaps();
	});
	canvas.addEventListener("focus", () => {
		focusedMap = canvas;
		cursor ??= terrain.start;
		drawMaps();
	});
	canvas.addEventListener("blur", () => {
		focusedMap = null;
		if(!drag) cursor = null;
		drawMaps();
	});
	canvas.addEventListener("keydown", event => {
		cursor ??= terrain.start;
		const x = cursor % terrain.columns;
		const y = Math.floor(cursor / terrain.columns);
		if(event.key === "ArrowLeft") cursor = y * terrain.columns + Math.max(0, x - 1);
		else if(event.key === "ArrowRight") cursor = y * terrain.columns + Math.min(terrain.columns - 1, x + 1);
		else if(event.key === "ArrowUp") cursor = Math.max(0, y - 1) * terrain.columns + x;
		else if(event.key === "ArrowDown") cursor = Math.min(terrain.rows - 1, y + 1) * terrain.columns + x;
		else if(event.key === " " || event.key === "Enter")
		{
			if(paint(cursor)) changed();
		}
		else return;
		event.preventDefault();
		drawMaps();
	});
}

for(const button of document.querySelectorAll("[data-tool]"))
	button.addEventListener("click", () => chooseTool(button.dataset.tool));
for(const button of document.querySelectorAll("[data-strength]"))
	button.addEventListener("click", () => {
		strength = Number(button.dataset.strength);
		for(const choice of document.querySelectorAll("[data-strength]"))
			choice.setAttribute("aria-pressed", String(Number(choice.dataset.strength) === strength));
		byId("astar-estimate").textContent = `${strength}% estimate`;
		byId("heuristic-copy").textContent = strength === 0
			? "With no estimate, A* chooses the cheapest known next step, just like Dijkstra."
			: `${strength}% uses ${strength === 50 ? "half the" : "the"} grid distance to the goal. Each step costs at least 1, so this estimate never overstates the remaining cost.`;
		changed();
	});

const loadTerrain = seed => {
	terrain = createTerrain(seed);
	byId("terrain-seed").value = terrain.seed;
	cursor = null;
	changed();
};
byId("new-terrain").addEventListener("click", () => {
	const seed = crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, "0");
	loadTerrain(seed);
});
byId("seed-form").addEventListener("submit", event => {
	event.preventDefault();
	loadTerrain(byId("terrain-seed").value.trim() || "1135cafe");
});
byId("clear-terrain").addEventListener("click", () => {
	terrain.cells.fill(TERRAIN.floor);
	changed();
});
document.addEventListener("keydown", event => {
	if(event.target.closest("input,textarea,select") || event.metaKey || event.ctrlKey || event.altKey) return;
	const shortcut = { w: "wall", f: "floor", t: "forest", r: "water", e: "erase", s: "start", g: "target" }[event.key.toLowerCase()];
	if(shortcut) chooseTool(shortcut);
});
const observer = new ResizeObserver(drawMaps);
for(const map of maps) observer.observe(map.canvas);
drawMaps();

initRuntime().then(async () => {
	runtimeReady = true;
	await solveMaps();
	mountBenchmark();
}).catch(error => {
	byId("runtime-status").textContent = "Lean/Wasm could not load";
	byId("runtime-status").classList.add("failed");
	byId("result-title").textContent = "The Lean runtime could not start.";
	byId("result-copy").textContent = error.message;
});
