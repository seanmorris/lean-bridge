/**
 * Audit the static React site, no-script content, navigation, budgets, and pilot lifecycles.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { chromium, firefox, webkit } from "playwright";
import { startSiteServer } from "./serve.mjs";
import { demos, docPages, prerenderPaths } from "./registry.mjs";
import { checkSidebarScroll } from "./sidebar-browser-check.mjs";
import { checkSiteHeaders } from "./header-browser-check.mjs";
import { waitForWorkbench } from "./workbench-readiness.mjs";

const root = resolve(process.env.SITE_ARTIFACT_ROOT ?? "build/github-pages");
const identity = JSON.parse(await readFile(resolve(root, "build-identity.json"), "utf8"));
const server = await startSiteServer({ root, base: identity.siteBase });
const report = { createdAt: new Date().toISOString(), base: identity.siteBase, status: "running", engines: [], checks: [], performance: [] };
const output = resolve("build/react-site-audit", identity.siteBase === "/" ? "root" : "prefixed");
const execute = promisify(execFile);
const checkedLinks = new Map();
await mkdir(output, { recursive: true });

/**
 * Follow rendered local links using the exact configured deployment prefix.
 *
 * @param {import('playwright').Page} page Statically rendered document.
 */
const checkLinks = async page => {
	const urls = await page.locator("a[href]").evaluateAll(links => links.map(link => link.href));
	for(const value of new Set(urls))
	{
		const url = new URL(value);
		if(url.origin !== new URL(server.url).origin) continue;
		assert.ok(url.href.startsWith(server.url), `${page.url()}: link escapes deployment prefix: ${value}`);
		const fragment = decodeURIComponent(url.hash.slice(1));
		url.hash = "";
		if(!checkedLinks.has(url.href)) checkedLinks.set(url.href, fetch(url).then(async response => {
			assert.equal(response.status, 200, `${page.url()}: broken link ${value}`);
			return { html: response.headers.get("content-type")?.includes("text/html"), text: await response.text() };
		}));
		const target = await checkedLinks.get(url.href);
		if(fragment && target.html) assert.ok(target.text.includes(`id="${fragment}"`), `Missing rendered fragment ${value}`);
	}
};

/**
 * Check rails across the viewport widths that previously exposed demo overflow.
 *
 * @param {import('playwright').Page} page Browser page to inspect.
 */
const checkLayout = async page => {
	for(const width of [320, 390, 768, 1440, 1920])
	{
		await page.setViewportSize({ width, height: 1000 });
		assert.ok(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth),
			`${page.url()}: horizontal overflow at ${width}px`);
	}
};

/**
 * Record fetched JavaScript gzip bytes and observational cold-load timing.
 *
 * @param {import('playwright').Browser} browser Isolated browser engine.
 * @param {string} route Canonical page path.
 * @param {string} engine Browser engine label.
 */
const measurePage = async (browser, route, engine) => {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const requests = [];
	const scripts = new Map();
	const errors = [];
	page.on("request", request => requests.push(request.url()));
	page.on("pageerror", error => errors.push(error.message));
	page.on("response", response => {
		if(/\.(?:m?js)(?:\?|$)/u.test(response.url())) scripts.set(response.url(), response.body());
	});
	await page.addInitScript(() => {
		globalThis.siteLongTasks = [];
		if(globalThis.PerformanceObserver.supportedEntryTypes.includes("longtask"))
			new globalThis.PerformanceObserver(list => globalThis.siteLongTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: "longtask", buffered: true });
	});
	try
	{
		await page.goto(server.url + route.slice(1));
		await page.waitForFunction(() => globalThis.performance.getEntriesByName("site-hydrated").length > 0);
		await page.locator("main h1").waitFor();
		assert.deepEqual(errors, [], `${engine}/${route}: hydration errors`);
		assert.equal(requests.some(url => /\.wasm(?:\?|$)|\/runtime\/|benchmark-workload/u.test(url)), false,
			`${route}: prose must not request an algorithm runtime`);
		assert.equal(requests.some(url => /search-index\.json/u.test(url)), false, "Search index loads only on use");
		const javascriptGzipBytes = (await Promise.all(scripts.values())).reduce((sum, bytes) => sum + gzipSync(bytes).length, 0);
		assert.ok(javascriptGzipBytes <= 200 * 1024, `${route}: ${javascriptGzipBytes} exceeds 200 KiB JS budget`);
		const timing = await page.evaluate(() => ({
			hydratedMs: globalThis.performance.getEntriesByName("site-hydrated")[0].startTime
			, domContentLoadedMs: globalThis.performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd
			, longTasks: globalThis.siteLongTasks
		}));
		report.performance.push({ engine, route, javascriptGzipBytes, ...timing });
		await checkLayout(page);
		if(engine === "chromium")
		{
			const name = route.replaceAll("/", "-");
			for(const width of [390, 1440])
			{
				await page.setViewportSize({ width, height: 1000 });
				await page.screenshot({ path: resolve(output, `${name}-${width}.png`) });
			}
		}
	}
	finally
	{ await page.close(); }
};

