/**
 * Check the shared header across React routes and standalone workbenches.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import { demos } from "./registry.mjs";
import { startSiteServer } from "./serve.mjs";

/**
 * Compare real header geometry, styling, and navigation at each breakpoint.
 *
 * @param {import('playwright').Browser} browser Browser engine under test.
 * @param {string} baseURL Static deployment URL, including its hosting prefix.
 */
export const checkSiteHeaders = async (browser, baseURL) => {
	const target = path => new URL(path, baseURL).href;
	const widths = [320, 390, 768, 1440, 1920];
	const routes = ["", "docs/", "demos/", ...demos.map(demo => demo.canonicalPage.slice(1))];
	const expectedLinks = [target(""), target("demos/"), target("docs/"), "https://github.com/seanmorris/lean-bridge"];
	const reference = new Map();
	const errors = [];
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	page.on("pageerror", error => errors.push(error.message));
	try
	{
		for(const route of routes)
		{
			await page.goto(target(route));
			await page.locator(".site-header").waitFor();
			assert.equal(await page.locator(".site-header").count(), 1, `${route}: one header`);
			assert.equal(await page.locator(".portfolio-nav").count(), 0, `${route}: no legacy header`);
			assert.equal(await page.locator(".site-brand").getAttribute("href"), new URL(baseURL).pathname);
			assert.equal(await page.locator(".site-brand span").textContent(), "Lean Bridge");
			for(const selector of [".site-links", ".mobile-navigation nav"])
			{
				assert.deepEqual(await page.locator(`${selector} a`).evaluateAll(links => links.map(link => link.href)), expectedLinks);
				assert.deepEqual(await page.locator(`${selector} a`).allTextContents(), ["Home", "Demos", "Docs", "GitHub ↗"]);
				const active = route === "" ? "Home" : route === "docs/" ? "Docs" : "Demos";
				assert.equal(await page.locator(`${selector} [aria-current="page"]`).textContent(), active);
			}
			for(const width of widths)
			{
				await page.setViewportSize({ width, height: 1000 });
				await page.mouse.move(0, 0);
				await page.evaluate(() => globalThis.scrollTo(0, 0));
				const desktop = width > 760;
				assert.equal(await page.locator(".site-links").isVisible(), desktop);
				assert.equal(await page.locator(".mobile-navigation summary").isVisible(), !desktop);
				assert.ok(await page.locator(".site-brand span").isVisible(), "Mobile keeps the site name");
				assert.ok(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
					`${route}: no horizontal overflow at ${width}px`);
				const appearance = await page.evaluate(desktop => {
					const selectors = [
						".site-header", ".site-header-inner", ".site-brand"
						, ".site-brand b", ".site-brand span"
						, desktop ? ".site-links" : ".mobile-navigation summary"
					];
					return selectors.map(selector => {
						const element = globalThis.document.querySelector(selector);
						const bounds = element.getBoundingClientRect();
						const style = globalThis.getComputedStyle(element);
						return {
							selector
							, box: [bounds.x, bounds.y, bounds.width, bounds.height].map(value => Math.round(value * 10) / 10)
							// Vite removes optional font-family quotes; Firefox preserves that spelling.
							, font: style.font.replaceAll('"', ""), color: style.color
							, background: style.backgroundColor
							, border: style.borderBottom, padding: style.padding, gap: style.gap
						};
					});
				}, desktop);
				if(route === "") reference.set(width, appearance);
				else assert.deepEqual(appearance, reference.get(width), `${route}: header matches home at ${width}px`);
				if(!desktop)
				{
					await page.locator(".mobile-navigation summary").focus();
					await page.keyboard.press("Enter");
					assert.ok(await page.locator(".mobile-navigation nav").isVisible(), "Keyboard opens the mobile menu");
					const menu = await page.locator(".mobile-navigation nav").boundingBox();
					assert.ok(menu.x >= 0 && menu.x + menu.width <= width, "Menu fits the viewport");
					await page.keyboard.press("Enter");
					assert.equal(await page.locator(".mobile-navigation nav").isVisible(), false);
				}
			}
			await page.setViewportSize({ width: 390, height: 1000 });
			await page.locator(".mobile-navigation summary").click();
			await page.locator('.mobile-navigation a[href$="/docs/"]').click();
			await page.waitForURL(target("docs/"));
			// The current page link does not navigate, so its native disclosure stays open.
			if(route !== "docs/") await page.waitForFunction(() => !globalThis.document.querySelector(".mobile-navigation").open);
		}
		assert.deepEqual(errors, [], "Header navigation produces no browser errors");
		return { routes: routes.length, demos: demos.length, widths, checks: ["single header", "geometry and typography", "active links", "keyboard mobile menu", "mobile navigation", "no overflow"] };
	}
	finally
	{ await page.close(); }
};

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	const root = resolve(process.env.SITE_ARTIFACT_ROOT ?? "build/github-pages");
	const identity = JSON.parse(await readFile(resolve(root, "build-identity.json"), "utf8"));
	const server = await startSiteServer({ root, base: identity.siteBase });
	const report = { base: identity.siteBase, status: "running", engines: [] };
	const output = resolve("build/header-audit", identity.siteBase === "/" ? "root.json" : "prefixed.json");
	try
	{
		for(const engine of (process.env.SITE_BROWSERS ?? "chromium,firefox,webkit").split(","))
		{
			const type = { chromium, firefox, webkit }[engine];
			assert.ok(type, `Unknown browser ${engine}`);
			let executablePath = engine === "chromium" ? process.env.CHROMIUM_PATH : undefined;
			if(engine === "chromium" && !executablePath)
			{
				try
				{ await access("/usr/bin/chromium"); executablePath = "/usr/bin/chromium"; }
				catch { /* Use Playwright's installed Chromium when no system binary exists. */ }
			}
			const browser = await type.launch({ headless: true, executablePath, args: engine === "chromium" ? ["--no-sandbox"] : [] });
			try
			{
				const checks = await checkSiteHeaders(browser, server.url);
				report.engines.push({ engine, version: browser.version(), ...checks });
				console.log(`PASS ${engine}: shared header on ${checks.routes} pages across ${checks.widths.length} widths`);
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
		await mkdir(resolve("build/header-audit"), { recursive: true });
		await writeFile(output, JSON.stringify(report, null, 2) + "\n");
		await server.close();
	}
}
