/**
 * Present compiled Lean bucket transitions as a controllable request simulation.
 *
 * @file
 */
import { createBucket } from "./runtime.mjs";
import { mountBenchmark } from "./browser-benchmark.mjs";
import { CREDITS_PER_TOKEN, EXAMPLE_CONFIG, EXAMPLE_REQUESTS, formatTime, formatTokens } from "./scenario.mjs";

const byId = id => globalThis.document.getElementById(id);
const elements = Object.fromEntries([
	"runtime-status"
	, "result-title"
	, "result-copy"
	, "allowed-count"
	, "throttled-count"
	, "scenario-copy"
	, "replay-example"
	, "token-balance"
	, "refill-label"
	, "capacity-scale"
	, "reservoir"
	, "reservoir-fill"
	, "reservoir-lines"
	, "reservoir-state"
	, "reservoir-copy"
	, "clock-value"
	, "clock-state"
	, "play-clock"
	, "capacity"
	, "capacity-value"
	, "rate"
	, "rate-value"
	, "request-cost"
	, "send-request"
	, "reset-bucket"
	, "request-timeline"
	, "decision-label"
	, "decision-title"
	, "decision-explanation"
	, "decision-available"
	, "decision-cost", "decision-remaining", "decision-retry", "interaction-status"
].map(id => [id, byId(id)]));
const decisionPanel = globalThis.document.querySelector(".decision-panel");
const labControls = [...globalThis.document.querySelectorAll(".bucket-workbench button,.bucket-workbench input")];
const HISTORY_LIMIT = 120;
const element = (tag, className, text) => {
	const node = globalThis.document.createElement(tag);
	if(className) node.className = className;
	if(text !== undefined) node.textContent = text;
	return node;
};
const duration = milliseconds => milliseconds < 1000 ? `${milliseconds} ms` : `${formatTokens(milliseconds)} s`;
const tokenCount = credits => `${formatTokens(credits)} ${credits === CREDITS_PER_TOKEN ? "token" : "tokens"}`;

let bucket;
let capacity = EXAMPLE_CONFIG.capacity;
let rate = EXAMPLE_CONFIG.rate;
let cost = EXAMPLE_CONFIG.cost;
let now = 0;
let tokens = 0;
let busy = true;
let alive = true;
let revision = 0;
let history = [];
let allowedCount = 0;
let throttledCount = 0;
let requestCount = 0;
let selected = null;
let playing = false;
let frame = 0;
let previousFrame = 0;
let frameRemainder = 0;
let example = null;

const renderControls = () => {
	for(const control of labControls) control.disabled = busy;
	elements["play-clock"].textContent = playing ? "Pause clock" : "Play clock";
	elements["play-clock"].setAttribute("aria-pressed", String(playing));
	elements["clock-state"].textContent = playing ? "Running" : "Paused";
	elements["clock-state"].classList.toggle("playing", playing);
	elements["capacity-value"].textContent = `${capacity} tokens`;
	elements["rate-value"].textContent = `${rate} ${rate === 1 ? "token" : "tokens"} / second`;
	elements["refill-label"].textContent = elements["rate-value"].textContent;
	for(const button of elements["request-timeline"].querySelectorAll("button")) button.disabled = busy;
};

const stopClock = () => {
	globalThis.cancelAnimationFrame(frame);
	frame = 0;
	previousFrame = 0;
	frameRemainder = 0;
	playing = false;
	renderControls();
};

const renderScale = () => {
	const marks = Array.from({ length: capacity + 1 }, (_, index) => index);
	elements["capacity-scale"].replaceChildren(...marks.filter(mark => capacity <= 10 || mark % 2 === 0 || mark === capacity).map(mark => {
		const label = element("span", "", String(mark));
		label.style.bottom = `${mark / capacity * 100}%`;
		return label;
	}));
	elements["reservoir-lines"].replaceChildren(...marks.slice(1, -1).map(mark => {
		const line = element("i");
		line.style.bottom = `${mark / capacity * 100}%`;
		return line;
	}));
	elements.reservoir.setAttribute("aria-valuemax", String(capacity));
};

