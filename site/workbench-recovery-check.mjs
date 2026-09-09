/**
 * Exercise retryable Wasm downloads and route departure during pending module loads.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { waitForWorkbench } from "./workbench-readiness.mjs";
import { settle } from "./graph-browser-helpers.mjs";

const base = new URL(process.env.SITE_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:8765/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const names = ["dijkstra", "flood-fill", "union-find", "topological-sort", "aho-corasick", "lru-cache", "a-star", "tarjan", "token-bucket"];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
try
{
	for(const name of names)
	{
		const slug = `lean-${name}`;
		const page = await browser.newPage({ reducedMotion: "reduce" });
		const pattern = `**/${slug}/runtime/${slug}.wasm`;
		await page.route(pattern, route => route.fulfill({ status: 503, body: "Test: temporary Wasm failure" }));
		await page.goto(new URL(`demos/${slug}/`, base).href);
		await page.getByRole("button", { name: "Retry workbench" }).waitFor();
		await page.unroute(pattern);
		await page.getByRole("button", { name: "Retry workbench" }).click();
		await waitForWorkbench(page, slug);
		assert.equal(await page.locator(".workbench-error").count(), 0, `${slug}: retry clears the error`);
		assert.equal(await page.locator(".site-header").count(), 1);
		await page.close();
		console.log(`PASS ${slug}: failed Wasm download recovers without reloading the document`);
	}
	for(const name of ["dijkstra", "flood-fill", "a-star", "tarjan", "token-bucket"])
	{
		const slug = `lean-${name}`;
		const page = await browser.newPage({ reducedMotion: "reduce" });
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		let resume;
		const gate = new Promise(resolve => { resume = resolve; });
		let requested;
		const started = new Promise(resolve => { requested = resolve; });
		await page.route(`**/${slug}/workbench.mjs`, async route => {
			requested();
			await gate;
			await route.continue();
		});
		await page.goto(new URL(`demos/${slug}/`, base).href, { waitUntil: "domcontentloaded" });
		await started;
		await page.locator(".site-links a").filter({ hasText: /^Docs$/u }).click();
		await page.locator(".docs-layout").waitFor();
		resume();
		await page.waitForLoadState("networkidle");
		await settle(page);
		assert.equal(await page.locator(".workbench-host").count(), 0);
		await page.goBack();
		await waitForWorkbench(page, slug);
		assert.deepEqual(errors, [], `${slug}: pending work cannot mount on the next route`);
		await page.close();
		console.log(`PASS ${slug}: pending module load leaves and returns cleanly`);
	}
	for(const name of ["dijkstra", "aho-corasick"])
	{
		const slug = `lean-${name}`;
		const page = await browser.newPage({ reducedMotion: "reduce" });
		const pattern = `**/${slug}/workbench.mjs`;
		await page.route(pattern, route => route.fulfill({ status: 503, body: "Test: temporary module failure" }));
		await page.goto(new URL(`demos/${slug}/`, base).href);
		await page.getByRole("button", { name: "Retry workbench" }).waitFor();
		await page.unroute(pattern);
		await page.getByRole("button", { name: "Retry workbench" }).click();
		await waitForWorkbench(page, slug);
		assert.equal(await page.locator(".workbench-error").count(), 0);
		await page.close();
		console.log(`PASS ${slug}: retry bypasses a cached module-download failure`);
	}
}
finally
{ await browser.close(); }
