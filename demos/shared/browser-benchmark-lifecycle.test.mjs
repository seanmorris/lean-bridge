/**
 * Exercises controller disposal without retaining DOM listeners or queued frames.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { attachBrowserBenchmark } from "./browser-benchmark.mjs";

const browserFixture = context => {
	const events = new Map();
	const frames = new Map();
	const observers = [];
	let handle = 0;
	const element = () => {
		const listeners = new Map();
		return {
			textContent: "unchanged", disabled: false, clientWidth: 600, listeners
			, addEventListener: (name, fn) => listeners.set(name, fn)
			, removeEventListener: name => listeners.delete(name)
			, setAttribute: () => undefined, replaceChildren: () => undefined
			, append: () => undefined
		};
	};
	const elements = new Map();
	const root = { querySelector: selector => {
		if(!elements.has(selector)) elements.set(selector, element());
		return elements.get(selector);
	} };
	/** Track subscriptions while leaving visibility under test control. */
	class Observer
	{
		/**
		 * Capture an observable callback for lifecycle assertions.
		 *
		 * @param callback Observer callback retained for assertions.
		 * @param options Visibility threshold and margins.
		 */
		constructor(callback, options) { this.callback = callback; this.options = options; this.connected = false; observers.push(this); }
		/**
		 * Record a live subscription.
		 *
		 * @param target Element being observed.
		 */
		observe(target) { this.connected = true; this.target = target; }
		/** Record release of the subscription. */
		disconnect() { this.connected = false; }
	}
	const globals = {
		document: {
			createElementNS: element, hidden: false
			, addEventListener: (name, fn) => events.set(name, fn)
			, removeEventListener: name => events.delete(name)
		}
		, ResizeObserver: Observer
		, IntersectionObserver: Observer
		, innerWidth: 1440, innerHeight: 1000
		, requestAnimationFrame: callback => { frames.set(++handle, callback); return handle; }
		, cancelAnimationFrame: id => frames.delete(id)
		, addEventListener: (name, fn) => events.set(name, fn)
		, removeEventListener: name => events.delete(name)
	};
	for(const [name, value] of Object.entries(globals))
	{
		const original = Object.getOwnPropertyDescriptor(globalThis, name);
		Object.defineProperty(globalThis, name, { configurable: true, value });
		context.after(() => {
			if(original) Object.defineProperty(globalThis, name, original);
			else Reflect.deleteProperty(globalThis, name);
		});
	}
	const intersect = ratio => observers.find(observer => observer.target === root).callback([
		{ target: root, isIntersecting: ratio > 0, intersectionRatio: ratio }
	]);
	const nextFrame = async () => {
		const callbacks = [...frames.values()];
		frames.clear();
		for(const callback of callbacks) callback();
		await new Promise(resolve => setImmediate(resolve));
	};
	return { root, elements, events, frames, observers, intersect, nextFrame };
};

test("disposing a benchmark cancels pending frames and removes every owner callback", async context => {
	const browser = browserFixture(context);
	let samples = 0;
	const controller = attachBrowserBenchmark({
		root: browser.root
		, prepare: async () => undefined
		, warmupCount: 2
		, trialCount: 1
		, sample: () => { samples++; return { leanMs: 1, javascriptMs: 1 }; }
		, summarize: () => { throw new Error("Disposed runs must not summarize"); }
	});
	browser.intersect(1);
	const running = controller.run();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(samples, 1);
	assert.equal(browser.frames.size, 1);
	controller.dispose();
	controller.dispose();
	await running;
	assert.equal(browser.frames.size, 0);
	assert.equal(browser.events.size, 0);
	assert.ok(browser.observers.every(observer => !observer.connected));
	assert.ok([...browser.elements.values()].every(element => element.listeners.size === 0));
	await controller.run();
	assert.equal(samples, 1);
});

test("disposal before deferred preparation avoids creating an orphaned solver", async context => {
	const browser = browserFixture(context);
	let preparations = 0;
	const controller = attachBrowserBenchmark({
		root: browser.root, prepare: async () => { preparations++; }
		, sample: () => { throw new Error("Disposed runs must not sample"); }
		, summarize: () => ""
	});
	browser.intersect(1);
	const running = controller.run();
	controller.dispose();
	await running;
	assert.equal(preparations, 0);
});

test("disposed preparation settlement cannot update the retired scaffold", async context => {
	const browser = browserFixture(context);
	let finish;
	const pending = new Promise(resolve => { finish = resolve; });
	const controller = attachBrowserBenchmark({
		root: browser.root, prepare: () => pending
		, sample: () => { throw new Error("Disposed runs must not sample"); }
		, summarize: () => ""
	});
	browser.intersect(1);
	const running = controller.run();
	await new Promise(resolve => setImmediate(resolve));
	controller.dispose();
	finish();
	await running;
	assert.equal(browser.elements.get("[data-benchmark-progress]").textContent, "Cancelled");
	assert.equal(browser.elements.get("[data-benchmark-summary]").textContent, "unchanged");
});