const renderBalance = () => {
	elements["token-balance"].textContent = formatTokens(tokens);
	elements["clock-value"].textContent = formatTime(now);
	elements["reservoir-fill"].style.height = `${tokens / (capacity * CREDITS_PER_TOKEN) * 100}%`;
	elements.reservoir.setAttribute("aria-valuenow", String(tokens / CREDITS_PER_TOKEN));
	elements.reservoir.setAttribute("aria-valuetext", `${tokenCount(tokens)} of ${capacity}`);
	elements.reservoir.classList.toggle("empty", tokens === 0);
	const full = tokens === capacity * CREDITS_PER_TOKEN;
	elements["reservoir-state"].textContent = full ? "Full bucket" : tokens === 0 ? "Empty bucket" : "Tokens available";
	elements["reservoir-copy"].textContent = full
		? `Capacity is ${capacity} tokens. Further refill is discarded.`
		: rate === 0 ? "Refill is off. Only the stored balance can be spent."
			: playing ? "The clock adds tokens until the bucket is full."
				: tokens === 0 ? "Advance the clock to add tokens before the next request."
					: "Advance the clock to refill, or spend the current balance.";
};

const renderSummary = () => {
	elements["allowed-count"].textContent = String(allowedCount);
	elements["throttled-count"].textContent = String(throttledCount);
	elements["result-title"].textContent = requestCount
		? `${allowedCount} allowed. ${throttledCount} throttled.`
		: `A full bucket can spend ${capacity} tokens.`;
	elements["result-copy"].textContent = requestCount
		? `${requestCount} ${requestCount === 1 ? "request has" : "requests have"} arrived by ${formatTime(now)}. ${requestCount > HISTORY_LIMIT ? `Showing the last ${HISTORY_LIMIT} arrivals.` : "Select any arrival to inspect Lean's decision."}`
		: "Send one request or a simultaneous burst. Move the clock to see the balance recover.";
};

const renderDecision = () => {
	const event = history.find(item => item.id === selected);
	decisionPanel.classList.toggle("throttled", event?.status === "throttled");
	if(!event)
	{
		elements["decision-label"].textContent = "Selected request";
		elements["decision-title"].textContent = "Send a request to inspect its decision.";
		elements["decision-explanation"].textContent = "The current balance is above. Each arrival records the tokens available before and after that request.";
		for(const name of ["available", "cost", "remaining", "retry"]) elements[`decision-${name}`].textContent = "—";
		return;
	}
	elements["decision-label"].textContent = `Request #${event.id} · ${formatTime(event.at)}`;
	elements["decision-title"].textContent = event.allowed ? "Allowed. The request spent its tokens." : event.status === "clock-regression" ? "Rejected. The timestamp moved backward." : "Throttled. No tokens were spent.";
	elements["decision-available"].textContent = tokenCount(event.available);
	elements["decision-cost"].textContent = tokenCount(event.cost);
	elements["decision-remaining"].textContent = tokenCount(event.tokens);
	elements["decision-retry"].textContent = event.allowed ? "Not needed" : event.retryAfter === null ? "Cannot refill" : duration(event.retryAfter);
	const refill = event.refilled ? `Elapsed time added ${tokenCount(event.refilled)} before this request. ` : "";
	if(event.allowed)
		elements["decision-explanation"].textContent = `${refill}${tokenCount(event.available)} covered the ${tokenCount(event.cost)} cost. ${tokenCount(event.tokens)} remained immediately afterward.`;
	else if(event.status === "clock-regression")
		elements["decision-explanation"].textContent = "Lean rejected a timestamp earlier than the bucket's last update. The stored time and balance did not change.";
	else if(event.cost > capacity * CREDITS_PER_TOKEN)
		elements["decision-explanation"].textContent = `The ${formatTokens(event.cost)}-token cost exceeds the ${capacity}-token capacity. Waiting cannot make this request fit. Reduce its cost or increase capacity.`;
	else if(event.retryAfter === null)
		elements["decision-explanation"].textContent = `${refill}The available balance was ${tokenCount(event.available)}. With refill set to zero, waiting adds nothing. Change the refill rate or reduce the cost.`;
	else
		elements["decision-explanation"].textContent = `${refill}The available balance was ${tokenCount(event.available)}. This request could retry after ${duration(event.retryAfter)}, at ${formatTime(event.at + event.retryAfter)}, if no other request spends tokens first. It is not queued.`;
};

