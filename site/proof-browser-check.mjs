/**
 * Check React proof loading, checker controls, and benchmark lifecycle in Chromium.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.env.SITE_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:8765/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const myers = new URL("demos/lean-myers/", base);
const artifact = new URL("lean-myers/", base);
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});

const openPage = async () => {
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	return { page, errors };
};
const ready = page => page.waitForFunction(() =>
	globalThis.document.querySelector("#runtime-status")?.textContent.startsWith("Lean/Wasm ready"), null, { timeout: 30000 });
const checked = async page => {
	await page.locator(".proof-section").scrollIntoViewIfNeeded();
	await page.waitForFunction(() => globalThis.document.querySelector("#audit-status")?.textContent
		=== "Source matches checked build", null, { timeout: 30000 });
};
const retiredLifecycle = async page => {
	await page.locator(".proof-section").waitFor({ state: "detached" });
	await page.evaluate(() => new Promise(resolve =>
		globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));
	return page.evaluate(() => globalThis.proofLifecycle());
};

try
{
	const { page, errors } = await openPage();
	try
	{
		await page.addInitScript(() => {
			const listeners = new Map([["pagehide", new Set()], ["pageshow", new Set()]]);
			const activeObservers = new Set();
			const add = globalThis.addEventListener.bind(globalThis);
			const remove = globalThis.removeEventListener.bind(globalThis);
			globalThis.addEventListener = (name, callback, options) => {
				listeners.get(name)?.add(callback);
				return add(name, callback, options);
			};
			globalThis.removeEventListener = (name, callback, options) => {
				listeners.get(name)?.delete(callback);
				return remove(name, callback, options);
			};
			for(const name of ["IntersectionObserver", "ResizeObserver"])
			{
				const Original = globalThis[name];
				globalThis[name] = new Proxy(Original, { construct: (target, args) => {
					const observer = Reflect.construct(target, args);
					const observe = observer.observe.bind(observer);
					const disconnect = observer.disconnect.bind(observer);
					observer.observe = element => { activeObservers.add(observer); return observe(element); };
					observer.disconnect = () => { activeObservers.delete(observer); return disconnect(); };
					return observer;
				} });
			}
			globalThis.proofLifecycle = () => ({
				listeners: [...listeners.values()].reduce((sum, set) => sum + set.size, 0)
				, observers: activeObservers.size
			});
		});
		let sourceRequests = 0;
		page.on("request", request => { if(request.url().endsWith(".lean")) sourceRequests++; });
		await page.goto(myers.href);
		await ready(page);
		assert.equal(sourceRequests, 0, "Proof sources must remain lazy above the fold");
		let release;
		const held = new Promise(resolve => { release = resolve; });
		let holding = true;
		await page.route(new URL("Myers.lean", artifact).href, async route => {
			if(holding) await held;
			try
{ await route.continue(); }
			catch
{ return; }
		});
		await page.locator(".proof-section").scrollIntoViewIfNeeded();
		await page.waitForFunction(() => globalThis.document.querySelector("#proof-code")?.getAttribute("aria-busy") === "true");
		await page.locator(".site-links a").filter({ hasText: "Docs" }).click();
		await page.waitForURL(new URL("docs/", base).href);
		const retired = await retiredLifecycle(page);
		holding = false;
		release();
		await page.goBack();
		await ready(page);
		await checked(page);
		await page.waitForFunction(() => !globalThis.document.querySelector("#launch-wasm").disabled);
		await page.locator("[data-source-select]").selectOption("ArrayScriptCheck.lean");
		assert.equal(await page.locator("#source-label").textContent(), "ArrayScriptCheck.lean");
		await page.locator(".source-tab").first().focus();
		await page.keyboard.press("ArrowRight");
		assert.equal(await page.locator("#source-label").textContent(), "MyersCore.lean");
		await page.evaluate(() => Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true
			, value: { writeText: async () => { throw new Error("Clipboard denied"); } }
		}));
		await page.locator("#copy-source").click();
		await page.waitForFunction(() => globalThis.document.querySelector("#copy-source").textContent === "Copy failed");
		await page.evaluate(() => {
			const tabs = [];
			globalThis.proofTabs = tabs;
			globalThis.open = () => {
				const tab = { closed: false, focused: 0, urls: [], opener: "page" };
				tab.location = { replace: url => tab.urls.push(url) };
				tab.focus = () => { tab.focused++; };
				tabs.push(tab);
				return tab;
			};
		});
		const label = await page.locator("#launch-wasm").textContent();
		await page.locator("#launch-wasm").click();
		await page.locator("#launch-wasm").click();
		assert.deepEqual(await page.evaluate(() => ({
			count: globalThis.proofTabs.length, focus: globalThis.proofTabs[0].focused
			, opener: globalThis.proofTabs[0].opener
		})),
		{ count: 1, focus: 1, opener: null });
		await page.evaluate(() => { globalThis.proofTabs[0].closed = true; });
		await page.locator("#launch-wasm").click();
		assert.equal(await page.evaluate(() => globalThis.proofTabs.length), 2);
		assert.equal(await page.locator("#launch-wasm").textContent(), label);
		await page.locator("#launch-lean-web").click();
		const challengeUrl = new URL(await page.locator("#open-lean-web").getAttribute("href"));
		const challenge = new URLSearchParams(challengeUrl.hash.slice(1));
		assert.match(challenge.get("challenge"), /theorem solve_total[\s\S]*:= by\n {2}sorry/u);
		assert.match(challenge.get("code"), /#print axioms LeanMyers.solve_total/u);
		await page.evaluate(() => {
			globalThis.proofTabs[1].closed = true;
			globalThis.open = () => null;
		});
		await page.locator("#launch-wasm").click();
		assert.match(await page.locator("#playground-panel b").textContent(), /Popup blocked/u);

		await page.locator("#browser-benchmark").scrollIntoViewIfNeeded();
		if(await page.locator("[data-benchmark-cancel]").isEnabled()) await page.locator("[data-benchmark-cancel]").click();
		await page.locator("[data-benchmark-run]").click();
		await page.evaluate(() => {
				globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pagehide", { persisted: true }));
				globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pageshow", { persisted: true }));
		});
		assert.equal(await page.locator("[data-benchmark-progress]").textContent(), "Cancelled");
		await page.locator("[data-benchmark-run]").click();
		await page.waitForFunction(() => /Completed|failed/u.test(globalThis.document.querySelector("[data-benchmark-progress]").textContent),
			null, { timeout: 120000 });
		assert.match(await page.locator("[data-benchmark-progress]").textContent(), /^Completed/u);
		assert.match(await page.locator("[data-benchmark-summary]").textContent(), /^100 checked shortest scripts/u);
		assert.equal(await page.locator(".benchmark-bar").count(), 10);
		assert.doesNotMatch(await page.locator(".browser-benchmark-metrics").textContent(), /NaN|Infinity/u);
		await page.locator(".site-links a").filter({ hasText: "Docs" }).click();
		await page.waitForURL(new URL("docs/", base).href);
		assert.deepEqual(await retiredLifecycle(page), retired,
			"Repeated route mounts must restore the same listener and observer count");
		assert.deepEqual(errors, []);
		console.log("React proof controls, lazy navigation, checker ownership, and 100-sample benchmark passed.");
	}
	finally
	{ await page.close(); }

	for(const failure of ["missing", "tampered", "compression"])
	{
		const { page, errors } = await openPage();
		try
		{
			if(failure === "compression") await page.addInitScript(() => {
				Object.defineProperty(globalThis, "CompressionStream", { configurable: true, value: undefined });
			});
			else await page.route(new URL("Myers.lean", artifact).href, async route => {
				if(failure === "missing") return route.fulfill({ status: 503, body: "Temporarily unavailable" });
				const response = await route.fetch();
				return route.fulfill({ response, body: await response.text() + "\n-- changed after build\n" });
			});
			await page.goto(myers.href);
			await ready(page);
			await page.locator(".proof-section").scrollIntoViewIfNeeded();
			if(failure === "compression")
			{
				await checked(page);
				await page.waitForFunction(() => !globalThis.document.querySelector("#launch-lean-web").disabled);
				assert.equal(await page.locator("#launch-wasm").isDisabled(), true);
				await page.waitForFunction(() => globalThis.document.querySelector("#launch-wasm").title.includes("cannot create"));
			}
			else
			{
				await page.waitForFunction(() => globalThis.document.querySelector("#audit-status").textContent === "Proof receipt unavailable");
				assert.equal(await page.locator("#launch-wasm").isDisabled(), true);
				assert.equal(await page.locator("#launch-lean-web").isDisabled(), true);
				if(failure === "tampered") assert.match(await page.locator("#audit-status").getAttribute("title"), /does not match/u);
				await page.unroute(new URL("Myers.lean", artifact).href);
				await page.reload();
				await checked(page);
			}
			assert.deepEqual(errors, []);
			console.log(`React proof recovery passed: ${failure}.`);
		}
		finally
		{ await page.close(); }
	}
}
finally
{ await browser.close(); }
