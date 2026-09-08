/**
 * Check accessible mouse, keyboard, and touch editing against real Lean paths.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8765/demos/lean-dijkstra/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
try
{
	const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.route("**/browser-benchmark.mjs", route => route.fulfill({
		contentType: "text/javascript"
		, body: "export const attachBrowserBenchmark=()=>({});export const measureSyncBenchmark=()=>({});"
	}));
	await page.goto(url);
	await page.waitForFunction(() => globalThis.document.querySelector("#status").classList.contains("ready"));
	assert.equal(await page.locator("#grid.maze-cycling").count(), 0);
	await page.locator("#clear").click();
	await page.waitForFunction(() => globalThis.document.querySelectorAll(".cell.wall").length === 0);
	const first = page.locator('.cell[data-index="115"]');
	const last = page.locator('.cell[data-index="122"]');
	await first.scrollIntoViewIfNeeded();
	const a = await first.boundingBox();
	const z = await last.boundingBox();
	const client = await page.context().newCDPSession(page);
	await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }] });
	await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: z.x + z.width / 2, y: z.y + z.height / 2 }] });
	assert.equal(await page.locator(".cell.wall").count(), 8, "Fast touch drag fills every intervening cell");
	await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	await page.waitForFunction(() => globalThis.document.querySelector("#status").classList.contains("ready"));
	await first.focus();
	await page.keyboard.press("Enter");
	assert.equal(await first.evaluate(node => node.classList.contains("wall")), false);
	await page.keyboard.press("ArrowRight");
	assert.equal(await page.evaluate(() => globalThis.document.activeElement.dataset.index), "116");
	await page.locator('[data-mode="start"]').click();
	await first.focus();
	await page.keyboard.press(" ");
	assert.equal(await first.evaluate(node => node.classList.contains("start")), true);
	await page.evaluate(() => {
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pagehide", { persisted: true }));
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pageshow", { persisted: true }));
	});
	await page.waitForFunction(() => globalThis.document.querySelector("#status").classList.contains("ready"));
	assert.equal(await page.locator(".cell.path").count() > 0, true);
	assert.equal(await page.locator('.cell[tabindex="0"]').count(), 1);
	assert.deepEqual(errors, []);
	console.log("PASS: real paths, reduced-motion opening, interpolated touch walls, keyboard toggling/endpoints, roving focus, and page restoration.");
}
finally
{ await browser.close(); }
