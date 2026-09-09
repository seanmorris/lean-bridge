/**
 * Exercise benchmark scheduling against the real percolation animation and Wasm exports.
 *
 * @file
 */

import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";

/**
 * Check that scrolling and editing cannot make the benchmark compete with the demo.
 *
 * @param browser Browser engine under test.
 * @param baseURL Exact static deployment base.
 */
export const checkUnionFindBenchmarkScheduling = async (browser, baseURL) => {
	const base = new URL(baseURL);
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	const progress = () => page.locator("[data-benchmark-progress]").textContent();
	try
	{
		await page.goto(new URL("docs/", base).href);
		await page.evaluate(async url => {
			const runtime = await import(url);
			const module = await runtime.ready();
			const audit = { prepared: 0, released: 0, calls: 0, concurrent: 0, firstPreparation: null };
			const prepare = module._lean_union_find_prepare_partition;
			const solve = module._lean_union_find_solve_prepared_partition;
			const release = module._lean_union_find_release_partition;
			module._lean_union_find_prepare_partition = (...args) => {
				audit.prepared++;
				audit.firstPreparation ??= {
					running: !globalThis.document.querySelector("#pause").disabled
					, filling: globalThis.document.querySelectorAll(".site.filling").length
				};
				return prepare(...args);
			};
			module._lean_union_find_solve_prepared_partition = (...args) => {
				audit.calls++;
				if(!globalThis.document.querySelector("#pause").disabled) audit.concurrent++;
				return solve(...args);
			};
			module._lean_union_find_release_partition = (...args) => { audit.released++; return release(...args); };
			globalThis.unionBenchmarkAudit = audit;
		}, new URL("lean-union-find/runtime.mjs", base).href);
		await page.locator('.site-links a[href$="/demos/"]').click();
		await page.locator('.demo-card a[href$="/demos/lean-union-find/"]').click();
		await page.waitForFunction(() => /^\d/u.test(globalThis.document.querySelector("#runtime")?.textContent ?? ""));
		await page.waitForFunction(() => globalThis.document.querySelector("#pause").disabled && globalThis.document.querySelectorAll(".site.filling").length === 0);
		await page.waitForTimeout(250);
		assert.ok(await page.locator("#browser-benchmark").evaluate(element => element.getBoundingClientRect().top > globalThis.innerHeight));
		assert.equal(await page.evaluate(() => globalThis.unionBenchmarkAudit.prepared), 0, "No offscreen benchmark preparation");
		assert.equal(await progress(), "Waiting to enter view");

		await page.locator("#reset").click();
		await page.locator("#browser-benchmark").scrollIntoViewIfNeeded();
		await page.waitForFunction(() => globalThis.document.querySelector("[data-benchmark-progress]").textContent === "Waiting for demo to settle");
		assert.equal(await page.evaluate(() => globalThis.unionBenchmarkAudit.prepared), 0, "Visible benchmark waits for the run and its fill animations");
		await page.waitForFunction(() => globalThis.unionBenchmarkAudit.calls > 0);
		assert.deepEqual(await page.evaluate(() => globalThis.unionBenchmarkAudit.firstPreparation), { running: false, filling: 0 });

		await page.evaluate(() => globalThis.scrollTo(0, 0));
		await page.waitForFunction(() => globalThis.document.querySelector("[data-benchmark-progress]").textContent === "Waiting to enter view");
		const beforeRun = await page.evaluate(() => globalThis.unionBenchmarkAudit.calls);
		await page.locator("#reset").click();
		await page.waitForTimeout(300);
		assert.equal(await page.evaluate(() => globalThis.unionBenchmarkAudit.calls), beforeRun, "Scrolling away and re-running the demo suspends measurements");
		await page.locator("#browser-benchmark").scrollIntoViewIfNeeded();
		await page.waitForFunction(() => /^Completed/u.test(globalThis.document.querySelector("[data-benchmark-progress]").textContent), null, { timeout: 120000 });
		assert.match(await page.locator("[data-benchmark-summary]").textContent(), /^100 checked partitions agreed/u);
		assert.equal(await page.locator(".benchmark-bar").count(), 10);
		assert.equal(await page.evaluate(() => globalThis.unionBenchmarkAudit.concurrent), 0, "No prepared benchmark calls overlap a demo run");
		await page.locator('.site-links a[href$="/docs/"]').click();
		await page.waitForURL(new URL("docs/", base).href);
		await page.waitForFunction(() => globalThis.unionBenchmarkAudit.released === globalThis.unionBenchmarkAudit.prepared);
		const finished = await page.evaluate(() => ({ ...globalThis.unionBenchmarkAudit }));
		assert.deepEqual(errors, []);
		return { status: "passed", ...finished, checks: ["offscreen preparation", "animation settling", "scroll suspension", "demo rerun priority", "100 fresh samples", "handle disposal"] };
	}
	finally
	{ await page.close(); }
};

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
	const base = process.argv[2] ?? process.env.SITE_BASE_URL;
	assert.ok(base, "Pass the running site's base URL");
	for(const engine of (process.env.DEMO_BROWSERS ?? "chromium,firefox,webkit").split(","))
	{
		const browser = await { chromium, firefox, webkit }[engine].launch(engine === "chromium"
			? { executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
		try
		{ console.log(JSON.stringify({ engine, ...await checkUnionFindBenchmarkScheduling(browser, base) })); }
		finally
		{ await browser.close(); }
	}
}
