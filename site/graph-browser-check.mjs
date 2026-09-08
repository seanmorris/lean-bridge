/**
 * Audit React Sweep/Dinic editing, route state, runtime ownership, proof and benchmark parity.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
	assertReleased, instrumentLifecycle, instrumentRuntime, measureColdPage, pageTransition
	, proofAndBenchmark, ready, resourceSnapshot, setHidden, settle
} from "./graph-browser-helpers.mjs";

const base = new URL(process.env.SITE_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:8765/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const docs = new URL("docs/", base).href;
const executablePath = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const configurations = [
	{ slug: "lean-sweep-and-prune", prefix: "sweep"
		, namespace: "LeanSweep", proof: "Sweep.lean"
		, root: "#scene" }
	, { slug: "lean-dinic", prefix: "dinic"
		, namespace: "LeanDinic", proof: "Dinic.lean"
		, root: "#network-canvas" }
];
const selectedConfigurations = configurations.filter(entry => !process.env.GRAPH_DEMOS
	|| process.env.GRAPH_DEMOS.split(",").includes(entry.prefix));
assert.ok(selectedConfigurations.length > 0, "Select sweep, dinic, or both graph checks");
const report = {
	createdAt: new Date().toISOString(), base: base.pathname, status: "running"
	, method: "Cold isolated Chromium pages, 1440x1000, reduced motion; decoded resource bytes and per-file gzip level 9. Timings are observations. Route resource gates compare collected DOM/listeners after 3 warmup and 6 measured visits."
	, pages: [], lifecycles: []
};
const reportVariant = process.env.GRAPH_AUDIT_VARIANT ?? (base.pathname === "/" ? "root" : "prefixed");
assert.match(reportVariant, /^[a-z0-9-]+$/u, "Report variant must name one audit directory");
const reportRoot = resolve("build/react-site-audit", reportVariant);
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });

const positions = page => page.locator(".body").evaluateAll(nodes => nodes.map(node => node.getAttribute("transform")));
const frame = page => page.locator("#frame-number").textContent();
const toDocs = async page => {
	await page.locator(".site-links a").filter({ hasText: /^Docs$/u }).click();
	await page.waitForURL(docs);
	await page.locator(".docs-layout").waitFor();
	await settle(page);
};
const returnToDemo = async (page, url) => {
	await page.goBack();
	await page.waitForURL(url);
	await ready(page);
	await settle(page);
};

/**
 * Edits survive client navigation but not a full document reload.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {string} url Canonical workbench URL.
 */
const sweepState = async (page, url) => {
	assert.equal(await page.locator("#candidate-count").textContent(), "2");
	assert.equal(await page.locator("#overlap-count").textContent(), "1");
	await page.locator("#scene-seed").fill("2026");
	await page.locator("#body-count").selectOption("12");
	await page.locator("#new-scene").click();
	await page.waitForFunction(() => globalThis.document.querySelector("#all-count").textContent === "66");
	await page.locator('[data-axis="1"]').click();
	await page.locator("#selected-body").selectOption("3");
	await page.locator('[data-nudge="right"]').click();
	await ready(page);
	await settle(page);
	const edited = await positions(page);
	await toDocs(page);
	await returnToDemo(page, url);
	assert.deepEqual(await positions(page), edited);
	assert.equal(await page.locator("#scene-seed").inputValue(), "2026");
	assert.equal(await page.locator("#body-count").inputValue(), "12");
	assert.equal(await page.locator("#selected-body").inputValue(), "3");
	assert.equal(await page.locator('[data-axis="1"]').getAttribute("aria-pressed"), "true");
	assert.match(await page.locator("#toggle-motion").textContent(), /Play/u);
	await page.locator("#toggle-motion").click();
	const running = await frame(page);
	await page.waitForFunction(previous => globalThis.document.querySelector("#frame-number").textContent !== previous, running);
	await setHidden(page, true);
	await settle(page);
	const hidden = await frame(page);
	await page.waitForTimeout(120);
	assert.equal(await frame(page), hidden, "Hidden Sweep work does not continue");
	await setHidden(page, false);
	await page.locator("#scene").scrollIntoViewIfNeeded();
	await page.waitForFunction(previous => globalThis.document.querySelector("#frame-number").textContent !== previous, hidden);
	await toDocs(page);
	await returnToDemo(page, url);
	assert.match(await page.locator("#toggle-motion").textContent(), /Play/u, "Returning does not restart an abandoned simulation");
	await pageTransition(page, "pagehide");
	await pageTransition(page, "pageshow");
	const restored = await frame(page);
	await page.locator("#step-motion").click();
	await page.waitForFunction(previous => globalThis.document.querySelector("#frame-number").textContent !== previous, restored);
};

