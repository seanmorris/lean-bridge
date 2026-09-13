/**
 * Check linked diagrams, failure feedback, keyboard input, and proof services.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startSiteServer } from "./serve.mjs";
import { PRESETS } from "../demos/lean-tutte/scenario.mjs";
import { availableScales } from "../demos/lean-tutte/constructions.mjs";

const explicit = process.env.SITE_BASE_URL ?? process.argv[2];
const root = resolve(process.env.SITE_ARTIFACT_ROOT ?? "build/github-pages");
const identity = explicit ? null : JSON.parse(await readFile(resolve(root, "build-identity.json"), "utf8"));
const server = explicit ? null : await startSiteServer({ root, base: identity.siteBase });
const base = new URL(explicit ?? server.url);
if(!base.pathname.endsWith("/")) base.pathname += "/";
let browser;
try
{
	let executablePath = process.env.CHROMIUM_PATH;
	if(!executablePath)
	{
		try
		{ await access("/usr/bin/chromium"); executablePath = "/usr/bin/chromium"; }
		catch
		{ executablePath = chromium.executablePath(); }
	}
	browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errors = [], requests = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("request", request => requests.push(request.url()));
	await page.goto(new URL("demos/lean-tutte/", base).href);
	await page.getByText("✓ Lean accepts this construction", { exact: true }).waitFor();
	assert.equal(requests.some(url => url.includes("benchmark-workload")), false, "Benchmark stays lazy above the fold");
	assert.equal(await page.locator(".site-header").count(), 1);
	assert.equal(await page.locator("#tutte-construction option").count(), 21);
	assert.equal(await page.locator("#tutte-construction optgroup").count(), 4);
	assert.equal(await page.getByRole("button", { name: "Previous construction", exact: true }).isDisabled(), true);
	await page.getByRole("checkbox", { name: "Overlay the wires" }).check();
	assert.equal(await page.locator(".tile-overlay polyline").count(), 9);
	await page.locator(".tile-picker").getByRole("button", { name: "1", exact: true }).focus();
	await page.keyboard.press("Enter");
	assert.match(await page.locator(".tutte-equation").innerText(), /10 − 9 = 1/u);
	await page.getByRole("button", { name: "See why the lengths balance" }).click();
	assert.match(await page.locator(".tutte-equation").innerText(), /7 \+ 4 = 10 \+ 1/u);
	const motion = await page.locator(".wire-motion").first().evaluate(async path => {
		const first = globalThis.getComputedStyle(path).strokeDashoffset;
		await new Promise(resolve => setTimeout(resolve, 100));
		return first !== globalThis.getComputedStyle(path).strokeDashoffset;
	});
	assert.ok(motion, "Current animation moves");
	await page.getByRole("button", { name: /Enlarge the/u }).click();
	await page.getByText("× Lean rejects this construction", { exact: true }).waitFor();
	assert.match(await page.locator(".tutte-equation").innerText(), /8 \+ 4 ≠ 10 \+ 1/u);
	await page.getByRole("button", { name: "Restore the exact fit" }).click();
	await page.getByText("✓ Lean accepts this construction", { exact: true }).waitFor();
	await page.getByRole("button", { name: "See what simple means" }).click();
	await page.getByRole("button", { name: "Junction A, 17 volts, remove", exact: true }).click();
	await page.getByRole("button", { name: "Junction C, 10 volts, remove", exact: true }).focus();
	await page.keyboard.press("Space");
	assert.equal(await page.locator(".tutte-node.removed").count(), 2);
	assert.equal(await page.getByTestId("connectivity").innerText(), "Still connected");
	await page.getByRole("button", { name: "Compare a compound rectangle" }).click();
	await page.getByRole("button", { name: "Show the separating pair" }).click();
	assert.equal(await page.getByTestId("connectivity").innerText(), "2 separate pieces");
	assert.equal(await page.locator(".compound-outline").count(), 1);
	await page.getByLabel("Construction", { exact: true }).selectOption("wide");
	await page.getByLabel("Voltage scale", { exact: true }).selectOption("3");
	await page.getByText("✓ Lean accepts this construction", { exact: true }).waitFor();
	assert.match(await page.locator(".tutte-diagrams figcaption").first().innerText(), /207 × 183/u);
	const lastSimple = PRESETS.filter(preset => preset.kind === "simple").at(-1);
	await page.getByLabel("Construction", { exact: true }).selectOption(lastSimple.id);
	assert.equal(await page.getByLabel("Voltage scale", { exact: true }).inputValue(), "1", "A larger construction clamps a previous 3× scale");
	await page.getByRole("button", { name: "1 One square, one wire" }).click();
	for(const preset of PRESETS)
	{
		await page.getByLabel("Construction", { exact: true }).selectOption(preset.id);
		await page.getByText("✓ Lean accepts this construction", { exact: true }).waitFor();
		assert.match(await page.locator(".tutte-diagrams figcaption").first().innerText(), new RegExp(`${preset.width} × ${preset.height}`));
		assert.equal(await page.locator(".tutte-square").count(), preset.order);
		assert.equal(await page.locator(".tutte-wire").count(), preset.order);
		assert.equal(await page.locator(".tutte-node.removed").count(), 0);
		assert.deepEqual(await page.locator("#tutte-scale option").evaluateAll(options => options.map(option => Number(option.value))), availableScales(preset));
		const colors = await page.locator(".tutte-square").evaluateAll(squares => squares.map(square => square.style.getPropertyValue("--square")));
		assert.ok(colors.every(Boolean));
		assert.equal(new Set(colors).size, preset.order, "Every square has a distinct palette entry");
		assert.ok(await page.evaluate(() => {
			const labels = [...globalThis.document.querySelectorAll(".potential-label")].map(label => label.getBBox());
			const values = [...globalThis.document.querySelectorAll(".wire-value rect")].map(label => label.getBBox());
			return labels.every(a => values.every(b => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y));
		}), "Voltage labels do not overlap wire values");
	}
	assert.equal(await page.getByRole("button", { name: "Next construction", exact: true }).isDisabled(), true);
	await page.getByRole("button", { name: "Previous construction", exact: true }).click();
	assert.equal(await page.getByLabel("Construction", { exact: true }).inputValue(), lastSimple.id);
	await page.getByRole("button", { name: "See why the lengths balance" }).click();
	await page.getByRole("button", { name: /Enlarge the/u }).click();
	await page.getByText("× Lean rejects this construction", { exact: true }).waitFor();
	await page.getByRole("button", { name: "Next construction", exact: true }).click();
	await page.getByText("✓ Lean accepts this construction", { exact: true }).waitFor();
	assert.equal(await page.locator(".tutte-square.broken").count(), 0, "Browsing clears a deliberately broken fit");
	await page.getByLabel("Construction", { exact: true }).selectOption(lastSimple.id);
	for(const width of [320, 390, 768, 1440, 1920])
	{
		await page.setViewportSize({ width, height: 1000 });
		assert.ok(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), `No overflow at ${width}px`);
		const badge = await page.locator(".tutte-steps span").first().boundingBox();
		assert.ok(Math.abs(badge.width - badge.height) < 1, `Step badges stay circular at ${width}px`);
		assert.ok(await page.locator(".tutte-steps button").evaluateAll(buttons => buttons.every(button => button.scrollHeight <= button.clientHeight + 1)), `Step labels fit at ${width}px`);
	}
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.getByRole("button", { name: "1 One square, one wire" }).click();
	assert.equal(await page.locator(".wire-motion").first().evaluate(path => globalThis.getComputedStyle(path).animationName), "none");
	await page.locator(".proof-section").scrollIntoViewIfNeeded();
	await page.getByText("Source matches checked build", { exact: true }).waitFor();
	await page.waitForFunction(() => !globalThis.document.querySelector("#launch-wasm")?.disabled);
	assert.ok((await page.locator(".token-declaration").count()) > 0);
	await page.locator("#browser-benchmark").scrollIntoViewIfNeeded();
	await page.waitForFunction(() => globalThis.document.querySelector("[data-benchmark-progress]")?.textContent?.startsWith("Completed in"), null, { timeout: 60000 });
	assert.doesNotMatch(await page.locator("#browser-benchmark").innerText(), /Infinity|NaN/u);
	assert.deepEqual(errors, []);
	for(const file of ["runtime.mjs", "runtime/lean-tutte.mjs", "runtime/lean-tutte.wasm"])
	{
		const retry = await browser.newPage();
		const pattern = `**/lean-tutte/${file}`;
		await retry.route(pattern, route => route.fulfill({ status: 503, body: "Temporary checker download failure" }));
		await retry.goto(new URL("demos/lean-tutte/", base).href);
		await retry.getByRole("button", { name: "Retry checker" }).waitFor();
		await retry.unroute(pattern);
		await retry.getByRole("button", { name: "Retry checker" }).click();
		await retry.getByText("✓ Lean accepts this construction", { exact: true }).waitFor({ timeout: 10000 });
		await retry.close();
	}
	console.log("Tutte browser checks passed: 20 generated constructions, navigation, safe scales, selection, balance, rejection, connectivity, responsive layout, reduced motion, proof receipt, benchmark, and failed-download recovery.");
}
finally
{
	await browser?.close();
	await server?.close();
}
