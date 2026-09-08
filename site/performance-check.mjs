/**
 * Record cold-load costs and audit retained resources across Myers route visits.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? process.env.SITE_BASE_URL ?? "http://127.0.0.1:8765/build/github-pages/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const demo = new URL("demos/lean-myers/", base).href;
const docs = new URL("docs/", base).href;
const reportRoot = resolve("build/react-site-audit", base.pathname === "/" ? "root" : "prefixed");
const output = resolve(reportRoot, "performance.json");
const viewport = { width: 1440, height: 1000 };
let executablePath = process.env.CHROMIUM_PATH;
if(!executablePath)
{
	try
	{ await access("/usr/bin/chromium"); executablePath = "/usr/bin/chromium"; }
	catch
	{ executablePath = chromium.executablePath(); }
}
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const report = {
	schemaVersion: 1, capturedAt: new Date().toISOString()
	, base: base.pathname, status: "running"
	, browser: browser.version(), viewport
	, method: "Each cold page uses a fresh Chromium context. Actual decoded response bodies are summed once per URL; JavaScript gzip estimates sum per-file gzip level 9 sizes. Timings use the browser navigation clock. Long tasks use PerformanceObserver. Load and heap measurements are observations, not cross-machine performance gates."
	, moduleCachePolicy: "Myers keeps one imported runtime module and initialized Wasm instance per browser document. Route departure releases prepared solver handles, editor listeners, observers, and timers. The runtime module and Wasm linear memory remain cached for return visits; full reload creates a new document."
	, benchmark: "The existing five-warmup, 100-sample Lean/JavaScript workload is unchanged and is checked by the integration suite. This audit leaves its section offscreen and does not run it."
	, pages: [], memory: { snapshots: [] }
};

/**
 * Wait until the real compiled solver has supplied the current comparison.
 *
 * @param {import('playwright').Page} page Browser page.
 */
const ready = page => page.waitForFunction(() => globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready"));

/**
 * Let effects and animation-frame callbacks settle before forcing collection.
 *
 * @param {import('playwright').Page} page Browser page.
 */
const settle = page => page.evaluate(() => new Promise(resolveFrame => {
	globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolveFrame));
}));

/**
 * Measure fetched bytes and initial readiness without scrolling toward the benchmark.
 *
 * @param {string} path Canonical path relative to the configured artifact root.
 * @param {boolean} hasWasm Whether this page must solve a real Myers comparison.
 */
