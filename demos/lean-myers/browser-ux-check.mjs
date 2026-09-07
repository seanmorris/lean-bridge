/**
 * Exercise exact-text editing and responsive diff presentation against real Wasm.
 *
 * Run against a served build: node demos/lean-myers/browser-ux-check.mjs [demo URL].
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8765/demos/lean-myers/";
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});
try
{
	const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.route("**/browser-benchmark.mjs", route => route.fulfill({
		contentType: "text/javascript"
		, body: "export const mountBenchmark = () => ({});"
	}));
	await page.goto(url);
	const ready = () => page.waitForFunction(() => globalThis.document.querySelector("#runtime-status").textContent.includes("ready"));
	const endings = () => page.locator(".diff-cell:nth-child(1) .ending").allTextContents();
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "4");
	assert.equal(await page.locator("#delete-count").textContent(), "2");
	assert.equal(await page.locator("#insert-count").textContent(), "2");

	await page.locator("#example").selectOption("unicode");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "5");
	await page.locator("#before-text").focus();
	await page.keyboard.press("Control+Home");
	await page.keyboard.type("X");
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CRLF"]);
	await page.keyboard.press("Control+z");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "5");
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CRLF"]);

	await page.locator("#before-text").fill("x\n");
	await page.locator("#after-text").fill("x");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "1");
	assert.deepEqual(await page.locator(".ending").allTextContents(), ["↵ LF", "∅ No newline"]);
	await page.locator("#before-text").fill("");
	await page.locator("#after-text").fill("");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "0");

	const rawPaste = "first\r\nsecond\rthird\n";
	await page.evaluate(text => globalThis.navigator.clipboard.writeText(text), rawPaste);
	await page.locator("#before-text").focus();
	await page.keyboard.press("Control+v");
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CR", "↵ LF"]);
	await page.keyboard.press("Control+z");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "0");
	await page.keyboard.press("Control+Shift+z");
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CR", "↵ LF"]);
	await page.locator("#before-text").evaluate(textarea => textarea.setSelectionRange(5, 5));
	await page.keyboard.press("Enter");
	await ready();
	assert.deepEqual(await endings(), ["↵ LF", "↵ CRLF", "↵ CR", "↵ LF"]);
	await page.keyboard.press("Backspace");
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CR", "↵ LF"]);

	await page.locator("#before-text").fill("A".repeat(2500));
	await page.locator("#after-text").fill("B".repeat(2500));
	await page.waitForFunction(() => globalThis.document.querySelector("#runtime-status").textContent.includes("limit"));
	assert.equal((await page.locator("#before-text").inputValue()).length, 2500);
	assert.equal((await page.locator("#after-text").inputValue()).length, 2500);
	await page.locator('[data-mode="lines"]').click();
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "2");
	await page.locator("#before-text").fill("<img src=x onerror=alert(1)>");
	await page.locator("#after-text").fill("<script>alert(2)</script>");
	await ready();
	assert.equal(await page.locator("#diff-preview img,#diff-preview script").count(), 0);

	await page.locator("#example").selectOption("settings");
	await ready();
	await page.locator('[data-mode="characters"]').click();
	await page.locator("#after-text").fill(await page.locator("#before-text").inputValue());
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "0");
	assert.equal(await page.locator("#replay-title").textContent(), "Script reproduces After exactly.");
	for(const width of [320, 390, 441, 500, 650, 768, 850, 1024, 1440, 1920])
	{
		await page.setViewportSize({ width, height: 900 });
		assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth), width);
	}
	assert.deepEqual(errors, []);
	console.log("PASS: real Wasm diff, Unicode code points, raw CRLF/CR/LF paste, undo/redo, explicit newline edits, no truncation, revision changes, escaped preview, and 320–1920 px layouts.");
}
finally
{ await browser.close(); }
