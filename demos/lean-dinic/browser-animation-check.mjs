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
const motionState = page => page.evaluate(() => ({
	svgTime: globalThis.document.querySelector("#network-svg").getCurrentTime()
	, packets: [...globalThis.document.querySelectorAll(".flow-packet")].map(packet => {
		const matrix = packet.getCTM();
		return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
	})
	, dashes: [...globalThis.document.querySelectorAll(".flow-motion")].map(path => ({
		offset: globalThis.getComputedStyle(path).strokeDashoffset
		, clocks: path.getAnimations().map(animation => [animation.playState, animation.currentTime])
	}))
}));

// Chromium can rerasterize a stationary rounded outline with small edge-color
// differences. Compare decoded pixels, not PNG bytes, while checking every
// animation clock and packet transform exactly below.
const rasterDifference = (page, before, after) => page.evaluate(async ({ first, second }) => {
	const decode = async encoded => {
		const bytes = Uint8Array.from(globalThis.atob(encoded), character => character.charCodeAt(0));
		const bitmap = await globalThis.createImageBitmap(new globalThis.Blob([bytes], { type: "image/png" }));
		const canvas = new globalThis.OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(bitmap, 0, 0);
		const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
		bitmap.close();
		return { width: canvas.width, height: canvas.height, pixels };
	};
	const left = await decode(first);
	const right = await decode(second);
	const sameDimensions = left.width === right.width && left.height === right.height;
	let changedPixels = 0;
	let maximumDelta = 0;
	if(sameDimensions)
		for(let index = 0; index < left.pixels.length; index += 4)
		{
			let delta = 0;
			for(let channel = 0; channel < 4; channel++)
				delta = Math.max(delta, Math.abs(left.pixels[index + channel] - right.pixels[index + channel]));
			if(delta) changedPixels++;
			maximumDelta = Math.max(maximumDelta, delta);
		}
	return { sameDimensions, changedPixels, maximumDelta, pixelCount: left.width * left.height };
}, { first: before.toString("base64"), second: after.toString("base64") });

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
		assert.ok((await rasterDifference(page, firstRaster, secondRaster)).maximumDelta > 16, "Running motion must change actual rendered pixels beyond antialiasing noise");

		await page.locator("#toggle-motion").click();
		await page.mouse.move(0, 0);
		await page.waitForFunction(() => [...globalThis.document.querySelectorAll(".flow-motion")]
			.every(path => path.getAnimations().every(animation => animation.playState === "paused")));
		await page.evaluate(() => new Promise(resolve => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));
		const pausedBefore = await motionState(page);
		const pausedRaster = await page.locator(".network-canvas").screenshot();
		await delay(219);
		assert.deepEqual(await motionState(page), pausedBefore, "Pause must freeze every packet transform, CSS dash clock, and SVG clock exactly");
		const pausedDifference = await rasterDifference(page, pausedRaster, await page.locator(".network-canvas").screenshot());
		const visuallyPaused = pausedDifference.sameDimensions && pausedDifference.maximumDelta <= 16
			&& pausedDifference.changedPixels <= pausedDifference.pixelCount * .001;
		assert.ok(visuallyPaused, `Paused raster must remain unchanged apart from small edge antialiasing noise: ${JSON.stringify(pausedDifference)}`);

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