const measurePage = async (path, hasWasm) => {
	const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
	const page = await context.newPage();
	const bodies = new Map();
	const requests = [];
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("request", request => requests.push(request.url()));
	page.on("response", response => {
		bodies.set(response.url(), response.body().then(bytes => ({ bytes, error: null }), error => ({ bytes: null, error: error.message })));
	});
	await page.addInitScript(() => {
		globalThis.__sitePerformance = { wasmReadyMs: null, longTasks: [] };
		if(globalThis.PerformanceObserver.supportedEntryTypes.includes("longtask"))
			new globalThis.PerformanceObserver(list => {
				globalThis.__sitePerformance.longTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration })));
			}).observe({ type: "longtask", buffered: true });
		const observer = new globalThis.MutationObserver(() => {
			if(!globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready")) return;
			globalThis.__sitePerformance.wasmReadyMs = globalThis.performance.now();
			observer.disconnect();
		});
		observer.observe(globalThis.document, { childList: true, subtree: true, characterData: true });
	});
	try
	{
		await page.goto(new URL(path, base).href);
		await page.waitForFunction(() => globalThis.performance.getEntriesByName("site-hydrated").length > 0);
		if(hasWasm) await ready(page);
		await page.waitForLoadState("networkidle");
		await settle(page);
		assert.deepEqual(errors, [], `${path}: no browser errors`);
		assert.equal(requests.some(url => url.includes("benchmark-workload")), false, `${path}: no offscreen benchmark import`);
		const resources = await Promise.all([...bodies].map(async ([url, body]) => {
			const { bytes, error } = await body;
			assert.equal(error, null, `${url}: response body must be readable`);
			return {
				path: new URL(url).pathname, bytes: bytes.length
					, javascript: /\.(?:m?js)(?:\?|$)/u.test(url)
					, wasm: /\.wasm(?:\?|$)/u.test(url)
				, gzipBytes: /\.(?:m?js)(?:\?|$)/u.test(url) ? gzipSync(bytes, { level: 9 }).length : null
			};
		}));
		const timing = await page.evaluate(() => {
			const navigation = globalThis.performance.getEntriesByType("navigation")[0];
			const state = globalThis.__sitePerformance;
			return {
				wasmReadyMs: state.wasmReadyMs
				, hydratedMs: globalThis.performance.getEntriesByName("site-hydrated")[0].startTime
				, domContentLoadedMs: navigation.domContentLoadedEventEnd
				, loadMs: navigation.loadEventEnd
				, longTaskCount: state.longTasks.length
				, longTaskMs: state.longTasks.reduce((sum, task) => sum + task.duration, 0)
				, longTasks: state.longTasks
			};
		});
		assert.equal(timing.wasmReadyMs !== null, hasWasm, `${path}: readiness must reflect the actual solver`);
		if(!hasWasm) assert.equal(resources.some(resource => resource.wasm), false, `${path}: no prose Wasm`);
		if(hasWasm) assert.equal(await page.locator("[data-benchmark-progress]").textContent(), "Waiting to enter view");
		report.pages.push({
			path: `/${path}`
			, ...timing
			, javascriptBytes: resources.filter(resource => resource.javascript).reduce((sum, resource) => sum + resource.bytes, 0)
			, estimatedGzipJavascriptBytes: resources.reduce((sum, resource) => sum + (resource.gzipBytes ?? 0), 0)
			, resourceBytes: resources.reduce((sum, resource) => sum + resource.bytes, 0)
			, wasmBytes: resources.filter(resource => resource.wasm).reduce((sum, resource) => sum + resource.bytes, 0)
			, resources
		});
	}
	finally
	{ await context.close(); }
};

/**
 * Audit document-scoped caches and route-owned resources after twelve return visits.
 */