const renderTimeline = () => {
	if(!history.length)
	{
		elements["request-timeline"].replaceChildren(element("p", "timeline-empty", "No requests yet. Try a burst to see which arrivals the current balance covers."));
		return;
	}
	elements["request-timeline"].replaceChildren(...history.map(event => {
		const button = element("button", `request-event ${event.status}`);
		button.type = "button";
		button.disabled = busy;
		button.dataset.request = String(event.id);
		button.setAttribute("aria-pressed", String(event.id === selected));
		button.setAttribute("aria-label", `Request ${event.id} at ${formatTime(event.at)}: ${event.status}, cost ${tokenCount(event.cost)}. Inspect decision.`);
		button.append(element("span", "event-index", `#${event.id}`), element("b", "", event.allowed ? "✓" : "×"), element("span", "event-time", `${formatTokens(event.at)} s`));
		button.addEventListener("click", () => {
			selected = event.id;
			for(const item of elements["request-timeline"].children) item.setAttribute("aria-pressed", String(item === button));
			renderDecision();
		});
		return button;
	}));
	const active = elements["request-timeline"].querySelector('[aria-pressed="true"]');
	if(active)
	{
		const bounds = active.getBoundingClientRect();
		const viewport = elements["request-timeline"].getBoundingClientRect();
		if(bounds.bottom > viewport.bottom) elements["request-timeline"].scrollTop += bounds.bottom - viewport.bottom + 5;
		if(bounds.top < viewport.top) elements["request-timeline"].scrollTop -= viewport.top - bounds.top + 5;
	}
};

const render = () => {
	renderControls();
	renderBalance();
	renderSummary();
	renderTimeline();
	renderDecision();
};

const showError = error => {
	busy = true;
	stopClock();
	elements["runtime-status"].classList.add("failed");
	elements["runtime-status"].textContent = "Lean/Wasm could not complete the request";
	elements["result-title"].textContent = "The request did not complete.";
	elements["result-copy"].textContent = error instanceof Error ? error.message : String(error);
	console.error(error);
};

const advance = timestamp => {
	const result = bucket.advance(timestamp);
	now = result.timestamp;
	tokens = result.tokens;
};

const applyRequest = (timestamp, requestCost) => {
	const result = bucket.request(timestamp, requestCost * CREDITS_PER_TOKEN);
	now = result.timestamp;
	tokens = result.tokens;
	const event = { ...result, id: ++requestCount, at: timestamp, cost: requestCost * CREDITS_PER_TOKEN };
	history.push(event);
	if(history.length > HISTORY_LIMIT) history.shift();
	if(result.allowed) allowedCount++;
	else throttledCount++;
	selected = event.id;
	return event;
};

const tick = frameTime => {
	if(!playing || busy || !alive) return;
	if(!previousFrame) previousFrame = frameTime;
	frameRemainder += Math.min(100, frameTime - previousFrame);
	previousFrame = frameTime;
	if(frameRemainder >= 32)
	{
		const delta = Math.floor(frameRemainder);
		frameRemainder -= delta;
		try
		{
			let arrivals = false;
			if(example)
			{
				example.elapsed += delta;
				while(example.index < 8 && example.elapsed >= example.index * 110)
				{
					applyRequest(0, 1);
					example.index++;
					arrivals = true;
				}
				if(example.elapsed >= 880)
				{
					const target = Math.min(1000, example.elapsed - 880);
					while(example.index < EXAMPLE_REQUESTS.length && EXAMPLE_REQUESTS[example.index].timestamp <= target)
					{
						const request = EXAMPLE_REQUESTS[example.index++];
						applyRequest(request.timestamp, request.cost);
						arrivals = true;
					}
					advance(target);
				}
				if(example.index === EXAMPLE_REQUESTS.length)
				{
					example = null;
					stopClock();
					elements["scenario-copy"].textContent = "The eight-request burst passed five and throttled three. Refill admitted another request at 0.5 s and at 1 s.";
					elements["interaction-status"].textContent = "Example complete. Seven requests allowed, three throttled. The clock is paused at one second.";
				}
			}
			else advance(now + delta);
			renderBalance();
			if(arrivals)
			{
				renderSummary();
				renderTimeline();
				renderDecision();
			}
		}
		catch(error)
		{ showError(error); }
	}
	if(playing) frame = globalThis.requestAnimationFrame(tick);
};

const startClock = () => {
	if(busy || playing) return;
	playing = true;
	previousFrame = 0;
	frameRemainder = 0;
	renderControls();
	renderBalance();
	frame = globalThis.requestAnimationFrame(tick);
};

