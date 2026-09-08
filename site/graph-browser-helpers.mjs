/**
 * Share browser-only lifecycle instrumentation for the two React graph workbenches.
 *
 * @file
 */

import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";

/**
 * Wait for pending React effects and visual updates.
 *
 * @param {import('playwright').Page} page Browser page.
 */
export const settle = page => page.evaluate(() => new Promise(resolve =>
	globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));

/**
 * Wait for a result from the actual compiled solver.
 *
 * @param {import('playwright').Page} page Browser page.
 */
export const ready = page => page.waitForFunction(() =>
	globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready"), null, { timeout: 30000 });

/**
 * Track scheduled callbacks and observers without retaining disconnected DOM.
 *
 * @param {import('playwright').Page} page Browser page.
 */
export const instrumentLifecycle = page => page.addInitScript(() => {
	const frames = new Set();
	const observers = new Set();
	const request = globalThis.requestAnimationFrame.bind(globalThis);
	const cancel = globalThis.cancelAnimationFrame.bind(globalThis);
	globalThis.requestAnimationFrame = callback => {
		const id = request(time => { frames.delete(id); callback(time); });
		frames.add(id);
		return id;
	};
	globalThis.cancelAnimationFrame = id => { frames.delete(id); cancel(id); };
	for(const name of ["ResizeObserver", "IntersectionObserver"])
	{
		const Original = globalThis[name];
		globalThis[name] = new Proxy(Original, { construct: (target, args) => {
			const observer = Reflect.construct(target, args);
			const observe = observer.observe.bind(observer);
			const disconnect = observer.disconnect.bind(observer);
			observer.observe = element => { observers.add(observer); return observe(element); };
			observer.disconnect = () => { observers.delete(observer); return disconnect(); };
			return observer;
		} });
	}
	globalThis.__graphLifecycle = () => ({ frames: frames.size, observers: observers.size });
});

/**
 * Observe the actual C exports used by the unchanged runtime adapter.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {string} runtimeUrl Absolute raw runtime module URL.
 * @param {string} prefix C export namespace.
 */
export const instrumentRuntime = (page, runtimeUrl, prefix) => page.evaluate(async ({ url, name }) => {
	const runtime = await import(url);
	const module = await runtime.initRuntime();
	const handles = new Set();
	const pointers = new Set();
	const audit = { handles, pointers, prepared: 0, released: 0, invalidReleases: 0, invalidFrees: 0 };
	const prepare = module[`_lean_${name}_prepare_c`];
	const release = module[`_lean_${name}_release`];
	const malloc = module._malloc;
	const free = module._free;
	module[`_lean_${name}_prepare_c`] = (...args) => {
		const handle = prepare(...args);
		if(handle)
		{ handles.add(handle); audit.prepared++; }
		return handle;
	};
	module[`_lean_${name}_release`] = handle => {
		if(!handles.delete(handle)) audit.invalidReleases++;
		audit.released++;
		return release(handle);
	};
	module._malloc = size => {
		const pointer = malloc(size);
		if(pointer) pointers.add(pointer);
		return pointer;
	};
	module._free = pointer => {
		if(pointer && !pointers.delete(pointer)) audit.invalidFrees++;
		return free(pointer);
	};
	globalThis.__graphHandles = () => ({
		live: handles.size, allocations: pointers.size
		, prepared: audit.prepared, released: audit.released
		, invalidReleases: audit.invalidReleases, invalidFrees: audit.invalidFrees
	});
}, { url: runtimeUrl, name: prefix });

/**
 * Collect after route effects settle; return numbers, never remote DOM handles.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {import('playwright').CDPSession} cdp Chromium debugging session.
 */
export const resourceSnapshot = async (page, cdp) => {
	await settle(page);
	await cdp.send("HeapProfiler.collectGarbage");
	const dom = await cdp.send("Memory.getDOMCounters");
	return { dom, ...await page.evaluate(() => ({
		handles: globalThis.__graphHandles(), lifecycle: globalThis.__graphLifecycle()
		, attached: globalThis.document.querySelectorAll("*").length
	})) };
};

/**
 * Reject unbalanced native ownership and route-owned resource accumulation.
 *
 * @param {object} snapshot Current collected counters.
 * @param {object} [baseline] Warmed route counters.
 */
export const assertReleased = (snapshot, baseline) => {
	assert.equal(snapshot.handles.live, 0, "Unmount releases every prepared solver");
	assert.equal(snapshot.handles.allocations, 0, "Unmount releases every adapter input/output buffer");
	assert.equal(snapshot.handles.prepared, snapshot.handles.released);
	assert.equal(snapshot.handles.invalidReleases, 0, "No double or unowned handle release");
	assert.equal(snapshot.handles.invalidFrees, 0, "No double or unowned buffer free");
	if(!baseline) return;
	assert.deepEqual(snapshot.lifecycle, baseline.lifecycle, "No observer or animation-frame accumulation");
	assert.equal(snapshot.attached, baseline.attached);
	assert.equal(snapshot.dom.documents, baseline.dom.documents);
	assert.ok(snapshot.dom.nodes <= baseline.dom.nodes,
		`Collected DOM nodes do not accumulate: ${snapshot.dom.nodes} > ${baseline.dom.nodes}`);
	assert.ok(snapshot.dom.jsEventListeners <= baseline.dom.jsEventListeners,
		`Collected listeners do not accumulate: ${snapshot.dom.jsEventListeners} > ${baseline.dom.jsEventListeners}`);
};

/**
 * Use visibility events without requiring an unreliable background-tab scheduler.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {boolean} hidden Requested document visibility.
 */
export const setHidden = (page, hidden) => page.evaluate(value => {
	if(value) Object.defineProperty(globalThis.document, "hidden", { configurable: true, get: () => true });
	else delete globalThis.document.hidden;
	globalThis.document.dispatchEvent(new globalThis.Event("visibilitychange"));
}, hidden);

/**
 * Exercise the persisted page lifecycle without causing an external navigation.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {string} type Page transition event name.
 */
export const pageTransition = (page, type) => page.evaluate(name => {
	globalThis.dispatchEvent(new globalThis.PageTransitionEvent(name, { persisted: true }));
}, type);

/**
 * Exercise receipt/source parity and the unchanged five-warmup, 100-sample workload.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {string} namespace Checked Lean namespace.
 * @param {string} proof Primary Lean source filename.
 */
export const proofAndBenchmark = async (page, namespace, proof) => {
	await page.locator(".proof-section").scrollIntoViewIfNeeded();
	await page.waitForFunction(() => globalThis.document.querySelector("#audit-status")?.textContent
		=== "Source matches checked build");
	await page.waitForFunction(() => !globalThis.document.querySelector("#launch-lean-web").disabled);
	assert.equal(await page.locator("#source-label").textContent(), proof);
	for(const tab of await page.locator(".source-tab").all())
	{
		await tab.click();
		assert.equal(await page.locator("#source-label").textContent(), await tab.getAttribute("data-source"));
		assert.equal(await tab.getAttribute("aria-selected"), "true");
	}
	const source = await page.locator("[data-source-select] option").last().getAttribute("value");
	await page.locator("[data-source-select]").selectOption(source);
	assert.equal(await page.locator("#source-label").textContent(), source);
	assert.ok(await page.locator("#proof-code span").count() > 0, "Sources retain syntax highlighting");
	const payload = new URLSearchParams(new URL(await page.locator("#open-lean-web").getAttribute("href")).hash.slice(1));
	assert.match(payload.get("challenge"), /theorem solve_total[\s\S]*:= by\s+sorry/u);
	assert.ok(payload.get("code").includes(`#print axioms ${namespace}.solve_total`));
	await page.locator("#browser-benchmark").scrollIntoViewIfNeeded();
	await page.locator("[data-benchmark-cancel]").evaluate(button => { if(!button.disabled) button.click(); });
	await page.locator("[data-benchmark-run]").click();
	await pageTransition(page, "pagehide");
	await pageTransition(page, "pageshow");
	assert.equal(await page.locator("[data-benchmark-progress]").textContent(), "Cancelled");
	await page.locator("[data-benchmark-run]").click();
	await page.waitForFunction(() => /Completed|failed/u.test(globalThis.document.querySelector("[data-benchmark-progress]").textContent),
		null, { timeout: 120000 });
	assert.match(await page.locator("[data-benchmark-progress]").textContent(), /^Completed/u,
		await page.locator("[data-benchmark-summary]").textContent());
	assert.match(await page.locator("[data-benchmark-summary]").textContent(), /100/u);
	assert.equal(await page.locator(".benchmark-bar").count(), 10);
	assert.doesNotMatch(await page.locator(".browser-benchmark-metrics").textContent(), /NaN|Infinity/u);
};

/**
 * Record cold-load observations using the pre-port baseline measurement method.
 *
 * @param {import('playwright').Browser} browser Chromium browser.
 * @param {string} url Canonical workbench URL.
 */
export const measureColdPage = async (browser, url) => {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	const bodies = new Map();
	page.on("response", response => bodies.set(response.url(), response.body().then(bytes => ({ bytes }))
		.catch(error => ({ error: error.message }))));
	await page.addInitScript(() => {
		globalThis.__graphLoad = { ready: null, longTasks: [] };
		const observer = new globalThis.MutationObserver(() => {
			if(!globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready")) return;
			globalThis.__graphLoad.ready = globalThis.performance.now();
			observer.disconnect();
		});
		observer.observe(globalThis.document, { childList: true, subtree: true, characterData: true });
		new globalThis.PerformanceObserver(list => globalThis.__graphLoad.longTasks.push(...list.getEntries().map(entry => entry.duration)))
			.observe({ type: "longtask", buffered: true });
	});
	try
	{
		await page.goto(url);
		await ready(page);
		await page.waitForLoadState("networkidle");
		const resources = await Promise.all([...bodies].map(async ([resourceUrl, pending]) => {
			const { bytes, error } = await pending;
			assert.equal(error, undefined, `${resourceUrl}: resource body must be readable`);
			return {
				bytes: bytes.length
				, wasm: resourceUrl.endsWith(".wasm") ? bytes.length : 0
				, gzip: /\.m?js(?:\?|$)/u.test(resourceUrl) ? gzipSync(bytes, { level: 9 }).length : 0 };
		}));
		assert.equal([...bodies.keys()].some(resource => resource.includes("benchmark-workload")), false);
		return {
			resourceBytes: resources.reduce((sum, resource) => sum + resource.bytes, 0)
			, estimatedGzipJavascriptBytes: resources.reduce((sum, resource) => sum + resource.gzip, 0)
			, wasmBytes: resources.reduce((sum, resource) => sum + resource.wasm, 0)
			, ...await page.evaluate(() => ({
				wasmReadyMs: globalThis.__graphLoad.ready
				, domContentLoadedMs: globalThis.performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd
				, longTaskCount: globalThis.__graphLoad.longTasks.length
				, longTaskMs: globalThis.__graphLoad.longTasks.reduce((sum, value) => sum + value, 0)
			}))
		};
	}
	finally
	{ await page.close(); }
};
