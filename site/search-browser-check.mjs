/**
 * Check search recovery and responsive guide navigation against the published site.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { docPages } from "./registry.mjs";

const base = new URL(process.env.SITE_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:8765/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const docs = new URL("docs/", base);
const search = new URL("search-index.json", base);
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});

const hydrated = page => page.waitForFunction(() =>
	globalThis.performance.getEntriesByName("site-hydrated").length > 0);

try
{
	for(const failure of ["unavailable", "malformed", "invalid-route"])
	{
		const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		let requests = 0;
		await page.route(search.href, route => {
			requests++;
			if(requests > 1) return route.continue();
			const body = failure === "invalid-route"
				? JSON.stringify([{ title: "Untrusted", searchText: "ABI", route: "https://example.invalid/" }])
				: "{}";
			return route.fulfill({ status: failure === "unavailable" ? 503 : 200, contentType: "application/json", body });
		});
		try
		{
			await page.goto(docs.href);
			await hydrated(page);
			assert.equal(requests, 0, "Search must remain lazy until a reader uses it");
			await page.locator("#doc-search").fill("ABI");
			await page.getByRole("button", { name: "Retry search" }).click();
			await page.locator(".search-results a").first().waitFor();
			assert.equal(requests, 2, `${failure}: retry must fetch without another user action`);
			assert.equal(await page.locator("#doc-search").inputValue(), "ABI");
			assert.equal(await page.locator("#doc-search").evaluate(element => element === globalThis.document.activeElement), true);
			assert.equal(await page.locator("main h1").innerText(), "Documentation map");
			assert.deepEqual(errors, [], `${failure}: errors stay inside search`);
		}
		finally
		{ await page.close(); }
	}

	const page = await browser.newPage({ viewport: { width: 390, height: 850 } });
	try
	{
		await page.goto(docs.href);
		await hydrated(page);
		const disclosure = page.locator(".doc-navigation");
		const summary = disclosure.locator("summary");
		assert.equal(await page.locator(".docs-sidebar nav a").count(), docPages.length, "One navigation tree");
		await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
		assert.equal(await summary.isVisible(), true);
		assert.equal(await page.locator("#doc-search").isVisible(), true);
		await summary.focus();
		await page.keyboard.press("Enter");
		await disclosure.locator('a[href$="/docs/lean/"]').click();
		await page.waitForURL(new URL("docs/lean/", base).href);
		await page.waitForFunction(() => globalThis.document.querySelector("main h1")?.textContent === "Package a Lean library"
			&& globalThis.document.activeElement === globalThis.document.querySelector("main h1"));
		await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
		assert.equal(await page.locator("main h1").evaluate(element => element === globalThis.document.activeElement), true);
		await summary.click();
		await disclosure.locator('a[href$="/docs/lean/"]').click();
		assert.equal(await summary.evaluate(element => element === globalThis.document.activeElement), true,
			"Selecting the current guide must not leave focus in hidden links");
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForFunction(() => globalThis.document.querySelector(".doc-navigation").open);
		assert.equal(await summary.isVisible(), false);
		assert.equal(await disclosure.locator("a").first().isVisible(), true);
		await page.setViewportSize({ width: 390, height: 850 });
		await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
		assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
	}
	finally
	{ await page.close(); }

	const noScript = await browser.newPage({ viewport: { width: 390, height: 850 }, javaScriptEnabled: false });
	try
	{
		await noScript.goto(docs.href);
		assert.equal(await noScript.locator(".doc-navigation").getAttribute("open"), "");
		assert.equal(await noScript.locator(".docs-sidebar nav a").first().isVisible(), true);
		await noScript.locator(".doc-navigation summary").click();
		assert.equal(await noScript.locator(".docs-sidebar nav a").first().isVisible(), false);
		await noScript.locator(".doc-navigation summary").click();
		await noScript.locator('.docs-sidebar a[href$="/docs/lean/"]').click();
		assert.equal(await noScript.locator("main h1").innerText(), "Package a Lean library");
	}
	finally
	{ await noScript.close(); }
	console.log("PASS search HTTP/malformed/route recovery, lazy requests, mobile guide disclosure, resize, focus, and no-JS navigation");
}
finally
{ await browser.close(); }
