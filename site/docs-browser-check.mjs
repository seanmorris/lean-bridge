/**
 * Check every published guide's layout, grouped navigation, and static article.
 *
 * Accepts a running site's base URL as argv[2] or SITE_BASE_URL.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { demos, docPages } from "./registry.mjs";
import contributingCompatibility from "../tests/fixtures/documentation/contributing-compatibility.json" with { type: "json" };

const base = new URL(process.argv[2] ?? process.env.SITE_BASE_URL ?? "http://127.0.0.1:39061/");
assert.ok(base.pathname.endsWith("/"), "The site base URL must end with a slash");
const variant = base.pathname === "/" ? "root" : "prefixed";
const output = resolve("build/documentation-site-audit", variant);
const groups = [...new Set(docPages.map(guide => guide.group))];
const visibleGuides = docPages.filter(guide => !guide.legacy);
const artifact = await fetch(new URL("build-identity.json", base), { signal: AbortSignal.timeout(30000) });
assert.equal(artifact.status, 200, "The audit needs an assembled site identity");
const identity = await artifact.json();
const report = {
	createdAt: new Date().toISOString(), base: base.href, status: "running"
	, artifact: { commit: identity.commit, sourceState: identity.sourceState, generatedAt: identity.generatedAt }
	, guides: [], compatibility: []
};
const target = route => new URL(route.slice(1), base).href;
const normalize = text => text.replace(/\s+/gu, " ").trim();
await mkdir(output, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH ?? await access("/usr/bin/chromium").then(
	() => "/usr/bin/chromium", () => chromium.executablePath()
);
const browser = await chromium.launch({
	executablePath
	, headless: true, args: ["--no-sandbox"]
});
report.browser = { engine: "chromium", version: browser.version() };

/**
 * Check a scroll container's content remains reachable without widening the page.
 *
 * @param {import('playwright').Page} page Guide under inspection.
 */
const checkContainedContent = async page => page.locator("article pre, article table").evaluateAll(nodes => nodes.map(node => {
	const bounds = node.getBoundingClientRect();
	const previous = node.scrollLeft;
	const overflowing = node.scrollWidth > node.clientWidth + 1;
	if(overflowing) node.scrollLeft = node.scrollWidth;
	const reachable = !overflowing || node.scrollLeft > 0;
	node.scrollLeft = previous;
	return {
		tag: node.tagName, left: bounds.left, right: bounds.right
		, overflowing, reachable
		, overflowX: globalThis.getComputedStyle(node).overflowX
	};
}));

/**
 * Check that pagination uses only immediate neighbors within the current group.
 *
 * @param {import('playwright').Page} page Guide under inspection.
 * @param {typeof docPages[number]} guide Registry entry for the current guide.
 */
const checkPagination = async (page, guide) => {
	const sequence = guide.legacy ? [] : visibleGuides.filter(entry => entry.group === guide.group);
	const index = sequence.findIndex(entry => entry.route === guide.route);
	const expected = [];
	if(sequence[index - 1]) expected.push({ rel: "prev", href: target(sequence[index - 1].route) });
	if(sequence[index + 1]) expected.push({ rel: "next", href: target(sequence[index + 1].route) });
	const actual = await page.locator(".doc-pagination a").evaluateAll(links => links.map(link => ({
		rel: link.rel, href: link.href
	})));
	assert.deepEqual(actual, expected, `${guide.id}: group-preserving previous/next destinations`);
	if(expected.length)
	{
		await page.evaluate(() => { globalThis.documentationVisit = "same-document"; });
		await page.locator(".doc-pagination a").first().click();
		await page.waitForURL(expected[0].href);
		await page.locator("main article h1").waitFor();
		assert.equal(await page.evaluate(() => globalThis.documentationVisit), "same-document",
			`${guide.id}: pagination stays in the React document`);
		await page.goBack();
		await page.waitForURL(target(guide.route));
		await page.locator("main article h1").waitFor();
	}
};

/**
 * Inspect every article at three widths and compare it with its no-JS rendering.
 *
 * @param {import('playwright').Page} page Hydrated document.
 * @param {import('playwright').Page} noScript JavaScript-disabled document.
 * @param {typeof docPages[number]} guide Registry entry for the current guide.
 */
