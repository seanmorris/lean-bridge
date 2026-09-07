/**
 * Edits module imports and displays strongly connected groups computed by Lean.
 *
 * @file
 */

import { initRuntime, prepareGraph } from "./runtime.mjs";
import { mountBenchmark } from "./browser-benchmark.mjs";
import { buildGraphRequest, collapsedLayout, createPreset, describePartition } from "./graph.mjs";

const byId = id => document.getElementById(id);
const canvas = byId("graph-canvas");
const svg = byId("graph-svg");
const layer = byId("node-layer");
let scene = createPreset();
let partition = null;
let selectedId = 1;
let groupAnchor = null;
let collapsed = false;
let runtimeReady = false;
let revision = 0;
let solveFrame = 0;
let drag = null;
const groupPositions = new Map();

const element = (name, className, text) => {
	const node = document.createElement(name);
	if(className) node.className = className;
	if(text !== undefined) node.textContent = text;
	return node;
};
const svgElement = (name, attributes) => {
	const node = document.createElementNS("http://www.w3.org/2000/svg", name);
	for(const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
	return node;
};
const selectedNode = () => scene.nodes.find(node => node.id === selectedId);
const activeGroup = () => groupAnchor === null ? undefined : partition?.nodeGroups.get(groupAnchor);
const hasEdge = (source, target) => scene.edges.some(edge => edge[0] === source && edge[1] === target);
const feedbackPath = (start, target) => {
	const queue = [[start]];
	const seen = new Set([start]);
	for(let head = 0; head < queue.length; head += 1)
	{
		const path = queue[head];
		const last = path[path.length - 1];
		if(last === target) return path;
		for(const [source, next] of scene.edges)
			if(source === last && !seen.has(next))
			{
				seen.add(next);
				queue.push([...path, next]);
			}
	}
	return null;
};
const boundary = (source, target, gap = 7) => {
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const scale = Math.min((source.width / 2 + gap) / (Math.abs(dx) || .001),
		(source.height / 2 + gap) / (Math.abs(dy) || .001));
	return { x: source.x + dx * scale, y: source.y + dy * scale };
};
const edgePath = (source, target, reciprocal) => {
	if(source === target)
		return `M ${source.x + source.width * .25} ${source.y - source.height / 2 + 1} `
			+ `C ${source.x + source.width * .4} ${source.y - source.height / 2 - 42}, `
			+ `${source.x - source.width * .4} ${source.y - source.height / 2 - 42}, `
			+ `${source.x - source.width * .25} ${source.y - source.height / 2 - 6}`;
	const start = boundary(source, target, 4);
	const end = boundary(target, source, 10);
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy) || 1;
	const bend = reciprocal ? 23 : 0;
	return `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 - dy / length * bend} `
		+ `${(start.y + end.y) / 2 + dx / length * bend} ${end.x} ${end.y}`;
};

