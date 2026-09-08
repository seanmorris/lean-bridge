/**
 * Check exact pattern editing and lifecycle recovery against the real Lean matcher.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8765/demos/lean-aho-corasick/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
try
{
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.route("**/browser-benchmark.mjs", route => route.fulfill({
		contentType: "text/javascript"
		, body: "export const attachBrowserBenchmark=()=>({});export const measureSyncBenchmark=()=>({});"
	}));
	await page.goto(url);
	await page.waitForFunction(() => globalThis.document.querySelectorAll(".pattern-chip").length === 6);
	await page.locator("#patterns").fill("zebra");
	await page.locator("#input").fill("zebra zebra ERROR");
	await page.waitForFunction(() => globalThis.document.querySelector("#match-count").textContent === "2");
	assert.equal(await page.locator(".pattern-chip span").textContent(), "zebra");
	await page.locator("#patterns").fill("");
	await page.waitForFunction(() => globalThis.document.querySelector("#verdict-title").textContent === "Add at least one pattern.");
	assert.equal(await page.locator("#match-count").textContent(), "0");
	assert.equal(await page.locator(".pattern-chip,.char.matched").count(), 0);
	await page.locator("#input").fill("zebra ERROR ERROR");
	await page.waitForTimeout(200);
	assert.equal(await page.locator("#match-count").textContent(), "0");
	assert.equal(await page.locator("#highlighted-text").textContent(), "zebra ERROR ERROR");
	await page.locator("#patterns").fill(" a \na");
	await page.locator("#input").fill("a a a");
	await page.waitForFunction(() => globalThis.document.querySelector("#match-count").textContent === "4");
	assert.deepEqual(await page.locator(".pattern-chip span").allTextContents(), [" a ", "a"]);
	await page.evaluate(() => {
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pagehide", { persisted: true }));
		globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pageshow", { persisted: true }));
	});
	await page.waitForFunction(() => globalThis.document.querySelectorAll(".pattern-chip").length === 2);
	assert.equal(await page.locator("#match-count").textContent(), "4");
	await page.locator("#patterns").fill("<img\n<script");
	await page.locator("#input").fill("<img src=x><script>alert(1)</script>");
	await page.waitForFunction(() => globalThis.document.querySelector("#match-count").textContent === "2");
	assert.equal(await page.locator("#highlighted-text img,#highlighted-text script").count(), 0);
	assert.deepEqual(errors, []);
	console.log("PASS: rapid pattern/text edits, empty pattern reset, significant spaces, exact matches, escaped highlights, and restored-page matcher ownership.");
}
finally
{ await browser.close(); }