try
{
	for(const engine of (process.env.SITE_BROWSERS ?? "chromium").split(","))
	{
		const type = { chromium, firefox, webkit }[engine];
		assert.ok(type, `Unknown browser ${engine}`);
		let executablePath;
		if(engine === "chromium")
		{
			executablePath = process.env.CHROMIUM_PATH;
			if(!executablePath)
			{
				try
				{ await access("/usr/bin/chromium"); executablePath = "/usr/bin/chromium"; }
				catch
				{ executablePath = chromium.executablePath(); }
			}
		}
		const browser = await type.launch({ executablePath, headless: true, args: engine === "chromium" ? ["--no-sandbox"] : [] });
		try
		{
			report.engines.push({ engine, version: browser.version() });
			const headerChecks = await checkSiteHeaders(browser, server.url);
			report.checks.push({ engine, headerChecks, status: "passed" });
			const sidebarChecks = await checkSidebarScroll(browser, server.url);
			report.checks.push({ engine, sidebarChecks, status: "passed" });
			const noScript = await browser.newPage({ javaScriptEnabled: false });
			for(const path of prerenderPaths)
			{
				const response = await noScript.goto(server.url + path.slice(1));
				assert.equal(response.status(), 200, `${path}: direct static load`);
				assert.equal(await noScript.locator("main h1").count(), 1, `${path}: one visible static heading`);
				assert.equal(await noScript.locator("main h1").isVisible(), true, `${path}: guide must not require streaming scripts`);
				assert.doesNotMatch(await noScript.locator("main").innerText(), /Loading guide/u);
				const guide = docPages.find(entry => entry.route === path && entry.source);
				if(guide && !guide.legacy) assert.ok((await noScript.locator("main").innerText()).length > 500, `${path}: complete guide`);
				await checkLinks(noScript);
				if(path === "/") assert.equal(await noScript.locator(".demo-card").count(), demos.length);
				if(path === "/docs/lean/first-component/") assert.ok(await noScript.locator("pre code").count() > 0);
			}
			const missing = await noScript.goto(server.url + "there-is-no-such-guide/");
			assert.equal(missing.status(), 404);
			assert.match(await noScript.locator("h1").innerText(), /no page/u);
			await noScript.close();
			for(const path of ["/", ...docPages.map(entry => entry.route)])
				await measurePage(browser, path, engine);

			const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
			const errors = [];
			page.on("pageerror", error => errors.push(error.message));
			await page.goto(server.url);
			await page.waitForFunction(() => globalThis.performance.getEntriesByName("site-hydrated").length > 0);
			await page.evaluate(() => { globalThis.siteDocumentMarker = "same-document"; });
			await page.locator('.site-links a[href$="/docs/"]').click();
			await page.locator('.docs-sidebar a[href$="/docs/lean/"]').click();
			await page.waitForURL("**/docs/lean/");
			assert.equal(await page.evaluate(() => globalThis.siteDocumentMarker), "same-document", "Docs use client navigation");
			await page.goBack();
			assert.ok(page.url().endsWith("/docs/"));
			await page.goForward();
			await page.locator("main h1").waitFor();
			await page.locator("#doc-search").fill("ABI");
			await page.locator(".search-results a").first().waitFor();
			assert.ok(await page.locator(".search-results a").count() > 0);
			const outline = page.locator(".doc-outline a").first();
			await outline.click();
			assert.ok(new URL(page.url()).hash.length > 1);
			await page.reload();
			assert.ok(new URL(page.url()).hash.length > 1, "Deep fragments survive reload");
			await page.evaluate(() => { globalThis.siteDocumentMarker = "same-document"; });
			await page.setViewportSize({ width: 390, height: 850 });
			await page.locator(".mobile-navigation summary").click();
			await page.locator('.mobile-navigation a[href$="/demos/"]').click();
			await page.waitForURL("**/demos/");
			await page.waitForFunction(() => !globalThis.document.querySelector(".mobile-navigation").open);
			assert.equal(await page.locator(".mobile-navigation").getAttribute("open"), null);
			await page.locator('input[type="search"]').fill("Myers");
			assert.equal(await page.locator(".demo-card").count(), 1);
			await page.locator(".demo-card a").click();
			await page.waitForFunction(() => globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready"));
			assert.equal(await page.evaluate(() => globalThis.siteDocumentMarker), "same-document", "Myers gallery link uses client navigation");
			assert.equal(await page.locator(".site-header").count(), 1);
			assert.equal(await page.locator(".portfolio-nav").count(), 0, "No double demo shell");
			await checkLayout(page);
			await page.screenshot({ path: resolve(output, `${engine}-myers-desktop.png`), fullPage: true });
			for(const demo of demos.filter(entry => entry.renderingMode === "react"))
			{
				await page.goto(server.url + demo.entrypoint + "?from=legacy#main-content");
				await page.waitForURL(server.url + demo.canonicalPage.slice(1) + "?from=legacy#main-content");
				await waitForWorkbench(page, demo.slug);
				assert.equal(await page.locator(".site-header").count(), 1);
				assert.equal(await page.locator(".portfolio-nav").count(), 0);
				await checkLayout(page);
			}
			assert.deepEqual(errors, [], `${engine}: client navigation errors`);
			await page.close();
			report.checks.push({ engine, staticRoutes: prerenderPaths.length, status: "passed" });
			console.log(`PASS ${engine}: static guides, no-JS, 404, nested links, search, history, gallery, alias, layout, no prose Wasm, JS budget`);
			if(engine === "chromium")
			{
				for(const script of [
					"site/myers-browser-check.mjs", "site/proof-browser-check.mjs"
					, "site/search-browser-check.mjs", "site/performance-check.mjs"
					, "site/graph-browser-check.mjs"
					, "site/workbench-browser-check.mjs"
					, "site/workbench-recovery-check.mjs"
					, "site/docs-browser-check.mjs"
				]) {
					const result = await execute(process.execPath, [resolve(script), server.url], {
						timeout: script === "site/workbench-browser-check.mjs" ? 360000 : 180000
						, env: { ...process.env, CHROMIUM_PATH: executablePath }
					});
					process.stdout.write(result.stdout);
					report.checks.push({ engine, script, status: "passed" });
				}
			}
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
	await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
	await server.close();
}