const renderGraph = () => {
	canvas.classList.toggle("collapsed", collapsed);
	if(collapsed && !partition)
	{
		svg.replaceChildren();
		layer.replaceChildren();
		return;
	}
	const layout = partition ? collapsedLayout(partition) : { height: 495, positions: [] };
	canvas.style.height = `${collapsed ? layout.height : 495}px`;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const focus = activeGroup();
	svg.replaceChildren();
	layer.replaceChildren();
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	const definitions = svgElement("defs", {});
	const marker = svgElement("marker", {
		id: "dependency-arrow", viewBox: "0 0 10 8", refX: 9, refY: 4
		, markerWidth: 7, markerHeight: 7, orient: "auto", markerUnits: "strokeWidth"
	});
	marker.append(svgElement("path", { d: "M 0 0 L 10 4 L 0 8 z", fill: "context-stroke" }));
	definitions.append(marker);
	svg.append(definitions);
	const positions = new Map();
	const items = collapsed && partition ? partition.groups : scene.nodes;
	for(const item of items)
	{
		const group = collapsed ? item : partition?.groups[partition.nodeGroups.get(item.id)];
		const coordinates = collapsed ? groupPositions.get(item.nodes[0].id) || layout.positions[item.index] : item;
		const card = element("button", collapsed ? "component-card" : "module-card");
		card.type = "button";
		card.style.setProperty("--group", group?.color || "#8fa7bf");
		card.style.left = `${coordinates.x * width}px`;
		card.style.top = `${coordinates.y * height}px`;
		const selected = collapsed ? focus === item.index : selectedId === item.id;
		card.classList.toggle("selected", selected);
		card.classList.toggle("dim", focus !== undefined && group?.index !== focus);
		card.setAttribute("aria-pressed", String(selected));
		if(collapsed)
		{
			card.dataset.group = String(item.index);
			card.append(element("strong", null, `Group ${item.number}`),
				element("span", "component-members", item.nodes.map(node => node.name).join(", ")),
				element("span", "node-meta", item.cyclic ? "Dependency loop inside" : "One module"));
			card.setAttribute("aria-label", `Group ${item.number}: ${item.nodes.map(node => node.name).join(", ")}`);
		}
		else
		{
			card.dataset.nodeId = String(item.id);
			card.append(element("strong", null, item.name), element("span", "node-meta", group
				? `Group ${group.number}${group.cyclic && group.nodes.length === 1 ? " · self loop" : ""}` : "Checking…"));
			card.title = `${item.name}. Select to edit imports; drag to move.`;
		}
		layer.append(card);
		positions.set(collapsed ? item.index : item.id, {
			x: coordinates.x * width, y: coordinates.y * height
			, width: card.offsetWidth, height: card.offsetHeight, group: group?.index
		});
	}
	if(!collapsed && partition)
		for(const group of partition.groups)
		{
			if(group.nodes.length === 1) continue;
			const boxes = group.nodes.map(node => positions.get(node.id));
			const left = Math.min(...boxes.map(box => box.x - box.width / 2)) - 15;
			const top = Math.min(...boxes.map(box => box.y - box.height / 2)) - 16;
			const right = Math.max(...boxes.map(box => box.x + box.width / 2)) + 15;
			const bottom = Math.max(...boxes.map(box => box.y + box.height / 2)) + 16;
			const rectangle = svgElement("rect", {
				x: left, y: top, width: right - left, height: bottom - top, rx: 10
				, class: `cluster-boundary${focus === group.index ? " active" : focus !== undefined ? " dim" : ""}`
			});
			rectangle.style.setProperty("--group", group.color);
			svg.append(rectangle);
		}
	const edges = collapsed && partition ? partition.links : scene.edges;
	for(const [from, to] of edges)
	{
		const source = positions.get(from);
		const target = positions.get(to);
		if(!source || !target) continue;
		const internal = !collapsed && source.group !== undefined && source.group === target.group;
		const active = focus !== undefined && (source.group === focus || target.group === focus);
		const path = svgElement("path", {
			d: edgePath(source, target, edges.some(([a, b]) => a === to && b === from))
			, class: `graph-edge${internal ? " internal" : ""}${focus !== undefined ? active ? " active" : " dim" : ""}`
		});
		if(internal) path.style.setProperty("--group", partition.groups[source.group].color);
		svg.append(path);
	}
	byId("graph-label").textContent = collapsed ? "Collapsed group graph" : "Original module graph";
	byId("graph-title").textContent = collapsed ? "The dependencies between groups" : "Every module, every import";
	byId("graph-hint").textContent = collapsed
		? "Each card stands for a whole group. Loops stay inside the cards; arrows between groups form a directed acyclic graph."
		: "Select a module to edit its imports. Select a group to highlight all its members.";
	byId("view-note").textContent = collapsed ? "Original modules and edits are preserved." : "Drag modules; scroll sideways on small screens.";
	byId("collapse-groups").textContent = collapsed ? "Unfold modules" : "Collapse groups";
	byId("collapse-groups").setAttribute("aria-pressed", String(collapsed));
	byId("show-all").disabled = focus === undefined;
};

