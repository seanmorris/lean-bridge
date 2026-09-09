/**
 * Check independent guide-rail scrolling across routes, reloads, and breakpoints.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import { startSiteServer } from "./serve.mjs";

/**
 * Exercise real rail scrolling without coupling it to document scroll history.
 *
 * @param {import('playwright').Browser} browser Browser engine under test.
 * @param {string} baseURL Root or prefixed static deployment URL.
 */
export const checkSidebarScroll = async (browser, baseURL) => {
	const base = new URL(baseURL);
	const target = path => new URL(path, base).href;
	const storageKey = `lean-bridge:docs-sidebar-scroll:${base.pathname}`;
	const options = { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" };
	const errors = [];
	const ready = page => page.waitForFunction(() =>
		globalThis.performance.getEntriesByName("site-hydrated").length > 0);
	const atPosition = (page, position) => page.waitForFunction(expected =>
		Math.abs(globalThis.document.querySelector(".docs-sidebar")?.scrollTop - expected) <= 1, position);
	const chooseLowerGuide = async page => {
		const link = page.locator('.docs-sidebar a[href$="/docs/contributing/testing/"]');
		await link.scrollIntoViewIfNeeded();
		const position = await page.locator(".docs-sidebar").evaluate(element => element.scrollTop);
		assert.ok(position > 500, "The test starts below the top of the guide rail");
		await page.evaluate(() => { globalThis.sidebarDocument = "same-document"; });
		await link.click();
		await page.waitForURL(target("docs/contributing/testing/"));
		await atPosition(page, position);
		assert.equal(await page.evaluate(() => globalThis.sidebarDocument), "same-document");
		return position;
	};
	const page = await browser.newPage(options);
	page.on("pageerror", error => errors.push(error.message));
	try
	{
		await page.goto(target("docs/"));
		await ready(page);
		const position = await chooseLowerGuide(page);
		await page.reload();
		await ready(page);
		await atPosition(page, position);
		await page.locator('.doc-pagination a[rel="next"]').click();
		await page.waitForURL(target("docs/contributing/release-pipeline/"));
		await atPosition(page, position);
		await page.goBack();
		await page.waitForURL(target("docs/contributing/testing/"));
		await atPosition(page, position);
		await page.goForward();
		await page.waitForURL(target("docs/contributing/release-pipeline/"));
		await atPosition(page, position);
		await page.locator('.site-links a[href$="/demos/"]').click();
		await page.waitForURL(target("demos/"));
		await page.locator('.site-links a[href$="/docs/"]').click();
		await page.waitForURL(target("docs/"));
		await atPosition(page, position);
		await page.setViewportSize({ width: 390, height: 850 });
		await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
		await page.locator(".doc-navigation > summary").click();
		await page.locator('.doc-navigation a[href$="/docs/lean/"]').click();
		await page.waitForURL(target("docs/lean/"));
		await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
		await page.reload();
		await ready(page);
		await page.setViewportSize(options.viewport);
		await page.waitForFunction(() => globalThis.document.querySelector(".doc-navigation").open);
		await atPosition(page, position);
		await page.evaluate(() => globalThis.scrollTo(0, 250));
		const articlePosition = await page.evaluate(() => globalThis.scrollY);
		await page.locator(".docs-sidebar").evaluate(element => { element.scrollTop = 300; });
		await atPosition(page, 300);
		assert.equal(await page.evaluate(() => globalThis.scrollY), articlePosition,
			"Moving the rail does not move the article");
	}
	finally
	{ await page.close(); }

	const unavailable = await browser.newPage(options);
	unavailable.on("pageerror", error => errors.push(error.message));
	try
	{
		await unavailable.addInitScript(key => {
			// Isolate rail failures from the router's independent article storage.
			for(const method of ["getItem", "setItem"])
			{
				const original = globalThis.Storage.prototype[method];
				globalThis.Storage.prototype[method] = new Proxy(original, {
					/**
					 * Reject both reading and saving the rail's offset.
					 *
					 * @param {Storage['getItem'] | Storage['setItem']} target Original storage method.
					 * @param {Storage} receiver Browser storage instance.
					 * @param {unknown[]} args Storage key and optional value.
					 */
					apply(target, receiver, args) {
						if(args[0] === key) throw new Error("Rail storage is unavailable in this test");
						return Reflect.apply(target, receiver, args);
					}
				});
			}
		}, storageKey);
		await unavailable.goto(target("docs/"));
		await ready(unavailable);
		await chooseLowerGuide(unavailable);
	}
	finally
	{ await unavailable.close(); }
	for(const value of ["invalid", "-10", "Infinity", "1000000000"])
	{
		const stored = await browser.newPage(options);
		stored.on("pageerror", error => errors.push(error.message));
		try
		{
			await stored.addInitScript(({ key, value }) => globalThis.sessionStorage.setItem(key, value),
				{ key: storageKey, value });
			await stored.goto(target("docs/"));
			await ready(stored);
			const expected = value === "1000000000"
				? await stored.locator(".docs-sidebar").evaluate(element => element.scrollHeight - element.clientHeight) : 0;
			await atPosition(stored, expected);
		}
		finally
		{ await stored.close(); }
	}
	assert.deepEqual(errors, [], "Scroll restoration produces no browser errors");
	return ["guide click", "reload", "pagination", "back/forward", "leave/return", "mobile reload", "article isolation", "blocked storage", "invalid/clamped storage"];
};

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	const root = resolve(process.env.SITE_ARTIFACT_ROOT ?? "build/github-pages");
	const identity = JSON.parse(await readFile(resolve(root, "build-identity.json"), "utf8"));
	const server = await startSiteServer({ root, base: identity.siteBase });
	const report = { base: identity.siteBase, status: "running", engines: [] };
	const output = resolve("build/sidebar-scroll-audit", identity.siteBase === "/" ? "root.json" : "prefixed.json");
	try
	{
		for(const engine of (process.env.SITE_BROWSERS ?? "chromium,firefox,webkit").split(","))
		{
			const type = { chromium, firefox, webkit }[engine];
			assert.ok(type, `Unknown browser ${engine}`);
			const browser = await type.launch({ headless: true, ...(engine === "chromium"
				? { executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {}) });
			try
			{
				const checks = await checkSidebarScroll(browser, server.url);
				report.engines.push({ engine, version: browser.version(), checks });
				console.log(`PASS ${engine}: sidebar scrolling, reloads, history, mobile transitions, and storage failures`);
			}
			finally
			{ await browser.close(); }
		}
		report.status = "passed";
	}
	catch(error)
	{
		report.status = "failed";
		report.error = error.message;
		throw error;
	}
	finally
	{
		await mkdir(resolve("build/sidebar-scroll-audit"), { recursive: true });
		await writeFile(output, JSON.stringify(report, null, 2) + "\n");
		await server.close();
	}
}