/**
 * Check capacity editing through pointer selection, number entry, and range keys.
 *
 * @param {import('playwright').Page} page Browser page.
 * @param {string} url Canonical workbench URL.
 */
const dinicState = async (page, url) => {
	assert.equal(await page.locator("#flow-value").textContent(), "9");
	assert.equal(await page.locator("#cut-value").textContent(), "9");
	await page.locator("#widen-bottleneck").click();
	await page.waitForFunction(() => globalThis.document.querySelector("#flow-value").textContent === "14");
	await page.locator('button[data-edge="c-sink"]').click();
	await page.locator("#edge-capacity").fill("7");
	await page.locator("#edge-capacity").press("Tab");
	await page.waitForFunction(() => globalThis.document.querySelector("#flow-value").textContent === "12");
	await page.locator("#capacity-slider").focus();
	await page.keyboard.press("ArrowLeft");
	await page.waitForFunction(() => globalThis.document.querySelector("#flow-value").textContent === "11");
	await toDocs(page);
	await returnToDemo(page, url);
	assert.equal(await page.locator("#edge-capacity").inputValue(), "6");
	assert.equal(await page.locator("#flow-value").textContent(), "11");
	assert.match(await page.locator("#edge-title").textContent(), /C.*Sink/u);
	assert.equal(await page.locator("#network-svg").evaluate(svg => svg.animationsPaused()), true, "Explicit reduced-motion pause survives navigation");
	await page.locator("#toggle-motion").click();
	await setHidden(page, true);
	await settle(page);
	assert.equal(await page.locator("#network-svg").evaluate(svg => svg.animationsPaused()), true);
	await setHidden(page, false);
	await page.waitForFunction(() => !globalThis.document.querySelector("#network-svg").animationsPaused());
	await pageTransition(page, "pagehide");
	assert.equal(await page.locator("#network-svg").evaluate(svg => svg.animationsPaused()), true);
	await pageTransition(page, "pageshow");
	await page.locator("#edge-capacity").fill("5");
	await page.locator("#edge-capacity").press("Tab");
	await page.waitForFunction(() => globalThis.document.querySelector("#flow-value").textContent === "10");
	await toDocs(page);
	await returnToDemo(page, url);
	assert.equal(await page.locator("#edge-capacity").inputValue(), "5");
	await page.locator("#reset-network").click();
	await page.waitForFunction(() => globalThis.document.querySelector("#flow-value").textContent === "9");
};

/**
 * A late dynamic runtime import cannot revive an unmounted workbench.
 *
 * @param {object} configuration Canonical workbench metadata.
 */
const pendingNavigation = async configuration => {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	const url = new URL(`demos/${configuration.slug}/`, base).href;
	let release;
	const held = new Promise(resolveHeld => { release = resolveHeld; });
	const runtimeUrl = new URL(`${configuration.slug}/runtime.mjs`, base).href;
	const requested = page.waitForRequest(runtimeUrl, { timeout: 30000 });
	await page.route(runtimeUrl, async route => {
		await held;
		try
		{ await route.continue(); }
		catch
		{ return; }
	});
	try
	{
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await requested;
		await toDocs(page);
		release();
		await settle(page);
		assert.equal(await page.locator(configuration.root).count(), 0);
		await returnToDemo(page, url);
		assert.deepEqual(errors, []);
	}
	finally
	{ release(); await page.close(); }
};

/** A native mobile link tap and slider gesture must edit the real flow result. */
const dinicTouch = async () => {
	const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
	try
	{
		await page.goto(new URL("demos/lean-dinic/", base).href);
		await ready(page);
		await page.locator('button[data-edge="d-sink"]').tap();
		assert.match(await page.locator("#edge-title").textContent(), /D.*Sink/u);
		const slider = page.locator("#capacity-slider");
		await slider.scrollIntoViewIfNeeded();
		const bounds = await slider.boundingBox();
		const cdp = await page.context().newCDPSession(page);
		try
		{
			const y = bounds.y + bounds.height / 2;
			await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: bounds.x + bounds.width / 4, y }] });
			await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: bounds.x + bounds.width * .6, y }] });
			await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
			await page.waitForFunction(() => globalThis.document.querySelector("#capacity-slider").value !== "5");
			await ready(page);
			assert.equal(await page.locator("#flow-value").textContent(), await page.locator("#cut-value").textContent());
		}
		finally
		{ await cdp.detach(); }
	}
	finally
	{ await page.close(); }
};