const selectGroup = index => {
	const group = partition.groups[index];
	groupAnchor = group.nodes[0].id;
	if(!group.nodes.some(node => node.id === selectedId)) selectedId = groupAnchor;
	render();
};
const renderGroups = () => {
	const list = byId("group-list");
	list.replaceChildren();
	if(!partition) return;
	const focus = activeGroup();
	for(const group of partition.groups)
	{
		const button = element("button", "group-choice");
		button.type = "button";
		button.style.setProperty("--group", group.color);
		button.setAttribute("aria-pressed", String(focus === group.index));
		button.dataset.component = String(group.index);
		button.append(element("b", null, `Group ${group.number}`), element("span", null,
			`${group.nodes.length} ${group.nodes.length === 1 ? "module" : "modules"}${group.cyclic ? " · loop" : ""}`));
		button.addEventListener("click", () => selectGroup(group.index));
		list.append(button);
	}
	byId("group-list-count").textContent = String(partition.groups.length);
	byId("group-members").textContent = focus === undefined
		? "Select a group to highlight its members. A module with a self import forms a one-module loop."
		: `Group ${partition.groups[focus].number}: ${partition.groups[focus].nodes.map(node => node.name).join(", ")}.`;
};
const toggleEdge = (source, target) => {
	if(hasEdge(source, target)) scene.edges = scene.edges.filter(edge => edge[0] !== source || edge[1] !== target);
	else scene.edges.push([source, target]);
	scheduleSolve();
};
const renderEditor = () => {
	const selected = selectedNode();
	if(!selected) return;
	const nameInput = byId("module-name");
	if(document.activeElement !== nameInput || nameInput.dataset.nodeId !== String(selected.id))
		nameInput.value = selected.name;
	nameInput.dataset.nodeId = String(selected.id);
	byId("imports-title").textContent = `${selected.name} imports`;
	const imports = byId("import-list");
	imports.replaceChildren();
	for(const node of scene.nodes)
	{
		const present = hasEdge(selected.id, node.id);
		const button = element("button", "import-toggle");
		button.type = "button";
		button.dataset.importTarget = String(node.id);
		button.setAttribute("aria-pressed", String(present));
		button.setAttribute("aria-label", `${selected.name} imports ${node.name}${node.id === selected.id ? " (self import)" : ""}`);
		button.append(element("span", null, `${node.name}${node.id === selected.id ? " (self)" : ""}`), element("i", null, present ? "✓" : ""));
		button.addEventListener("click", () => toggleEdge(selected.id, node.id));
		imports.append(button);
	}
	byId("remove-module").disabled = scene.nodes.length === 1;
	byId("add-module").disabled = scene.nodes.length >= 24;
	const [sourceId, targetId] = scene.feedback;
	const source = scene.nodes.find(node => node.id === sourceId);
	const target = scene.nodes.find(node => node.id === targetId);
	const present = hasEdge(sourceId, targetId);
	byId("toggle-feedback").disabled = !source || !target;
	byId("toggle-feedback").setAttribute("aria-pressed", String(present));
	byId("toggle-feedback").textContent = present ? "Remove feedback edge ↶" : "Add feedback edge ↶";
	const returnPath = source && target ? feedbackPath(targetId, sourceId) : null;
	const pathGroups = returnPath && partition
		? new Set(returnPath.map(node => partition.nodeGroups.get(node))).size : 0;
	byId("feedback-copy").textContent = !source || !target
		? "Load an example to restore its feedback-edge endpoints."
		: present ? `${source.name} → ${target.name} is present. Remove it to compare the groups.`
			: !returnPath ? `${source.name} → ${target.name} has no return path, so it will not create a loop.`
				: `${source.name} → ${target.name} closes a loop ${pathGroups > 1 ? `across ${pathGroups} groups` : "inside one group"}.`;
};
const render = () => {
	renderGraph();
	renderGroups();
	renderEditor();
	if(!partition) return;
	const cycles = partition.groups.filter(group => group.cyclic).length;
	byId("module-count").textContent = String(scene.nodes.length);
	byId("group-count").textContent = String(partition.groups.length);
	byId("cyclic-count").textContent = String(cycles);
	byId("result-title").textContent = cycles
		? `${partition.groups.length} groups, ${cycles} with dependency loops.`
		: `${partition.groups.length} groups. No dependency loops.`;
	byId("result-copy").textContent = `${scene.nodes.length} modules condense into ${partition.groups.length} ${partition.groups.length === 1 ? "node" : "nodes"}. `
		+ "Every member of a colored group can reach every other member by following imports.";
};

const solve = async () => {
	if(!runtimeReady) return;
	const current = revision;
	let prepared;
	try
	{
		prepared = await prepareGraph(buildGraphRequest(scene));
		if(current !== revision) return;
		const result = prepared();
		partition = describePartition(scene, result.labels);
		byId("runtime-status").textContent = "Groups computed by Lean/Wasm";
		byId("runtime-status").classList.remove("failed");
		render();
	}
	catch(error)
	{
		byId("runtime-status").textContent = "Component search could not complete";
		byId("runtime-status").classList.add("failed");
		byId("result-title").textContent = "Lean could not classify this graph.";
		byId("result-copy").textContent = error.message;
	}
	finally
	{
		prepared?.dispose();
	}
};
const scheduleSolve = () => {
	revision += 1;
	renderEditor();
	renderGroups();
	renderGraph();
	if(solveFrame) return;
	solveFrame = requestAnimationFrame(() => {
		solveFrame = 0;
		void solve();
	});
};

