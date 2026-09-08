/**
 * Exercise the React Myers workbench with real Wasm and client-side navigation.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? process.env.SITE_BASE_URL ?? "http://127.0.0.1:8765/build/github-pages/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const demo = new URL("demos/lean-myers/", base).href;
const docs = new URL("docs/", base).href;
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});

try
{
	const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base.origin });
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	const ready = () => page.waitForFunction(() => globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready"));
	const cancelBenchmark = () => page.locator("[data-benchmark-cancel]").evaluate(button => button.click());
	const endings = () => page.locator(".diff-cell:nth-child(1) .ending").allTextContents();
	const toDocs = async () => {
		await page.locator(".site-links a").filter({ hasText: /^Docs$/u }).click();
		await page.waitForURL(docs);
		await page.waitForSelector(".docs-layout");
	};
	const returnToDemo = async () => {
		await page.goBack();
		await page.waitForURL(demo);
		await ready();
		await cancelBenchmark();
	};
	await page.goto(demo);
	await ready();
	await cancelBenchmark();
	assert.equal(await page.locator("#edit-count").textContent(), "4");
	await page.evaluate(() => { globalThis.__myersVisit = "same-document"; });
	await page.locator("#example").selectOption("unicode");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "5");
	await page.locator("#before-text").focus();
	await page.keyboard.press("Control+Home");
	await page.keyboard.type("Typed");
	await ready();
	await page.keyboard.press("Control+z");
	await ready();
	assert.equal(await page.locator("#edit-count").textContent(), "5");
	await page.keyboard.press("Control+Shift+z");
	await ready();
	assert.ok((await page.locator("#before-text").inputValue()).startsWith("Typed"));
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CRLF"]);

	await page.locator("#before-text").fill("");
	await page.locator("#after-text").fill("");
	await ready();
	const raw = "😀 first\r\nCafé second\rthird\n";
	await page.evaluate(text => navigator.clipboard.writeText(text), raw);
	await page.locator("#before-text").focus();
	await page.keyboard.press("Control+v");
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CR", "↵ LF"]);
	await page.locator("#before-text").evaluate(element => {
		element.setSelectionRange(2, 7, "backward");
		element.dispatchEvent(new Event("select"));
	});
	await toDocs();
	assert.equal(await page.locator("#before-text").count(), 0);
	await returnToDemo();
	assert.equal(await page.evaluate(() => globalThis.__myersVisit), "same-document");
	assert.equal(await page.locator("#before-text").inputValue(), raw.replace(/\r\n?/gu, "\n"));
	assert.deepEqual(await page.locator("#before-text").evaluate(element => [element.selectionStart, element.selectionEnd, element.selectionDirection]), [2, 7, "backward"]);
	await page.locator('[data-undo="before"]').click();
	await ready();
	assert.equal(await page.locator("#before-text").inputValue(), "");
	await page.locator('[data-redo="before"]').click();
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CR", "↵ LF"]);
	await page.locator("#before-text").focus();
	await page.keyboard.press("Control+z");
	await ready();
	assert.equal(await page.locator("#before-text").inputValue(), "");
	await page.keyboard.press("Control+y");
	await ready();
	assert.deepEqual(await endings(), ["↵ CRLF", "↵ CR", "↵ LF"]);

	await page.locator("#before-text").fill("");
	await ready();
	await page.locator("#before-text").focus();
	const cdp = await context.newCDPSession(page);
	await cdp.send("Input.imeSetComposition", { text: "n", selectionStart: 1, selectionEnd: 1 });
	await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
	await cdp.send("Input.insertText", { text: "日本" });
	await ready();
	assert.equal(await page.locator("#before-text").inputValue(), "日本");
	await page.locator('[data-undo="before"]').click();
	await ready();
	assert.equal(await page.locator("#before-text").inputValue(), "");
	await page.locator('[data-redo="before"]').click();
	await ready();
	assert.equal(await page.locator("#before-text").inputValue(), "日本");
	await cdp.detach();

	await page.locator("#example").selectOption("settings");
	await ready();
	assert.equal(await page.locator('[data-undo="before"]').isDisabled(), true);
	const originalBefore = await page.locator("#before-text").inputValue();
	const originalAfter = await page.locator("#after-text").inputValue();
	await page.locator("#swap-text").click();
	await ready();
	assert.equal(await page.locator("#before-text").inputValue(), originalAfter);
	assert.equal(await page.locator("#after-text").inputValue(), originalBefore);
	assert.equal(await page.locator('[data-undo="after"]').isDisabled(), true);

	await page.evaluate(async runtimeUrl => {
		const runtime = await import(runtimeUrl);
		const module = await runtime.initRuntime();
		const live = new Set();
		const prepare = module._lean_myers_prepare_c;
		const release = module._lean_myers_release;
		module._lean_myers_prepare_c = (...args) => {
			const handle = prepare(...args);
			if(handle) live.add(handle);
			return handle;
		};
		module._lean_myers_release = handle => { live.delete(handle); return release(handle); };
		globalThis.__myersLiveHandles = live;
	}, new URL("lean-myers/runtime.mjs", base).href);
	for(let index = 0; index < 6; index++)
	{
		await page.locator("#before-text").fill(`Visit ${index}\n`);
		await toDocs();
		await page.waitForFunction(() => globalThis.__myersLiveHandles.size === 0);
		await returnToDemo();
		assert.equal(await page.locator("#before-text").inputValue(), `Visit ${index}\n`);
		assert.ok(await page.evaluate(() => globalThis.__myersLiveHandles.size <= 1),
			"Only the mounted benchmark may retain its reusable prepared handle");
	}
	await toDocs();
	await page.waitForFunction(() => globalThis.__myersLiveHandles.size === 0);
	await returnToDemo();
	await page.reload();
	await ready();
	await cancelBenchmark();
	assert.equal(await page.locator("#example").inputValue(), "settings");
	assert.equal(await page.locator("#edit-count").textContent(), "4");
	assert.equal(await page.locator('[data-undo="before"]').isDisabled(), true);
	assert.deepEqual(errors, []);
	await context.close();
	console.log("PASS Myers React: exact paste, grouped Undo/Redo, restored selections/history, native IME, preset/Swap reset, pending navigation, six clean handle lifetimes, and full-reload reset.");
}
finally
{ await browser.close(); }
