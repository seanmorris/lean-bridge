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
		 */
		constructor(callback) { this.callback = callback; this.connected = false; observers.push(this); }
		/** Record a live subscription. */
		observe() { this.connected = true; }
		/** Record release of the subscription. */
		disconnect() { this.connected = false; }
	}
	const globals = {
		document: { createElementNS: element }
		, ResizeObserver: Observer
		, IntersectionObserver: Observer
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
	return { root, elements, events, frames, observers };
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
	const running = controller.run();
	await new Promise(resolve => setImmediate(resolve));
	controller.dispose();
	finish();
	await running;
	assert.equal(browser.elements.get("[data-benchmark-progress]").textContent, "Cancelled");
	assert.equal(browser.elements.get("[data-benchmark-summary]").textContent, "unchanged");
});