canvas.addEventListener("pointerdown", event => {
	const card = event.target.closest(".module-card,.component-card");
	if(!card || event.button !== 0) return;
	event.preventDefault();
	if(collapsed) selectGroup(Number(card.dataset.group));
	else
{ selectedId = Number(card.dataset.nodeId); groupAnchor = selectedId; render(); }
	const group = collapsed ? partition.groups[Number(card.dataset.group)] : null;
	const key = collapsed ? group.nodes[0].id : selectedId;
	const position = collapsed ? groupPositions.get(key) || collapsedLayout(partition).positions[group.index] : selectedNode();
	drag = { pointer: event.pointerId, key, x: position.x, y: position.y, clientX: event.clientX, clientY: event.clientY, collapsed };
	canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", event => {
	if(!drag || drag.pointer !== event.pointerId) return;
	const bounds = canvas.getBoundingClientRect();
	const marginX = (drag.collapsed ? 80 : 69) / bounds.width;
	const x = Math.max(marginX, Math.min(1 - marginX, drag.x + (event.clientX - drag.clientX) / bounds.width));
	const y = Math.max(.15, Math.min(.85, drag.y + (event.clientY - drag.clientY) / bounds.height));
	if(drag.collapsed) groupPositions.set(drag.key, { x, y });
	else Object.assign(scene.nodes.find(node => node.id === drag.key), { x, y });
	renderGraph();
});
const endDrag = event => {
	if(drag?.pointer !== event.pointerId) return;
	drag = null;
	if(canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("lostpointercapture", () => { drag = null; });
canvas.addEventListener("click", event => {
	if(event.detail !== 0) return;
	const card = event.target.closest(".module-card,.component-card");
	if(!card) return;
	if(collapsed) selectGroup(Number(card.dataset.group));
	else
{ selectedId = Number(card.dataset.nodeId); groupAnchor = selectedId; render(); }
});
byId("show-all").addEventListener("click", () => { groupAnchor = null; render(); });
byId("collapse-groups").addEventListener("click", () => { collapsed = !collapsed; renderGraph(); });
byId("toggle-feedback").addEventListener("click", () => toggleEdge(...scene.feedback));
byId("module-name").addEventListener("input", event => {
	selectedNode().name = event.target.value || "Unnamed module";
	render();
});
byId("remove-module").addEventListener("click", () => {
	if(scene.nodes.length < 2) return;
	scene.nodes = scene.nodes.filter(node => node.id !== selectedId);
	scene.edges = scene.edges.filter(([source, target]) => source !== selectedId && target !== selectedId);
	selectedId = scene.nodes[0].id;
	groupAnchor = null;
	partition = null;
	scheduleSolve();
});
byId("add-module").addEventListener("click", () => {
	if(scene.nodes.length >= 24) return;
	const id = scene.nextId++;
	const spots = Array.from({ length: 25 }, (_, index) => ({ x: .12 + (index % 5) * .19, y: .13 + Math.floor(index / 5) * .18 }));
	const score = spot => Math.min(...scene.nodes.map(node => Math.max(
		Math.abs(spot.x - node.x) * canvas.clientWidth / 140, Math.abs(spot.y - node.y) * canvas.clientHeight / 85
	)));
	spots.sort((left, right) => score(right) - score(left));
	scene.nodes.push({ id, name: `Module ${id + 1}`, ...spots[0] });
	selectedId = id;
	groupAnchor = null;
	partition = null;
	scheduleSolve();
});
for(const button of document.querySelectorAll("[data-preset]"))
	button.addEventListener("click", () => {
		scene = createPreset(button.dataset.preset);
		selectedId = 1;
		groupAnchor = null;
		partition = null;
		groupPositions.clear();
		for(const choice of document.querySelectorAll("[data-preset]"))
			choice.setAttribute("aria-pressed", String(choice === button));
		scheduleSolve();
	});
new ResizeObserver(renderGraph).observe(canvas);
render();
initRuntime().then(async () => {
	runtimeReady = true;
	await solve();
	mountBenchmark();
}).catch(error => {
	byId("runtime-status").textContent = "Lean/Wasm could not load";
	byId("runtime-status").classList.add("failed");
	byId("result-copy").textContent = error.message;
});