const measureMemory = async () => {
	const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
	const page = await context.newPage();
	const requests = [];
	const errors = [];
	page.on("request", request => requests.push(request.url()));
	page.on("pageerror", error => errors.push(error.message));
	const cdp = await context.newCDPSession(page);
	await cdp.send("HeapProfiler.enable");
	try
	{
		await page.goto(demo);
		await ready(page);
		await page.waitForLoadState("networkidle");
		await page.evaluate(async runtimeUrl => {
			const runtime = await import(runtimeUrl);
			const module = await runtime.initRuntime();
			const live = new Set();
			const prepare = module._lean_myers_prepare_c;
			const release = module._lean_myers_release;
			const audit = { live, prepared: 0, released: 0, invalidReleases: 0, module, marker: "same-document" };
			module._lean_myers_prepare_c = (...args) => {
				const handle = prepare(...args);
				if(handle)
				{ live.add(handle); audit.prepared++; }
				return handle;
			};
			module._lean_myers_release = handle => {
				if(!live.delete(handle)) audit.invalidReleases++;
				audit.released++;
				return release(handle);
			};
			globalThis.__myersResourceAudit = audit;
		}, new URL("lean-myers/runtime.mjs", base).href);
		const leave = async () => {
			assert.equal(await page.locator("[data-benchmark-progress]").textContent(), "Waiting to enter view");
			await page.locator(".site-links a").filter({ hasText: /^Docs$/u }).click();
			await page.waitForURL(docs);
			await page.locator(".docs-layout").waitFor();
			await settle(page);
			assert.equal(await page.locator("#before-text").count(), 0, "The editor DOM leaves with its route");
			assert.equal(await page.evaluate(() => globalThis.__myersResourceAudit.live.size), 0, "No prepared handles remain on Docs");
		};
		const returnToDemo = async () => {
			await page.goBack();
			await page.waitForURL(demo);
			await ready(page);
			assert.equal(await page.evaluate(() => globalThis.__myersResourceAudit.marker), "same-document", "Visits must use client navigation");
		};
		const snapshot = async label => {
			await settle(page);
			await cdp.send("HeapProfiler.collectGarbage");
			const heap = await cdp.send("Runtime.getHeapUsage");
			const dom = await cdp.send("Memory.getDOMCounters");
			const handles = await page.evaluate(() => {
				const audit = globalThis.__myersResourceAudit;
				return {
						livePreparedHandles: audit.live.size
						, prepared: audit.prepared, released: audit.released
						, invalidReleases: audit.invalidReleases
						, wasmLinearMemoryBytes: audit.module.HEAPU8.buffer.byteLength
					, attachedElements: globalThis.document.querySelectorAll("*").length
				};
			});
			const result = { label, heap, dom, ...handles };
			report.memory.snapshots.push(result);
			return result;
		};
		// Warm both route trees and cached data before comparing retained resources.
		await leave();
		for(let index = 0; index < 3; index++)
		{ await returnToDemo(); await leave(); }
		await page.waitForLoadState("networkidle");
		const baseline = await snapshot("warmed-docs-baseline");
		for(let cycle = 1; cycle <= 12; cycle++)
		{
			await returnToDemo();
			await leave();
			const current = await snapshot(`docs-after-cycle-${cycle}`);
			assert.equal(current.livePreparedHandles, 0);
			assert.equal(current.prepared, current.released, "Every prepared Wasm handle has one release");
			assert.equal(current.invalidReleases, 0, "No double or unowned releases");
			assert.equal(current.attachedElements, baseline.attachedElements, "Attached Docs DOM stays constant");
			assert.equal(current.dom.documents, baseline.dom.documents, "No extra browser documents remain");
			assert.ok(current.dom.nodes <= baseline.dom.nodes, "Collected DOM nodes do not accumulate across routes");
			assert.ok(current.dom.jsEventListeners <= baseline.dom.jsEventListeners, "Event listeners do not accumulate across routes");
		}
		const last = report.memory.snapshots.at(-1);
		assert.equal(requests.some(url => url.includes("benchmark-workload")), false, "Offscreen benchmark never imports its workload");
		assert.deepEqual(errors, []);
		report.memory = {
			...report.memory, warmupCycles: 3, measuredCycles: 12
			, usedHeapDeltaBytes: last.heap.usedSize - baseline.heap.usedSize
			, totalHeapDeltaBytes: last.heap.totalSize - baseline.heap.totalSize
			, domNodeDelta: last.dom.nodes - baseline.dom.nodes
			, listenerDelta: last.dom.jsEventListeners - baseline.dom.jsEventListeners
			, offscreenBenchmarkRequests: 0
			, heapScope: "CDP reports collected JavaScript heap and backing storage. Wasm linear memory is reported separately and intentionally stays cached. Heap byte deltas are observations; the gate checks balanced handles, stable DOM, and stable listener counts."
		};
	}
	finally
	{ await cdp.detach(); await context.close(); }
};

try
{
	report.buildIdentity = await fetch(new URL("build-identity.json", base)).then(response => response.json());
	try
	{ report.baseline = JSON.parse(await readFile(resolve("build/react-site-audit-baseline.json"), "utf8")); }
	catch(error)
	{ if(error.code !== "ENOENT") throw error; report.baseline = null; }
	await measurePage("", false);
	await measurePage("demos/lean-myers/", true);
	await measureMemory();
	report.status = "passed";
	console.log(`PASS React performance: cold-load bytes and timing recorded; 12 route cycles release all handles with stable DOM/listeners and no offscreen benchmark. Report: ${output}`);
}
catch(error)
{
	report.status = "failed";
	report.error = error.stack;
	throw error;
}
finally
{
	await mkdir(reportRoot, { recursive: true });
	await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
	await browser.close();
}
