/**
 * Scoped topological-sort editor; React owns the surrounding page and controller lifetime.
 *
 * @file
 */

import * as runtimeModule from "./runtime.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Mount the existing editor within one route-owned scaffold.
 *
 * @param root Workbench element containing the controls and drawing surfaces.
 * @param scope Resource lifetime, including late prepared Wasm handles.
 * @param saved Page-memory input snapshot, empty on a new document.
 */
export const mountWorkbench = async (root, scope, saved = {}) => {
	const { prepareSort, ready, sortGraph } = scope.runtime(runtimeModule);
	const byId = id => root.querySelector("#" + id);
	const elements = {
		canvas: byId("graph-canvas")
		, dependencies: byId("dependency-list")
		, edgeCount: byId("edge-count")
		, edges: byId("graph-edges")
		, layer: byId("task-layer")
		, name: byId("task-name")
		, runtime: byId("runtime-status")
		, schedule: byId("schedule")
		, scheduleTitle: byId("schedule-title")
		, solveTime: byId("solve-time")
		, taskCount: byId("task-count")
		, verdict: root.querySelector(".verdict")
		, verdictCopy: byId("verdict-copy")
		, verdictTitle: byId("verdict-title")
	};

	const healthyTasks = () => [
		["Schema", .10, .25]
		, ["Types", .10, .72]
		, ["API", .35, .20]
		, ["UI", .35, .68]
		, ["Unit tests", .59, .18]
		, ["Bundle", .59, .67]
		, ["E2E", .82, .28]
		, ["Release", .86, .72]
	].map(([name, x, y]) => ({ name, x, y }));
	const healthyEdges = () => [
		[0, 2], [0, 3], [1, 2], [1, 3], [2, 4], [2, 6]
		, [3, 5], [3, 6], [4, 7], [5, 6], [6, 7]
	];

	let tasks = saved.tasks ?? healthyTasks();
	let edges = saved.edges ?? healthyEdges();
	let selected = saved.selected ?? 5;
	let result = null;
	let solveRevision = 0;
	let drag = null;
	scope.remember(() => ({ tasks, edges, selected }));

	const edgeKey = (source, target) => `${source}:${target}`;
	const cycleEdges = () => {
		const values = new Set();
		if(result?.kind !== "cycle") return values;
		result.vertices.forEach((source, index) => values.add(edgeKey(
			source, result.vertices[(index + 1) % result.vertices.length]
		)));
		return values;
	};
	const graphRequest = () => ({
		edges: Uint32Array.from(edges.flat())
		, vertexCount: tasks.length
	});
	const cardBounds = card => {
		const canvas = elements.canvas.getBoundingClientRect();
		const box = card.getBoundingClientRect();
		return {
			height: box.height
			, width: box.width
			, x: box.left - canvas.left + box.width / 2
			, y: box.top - canvas.top + box.height / 2
		};
	};
	const boundaryPoint = (origin, destination, padding) => {
		const dx = destination.x - origin.x;
		const dy = destination.y - origin.y;
		if(Math.abs(dx) < .001 && Math.abs(dy) < .001)
			return { x: origin.x + origin.width / 2 + padding, y: origin.y };
		const horizontal = Math.abs(dx) < .001 ? Number.POSITIVE_INFINITY
			: (origin.width / 2 + padding) / Math.abs(dx);
		const vertical = Math.abs(dy) < .001 ? Number.POSITIVE_INFINITY
			: (origin.height / 2 + padding) / Math.abs(dy);
		const scale = Math.min(horizontal, vertical);
		return { x: origin.x + dx * scale, y: origin.y + dy * scale };
	};
	const edgePath = (source, target) => {
		const start = boundaryPoint(source, target, 4);
		const end = boundaryPoint(target, source, 9);
		const direction = end.x < start.x ? -1 : 1;
		const offset = Math.max(34, Math.abs(end.x - start.x) * .42);
		return `M ${start.x} ${start.y} C ${start.x + offset * direction} ${start.y}, `
			+ `${end.x - offset * direction} ${end.y}, ${end.x} ${end.y}`;
	};

	const renderEdges = () => {
		for(const node of [...elements.edges.querySelectorAll(".graph-edge")]) node.remove();
		const cards = [...elements.layer.children];
		const highlighted = cycleEdges();
		for(const [source, target] of edges)
		{
			const path = edgePath(cardBounds(cards[source]), cardBounds(cards[target]));
			for(const hit of [false, true])
			{
				const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
				node.setAttribute("d", path);
				node.setAttribute("class", `graph-edge${hit ? " hit" : ""}`
					+ `${!hit && highlighted.has(edgeKey(source, target)) ? " cycle" : ""}`);
				if(hit)
				{
					node.setAttribute("role", "button");
					node.setAttribute("aria-label", `Remove ${tasks[source].name} to ${tasks[target].name}`);
					scope.listen(node, "click", () => {
						edges = edges.filter(edge => edge[0] !== source || edge[1] !== target);
						void solve();
					});
				}
				elements.edges.append(node);
			}
		}
	};

	const renderEditor = () => {
		elements.name.value = tasks[selected]?.name || "";
		elements.dependencies.replaceChildren(...tasks.map((task, index) => {
			if(index === selected) return document.createComment("selected task");
			const active = edges.some(([source, target]) => source === index && target === selected);
			const button = document.createElement("button");
			button.className = "dependency-toggle";
			button.dataset.source = String(index);
			button.setAttribute("aria-pressed", String(active));
			const name = document.createElement("span");
			name.textContent = task.name;
			button.append(name, document.createElement("i"));
			scope.listen(button, "click", () => {
				if(active) edges = edges.filter(([source, target]) => source !== index || target !== selected);
				else edges.push([index, selected]);
				void solve();
			});
			return button;
		}));
	};

	const renderCards = () => {
		const cycle = new Set(result?.kind === "cycle" ? result.vertices : []);
		const positions = new Map(result?.kind === "order"
			? [...result.vertices].map((vertex, index) => [vertex, index + 1]) : []);
		elements.layer.replaceChildren(...tasks.map((task, index) => {
			const button = document.createElement("button");
			button.className = `task-card${index === selected ? " selected" : ""}`
				+ `${cycle.has(index) ? " cycle" : ""}${positions.has(index) ? " order" : ""}`;
			button.style.left = `${task.x * 100}%`;
			button.style.top = `${task.y * 100}%`;
			button.dataset.task = String(index);
			const number = document.createElement("span");
			number.className = "task-index";
			number.textContent = String(positions.get(index) ?? String(index + 1).padStart(2, "0"));
			const name = document.createElement("strong");
			name.textContent = task.name;
			button.append(number, name);
			const selectTask = () => {
				selected = index;
				renderEditor();
				for(const card of elements.layer.children)
				{
					card.classList.toggle("selected", Number(card.dataset.task) === selected);
				}
			};
			scope.listen(button, "click", selectTask);
			scope.listen(button, "pointerdown", event => {
				if(event.button !== 0 || !event.isPrimary) return;
				selectTask();
				drag = { id: event.pointerId, index };
				button.setPointerCapture(event.pointerId);
			});
			scope.listen(button, "pointermove", event => {
				if(!drag || drag.id !== event.pointerId || drag.index !== index) return;
				const box = elements.canvas.getBoundingClientRect();
				task.x = Math.max(.07, Math.min(.93, (event.clientX - box.left) / box.width));
				task.y = Math.max(.1, Math.min(.9, (event.clientY - box.top) / box.height));
				button.style.left = `${task.x * 100}%`;
				button.style.top = `${task.y * 100}%`;
				renderEdges();
			});
			scope.listen(button, "pointerup", () => { drag = null; });
			scope.listen(button, "pointercancel", () => { drag = null; });
			scope.listen(button, "lostpointercapture", () => { drag = null; });
			return button;
		}));
	};

	const renderSchedule = () => {
		elements.schedule.replaceChildren();
		if(!result) return;
		const values = [...result.vertices];
		elements.scheduleTitle.textContent = result.kind === "order" ? "Build schedule" : "Dependency cycle";
		values.forEach((vertex, index) => {
			const step = document.createElement("div");
			step.className = `schedule-step ${result.kind}`;
			const name = document.createElement("span");
			name.textContent = tasks[vertex].name;
			step.append(name);
			if(index + 1 < values.length || result.kind === "cycle")
			{
				const arrow = document.createElement("i");
				arrow.className = "schedule-arrow";
				arrow.textContent = "→";
				step.append(arrow);
			}
			elements.schedule.append(step);
		});
		if(result.kind === "cycle")
		{
			const close = document.createElement("div");
			close.className = "schedule-step cycle";
			const name = document.createElement("span");
			name.textContent = tasks[values[0]].name;
			close.append(name);
			elements.schedule.append(close);
		}
	};

	const render = () => {
		elements.taskCount.textContent = String(tasks.length);
		elements.edgeCount.textContent = String(edges.length);
		renderCards();
		renderEditor();
		renderSchedule();
		scope.requestAnimationFrame(renderEdges);
	};

	const solve = async () => {
		const revision = ++solveRevision;
		const started = performance.now();
		try
		{
			const next = await sortGraph(graphRequest());
			if(revision !== solveRevision) return;
			result = next;
			elements.solveTime.textContent = `${(performance.now() - started).toFixed(2)} ms`;
			elements.verdict.classList.toggle("cycle", result.kind === "cycle");
			if(result.kind === "order")
			{
				elements.verdictTitle.textContent = "This pipeline can ship.";
				elements.verdictCopy.textContent = `Lean returned a complete ${tasks.length}-task order `
					+ "that respects every dependency.";
			}
			else
			{
				const names = [...result.vertices].map(vertex => tasks[vertex].name);
				elements.verdictTitle.textContent = "Dependency cycle found.";
				elements.verdictCopy.textContent = `${names.join(" → ")} → ${names[0]} must be broken `
					+ "before the build can run.";
			}
			render();
		}
		catch(error)
		{
			if(!scope.active) return;
			elements.verdictTitle.textContent = "The graph could not be checked.";
			elements.verdictCopy.textContent = error.message;
			console.error(error);
		}
	};

	scope.listen(elements.name, "input", () => {
		if(!tasks[selected]) return;
		tasks[selected].name = elements.name.value || `Task ${selected + 1}`;
		renderCards();
		renderSchedule();
		scope.requestAnimationFrame(renderEdges);
	});
	scope.listen(byId("add-task"), "click", () => {
		const index = tasks.length;
		tasks.push({ name: `Task ${index + 1}`, x: .5, y: .5 });
		selected = index;
		result = null;
		void solve();
	});
	scope.listen(byId("delete-task"), "click", () => {
		if(tasks.length <= 1) return;
		tasks.splice(selected, 1);
		edges = edges.filter(([source, target]) => source !== selected && target !== selected)
			.map(([source, target]) => [source - Number(source > selected), target - Number(target > selected)]);
		selected = Math.min(selected, tasks.length - 1);
		void solve();
	});
	scope.listen(byId("healthy-preset"), "click", () => {
		tasks = healthyTasks(); edges = healthyEdges(); selected = 5; void solve();
	});
	scope.listen(byId("cycle-preset"), "click", () => {
		tasks = healthyTasks(); edges = [...healthyEdges(), [7, 0]]; selected = 0; void solve();
	});
	scope.listen(byId("new-graph"), "click", () => {
		const names = ["Parse", "Generate", "Compile", "Assets", "Tests", "Package", "Docs", "Deploy"];
		tasks = names.map((name, index) => ({
			name, x: .1 + (index % 4) * .27, y: .25 + Math.floor(index / 4) * .5
		}));
		edges = [];
		for(let target = 1; target < tasks.length; target += 1)
		{
			for(let source = 0; source < target; source += 1)
			{
				if(Math.random() < .24) edges.push([source, target]);
			}
		}
		selected = tasks.length - 1;
		void solve();
	});
	scope.resizeObserver(() => scope.requestAnimationFrame(renderEdges)).observe(elements.canvas);

	const jsSort = ({ vertexCount, edges: inputEdges }) => {
		const indegree = new Uint32Array(vertexCount);
		const adjacent = Array.from({ length: vertexCount }, () => []);
		for(let index = 0; index < inputEdges.length; index += 2)
		{
			adjacent[inputEdges[index]].push(inputEdges[index + 1]);
			indegree[inputEdges[index + 1]] += 1;
		}
		const queue = new Uint32Array(vertexCount);
		let head = 0;
		let tail = 0;
		for(let vertex = 0; vertex < vertexCount; vertex += 1)
		{
			if(indegree[vertex] === 0) queue[tail++] = vertex;
		}
		while(head < tail)
		{
			const source = queue[head++];
			for(const target of adjacent[source]) if(--indegree[target] === 0) queue[tail++] = target;
		}
		return queue.slice(0, tail);
	};
	const validOrder = ({ vertexCount, edges: inputEdges }, order) => {
		if(order.length !== vertexCount || new Set(order).size !== vertexCount) return false;
		const positions = new Uint32Array(vertexCount);
		order.forEach((vertex, index) => { positions[vertex] = index; });
		for(let index = 0; index < inputEdges.length; index += 2)
		{
			if(positions[inputEdges[index]] >= positions[inputEdges[index + 1]]) return false;
		}
		return true;
	};
	const benchmarkRequest = (() => {
		const vertexCount = 512;
		const values = [];
		for(let target = 1; target < vertexCount; target += 1)
		{
			for(let offset = 1; offset <= 4 && offset <= target; offset += 1)
			{
				values.push(target - offset, target);
			}
		}
		return { vertexCount, edges: Uint32Array.from(values) };
	})();
	let preparedBenchmark;
	let benchmarkHandle;
	let benchmarkGeneration = 0;
	const prepareBenchmark = () => {
		const generation = benchmarkGeneration;
		preparedBenchmark ??= prepareSort(benchmarkRequest).then(solver => {
			if(generation !== benchmarkGeneration) solver.dispose();
			else benchmarkHandle = solver;
			return solver;
		});
		return preparedBenchmark;
	};
	scope.listen(globalThis, "pagehide", () => {
		drag = null;
		solveRevision++;
		benchmarkGeneration++;
		preparedBenchmark = undefined;
		benchmarkHandle?.dispose();
		benchmarkHandle = undefined;
	});
	scope.listen(globalThis, "pageshow", event => {
		if(event.persisted) void solve();
	});
	scope.benchmark({
		root: root.querySelector("#browser-benchmark")
		, prepare: prepareBenchmark
		, sample: async index => {
			let lean;
			let javascript;
			if(index % 2 === 0)
			{
				lean = measureSyncBenchmark(await prepareBenchmark());
				javascript = measureSyncBenchmark(() => jsSort(benchmarkRequest));
			}
			else
			{
				javascript = measureSyncBenchmark(() => jsSort(benchmarkRequest));
				lean = measureSyncBenchmark(await prepareBenchmark());
			}
			if(lean.result.kind !== "order" || !validOrder(benchmarkRequest, lean.result.vertices)
				|| !validOrder(benchmarkRequest, javascript.result)) {
				throw new Error("A benchmark solver returned an invalid order");
				}
			return { javascriptMs: javascript.milliseconds, leanMs: lean.milliseconds };
		}
		, summarize: ({ ratio, trialCount }) => `${trialCount} checked schedules agreed · 512 tasks · `
			+ `2038 dependencies · median paired cost ${ratio.toFixed(1)}×`
	});

	render();
	try
	{
		await ready();
		elements.runtime.textContent = "Lean/Wasm ready";
		await solve();
	}
	catch(error)
	{
		if(!scope.active) return;
		elements.runtime.textContent = "Lean/Wasm failed to load";
		console.error(error);
	}
};
