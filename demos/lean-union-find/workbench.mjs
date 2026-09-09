/**
 * Scoped union-find editor; React owns the surrounding page and controller lifetime.
 *
 * @file
 */

import * as runtimeModule from "./runtime.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";
import { GRAPH_COUNT, HEIGHT, SITE_COUNT, WIDTH, activationOrder, activeFromPrefix, analyzePartition, inletDistances, linksForActive, mazeWalls } from "./percolation.mjs";

/**
 * Mount the existing editor within one route-owned scaffold.
 *
 * @param root Workbench element containing the controls and drawing surfaces.
 * @param scope Resource lifetime, including late prepared Wasm handles.
 * @param saved Page-memory input snapshot, empty on a new document.
 */
export const mountWorkbench = async (root, scope, saved = {}) => {
	const { partition, preparePartition, ready } = scope.runtime(runtimeModule);
	const COPY = {
		noun: "open passages"
		, spanning: "Water reached the outlet."
		, waiting: "Water has not crossed the material."
	};
	const byId = id => root.querySelector("#" + id);
	const elements = {
		activeCount: byId("active-count")
		, applySeed: byId("apply-seed")
		, bottom: byId("bottom-boundary")
		, componentCount: byId("component-count")
		, density: byId("density")
		, editStatus: byId("edit-status")
		, grid: byId("site-grid")
		, legend: byId("legend")
		, newMaterial: byId("new-material")
		, pause: byId("pause")
		, reset: byId("reset")
		, resultCopy: byId("result-copy")
		, resultTitle: byId("result-title")
		, run: byId("run")
		, runtime: byId("runtime")
		, runtimeStatus: byId("runtime-status")
		, sampleTitle: byId("sample-title")
		, seed: byId("seed")
		, step: byId("step")
		, top: byId("top-boundary")
		, toolOpen: byId("tool-open")
		, toolSeal: byId("tool-seal")
		, toolWall: byId("tool-wall")
	};

	let active = saved.active ?? new Uint8Array(SITE_COUNT);
	let walls = saved.walls ?? new Uint8Array(SITE_COUNT);
	let order = saved.order;
	let cursor = saved.cursor ?? 0;
	let seed = saved.seed ?? 0;
	let running = false;
	let runFrame = 0;
	let solveRevision = 0;
	let firstSpanCount = saved.firstSpanCount ?? null;
	let sequenceIntact = saved.sequenceIntact ?? true;
	let painting = false;
	let drawTool = saved.drawTool ?? "open";
	let dragSolveFrame = 0;
	let initializing = true;
	let pendingSolves = 0;
	let settled = false;
	let settleTimer = 0;
	let benchmark;
	const filling = new Set();
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
	const previousWet = new Uint8Array(SITE_COUNT);
	scope.remember(() => order ? ({ active, walls, order, cursor, seed, firstSpanCount, sequenceIntact, drawTool }) : saved);
	const activityChanged = () => {
		if(!scope.active) return;
		scope.clearTimeout(settleTimer);
		settleTimer = 0;
		settled = false;
		benchmark?.refresh();
		if(initializing || running || painting || pendingSolves || dragSolveFrame || filling.size) return;
		// Let the final tile and boundary transitions finish before measuring.
		settleTimer = scope.setTimeout(() => {
			settleTimer = 0;
			settled = true;
			benchmark?.refresh();
		}, 200);
	};
	const clearFill = cell => {
		cell.classList.remove("filling");
		filling.delete(cell);
	};

	const cells = Array.from({ length: SITE_COUNT }, (_, site) => {
		const cell = document.createElement("button");
		cell.className = "site";
		cell.type = "button";
		cell.dataset.site = String(site);
		cell.tabIndex = site === 0 ? 0 : -1;
		cell.setAttribute("role", "gridcell");
		cell.setAttribute("aria-rowindex", String(Math.floor(site / WIDTH) + 1));
		cell.setAttribute("aria-colindex", String(site % WIDTH + 1));
		const finishFill = () => { clearFill(cell); activityChanged(); };
		scope.listen(cell, "animationend", finishFill);
		scope.listen(cell, "animationcancel", finishFill);
		elements.grid.append(cell);
		return cell;
	});
	elements.grid.setAttribute("aria-rowcount", String(HEIGHT));
	elements.grid.setAttribute("aria-colcount", String(WIDTH));
	scope.listen(reducedMotion, "change", () => {
		if(reducedMotion.matches) for(const cell of filling) clearFill(cell);
		activityChanged();
	});

	const freshSeed = () => {
		const values = new Uint32Array(1);
		crypto.getRandomValues(values);
		return values[0] || 1;
	};

	const showSeed = () => {
		elements.seed.value = seed.toString(16).padStart(8, "0");
		elements.seed.setAttribute("aria-invalid", "false");
	};

	const syncLegend = () => {
		elements.legend.innerHTML = `<span><i class="wall-key"></i>Maze wall</span><span><i></i>Unopened passage</span><span><i class="active-key"></i>Dry clusters</span><span><i class="wet-key"></i>Water from inlet</span><span><i class="span-key"></i>Outlet contact</span>`;
	};

	const draw = (result, elapsed) => {
		const analysis = analyzePartition(active, result.representatives, walls);
		const distances = running && !reducedMotion.matches ? inletDistances(active, walls) : null;
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
				filling.add(cell);
			}
			else if(!topConnected) clearFill(cell);
			previousWet[site] = Number(topConnected);
			cell.setAttribute("aria-pressed", String(isActive));
			cell.setAttribute("aria-label", `Row ${Math.floor(site / WIDTH) + 1}, column ${site % WIDTH + 1}: ${isWall ? "maze wall" : isActive ? "open passage" : "unopened passage"}${topConnected ? ", filled from inlet" : ""}${inSpanningCluster ? ", in spanning wet cluster" : ""}${outletContact ? ", touches outlet" : ""}`);
		}
		const spans = analysis.spans;
		elements.top.classList.toggle("engaged", analysis.topRoots.size > 0);
		elements.top.classList.toggle("connected", spans);
		elements.bottom.classList.toggle("connected", spans);
		elements.activeCount.textContent = `${analysis.activeCount} / ${order.length}`;
		elements.density.textContent = `${(order.length ? analysis.activeCount / order.length * 100 : 0).toFixed(1)}%`;
		elements.componentCount.textContent = String(analysis.componentCount);
		elements.runtime.textContent = `${elapsed.toFixed(2)} ms`;
		if(spans)
		{
			if(firstSpanCount === null && sequenceIntact) firstSpanCount = analysis.activeCount;
			running = false;
			scope.cancelAnimationFrame(runFrame);
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
		elements.run.disabled = running || spans || cursor >= order.length;
	};

	const solve = async () => {
		const revision = ++solveRevision;
		pendingSolves++;
		activityChanged();
		try
		{
			const snapshot = active.slice();
			const links = linksForActive(snapshot, walls, true);
			const started = performance.now();
			const result = await partition({ elementCount: GRAPH_COUNT, links });
			const elapsed = performance.now() - started;
			if(revision !== solveRevision) return null;
			draw(result, elapsed);
			return result;
		}
		finally
		{
			pendingSolves--;
			activityChanged();
		}
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
		if(running && cursor < order.length) runFrame = scope.requestAnimationFrame(runLoop);
		else if(running)
		{
			pause("Every available passage is open.");
			elements.run.disabled = true;
		}
	};

	const startRun = () => {
		if(running || !order || cursor >= order.length) return;
		running = true;
		activityChanged();
		elements.pause.disabled = false;
		elements.run.disabled = true;
		runFrame = scope.requestAnimationFrame(runLoop);
	};

	const pause = message => {
		running = false;
		scope.cancelAnimationFrame(runFrame);
		elements.pause.disabled = true;
		elements.run.disabled = false;
		if(message) elements.editStatus.textContent = message;
		activityChanged();
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
		cells[site].classList.remove("top-connected", "spanning");
		clearFill(cells[site]);
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
			dragSolveFrame = scope.requestAnimationFrame(() => {
				dragSolveFrame = 0;
				void solve();
			});
		}
		activityChanged();
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

	scope.listen(elements.toolOpen, "click", () => selectTool("open"));
	scope.listen(elements.toolSeal, "click", () => selectTool("seal"));
	scope.listen(elements.toolWall, "click", () => selectTool("wall"));
	selectTool(drawTool);

	scope.listen(elements.grid, "pointerdown", event => {
		if(event.button !== 0 || !event.isPrimary || !order) return;
		const cell = event.target.closest(".site");
		if(!cell) return;
		event.preventDefault();
		pause();
		painting = true;
		activityChanged();
		paint(Number(cell.dataset.site));
		elements.grid.setPointerCapture(event.pointerId);
	});
	scope.listen(elements.grid, "pointermove", event => {
		if(!painting) return;
		const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest(".site");
		if(hit && elements.grid.contains(hit)) paint(Number(hit.dataset.site));
	});
	const finishPaint = async event => {
		if(!painting) return;
		painting = false;
		scope.cancelAnimationFrame(dragSolveFrame);
		dragSolveFrame = 0;
		if(elements.grid.hasPointerCapture(event.pointerId)) elements.grid.releasePointerCapture(event.pointerId);
		await solve();
	};
	scope.listen(elements.grid, "pointerup", finishPaint);
	scope.listen(elements.grid, "pointercancel", finishPaint);
	scope.listen(elements.grid, "lostpointercapture", finishPaint);
	scope.listen(elements.grid, "keydown", async event => {
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

	scope.listen(elements.run, "click", startRun);
	scope.listen(document, "visibilitychange", () => {
		if(document.hidden) pause("Sequence paused while the page is hidden.");
	});
	scope.listen(globalThis, "pagehide", () => {
		pause("Sequence paused.");
		solveRevision++;
		painting = false;
		scope.cancelAnimationFrame(dragSolveFrame);
		dragSolveFrame = 0;
	});
	scope.listen(globalThis, "pageshow", event => {
		if(event.persisted && order) void solve();
	});
	scope.listen(elements.pause, "click", () => pause("Sequence paused."));
	scope.listen(elements.step, "click", async () => { pause(); activateNext(1); elements.editStatus.textContent = "Opened one site."; await solve(); });
	scope.listen(elements.reset, "click", async () => { await reset(); startRun(); });
	scope.listen(elements.newMaterial, "click", replaceMaterial);
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
	scope.listen(elements.applySeed, "click", applySeed);
	scope.listen(elements.seed, "keydown", event => {
		if(event.key === "Enter")
		{
			event.preventDefault();
			void applySeed();
		}
	});

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

	const thresholdForOrder = async trialOrder => {
		let low = 1;
		let high = trialOrder.length;
		while(low < high)
		{
			const middle = Math.floor((low + high) / 2);
			const trialActive = activeFromPrefix(trialOrder, middle);
			const links = linksForActive(trialActive, walls, true);
			const result = await partition({ elementCount: GRAPH_COUNT, links });
			const analysis = analyzePartition(trialActive, result.representatives, walls);
			if(analysis.spans) high = middle;
			else low = middle + 1;
		}
		return { count: low, percent: low / trialOrder.length * 100 };
	};

	const samePartition = (left, right) => {
		if(left.length !== right.length) return false;
		const leftToRight = new Map();
		const rightToLeft = new Map();
		for(let vertex = 0; vertex < left.length; vertex += 1)
		{
			const leftRoot = left[vertex];
			const rightRoot = right[vertex];
			if(leftToRight.has(leftRoot) && leftToRight.get(leftRoot) !== rightRoot) return false;
			if(rightToLeft.has(rightRoot) && rightToLeft.get(rightRoot) !== leftRoot) return false;
			leftToRight.set(leftRoot, rightRoot);
			rightToLeft.set(rightRoot, leftRoot);
		}
		return true;
	};

	const connectedBenchmarkLinks = (elementCount, degree, initialSeed) => {
		let value = initialSeed >>> 0;
		const next = () => {
			value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
			return value;
		};
		const links = [];
		for(let vertex = 1; vertex < elementCount; vertex += 1) links.push(vertex, next() % vertex);
		for(let edge = elementCount; edge < elementCount * degree; edge += 1)
		{
			links.push(next() % elementCount, next() % elementCount);
		}
		return Uint32Array.from(links);
	};
	const benchmarkLinks = connectedBenchmarkLinks(GRAPH_COUNT, 4, GRAPH_COUNT ^ 0xa53c9e1d);
	const benchmarkRequest = { elementCount: GRAPH_COUNT, links: benchmarkLinks };
	let preparedLeanPartition;
	let benchmarkHandle;
	let benchmarkGeneration = 0;
	const prepareLeanPartition = () => {
		const generation = benchmarkGeneration;
		preparedLeanPartition ??= preparePartition(benchmarkRequest).then(solver => {
			if(generation !== benchmarkGeneration) solver.dispose();
			else benchmarkHandle = solver;
			return solver;
		});
		return preparedLeanPartition;
	};
	scope.listen(globalThis, "pagehide", () => {
		benchmarkGeneration++;
		preparedLeanPartition = undefined;
		benchmarkHandle?.dispose();
		benchmarkHandle = undefined;
	});
	const preparedJavaScriptPartition = () => jsPartition(benchmarkRequest);

	benchmark = scope.benchmark({
		root: byId("browser-benchmark")
		, canRun: () => settled
		, prepare: async () => {
			await prepareLeanPartition();
		}
		, sample: async index => {
			let lean;
			let javascript;
			if(index % 2 === 0)
			{
				lean = measureSyncBenchmark(await prepareLeanPartition());
				javascript = measureSyncBenchmark(preparedJavaScriptPartition);
			}
			else
			{
				javascript = measureSyncBenchmark(preparedJavaScriptPartition);
				lean = measureSyncBenchmark(await prepareLeanPartition());
			}
			if(!samePartition(lean.result.representatives, javascript.result.representatives))
			{
				throw new Error("Lean and JavaScript returned different partitions");
			}
			return { leanMs: lean.milliseconds, javascriptMs: javascript.milliseconds };
		}
		, summarize: ({ ratio, trialCount }) => `${trialCount} checked partitions agreed · ${GRAPH_COUNT} elements · ${benchmarkLinks.length / 2} links · median paired cost ${ratio.toFixed(1)}×`
	});

	const initializePage = () => {
		syncLegend();
	};

	try
	{
		initializePage();
		await ready();
		elements.runtimeStatus.textContent = "Lean/Wasm ready";
		if(!saved.order)
		{
			seed = freshSeed();
			walls = mazeWalls(seed);
			order = activationOrder(seed ^ 0xa53c9e1d, walls);
		}
		showSeed();
		await solve();
		if(saved.order) return;
		if(reducedMotion.matches)
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
		if(!scope.active) return;
		elements.runtimeStatus.textContent = "Lean/Wasm failed to load";
		elements.resultTitle.textContent = "The checked module did not start.";
		elements.resultCopy.textContent = error instanceof Error ? error.message : String(error);
		for(const button of root.querySelectorAll(".controls button, .trial-actions button")) button.disabled = true;
	}
	finally
	{
		initializing = false;
		activityChanged();
	}
};