const checkGuide = async (page, noScript, guide) => {
	const response = await page.goto(target(guide.route));
	assert.equal(response.status(), 200, `${guide.id}: direct load`);
	await page.waitForFunction(() => globalThis.performance.getEntriesByName("site-hydrated").length > 0);
	assert.equal(await page.locator(".site-header").count(), 1, `${guide.id}: one site shell`);
	assert.equal(await page.locator("main").count(), 1, `${guide.id}: one main landmark`);
	assert.equal(await page.locator("h1").count(), 1, `${guide.id}: one page heading`);
	assert.equal(await page.locator("main article h1").isVisible(), true);
	if(guide.consumerIds?.length || ["consume", "receive-package", "php"].includes(guide.id))
	{
		assert.deepEqual(await page.locator("article h2").allTextContents(),
			["Use a prepared release", "Start from a raw Lean package"], `${guide.id}: consumer flow precedes source preparation`);
		assert.deepEqual(await page.locator(".doc-outline a").allTextContents(),
			["Use a prepared release", "Start from a raw Lean package"], `${guide.id}: both entry points are visible in the outline`);
	}
	assert.equal(await page.locator(".portfolio-nav").count(), 0, `${guide.id}: no legacy shell`);
	const active = page.locator('.doc-navigation a[aria-current="page"]');
	assert.equal(await active.count(), guide.legacy ? 0 : 1, `${guide.id}: active guide excludes compatibility pages`);
	if(!guide.legacy) assert.equal(await active.getAttribute("href"), new URL(target(guide.route)).pathname);
	assert.deepEqual(await page.locator(".doc-navigation nav > section > h2").allTextContents(), groups);
	const article = normalize(await page.locator("main article").innerText());
	assert.ok(article.length > (guide.legacy ? 100 : 500), `${guide.id}: complete article`);
	const layouts = [];
	for(const width of [320, 390, 1440])
	{
		await page.setViewportSize({ width, height: 1000 });
		await page.waitForFunction(desktop => globalThis.document.querySelector(".doc-navigation").open === desktop,
			width > 760);
		await page.evaluate(() => globalThis.scrollTo(0, 0));
		const dimensions = await page.evaluate(() => ({
			width: globalThis.innerWidth
			, scrollWidth: globalThis.document.documentElement.scrollWidth
		}));
		assert.ok(dimensions.scrollWidth <= width, `${guide.id}: page overflow at ${width}px`);
		const containers = await checkContainedContent(page);
		for(const container of containers)
		{
			assert.ok(container.left >= 0 && container.right <= width + 1,
				`${guide.id}: ${container.tag} leaves its rail at ${width}px`);
			assert.ok(container.reachable, `${guide.id}: clipped ${container.tag} content at ${width}px`);
			if(container.overflowing) assert.match(container.overflowX, /^(?:auto|scroll)$/u);
		}
		layouts.push({ ...dimensions, containers });
		await page.screenshot({ path: resolve(output, `${guide.id}-${width}.png`) });
		if(width === 390 && containers.length)
		{
			await page.locator("article pre, article table").first().scrollIntoViewIfNeeded();
			await page.screenshot({ path: resolve(output, `${guide.id}-content-${width}.png`) });
		}
	}
	await checkPagination(page, guide);
	assert.equal((await noScript.goto(target(guide.route))).status(), 200);
	assert.equal(await noScript.locator("main article h1").isVisible(), true);
	assert.equal(normalize(await noScript.locator("main article").innerText()), article,
		`${guide.id}: no-JS article matches the hydrated article`);
	assert.equal(await noScript.locator(".doc-navigation").getAttribute("open"), "");
	assert.equal(await noScript.locator(".doc-navigation a").count(), visibleGuides.length);
	report.guides.push({ id: guide.id, route: guide.route, characters: article.length, layouts });
	console.log(`PASS documentation: ${guide.id} (three widths, pagination, no-JS parity)`);
};

/**
 * Follow historical heading bookmarks through readable compatibility pages.
 *
 * @param {import('playwright').Page} page Hydrated document.
 * @param {import('playwright').Page} noScript JavaScript-disabled document.
 */
