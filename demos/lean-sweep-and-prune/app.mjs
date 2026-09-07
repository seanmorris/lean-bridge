/**
 * Display compiled Lean candidate and overlap pairs for draggable moving boxes.
 *
 * @file
 */

import { prepareSweep } from "./runtime.mjs";
import { mountBenchmark } from "./browser-benchmark.mjs";
import {
	WORLD, BODY_COLORS, explanationScene, seededScene, placeBody, advanceScene
	, packScene
} from "./scenario.mjs";

const document = globalThis.document;
const byId = id => document.getElementById(id);
const scene = byId("scene");
const bodyLayer = byId("bodies");
const projection = byId("projection");
const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
const bodyNodes = new Map();
const laneNodes = new Map();
const element = (tag, className, text) => {
	const node = document.createElement(tag);
	if(className) node.className = className;
	if(text !== undefined) node.textContent = text;
	return node;
};
const svgElement = (tag, attributes = {}) => {
	const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
	for(const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
	return node;
};
const pairList = values => {
	const pairs = [];
	for(let index = 0; index < values.length; index += 2) pairs.push([values[index], values[index + 1]]);
	return pairs;
};
const pairKey = (left, right) => `${Math.min(left, right)}:${Math.max(left, right)}`;
const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
let bodies = explanationScene();
let axis = 0;
let selected = 0;
let allLinks = true;
let playing = false;
let alive = true;
let inView = true;
let ready = false;
let checking = false;
let dirty = false;
let revision = 0;
let frame = 0;
let frameHandle = 0;
let lastTime = 0;
let lastMotion = 0;
let drag = null;
let result = null;
let displayed = [];
let sweepStart = 0;
let sweepPosition = 0;
let seedEdited = false;
let selectionSignature = "";
let motionSignature = "";

const announce = text => { byId("interaction-status").textContent = text; };
const bodyName = id => bodies[id]?.label ?? String(id);
const activeMotion = () => playing && alive && inView && !document.hidden && !drag;
const renderMotion = () => {
	const signature = `${playing}:${activeMotion()}:${drag?.id}:${ready}`;
	if(signature === motionSignature) return;
	motionSignature = signature;
	byId("toggle-motion").replaceChildren(element("span", "", playing ? "Ⅱ" : "▶"), document.createTextNode(playing ? "Pause motion" : "Play motion"));
	byId("toggle-motion").firstChild.setAttribute("aria-hidden", "true");
	byId("step-motion").disabled = !ready || playing;
	byId("scene-state").classList.toggle("running", activeMotion());
	byId("scene-state").replaceChildren(element("i"), document.createTextNode(drag ? `Moving ${bodyName(drag.id)} · release to place` : activeMotion() ? "Playing · drag to pause" : playing ? "Motion suspended while offscreen" : "Paused · drag a box"));
};

const createBodyNodes = () => {
	bodyNodes.clear();
	laneNodes.clear();
	bodyLayer.replaceChildren();
	byId("selected-body").replaceChildren();
	projection.replaceChildren();
	const scale = element("div", "projection-scale");
	scale.append(element("span", "", "0"), element("span", "", axis === 0 ? "X → 900" : "Y ↓ 480"));
	projection.append(scale);
	for(const body of bodies)
	{
		const color = BODY_COLORS[body.id % BODY_COLORS.length];
		const group = svgElement("g", {
			class: "body", "data-body": body.id, tabindex: "0", role: "button"
			, "aria-label": `Box ${body.label}. Use arrow keys to move.`
		});
		group.style.setProperty("--body-color", color);
		const rect = svgElement("rect", { class: "body-box", width: body.width, height: body.height, rx: 3 });
		const label = svgElement("text", { class: "body-label", x: body.width / 2, y: body.height / 2 });
		label.textContent = body.label;
		group.append(rect, label);
		bodyLayer.append(group);
		bodyNodes.set(body.id, group);
		const option = element("option", "", `Box ${body.label}`);
		option.value = body.id;
		byId("selected-body").append(option);
		const lane = element("div", "projection-lane");
		lane.style.setProperty("--body-color", color);
		const button = element("button", "", body.label);
		button.type = "button";
		button.dataset.select = body.id;
		button.setAttribute("aria-label", `Inspect box ${body.label}`);
		const track = element("div", "projection-track");
		const span = element("div", "projection-span");
		track.append(span);
		lane.append(button, track);
		projection.append(lane);
		laneNodes.set(body.id, { lane, span });
	}
	projection.append(element("div", "projection-scan"));
	byId("selected-body").value = selected;
};

const updateSelection = () => {
	byId("selected-body").value = selected;
	byId("show-all").setAttribute("aria-pressed", String(allLinks));
	byId("show-all").textContent = allLinks ? "All links ✓" : "All links";
	if(!result) return;
	const candidates = pairList(result.candidates).filter(pair => pair.includes(selected));
	const confirmed = new Set(pairList(result.overlaps).map(pair => pairKey(...pair)));
	const count = candidates.filter(pair => confirmed.has(pairKey(...pair))).length;
	const signature = JSON.stringify([axis, selected, bodies.length, candidates, [...confirmed]]);
	if(signature === selectionSignature) return;
	selectionSignature = signature;
	byId("selection-summary").textContent = `Box ${bodyName(selected)}: ${plural(candidates.length, "candidate")}, ${plural(count, "overlap")}.`;
	const items = candidates.map(pair => {
		const overlap = confirmed.has(pairKey(...pair));
		const item = element("li");
		item.append(element("span", `pair-badge${overlap ? " confirmed" : ""}`, pair.map(bodyName).join("·")), element("span", "", overlap ? "Overlaps on X and Y" : `Gap on ${axis === 0 ? "Y" : "X"}; rejected`));
		return item;
	});
	if(!items.length) items.push(element("li", "", `No span overlaps on ${axis === 0 ? "X" : "Y"}. Lean skips all ${bodies.length - 1} pairs for this box.`));
	byId("selected-pairs").replaceChildren(...items);
};

const draw = () => {
	if(!result) return;
	const candidates = pairList(result.candidates);
	const overlaps = pairList(result.overlaps);
	const confirmed = new Set(overlaps.map(pair => pairKey(...pair)));
	const related = new Set([selected, ...candidates.filter(pair => pair.includes(selected)).flat()]);
	const overlappingBodies = new Set(overlaps.flat());
	const links = candidates.filter(pair => allLinks || pair.includes(selected)).map(([left, right]) => {
		const a = displayed[left];
		const b = displayed[right];
		return svgElement("line", {
			class: `pair-link${confirmed.has(pairKey(left, right)) ? " confirmed" : ""}`
			, x1: a.x + a.width / 2, y1: a.y + a.height / 2
			, x2: b.x + b.width / 2, y2: b.y + b.height / 2
			, "data-pair": pairKey(left, right)
		});
	});
	byId("pair-links").replaceChildren(...links);
	byId("overlap-regions").replaceChildren(...overlaps.filter(pair => allLinks || pair.includes(selected)).map(([left, right]) => {
		const a = displayed[left];
		const b = displayed[right];
		const x = Math.max(a.x, b.x);
		const y = Math.max(a.y, b.y);
		return svgElement("rect", {
			class: "overlap-region", x, y
			, width: Math.min(a.x + a.width, b.x + b.width) - x
			, height: Math.min(a.y + a.height, b.y + b.height) - y
		});
	}));
	for(const body of displayed)
	{
		const node = bodyNodes.get(body.id);
		node.setAttribute("transform", `translate(${body.x} ${body.y})`);
		node.classList.toggle("is-selected", body.id === selected);
		node.classList.toggle("is-overlapping", overlappingBodies.has(body.id));
		node.classList.toggle("dimmed", !allLinks && !related.has(body.id));
		node.setAttribute("aria-pressed", String(body.id === selected));
		node.setAttribute("aria-label", `Box ${body.label}, left ${body.x}, top ${body.y}. ${overlappingBodies.has(body.id) ? "Overlapping another box. " : ""}Use arrow keys to move.`);
		const { lane, span } = laneNodes.get(body.id);
		const extent = axis === 0 ? WORLD.width : WORLD.height;
		span.style.left = `${(axis === 0 ? body.x : body.y) / extent * 100}%`;
		span.style.width = `${(axis === 0 ? body.width : body.height) / extent * 100}%`;
		lane.classList.toggle("is-selected", body.id === selected);
		lane.classList.toggle("dimmed", !allLinks && !related.has(body.id));
	}
	const body = displayed[selected];
	byId("axis-shading").replaceChildren(svgElement("rect", {
		class: "axis-band", x: axis === 0 ? body.x : 0, y: axis === 0 ? 0 : body.y
		, width: axis === 0 ? body.width : WORLD.width
		, height: axis === 0 ? WORLD.height : body.height
	}));
	updateSelection();
	drawSweep();
};

const checkFrame = async () => {
	if(checking || !dirty || !alive) return;
	checking = true;
	dirty = false;
	const current = revision;
	const snapshot = bodies.map(body => ({ ...body, x: Math.round(body.x), y: Math.round(body.y) }));
	let solve;
	try
	{
		solve = await prepareSweep({ boxes: packScene(snapshot), dimensions: 2, axis });
		if(!alive || current !== revision) return;
		const start = performance.now();
		const answer = solve();
		const elapsed = performance.now() - start;
		if(!alive || current !== revision) return;
		result = answer;
		displayed = snapshot;
		ready = true;
		frame++;
		byId("all-count").textContent = bodies.length * (bodies.length - 1) / 2;
		byId("candidate-count").textContent = answer.candidates.length / 2;
		byId("overlap-count").textContent = answer.overlaps.length / 2;
		const skipped = bodies.length * (bodies.length - 1) / 2 - answer.candidates.length / 2;
		byId("reduction-note").textContent = `The ${axis === 0 ? "X" : "Y"} sweep skips ${plural(skipped, "pair")}. Lean checks the remaining ${answer.candidates.length / 2} on both axes.`;
		const status = "Lean/Wasm ready · exact current-frame pairs";
		if(byId("runtime-status").textContent !== status) byId("runtime-status").textContent = status;
		byId("runtime-status").classList.remove("failed");
		byId("frame-time").textContent = `${elapsed < .01 ? "<0.01" : elapsed.toFixed(2)} ms`;
		byId("frame-number").textContent = `Frame ${frame}`;
		byId("toggle-motion").disabled = false;
		byId("drag-preview").replaceChildren();
		draw();
		renderMotion();
	}
	catch(error)
	{
		playing = false;
		byId("runtime-status").textContent = error instanceof Error ? error.message : String(error);
		byId("runtime-status").classList.add("failed");
		byId("frame-title").textContent = "The current frame did not finish.";
		byId("frame-copy").textContent = "No browser fallback decides the pairs. Reload to try the compiled solver again.";
		console.error(error);
		renderMotion();
	}
	finally
	{
		solve?.dispose();
		checking = false;
		if(dirty && alive) globalThis.requestAnimationFrame(() => { void checkFrame(); });
	}
};

const requestCheck = () => {
	revision++;
	dirty = true;
	void checkFrame();
};

const selectBody = (id, focus = false) => {
	selected = id;
	allLinks = false;
	draw();
	if(focus) bodyNodes.get(id)?.focus({ preventScroll: true });
};

const pauseMotion = () => {
	playing = false;
	lastMotion = 0;
	renderMotion();
};

const replaySweep = () => {
	sweepStart = performance.now();
	sweepPosition = reducedMotion.matches ? 1 : 0;
	drawSweep();
	requestTick();
};

const drawSweep = () => {
	const scan = projection.querySelector(".projection-scan");
	if(!scan || !result) return;
	const scanning = sweepPosition < 1;
	const position = sweepPosition * (axis === 0 ? WORLD.width : WORLD.height);
	const active = new Set();
	for(const body of displayed)
	{
		const start = axis === 0 ? body.x : body.y;
		const end = start + (axis === 0 ? body.width : body.height);
		const inside = scanning && start <= position && position <= end;
		if(inside) active.add(body.id);
		laneNodes.get(body.id).lane.classList.toggle("sweep-active", inside);
	}
	for(const link of byId("pair-links").children)
	{
		const ids = link.dataset.pair.split(":").map(Number);
		link.classList.toggle("sweep-active", ids.every(id => active.has(id)));
	}
	scan.style.left = `calc(43px + (100% - 59px) * ${sweepPosition})`;
	scan.hidden = !scanning;
	const labels = Array.from(active, bodyName);
	byId("sweep-status").textContent = scanning
		? `At ${axis === 0 ? "X" : "Y"} ${Math.round(position)}: ${labels.length ? `${labels.slice(0, 5).join(", ")}${labels.length > 5 ? ` + ${labels.length - 5} more` : ""} active` : "no active spans"}.`
		: `Scan complete: ${plural(result.candidates.length / 2, "axis candidate")} returned by Lean.`;
};

const tick = time => {
	frameHandle = 0;
	if(!alive || document.hidden || !inView) return;
	if(activeMotion() && !checking && time - lastMotion >= 30)
	{
		advanceScene(bodies, Math.min(.05, (time - (lastMotion || lastTime || time)) / 1000));
		lastMotion = time;
		requestCheck();
	}
	lastTime = time;
	if(sweepPosition < 1)
	{
		sweepPosition = Math.min(1, (time - sweepStart) / 1400);
	}
	drawSweep();
	if(activeMotion() || sweepPosition < 1) requestTick();
};

const requestTick = () => {
	if(!frameHandle && alive && inView && !document.hidden) frameHandle = globalThis.requestAnimationFrame(tick);
};

const scenePoint = event => {
	const point = scene.createSVGPoint();
	point.x = event.clientX;
	point.y = event.clientY;
	return point.matrixTransform(scene.getScreenCTM().inverse());
};

const showDragPreview = body => {
	byId("drag-preview").replaceChildren(svgElement("rect", {
		class: "drag-outline", x: Math.round(body.x), y: Math.round(body.y)
		, width: body.width, height: body.height, rx: 3
	}));
};

const finishDrag = event => {
	if(!drag || drag.pointerId !== event.pointerId) return;
	const id = drag.id;
	drag = null;
	scene.classList.remove("dragging");
	byId("drag-preview").replaceChildren();
	byId("scene-hint").textContent = `Box ${bodyName(id)} placed. Use the arrow keys for a precise adjustment.`;
	if(scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
	renderMotion();
	announce(`Box ${bodyName(id)} placed. ${byId("selection-summary").textContent}`);
};

scene.addEventListener("pointerdown", event => {
	const node = event.target.closest("[data-body]");
	if(!ready || !node || event.button !== 0 || drag) return;
	event.preventDefault();
	pauseMotion();
	const id = Number(node.dataset.body);
	selectBody(id, true);
	const point = scenePoint(event);
	drag = { id, pointerId: event.pointerId, offsetX: point.x - bodies[id].x, offsetY: point.y - bodies[id].y };
	scene.setPointerCapture(event.pointerId);
	scene.classList.add("dragging");
	byId("scene-hint").textContent = `Moving ${bodyName(id)}. Lean updates its candidate and overlap pairs as you drag.`;
	renderMotion();
});
scene.addEventListener("pointermove", event => {
	if(!drag || drag.pointerId !== event.pointerId) return;
	const point = scenePoint(event);
	placeBody(bodies[drag.id], point.x - drag.offsetX, point.y - drag.offsetY);
	showDragPreview(bodies[drag.id]);
	requestCheck();
});
for(const type of ["pointerup", "pointercancel", "lostpointercapture"]) scene.addEventListener(type, finishDrag);

const nudgeBody = (direction, amount = 6) => {
	if(!ready) return;
	pauseMotion();
	const body = bodies[selected];
	const dx = direction === "left" ? -amount : direction === "right" ? amount : 0;
	const dy = direction === "up" ? -amount : direction === "down" ? amount : 0;
	placeBody(body, body.x + dx, body.y + dy);
	requestCheck();
	byId("scene-hint").textContent = `Box ${body.label} moved ${direction}. Touching an edge counts as overlap.`;
};

scene.addEventListener("keydown", event => {
	const node = event.target.closest("[data-body]");
	if(!node) return;
	if(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
	{
		event.preventDefault();
		selectBody(Number(node.dataset.body));
		nudgeBody(event.key.slice(5).toLowerCase(), event.shiftKey ? 24 : 3);
	}
	else if(event.key === "Enter" || event.key === " ")
	{
		event.preventDefault();
		selectBody(Number(node.dataset.body));
	}
});

scene.addEventListener("focusin", event => {
	const node = event.target.closest("[data-body]");
	if(node && Number(node.dataset.body) !== selected) selectBody(Number(node.dataset.body));
});
for(const button of document.querySelectorAll("[data-nudge]")) button.addEventListener("click", () => nudgeBody(button.dataset.nudge));
byId("selected-body").addEventListener("change", event => selectBody(Number(event.target.value)));
byId("show-all").addEventListener("click", () => { allLinks = !allLinks; draw(); });
projection.addEventListener("click", event => {
	const button = event.target.closest("[data-select]");
	if(button) selectBody(Number(button.dataset.select), true);
});
byId("toggle-motion").addEventListener("click", () => {
	playing = !playing;
	lastTime = performance.now();
	lastMotion = 0;
	renderMotion();
	requestTick();
	announce(playing ? "Motion playing. Drag a box to pause." : "Motion paused. You can still drag any box.");
});
byId("step-motion").addEventListener("click", () => {
	advanceScene(bodies, .4);
	requestCheck();
	announce("Advanced the scene by four tenths of a second.");
});

const renderAxis = () => {
	for(const button of document.querySelectorAll("[data-axis]")) button.setAttribute("aria-pressed", String(Number(button.dataset.axis) === axis));
	byId("candidate-label").textContent = `${axis === 0 ? "X" : "Y"}-axis candidates`;
	byId("projection-title").textContent = axis === 0 ? "Horizontal spans, left to right" : "Vertical spans, top to bottom";
	byId("projection-note").textContent = axis === 0 ? "Each row shows the same box flattened onto X. Vertical position is ignored in this first pass." : "Each row plots a box's vertical span from top (left end) to bottom (right end). Horizontal position is ignored in this first pass.";
	projection.querySelector(".projection-scale").lastChild.textContent = axis === 0 ? "X → 900" : "Y ↓ 480";
};
for(const button of document.querySelectorAll("[data-axis]")) button.addEventListener("click", () => {
	if(axis === Number(button.dataset.axis)) return;
	axis = Number(button.dataset.axis);
	renderAxis();
	requestCheck();
	replaySweep();
	announce(`Sweeping ${axis === 0 ? "X horizontally" : "Y vertically"}. Final overlap pairs do not depend on this choice.`);
});
byId("replay-sweep").addEventListener("click", replaySweep);

const replaceScene = next => {
	pauseMotion();
	drag = null;
	scene.classList.remove("dragging");
	result = null;
	bodies = next;
	selected = 0;
	allLinks = next.length <= 6;
	frame = 0;
	byId("pair-links").replaceChildren();
	byId("overlap-regions").replaceChildren();
	byId("axis-shading").replaceChildren();
	byId("drag-preview").replaceChildren();
	createBodyNodes();
	renderAxis();
	requestCheck();
	replaySweep();
};
byId("scene-seed").addEventListener("input", () => { seedEdited = true; });
byId("new-scene").addEventListener("click", () => {
	const input = byId("scene-seed");
	if(!input.checkValidity())
	{
		input.reportValidity();
		return;
	}
	let seed = Number(input.value) >>> 0;
	if(!seedEdited) seed = (seed + 1) >>> 0;
	input.value = seed;
	seedEdited = false;
	const count = Number(byId("body-count").value);
	replaceScene(seededScene(seed, count));
	byId("seed-note").textContent = `Seed ${seed} · ${count} boxes. Enter a seed, then choose New scene to reproduce it.`;
	byId("scene-hint").textContent = "Select a box to focus its pairs, or show all links. Drag any box to change the scene.";
	announce(`Generated ${count} boxes with seed ${seed}. Motion is paused.`);
});
byId("scene-seed").addEventListener("keydown", event => {
	if(event.key === "Enter") byId("new-scene").click();
});
byId("reset-scene").addEventListener("click", () => {
	axis = 0;
	replaceScene(explanationScene());
	byId("seed-note").textContent = "The example uses six boxes. Enter a seed to reproduce a generated scene.";
	byId("scene-hint").textContent = "Drag A toward B. Dashed means candidate; solid means overlap.";
	announce("Six-box example restored. A and B are candidates; C and D overlap.");
});

const suspend = () => {
	if(frameHandle) globalThis.cancelAnimationFrame(frameHandle);
	frameHandle = 0;
	lastTime = 0;
	lastMotion = 0;
	renderMotion();
};
document.addEventListener("visibilitychange", () => {
	if(document.hidden) suspend();
	else
	{
		sweepStart = performance.now() - sweepPosition * 1400;
		renderMotion();
		requestTick();
	}
});
const observer = new globalThis.IntersectionObserver(entries => {
	inView = entries[0].isIntersecting;
	if(!inView) suspend();
	else
	{
		sweepStart = performance.now() - sweepPosition * 1400;
		renderMotion();
		requestTick();
	}
}, { threshold: 0 });
observer.observe(scene);
globalThis.addEventListener("pagehide", () => {
	alive = false;
	revision++;
	suspend();
});
globalThis.addEventListener("pageshow", event => {
	if(!event.persisted) return;
	alive = true;
	dirty = true;
	void checkFrame();
	requestTick();
});
reducedMotion.addEventListener("change", () => {
	if(reducedMotion.matches)
	{
		pauseMotion();
		sweepPosition = 1;
	}
});

createBodyNodes();
renderMotion();
requestCheck();
replaySweep();
mountBenchmark();
