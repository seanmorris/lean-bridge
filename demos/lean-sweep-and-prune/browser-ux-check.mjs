/**
 * Exercise real-Wasm scene editing, motion, axis changes, and responsive layouts.
 *
 * Run: node demos/lean-sweep-and-prune/browser-ux-check.mjs [demo URL].
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8765/demos/lean-sweep-and-prune/";
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});
try
{
	const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.route("**/browser-benchmark.mjs", route => route.fulfill({
		contentType: "text/javascript"
		, body: "export const mountBenchmark = () => ({});"
	}));
	await page.route("**/lean-sweep-and-prune/runtime.mjs", async route => {
		const response = await route.fetch();
		const source = await response.text();
		const entry = "export const prepareSweep = async request => {";
		assert.ok(source.includes(entry), "The delayed test must wrap the real compiled solver adapter");
		await route.fulfill({ response
		, body: source.replace(entry,
			`${entry}\nif (globalThis.__sweepAuditGate) await globalThis.__sweepAuditGate;`) });
	});
	await page.goto(url);
	const settled = () => page.waitForFunction(() => globalThis.document.querySelector("#runtime-status").textContent.includes("ready"));
	await settled();
	const frame = () => page.locator("#frame-number").textContent();
	const nextFrame = previous => page.waitForFunction(value => globalThis.document.querySelector("#frame-number").textContent !== value, previous);
	const positions = () => page.locator(".body").evaluateAll(nodes => nodes.map(node => node.getAttribute("transform")));
	assert.equal(await page.locator("#all-count").textContent(), "15");
	assert.equal(await page.locator("#candidate-count").textContent(), "2");
	assert.equal(await page.locator("#overlap-count").textContent(), "1");
	assert.equal(await page.locator(".pair-link.confirmed").count(), 1);
	assert.match(await page.locator("#selection-summary").textContent(), /Box A: 1 candidate, 0 overlaps/);
	assert.match(await page.locator("#selected-pairs").textContent(), /Gap on Y; rejected/);

	await page.locator('[data-axis="1"]').click();
	await page.waitForFunction(() => globalThis.document.querySelector("#candidate-count").textContent !== "2");
	assert.equal(await page.locator("#overlap-count").textContent(), "1");
	await page.locator('[data-axis="0"]').click();
	await page.waitForFunction(() => globalThis.document.querySelector("#candidate-count").textContent === "2");
	await page.locator('[data-body="0"]').focus();
	for(let index = 0; index < 5; index++) await page.keyboard.press("Shift+ArrowDown");
	for(let index = 0; index < 3; index++) await page.keyboard.press("ArrowDown");
	await page.waitForFunction(() => globalThis.document.querySelector('[data-body="0"]').getAttribute("transform") === "translate(98 196)");
	assert.equal(await page.locator("#overlap-count").textContent(), "2", "Closed AABB semantics include the touching A/B boundary");
	await page.keyboard.press("ArrowUp");
	await page.waitForFunction(() => globalThis.document.querySelector("#overlap-count").textContent === "1");

	await page.locator("#toggle-motion").click();
	const moving = await positions();
	await page.waitForFunction(previous => JSON.stringify(Array.from(globalThis.document.querySelectorAll(".body"), node => node.getAttribute("transform"))) !== JSON.stringify(previous), moving);
	assert.match(await page.locator("#toggle-motion").textContent(), /Pause motion/);
	const body = page.locator('[data-body="0"]');
	await body.scrollIntoViewIfNeeded();
	const box = await body.boundingBox();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	assert.match(await page.locator("#toggle-motion").textContent(), /Play motion/);
	const beforeDrag = await body.getAttribute("transform");
	await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 6 });
	await page.waitForFunction(previous => globalThis.document.querySelector('[data-body="0"]').getAttribute("transform") !== previous, beforeDrag);
	assert.equal(await page.locator("#scene").evaluate(node => node.classList.contains("dragging")), true);
	assert.match(await page.locator("#scene-state").textContent(), /Moving A/);
	await page.mouse.up();
	assert.equal(await page.locator("#scene").evaluate(node => node.classList.contains("dragging")), false);
	const paused = await frame();
	await page.waitForTimeout(180);
	assert.equal(await frame(), paused, "Pausing stops frame updates without disabling editing");
	await page.locator("#step-motion").click();
	await nextFrame(paused);
	assert.match(await page.locator("#scene-state").textContent(), /Paused/);

	await page.locator("#scene-seed").fill("2026");
	await page.locator("#body-count").selectOption("12");
	await page.locator("#new-scene").click();
	await settled();
	await page.waitForFunction(() => globalThis.document.querySelector("#all-count").textContent === "66");
	const seeded = await positions();
	await page.locator("#scene-seed").fill("2026");
	await page.locator("#new-scene").click();
	await settled();
	await page.waitForFunction(() => globalThis.document.querySelector("#frame-number").textContent === "Frame 1");
	assert.deepEqual(await positions(), seeded, "Re-entering the visible seed reproduces the scene");
	// Keep preparation pending across selection, then let the real Lean solver finish.
	await page.evaluate(() => {
		globalThis.__sweepAuditGate = new Promise(resolve => { globalThis.__releaseSweepAudit = resolve; });
	});
	await page.locator("#new-scene").click();
	await page.waitForFunction(previous => JSON.stringify(Array.from(globalThis.document.querySelectorAll(".body"), node => node.getAttribute("transform"))) !== JSON.stringify(previous), seeded);
	assert.equal(await page.locator("#scene-seed").inputValue(), "2027");
	await page.locator("#selected-body").selectOption("3");
	assert.equal(await page.locator("#selected-body").inputValue(), "3");
	assert.match(await page.locator("#selection-summary").textContent(), /Checking/);
	await page.evaluate(() => { globalThis.__releaseSweepAudit(); delete globalThis.__sweepAuditGate; });
	await settled();
	await page.waitForFunction(() => /^Box D:/.test(globalThis.document.querySelector("#selection-summary").textContent));
	assert.match(await page.locator("#selection-summary").textContent(), /Box D/);
	const beforeNudge = await page.locator('[data-body="3"]').getAttribute("transform");
	await page.locator('[data-nudge="right"]').click();
	await page.waitForFunction(previous => globalThis.document.querySelector('[data-body="3"]').getAttribute("transform") !== previous, beforeNudge);

	await page.locator("#toggle-motion").click();
	await page.locator("#proof-title").scrollIntoViewIfNeeded();
	await page.waitForTimeout(120);
	const offscreen = await frame();
	await page.waitForTimeout(180);
	assert.equal(await frame(), offscreen, "An offscreen scene does not keep running");
	await page.locator("#scene").scrollIntoViewIfNeeded();
	await nextFrame(offscreen);
	await page.locator("#toggle-motion").click();

	await page.locator("#body-count").selectOption("24");
	await page.locator("#new-scene").click();
	await settled();
	await page.waitForFunction(() => globalThis.document.querySelector("#all-count").textContent === "276");
	for(const width of [320, 390, 441, 500, 650, 768, 850, 1024, 1440, 1920])
	{
		await page.setViewportSize({ width, height: 1000 });
		const dimensions = await page.evaluate(() => ({
			scroll: globalThis.document.documentElement.scrollWidth
			, client: globalThis.document.documentElement.clientWidth
		}));
		assert.ok(dimensions.scroll <= dimensions.client, `No page overflow at ${width}px: ${JSON.stringify(dimensions)}`);
	}
	await page.setViewportSize({ width: 1440, height: 1080 });
	await page.locator("#reset-scene").click();
	await settled();
	await page.waitForFunction(() => globalThis.document.querySelector("#all-count").textContent === "15");
	assert.equal(await page.locator("#candidate-count").textContent(), "2");
	assert.equal(await page.locator("#overlap-count").textContent(), "1");
	await page.evaluate(() => {
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pagehide", { persisted: true }));
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pageshow", { persisted: true }));
	});
	const restored = await frame();
	await page.locator("#step-motion").click();
	await nextFrame(restored);
	assert.deepEqual(errors, []);
	const mobile = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
	mobile.on("pageerror", error => errors.push(error.message));
	await mobile.route("**/browser-benchmark.mjs", route => route.fulfill({
		contentType: "text/javascript"
		, body: "export const mountBenchmark = () => ({});"
	}));
	await mobile.goto(url);
	await mobile.waitForFunction(() => globalThis.document.querySelector("#runtime-status").textContent.includes("ready"));
	const touchBody = mobile.locator('[data-body="4"]');
	await touchBody.scrollIntoViewIfNeeded();
	const touchBounds = await touchBody.boundingBox();
	const originalTouch = await touchBody.getAttribute("transform");
	const client = await mobile.context().newCDPSession(mobile);
	const x = touchBounds.x + touchBounds.width / 2;
	const y = touchBounds.y + touchBounds.height / 2;
	await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
	await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 35, y: y + 30 }] });
	await mobile.waitForFunction(previous => globalThis.document.querySelector('[data-body="4"]').getAttribute("transform") !== previous, originalTouch);
	assert.equal(await mobile.locator("#scene").evaluate(node => node.classList.contains("dragging")), true);
	await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	assert.equal(await mobile.locator("#scene").evaluate(node => node.classList.contains("dragging")), false);
	assert.match(await mobile.locator("#scene-state").textContent(), /Paused/);
	assert.deepEqual(errors, []);
	console.log("PASS: real Wasm pairs, closed touching boundaries, X/Y invariant overlaps, live pointer/touch drag feedback, keyboard/nudge editing, play/pause/step, seeded scenes, offscreen suspension, restored-page editing, reduced motion, and 320–1920 px layouts.");
}
finally
{ await browser.close(); }