const auditRoute = async configuration => {
	const url = new URL(`demos/${configuration.slug}/`, base).href;
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	const errors = [];
	const requests = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("request", request => requests.push(request.url()));
	await instrumentLifecycle(page);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("HeapProfiler.enable");
	try
	{
		await page.goto(url);
		await ready(page);
		assert.equal(requests.some(request => request.endsWith(".lean")), false, "Proof sources load only when viewed");
		assert.equal(requests.some(request => request.includes("benchmark-workload")), false, "Benchmark imports stay offscreen");
		await instrumentRuntime(page, new URL(`${configuration.slug}/runtime.mjs`, base).href, configuration.prefix);
		await page.evaluate(() => { globalThis.__graphDocument = "same-document"; });
		if(configuration.prefix === "sweep") await sweepState(page, url);
		else await dinicState(page, url);
		await proofAndBenchmark(page, configuration.namespace, configuration.proof);
		await toDocs(page);
		for(let index = 0; index < 3; index++)
		{ await returnToDemo(page, url); await toDocs(page); }
		const baseline = await resourceSnapshot(page, cdp);
		const snapshots = [baseline];
		report.lifecycles.push({ slug: configuration.slug, snapshots });
		assertReleased(baseline);
		for(let index = 0; index < 6; index++)
		{
			await returnToDemo(page, url);
			if(configuration.prefix === "sweep") await page.locator("#step-motion").click();
			else
			{
				await page.locator("#edge-capacity").fill(String(index + 2));
				await page.locator("#edge-capacity").press("Tab");
			}
			await toDocs(page);
			const current = await resourceSnapshot(page, cdp);
			snapshots.push(current);
			assertReleased(current, baseline);
			assert.equal(await page.evaluate(() => globalThis.__graphDocument), "same-document");
		}
		await returnToDemo(page, url);
		await page.reload();
		await ready(page);
		assert.equal(await page.evaluate(() => globalThis.__graphDocument), undefined, "Reload creates a fresh state store");
		if(configuration.prefix === "sweep")
		{
			assert.equal(await page.locator("#all-count").textContent(), "15");
			assert.equal(await page.locator("#candidate-count").textContent(), "2");
			assert.equal(await page.locator("#overlap-count").textContent(), "1");
		}
		else assert.equal(await page.locator("#flow-value").textContent(), "9");
		assert.deepEqual(errors, []);
		console.log(`PASS React ${configuration.slug}: state restoration, visibility/BFCache, proof, 100 samples, 6 balanced route lifetimes, reload reset`);
	}
	catch(error)
	{
		const status = await page.locator("#runtime-status").count()
			? await page.locator("#runtime-status").textContent() : "unmounted";
		throw new Error(`${configuration.slug}: ${error.message}; URL=${page.url()}; runtime=${status}; errors=${JSON.stringify(errors)}`, { cause: error });
	}
	finally
	{ await cdp.detach(); await page.close(); }
};

try
{
	try
	{ report.baseline = JSON.parse(await readFile(resolve("build/react-graph-audit-baseline.json"), "utf8")); }
	catch(error)
	{ if(error.code !== "ENOENT") throw error; report.baseline = null; }
	for(const configuration of selectedConfigurations)
	{
		report.pages.push({ slug: configuration.slug
			, ...await measureColdPage(browser, new URL(`demos/${configuration.slug}/`, base).href) });
		await pendingNavigation(configuration);
		await auditRoute(configuration);
	}
	if(!process.env.GRAPH_DEMOS || process.env.GRAPH_DEMOS.split(",").includes("dinic")) await dinicTouch();
	report.status = "passed";
	console.log("PASS React graph ports: pending imports retire safely and touch capacity editing reaches Lean");
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
	await writeFile(resolve(reportRoot, "graphs.json"), `${JSON.stringify(report, null, 2)}\n`);
	await browser.close();
}