const reset = async ({ initial = false, replay = false } = {}) => {
	const currentRevision = ++revision;
	busy = true;
	stopClock();
	example = null;
	bucket?.dispose();
	bucket = undefined;
	if(initial || replay)
	{
		({ capacity, rate, cost } = EXAMPLE_CONFIG);
		elements.capacity.value = String(capacity);
		elements.rate.value = String(rate);
		elements["request-cost"].value = String(cost);
	}
	try
	{
		const created = await createBucket({ capacity: capacity * CREDITS_PER_TOKEN, rate, now: 0 });
		if(currentRevision !== revision || !alive)
		{
			created.dispose();
			return;
		}
		bucket = created;
		({ tokens, timestamp: now } = bucket.snapshot());
		history = [];
		allowedCount = 0;
		throttledCount = 0;
		requestCount = 0;
		selected = null;
		if(initial) for(const request of EXAMPLE_REQUESTS.slice(0, 8)) applyRequest(request.timestamp, request.cost);
		busy = false;
		elements["runtime-status"].classList.remove("failed");
		elements["runtime-status"].textContent = "Lean/Wasm ready · decisions checked in Lean";
		elements["scenario-copy"].textContent = initial
			? "Eight requests just arrived together at 0 s. Replay the example to watch refill admit two later arrivals."
			: replay ? "Eight requests arrive at 0 s, then one at 0.5 s and one at 1 s. The display separates simultaneous arrivals so you can inspect them."
				: `Your bucket starts full at 0 s. Each request costs ${cost} ${cost === 1 ? "token" : "tokens"}.`;
		renderScale();
		render();
		if(replay)
		{
			example = { elapsed: 0, index: 0 };
			startClock();
		}
	}
	catch(error)
	{ if(currentRevision === revision && alive) showError(error); }
};

const send = count => {
	if(busy) return;
	try
	{
		example = null;
		let passed = 0;
		for(let index = 0; index < count; index++) if(applyRequest(now, cost).allowed) passed++;
		elements["scenario-copy"].textContent = `${count === 1 ? "One request" : `A burst of ${count} requests`} at ${formatTime(now)}. ${passed} allowed, ${count - passed} throttled.`;
		elements["interaction-status"].textContent = elements["scenario-copy"].textContent;
		render();
	}
	catch(error)
	{ showError(error); }
};

elements["send-request"].addEventListener("click", () => send(1));
for(const button of globalThis.document.querySelectorAll("[data-burst]")) button.addEventListener("click", () => send(Number(button.dataset.burst)));
for(const button of globalThis.document.querySelectorAll("[data-advance]")) button.addEventListener("click", () => {
	if(busy) return;
	stopClock();
	example = null;
	try
	{
		advance(now + Number(button.dataset.advance));
		renderBalance();
		elements["interaction-status"].textContent = `Clock advanced to ${formatTime(now)}. ${tokenCount(tokens)} available.`;
	}
	catch(error)
{ showError(error); }
});
elements["play-clock"].addEventListener("click", () => {
	if(playing) stopClock();
	else startClock();
	renderBalance();
});
elements["reset-bucket"].addEventListener("click", () => void reset());
elements["replay-example"].addEventListener("click", () => void reset({ replay: true }));
for(const name of ["capacity", "rate"])
{
	elements[name].addEventListener("input", () => {
		const value = Number(elements[name].value);
		elements[`${name}-value`].textContent = name === "capacity" ? `${value} tokens` : `${value} ${value === 1 ? "token" : "tokens"} / second`;
	});
	elements[name].addEventListener("change", () => {
		capacity = Number(elements.capacity.value);
		rate = Number(elements.rate.value);
		void reset();
	});
}
elements["request-cost"].addEventListener("change", () => {
	cost = Math.min(20, Math.max(1, Math.round(Number(elements["request-cost"].value) || 1)));
	elements["request-cost"].value = String(cost);
	example = null;
});
globalThis.document.addEventListener("visibilitychange", () => {
	if(globalThis.document.hidden)
	{
		stopClock();
		renderBalance();
	}
});
globalThis.addEventListener("pagehide", () => {
	alive = false;
	busy = true;
	revision++;
	stopClock();
	bucket?.dispose();
	bucket = undefined;
});
globalThis.addEventListener("pageshow", event => {
	if(event.persisted)
	{
		alive = true;
		void reset();
	}
});

mountBenchmark();
void reset({ initial: true });
