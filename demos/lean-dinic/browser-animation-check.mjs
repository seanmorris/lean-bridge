/**
 * Check visible flow motion, pause/resume, and reduced-motion behavior in Chromium.
 *
 * Run against a served, built demo: node demos/lean-dinic/browser-animation-check.mjs
 * An alternate demo URL can be supplied as the first argument.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8765/demos/lean-dinic/";
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const position = page => page.evaluate(() => {
	const transform = globalThis.document.querySelector(".flow-packet").getCTM();
	return [transform.e, transform.f];
});
const movement = (before, after) => Math.hypot(before[0] - after[0], before[1] - after[1]);

try
{
	for(const reducedMotion of ["no-preference", "reduce"])
	{
		const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion });
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		// Keep this interaction check separate from the automatic performance trial.
		await page.route("**/browser-benchmark.mjs", route => route.fulfill({
			contentType: "text/javascript"
			, body: "export const mountBenchmark = () => ({});"
		}));
		await page.goto(url);
		await page.waitForFunction(() => globalThis.document.querySelectorAll(".flow-packet").length > 0);
		await page.locator(".network-canvas").scrollIntoViewIfNeeded();
		if(reducedMotion === "reduce")
		{
			assert.equal(await page.locator("#network-svg").evaluate(svg => svg.animationsPaused()), true);
			const before = await position(page);
			await delay(173);
			assert.equal(movement(before, await position(page)), 0, "Reduced motion must start stationary");
			await page.locator("#toggle-motion").click();
		}

		const movingBefore = await position(page);
		const firstRaster = await page.locator(".network-canvas").screenshot();
		await delay(173);
		assert.ok(movement(movingBefore, await position(page)) > 2, "A flow packet must visibly travel along its edge");
		const secondRaster = await page.locator(".network-canvas").screenshot();
		assert.equal(firstRaster.equals(secondRaster), false, "Running motion must change actual rendered pixels");

		await page.locator("#toggle-motion").click();
		await page.mouse.move(0, 0);
		await page.evaluate(() => new Promise(resolve => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));
		const pausedBefore = await position(page);
		const pausedRaster = await page.locator(".network-canvas").screenshot();
		await delay(219);
		assert.equal(movement(pausedBefore, await position(page)), 0, "Pause must freeze packet positions");
		assert.ok(pausedRaster.equals(await page.locator(".network-canvas").screenshot()), "Pause must freeze rendered flow pixels");

		await page.locator("#toggle-motion").click();
		const resumedBefore = await position(page);
		await delay(173);
		assert.ok(movement(resumedBefore, await position(page)) > 2, "Resume must restart packet movement");
		assert.equal(await page.evaluate(() => [...globalThis.document.querySelectorAll(".flow-packet")].every(packet => {
			const edge = globalThis.document.querySelector(`[data-edge="${packet.dataset.edgePacket}"]`);
			return Number(edge.textContent.split("/")[0]) > 0;
		})), true, "Only positive-flow links may carry moving packets");
		assert.deepEqual(errors, []);
		await page.close();
		console.log(`Flow animation passed: ${reducedMotion}, rendered pixels, packet positions, pause, resume.`);
	}
}
finally
{ await browser.close(); }