const checkCompatibility = async (page, noScript) => {
	for(const migration of contributingCompatibility)
	{
		for(const [depth, id] of migration.headings)
		{
			for(const [reader, javaScriptEnabled] of [[page, true], [noScript, false]])
			{
				const bookmark = target(migration.route) + `?from=bookmark#${id}`;
				assert.equal((await reader.goto(bookmark)).status(), 200);
				assert.equal((await reader.reload()).status(), 200);
				if(javaScriptEnabled) await reader.waitForFunction(() =>
					globalThis.performance.getEntriesByName("site-hydrated").length > 0);
				assert.equal(reader.url(), bookmark, "Compatibility pages retain the bookmarked address on reload");
				const heading = reader.locator(`article h${depth}[id="${id}"]`);
				assert.equal(await heading.count(), 1, `${migration.id}: historical ${id}`);
				const forwarding = heading.locator("xpath=following-sibling::p[1]//a").first();
				const destination = target(migration.target) + `#${id}`;
				assert.equal(await forwarding.evaluate(link => link.href), destination);
				if(javaScriptEnabled) await reader.evaluate(() => { globalThis.documentationVisit = "same-document"; });
				await forwarding.click();
				await reader.waitForURL(destination);
				assert.equal(await reader.locator(`article [id="${id}"]`).count(), 1);
				if(javaScriptEnabled) assert.equal(await reader.evaluate(() => globalThis.documentationVisit), "same-document",
					"Compatibility links stay in the React document");
				report.compatibility.push({ from: bookmark, to: destination, javaScriptEnabled });
			}
		}
		console.log(`PASS documentation bookmarks: ${migration.id} (reload, section links, with and without JavaScript)`);
	}
};

try
{
	const page = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
	const noScript = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
	const errors = [];
	const requests = [];
	report.browserErrors = errors;
	report.failedRequests = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("request", request => requests.push(request.url()));
	page.on("requestfailed", request => report.failedRequests.push({
		url: request.url(), error: request.failure()?.errorText
	}));
	for(const guide of docPages) await checkGuide(page, noScript, guide);
	await checkCompatibility(page, noScript);
	await page.evaluate(() => { globalThis.documentationVisit = "same-document"; });
	await page.locator('.site-footer a[href$="/docs/contributing/"]').click();
	await page.waitForURL(target("/docs/contributing/"));
	assert.equal(await page.locator("article h1").isVisible(), true, "The shared footer opens Contributing");
	assert.equal(await page.evaluate(() => globalThis.documentationVisit), "same-document",
		"The contributor footer link stays in the React document");
	assert.deepEqual(errors, [], "Guides render and navigate without browser errors");
	assert.equal(requests.some(url => /\.wasm(?:\?|$)|\/runtime\/|benchmark-workload/u.test(url)), false,
		"Documentation visits do not fetch algorithm runtimes");
	await page.setViewportSize({ width: 390, height: 1000 });
	await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
	for(const group of groups)
	{
		const guide = visibleGuides.filter(entry => entry.group === group).at(-1);
		await page.locator(".doc-navigation > summary").click();
		const link = page.locator(".doc-navigation a").filter({ hasText: guide.title });
		await link.click();
		await page.waitForURL(target(guide.route));
		await page.waitForFunction(() => !globalThis.document.querySelector(".doc-navigation").open);
		assert.equal(await page.locator("main article h1").isVisible(), true);
	}
	const sweep = demos.find(demo => demo.slug === "lean-sweep-and-prune");
	for(const guide of docPages.filter(entry => entry.group === "Concepts"))
	{
		await page.goto(target(guide.route));
		const link = page.locator(`article a[href="${new URL(target(sweep.canonicalPage)).pathname}"]`).first();
		assert.ok(await link.count(), `${guide.id}: a link opens the actual Sweep workbench`);
		await link.click();
		await page.waitForURL(target(sweep.canonicalPage));
		await page.locator("#scene").waitFor();
		await page.waitForFunction(() => globalThis.document.querySelector("#runtime-status")?.textContent.includes("ready"));
	}
	assert.deepEqual(errors, [], "Concept-to-demo navigation has no browser errors");
	report.mobileGroups = groups;
	report.conceptWorkbenches = docPages.filter(entry => entry.group === "Concepts").map(entry => ({
		from: entry.route, to: sweep.canonicalPage
	}));
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
	await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
	await browser.close();
}
