/**
 * Check gallery app edge cases using real Wasm while excluding benchmark timing.
 *
 * Run: node demos/interaction-check.mjs [gallery base URL].
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:8765/demos/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
const errors = [];
const open = async slug => {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	page.on("pageerror", error => errors.push(`${slug}: ${error.message}`));
	await page.route("**/browser-benchmark.mjs", route => route.fulfill({
		contentType: "text/javascript"
		, body: "export const mountBenchmark=()=>({});export const attachBrowserBenchmark=()=>({});export const measureSyncBenchmark=()=>({});"
	}));
	await page.goto(new URL(`${slug}/`, base.endsWith("/") ? base : `${base}/`).href);
	return page;
};
try
{
	const union = await open("lean-union-find");
	await union.waitForFunction(() => globalThis.document.querySelector("#runtime-status").textContent.includes("ready"));
	await union.locator("#tool-wall").click();
	await union.locator(".site").evaluateAll(cells => {
		for(const cell of cells) cell.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: " ", bubbles: true }));
	});
	await union.waitForFunction(() => globalThis.document.querySelector("#density").textContent === "0.0%");
	assert.equal(await union.locator("#run").isDisabled(), true);
	await union.locator("#tool-open").click();
	await union.locator(".site").first().dispatchEvent("keydown", { key: " ", bubbles: true });
	await union.waitForFunction(() => globalThis.document.querySelector("#density").textContent === "100.0%");
	await union.locator("#run").click();
	await union.waitForFunction(() => globalThis.document.querySelector("#pause").disabled && globalThis.document.querySelector("#run").disabled);
	console.log("PASS: an all-wall material has finite density; exhausting a non-spanning sequence stops its controls.");
	await union.close();

	const lru = await open("lean-lru-cache");
	await lru.waitForFunction(() => !globalThis.document.querySelector("#step").disabled);
	await lru.locator("#step").click();
	await lru.locator("#step").click();
	const progress = await lru.locator("#timeline-progress").textContent();
	await lru.evaluate(() => {
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pagehide", { persisted: true }));
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pageshow", { persisted: true }));
	});
	await lru.waitForFunction(() => !globalThis.document.querySelector("#step").disabled);
	assert.equal(await lru.locator("#timeline-progress").textContent(), progress);
	await lru.locator("#step").click();
	assert.match(await lru.locator("#timeline-progress").textContent(), /^3/u);
	console.log("PASS: a restored LRU page reconstructs the exact request history and accepts the next request.");
	await lru.close();

	const topology = await open("lean-topological-sort");
	await topology.waitForFunction(() => globalThis.document.querySelector("#runtime-status").textContent.includes("ready"));
	await topology.locator("#add-task").click();
	await topology.waitForFunction(() => globalThis.document.querySelectorAll(".task-card").length === 9);
	await topology.locator("#add-task").click();
	await topology.waitForFunction(() => globalThis.document.querySelectorAll(".task-card").length === 10);
	await topology.locator('.dependency-toggle[data-source="8"]').click();
	await topology.waitForFunction(() => globalThis.document.querySelector("#edge-count").textContent === "12");
	await topology.evaluate(() => new Promise(resolve => globalThis.requestAnimationFrame(resolve)));
	assert.equal(await topology.locator(".graph-edge").evaluateAll(paths => paths.some(path => /NaN|Infinity/u.test(path.getAttribute("d")))), false);
	console.log("PASS: an edge between coincident task cards has finite SVG coordinates.");
	await topology.close();

	const flood = await open("lean-flood-fill");
	await flood.waitForFunction(() => globalThis.document.querySelector("#status").textContent.includes("rooms"));
	await flood.evaluate(() => {
		globalThis.navigator.clipboard.writeText = async () => { throw new globalThis.DOMException("Denied", "NotAllowedError"); };
	});
	await flood.locator("#seed").click();
	assert.equal(await flood.locator("#seed").textContent(), "copy unavailable");
	console.log("PASS: denied clipboard access reports a recoverable status without an unhandled rejection.");
	await flood.close();
	assert.deepEqual(errors, []);
}
finally
{ await browser.close(); }
