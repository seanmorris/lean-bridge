/**
 * Scoped lru-cache editor; React owns the surrounding page and controller lifetime.
 *
 * @file
 */

import * as runtimeModule from "./runtime.mjs";
import { createBenchmark } from "./benchmark-workload.mjs";

/**
 * Mount the existing editor within one route-owned scaffold.
 *
 * @param root Workbench element containing the controls and drawing surfaces.
 * @param scope Resource lifetime, including late prepared Wasm handles.
 * @param saved Page-memory input snapshot, empty on a new document.
 */
export const mountWorkbench = async (root, scope, saved = {}) => {
	const { createCache, ready } = scope.runtime(runtimeModule);
	const byId = id => root.querySelector("#" + id);
	const elements = {
		capacity: byId("capacity")
		, evictionCount: byId("eviction-count")
		, evictionDetail: byId("eviction-detail")
		, evictionName: byId("eviction-name")
		, evictionReason: byId("eviction-reason")
		, hitCount: byId("hit-count")
		, hitRate: byId("hit-rate")
		, missCount: byId("miss-count")
		, next: byId("next-request")
		, occupancy: byId("occupancy")
		, progress: byId("timeline-progress")
		, replay: byId("replay")
		, resources: byId("resource-buttons")
		, result: byId("request-result")
		, resultExplanation: byId("result-explanation")
		, resultKind: byId("result-kind")
		, resultSymbol: byId("result-symbol")
		, resultTitle: byId("result-title")
		, run: byId("run")
		, runtime: byId("runtime-status")
		, scenarioExplanation: byId("scenario-explanation")
		, slots: byId("cache-slots")
		, step: byId("step")
		, timeline: byId("request-timeline")
		, timelineTitle: byId("timeline-title")
	};
	const resources = [
		{ key: 1, letter: "A", name: "Atlas", color: "#72d8ff" }
		, { key: 2, letter: "B", name: "Profile", color: "#c6a0ff" }
		, { key: 3, letter: "C", name: "Icon set", color: "#adf7b6" }
		, { key: 4, letter: "D", name: "Photo", color: "#ffd36e" }
		, { key: 5, letter: "E", name: "Audio", color: "#ff9fba" }
		, { key: 6, letter: "F", name: "Font", color: "#8ee6c1" }
		, { key: 7, letter: "G", name: "Video", color: "#ff9d80" }
		, { key: 8, letter: "H", name: "Catalog", color: "#a7b8ff" }
	];
	const scenarios = {
		working: {
			requests: [1, 2, 3, 1, 2, 4, 1, 2, 3, 1, 2, 3]
			, title: "A small working set gets reused."
			, explanation: "A, B, and C repeat. A newcomer competes for cache space. Compare three slots with four and inspect the same requests again."
		}
		, scan: {
			requests: [1, 2, 3, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 1, 2, 3]
			, title: "One-time requests push familiar resources out."
			, explanation: "After A, B, and C warm up, a scan requests D through H once each. Watch what happens when the familiar resources return."
		}
	};
	const resource = key => resources[key - 1];
	const fullName = key => `${resource(key).letter} · ${resource(key).name}`;
	const element = (tag, className, text) => {
		const node = globalThis.document.createElement(tag);
		if(className) node.className = className;
		if(text !== undefined) node.textContent = text;
		return node;
	};

	let cache;
	let scenarioName = saved.scenarioName ?? "working";
	let requests = saved.requests ?? [...scenarios.working.requests];
	let history = [];
	let capacity = saved.capacity ?? 3;
	let busy = true;
	let playing = false;
	let timer = 0;
	let revision = 0;
	let alive = true;
	scope.remember(() => ({ scenarioName, requests, capacity, position: busy ? (saved.position ?? history.length) : history.length }));
	elements.capacity.value = String(capacity);
	elements.scenarioExplanation.textContent = scenarios[scenarioName].explanation;
	elements.timelineTitle.textContent = scenarios[scenarioName].title;

	const stopPlayback = () => {
		scope.clearTimeout(timer);
		timer = 0;
		playing = false;
	};

	const applyRequest = key => {
		const before = cache.entries();
		const lookup = cache.get(key);
		let evicted = null;
		if(!lookup.hit) evicted = cache.put(key, key * 1000 + 1).evicted;
		history.push({ key, hit: lookup.hit, evicted, before, after: cache.entries() });
	};

	const renderSlots = entries => {
		const last = history.at(-1);
		elements.slots.style.setProperty("--capacity", String(capacity));
		elements.occupancy.textContent = `${entries.length} / ${capacity} slots`;
		elements.slots.replaceChildren(...Array.from({ length: capacity }, (_, index) => {
			const entry = entries[index];
			const item = entry ? resource(entry[0]) : null;
			const current = item && last?.key === item.key;
			const slot = element("div", `cache-slot${item ? "" : " empty"}${current ? " current" : ""}${item && index === entries.length - 1 && entries.length === capacity ? " lru" : ""}`);
			if(item) slot.style.setProperty("--resource-color", item.color);
			const lastUse = item ? history.findLastIndex(event => event.key === item.key) + 1 : 0;
			const note = !item ? "Available" : current ? (last.hit ? "Cache hit" : "Just loaded") : `Last used #${lastUse}`;
			slot.append(element("span", "slot-position", String(index + 1)), element("b", "slot-letter", item?.letter ?? "+"), element("span", "slot-name", item?.name ?? "Empty slot"), element("span", "slot-note", note));
			slot.setAttribute("aria-label", item ? `Slot ${index + 1}: ${item.name}, last requested at step ${lastUse}${index === 0 ? ", most recently used" : ""}${index === entries.length - 1 ? ", least recently used" : ""}` : `Slot ${index + 1}: empty`);
			return slot;
		}));
	};

	const renderResult = entries => {
		const last = history.at(-1);
		elements.result.className = `request-result${last ? last.hit ? " hit" : " miss" : ""}`;
		elements.evictionDetail.classList.toggle("has-eviction", Boolean(last?.evicted));
		if(!last)
		{
			elements.resultSymbol.textContent = "?";
			elements.resultSymbol.style.removeProperty("--resource-color");
			elements.resultKind.textContent = "Ready for the first request";
			elements.resultTitle.textContent = "The cache is empty.";
			elements.resultExplanation.textContent = `Choose Step to request ${resource(requests[0]).letter}, or click any resource to try your own request.`;
			elements.evictionName.textContent = "None";
			elements.evictionReason.textContent = "There is still room.";
			return;
		}
		const item = resource(last.key);
		elements.resultSymbol.textContent = item.letter;
		elements.resultSymbol.style.setProperty("--resource-color", item.color);
		elements.resultKind.textContent = `Request ${history.length} · ${last.hit ? "Cache hit" : "Cache miss"}`;
		elements.resultTitle.textContent = last.hit ? `${item.name} was already cached.` : `${item.name} was loaded.`;
		if(last.hit)
		{
			const previousPosition = last.before.findIndex(entry => entry[0] === last.key);
			elements.resultExplanation.textContent = previousPosition === 0
				? `${item.letter} was already the most recently used entry. Lean keeps it at the front.`
				: `Lean moves ${item.letter} from slot ${previousPosition + 1} to the front. The other entries keep their relative order.`;
		}
		else elements.resultExplanation.textContent = last.evicted
			? `Lean loads ${item.letter} at the front and evicts ${resource(last.evicted.key).letter}, the entry left unused longest.`
			: `Lean loads ${item.letter} at the front. ${capacity - entries.length > 0 ? `${capacity - entries.length} ${capacity - entries.length === 1 ? "slot remains" : "slots remain"} available.` : "The cache is now full."}`;
		elements.evictionName.textContent = last.evicted ? fullName(last.evicted.key) : "None";
		elements.evictionReason.textContent = last.evicted ? "Least recently used" : last.hit ? "A hit needs no new slot." : "An empty slot was available.";
	};

	const renderTimeline = () => {
		const active = history.length - 1;
		elements.progress.textContent = `${history.length} / ${requests.length} requests`;
		elements.timeline.replaceChildren(...requests.map((key, index) => {
			const event = history[index];
			const item = resource(key);
			const button = element("button", `timeline-request ${event ? event.hit ? "hit" : "miss" : "queued"}${index === history.length ? " next" : ""}`);
			button.type = "button";
			button.style.setProperty("--resource-color", item.color);
			button.dataset.step = String(index + 1);
			button.disabled = busy;
			button.setAttribute("aria-label", `Request ${index + 1}: ${item.name}${event ? event.hit ? ", cache hit" : ", cache miss" : ", queued"}. Show cache after this request.`);
			if(index === active) button.setAttribute("aria-current", "step");
			button.append(element("small", "", String(index + 1).padStart(2, "0")), element("b", "", item.letter), element("span", "", event ? event.hit ? "Hit" : "Miss" : "·"));
			scope.listen(button, "click", () => void resetAt(index + 1).then(() => {
				elements.timeline.querySelector(`[data-step="${index + 1}"]`)?.focus({ preventScroll: true });
			}));
			return button;
		}));
		const activeButton = elements.timeline.querySelector('[aria-current="step"]');
		if(activeButton)
		{
			const top = activeButton.offsetTop - elements.timeline.offsetTop;
			if(top < elements.timeline.scrollTop) elements.timeline.scrollTop = top;
			else if(top + activeButton.offsetHeight > elements.timeline.scrollTop + elements.timeline.clientHeight)
				elements.timeline.scrollTop = top + activeButton.offsetHeight - elements.timeline.clientHeight;
		}
	};

	const render = () => {
		const entries = history.at(-1)?.after ?? [];
		const hits = history.filter(event => event.hit).length;
		const evictions = history.filter(event => event.evicted).length;
		renderSlots(entries);
		renderResult(entries);
		renderTimeline();
		elements.hitCount.textContent = String(hits);
		elements.missCount.textContent = String(history.length - hits);
		elements.evictionCount.textContent = String(evictions);
		elements.hitRate.textContent = history.length ? `${Math.round(hits / history.length * 100)}%` : "—";
		elements.next.textContent = history.length < requests.length ? fullName(requests[history.length]) : "Sequence complete";
		elements.step.disabled = busy || history.length >= requests.length;
		elements.run.disabled = busy || history.length >= requests.length;
		elements.run.textContent = playing ? "Pause" : "Run";
		elements.replay.disabled = busy;
		elements.capacity.disabled = busy;
		for(const button of root.querySelectorAll("[data-scenario]"))
		{
			button.disabled = busy;
			button.setAttribute("aria-pressed", String(button.dataset.scenario === scenarioName));
		}
		for(const button of elements.resources.children)
		{
			const cached = entries.some(entry => entry[0] === Number(button.dataset.key));
			button.disabled = busy;
			button.classList.toggle("cached", cached);
			button.querySelector("small").textContent = cached ? "Cached" : "Not cached";
			button.setAttribute("aria-label", `Request ${resource(Number(button.dataset.key)).name}, ${cached ? "cached" : "not cached"}`);
		}
	};

	const showError = error => {
		stopPlayback();
		busy = true;
		render();
		elements.runtime.textContent = "Lean/Wasm could not complete the request";
		elements.resultKind.textContent = "Cache unavailable";
		elements.resultTitle.textContent = "The request did not complete.";
		elements.resultExplanation.textContent = error instanceof Error ? error.message : String(error);
		console.error(error);
	};

	const step = () => {
		if(busy || history.length >= requests.length) return;
		try
		{
			applyRequest(requests[history.length]);
			if(history.length === requests.length) stopPlayback();
			render();
		}
		catch(error)
		{
			if(!scope.active) return; showError(error); }
	};

	const scheduleNext = () => {
		if(!playing) return;
		timer = scope.setTimeout(() => {
			step();
			if(playing) scheduleNext();
		}, 850);
	};

	const startPlayback = () => {
		if(busy || history.length >= requests.length) return;
		playing = true;
		step();
		scheduleNext();
	};

	const resetAt = async (position, autoplay = false) => {
		stopPlayback();
		const current = ++revision;
		busy = true;
		render();
		try
		{
			const nextCache = await createCache(capacity);
			if(current !== revision || !alive)
			{ nextCache.dispose(); return; }
			cache?.dispose();
			cache = nextCache;
			history = [];
			for(let index = 0; index < Math.min(position, requests.length); index += 1) applyRequest(requests[index]);
			busy = false;
			render();
			if(autoplay) startPlayback();
		}
		catch(error)
		{
			if(!scope.active) return; if(current === revision) showError(error); }
	};

	const insertRequest = key => {
		if(busy) return;
		stopPlayback();
		requests.splice(history.length, 0, key);
		step();
	};

	elements.resources.replaceChildren(...resources.map(item => {
		const button = element("button", "resource-button");
		button.type = "button";
		button.disabled = true;
		button.dataset.key = String(item.key);
		button.style.setProperty("--resource-color", item.color);
		button.append(element("b", "", item.letter), element("span", "", item.name), element("small", "", "Not cached"));
		scope.listen(button, "click", () => insertRequest(item.key));
		return button;
	}));

	scope.listen(elements.step, "click", () => { stopPlayback(); step(); });
	scope.listen(elements.run, "click", () => {
		if(playing)
	{ stopPlayback(); render(); }
		else startPlayback();
	});
	scope.listen(elements.replay, "click", () => void resetAt(0, true));
	scope.listen(elements.capacity, "change", () => {
		capacity = Number(elements.capacity.value);
		void resetAt(history.length);
	});
	for(const button of root.querySelectorAll("[data-scenario]")) scope.listen(button, "click", () => {
		scenarioName = button.dataset.scenario;
		requests = [...scenarios[scenarioName].requests];
		elements.timelineTitle.textContent = scenarios[scenarioName].title;
		elements.scenarioExplanation.textContent = scenarios[scenarioName].explanation;
		void resetAt(0);
	});

	scope.listen(globalThis.document, "visibilitychange", () => {
		if(globalThis.document.hidden)
		{
			stopPlayback();
			render();
		}
	});
	scope.listen(globalThis, "pagehide", () => {
		alive = false;
		revision++;
		stopPlayback();
		cache?.dispose();
		cache = undefined;
		busy = true;
	});
	scope.listen(globalThis, "pageshow", event => {
		if(event.persisted)
		{
			alive = true;
			void resetAt(history.length);
		}
	});

	let benchmark;
	let benchmarkGeneration = 0;
	scope.listen(globalThis, "pagehide", () => {
		benchmarkGeneration++;
		benchmark?.dispose();
		benchmark = undefined;
	});
	scope.benchmark({
		root: byId("browser-benchmark")
		, prepare: async () => {
			const generation = benchmarkGeneration;
			if(!benchmark)
			{
				const prepared = await createBenchmark();
				if(generation !== benchmarkGeneration)
				{ prepared.dispose(); return; }
				benchmark = prepared;
			}
			byId("benchmark-description").textContent = `A ${benchmark.capacity}-slot cache processes ${benchmark.count.toLocaleString()} lookups and writes per trace. Five excluded runs warm Lean/Wasm and JavaScript’s insertion-ordered Map, then 100 comparisons check every outcome.`;
		}
		, sample: index => benchmark.sample(index)
		, summarize: ({ ratio, trialCount }) => `${trialCount} traces agreed · ${benchmark.count.toLocaleString()} operations each · median paired cost ${ratio.toFixed(1)}×`
	});

	render();
	try
	{
		await ready();
		await resetAt(saved.position ?? 0);
		if(!busy) elements.runtime.textContent = "Lean/Wasm ready";
	}
	catch(error)
	{
		if(!scope.active) return; showError(error); }
};