test("visibility and demo readiness both gate automatic preparation and warmups", async context => {
	const browser = browserFixture(context);
	let ready = false;
	let preparations = 0;
	const samples = [];
	const controller = attachBrowserBenchmark({
		root: browser.root
		, canRun: () => ready
		, prepare: async () => { preparations++; }
		, warmupCount: 1, trialCount: 1
		, sample: (index, warmup) => { samples.push({ index, warmup }); return { leanMs: 1, javascriptMs: 1 }; }
		, summarize: () => "Complete"
	});
	try
	{
		const observer = browser.observers.find(observer => observer.target === browser.root);
		assert.deepEqual(observer.options, { rootMargin: "0px", threshold: .05 });
		controller.refresh();
		browser.intersect(.01);
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(preparations, 0);
		assert.deepEqual(samples, []);
		browser.intersect(.5);
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(preparations, 0);
		assert.equal(browser.elements.get("[data-benchmark-progress]").textContent, "Waiting for demo to settle");
		assert.equal(browser.frames.size, 0, "Waiting uses notifications, not a polling animation loop");
		ready = true;
		controller.refresh();
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(preparations, 1);
		assert.deepEqual(samples, [{ index: 0, warmup: true }]);
		await browser.nextFrame();
		assert.deepEqual(samples, [{ index: 0, warmup: true }, { index: 0, warmup: false }]);
		assert.match(browser.elements.get("[data-benchmark-progress]").textContent, /^Completed/u);
		browser.intersect(0);
		browser.intersect(1);
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(preparations, 1, "A completed benchmark does not restart on scrolling");
	}
	finally
	{ controller.dispose(); }
});

test("editing, scrolling away, and hidden tabs suspend work and restart with fresh warmups", async context => {
	for(const reason of ["demo", "viewport", "tab"])
		await context.test(reason, async context => {
			const browser = browserFixture(context);
			let ready = true;
			let finishSample;
			const pending = new Promise(resolve => { finishSample = resolve; });
			const samples = [];
			let measured = 0;
			let summary;
			const controller = attachBrowserBenchmark({
				root: browser.root, canRun: () => ready, prepare: async () => {}
				, warmupCount: 1, trialCount: 1
				, sample: (index, warmup) => {
					samples.push({ index, warmup });
					if(!warmup && measured++ === 0) return pending;
					return { leanMs: 1, javascriptMs: 1 };
				}
				, summarize: result => { summary = result; return "Complete"; }
			});
			try
			{
				browser.intersect(1);
				await new Promise(resolve => setImmediate(resolve));
				await browser.nextFrame();
				assert.equal(samples.length, 2);
				if(reason === "demo")
				{ ready = false; controller.refresh(); }
				if(reason === "viewport") browser.intersect(0);
				if(reason === "tab")
				{ globalThis.document.hidden = true; browser.events.get("visibilitychange")(); }
				finishSample({ leanMs: 99, javascriptMs: 99 });
				await new Promise(resolve => setImmediate(resolve));
				assert.equal(samples.length, 2);
				assert.equal(browser.frames.size, 0);
				assert.match(browser.elements.get("[data-benchmark-progress]").textContent, /^Waiting/u);
				if(reason === "demo")
				{ ready = true; controller.refresh(); }
				if(reason === "viewport") browser.intersect(1);
				if(reason === "tab")
				{ globalThis.document.hidden = false; browser.events.get("visibilitychange")(); }
				await new Promise(resolve => setImmediate(resolve));
				await browser.nextFrame();
				assert.deepEqual(samples.map(sample => sample.warmup), [true, false, true, false]);
				assert.deepEqual(summary.samples, [{ leanMs: 1, javascriptMs: 1 }], "Interrupted measurements are discarded");
			}
			finally
			{ controller.dispose(); }
		});
});

test("cancelling or disposing a waiting run prevents later readiness from starting it", async context => {
	for(const action of ["cancel", "dispose"])
		await context.test(action, async context => {
			const browser = browserFixture(context);
			let ready = false;
			let preparations = 0;
			const controller = attachBrowserBenchmark({
				root: browser.root
				, canRun: () => ready
				, prepare: async () => { preparations++; }
				, sample: () => { throw new Error("A cancelled waiter must not sample"); }
				, summarize: () => ""
			});
			browser.intersect(1);
			const waiting = controller.run();
			controller[action]();
			await waiting;
			ready = true;
			controller.refresh();
			browser.intersect(0);
			browser.intersect(1);
			await new Promise(resolve => setImmediate(resolve));
			assert.equal(preparations, 0);
			controller.dispose();
			assert.equal(browser.events.size, 0);
			assert.equal(browser.frames.size, 0);
			assert.ok(browser.observers.every(observer => !observer.connected));
		});
});

test("the no-IntersectionObserver fallback remains lazy and releases its scroll listeners", async context => {
	const browser = browserFixture(context);
	Reflect.deleteProperty(globalThis, "IntersectionObserver");
	let top = 1200;
	browser.root.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 600, width: 600, height: 100 });
	let preparations = 0;
	const controller = attachBrowserBenchmark({
		root: browser.root
		, prepare: async () => { preparations++; }
		, warmupCount: 0
		, trialCount: 1
		, sample: () => ({ leanMs: 1, javascriptMs: 1 }), summarize: () => "Complete"
	});
	try
	{
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(preparations, 0);
		top = 900;
		browser.events.get("scroll")();
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(preparations, 1);
		assert.match(browser.elements.get("[data-benchmark-progress]").textContent, /^Completed/u);
	}
	finally
	{ controller.dispose(); }
	assert.equal(browser.events.size, 0);
});
