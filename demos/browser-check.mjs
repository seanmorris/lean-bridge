/**
 * Audit the assembled gallery under a nested static-host path with real browsers and Wasm.
 *
 * Set DEMO_BROWSERS=chromium,firefox,webkit to cover all three engines.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium, firefox, webkit } from "playwright";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(repository, "build/github-pages");
const output = resolve(repository, "build/demo-browser-audit");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const prefix = "/nested/lean-bridge/";
const types = {
	".html": "text/html"
	, ".mjs": "text/javascript"
	, ".css": "text/css"
	, ".json": "application/json"
	, ".wasm": "application/wasm"
	, ".lean": "text/plain"
};
const server = createServer(async (request, response) => {
	try
	{
		const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
		if(!pathname.startsWith(prefix))
		{
			response.writeHead(404).end();
			return;
		}
		let path = resolve(root, pathname.slice(prefix.length));
		if(path !== root && !path.startsWith(root + sep))
		{
			response.writeHead(403).end();
			return;
		}
		if((await stat(path)).isDirectory()) path = resolve(path, "index.html");
		response.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" });
		response.end(await readFile(path));
	}
	catch
	{ response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = origin + prefix;
const report = { createdAt: new Date().toISOString(), status: "running", engines: [], checks: [] };
const execute = promisify(execFile);
await mkdir(output, { recursive: true });

const checkLayout = async (page, label) => {
	for(const width of [320, 390, 768, 1440])
	{
		await page.setViewportSize({ width, height: 1000 });
		const dimensions = await page.evaluate(() => ({
			page: globalThis.document.documentElement.scrollWidth
			, viewport: globalThis.innerWidth
		}));
		assert.ok(dimensions.page <= dimensions.viewport, `${label}: overflow at ${width}: ${dimensions.page}`);
	}
};

const errorsFor = page => {
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if(message.type() === "error") errors.push(message.text()); });
	page.on("response", response => {
		if(response.url().startsWith(base) && response.status() >= 400)
			errors.push(`HTTP ${response.status()}: ${response.url()}`);
	});
	return errors;
};

const auditDemo = async (browser, engine, demo) => {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
	const errors = errorsFor(page);
	try
	{
		await page.goto(base + demo.entrypoint);
		await page.waitForFunction(() => globalThis.document.querySelector("#audit-status")?.textContent
			=== "Source matches checked build", null, { timeout: 60000 });
		await page.waitForFunction(() => !globalThis.document.querySelector("#launch-wasm").disabled);
		assert.equal(await page.locator("h1").count(), 1, `${demo.slug}: one page heading`);
		assert.equal(await page.locator(".portfolio-nav a").getAttribute("href"), "../");
		const duplicateIds = await page.locator("[id]").evaluateAll(nodes => {
			const ids = nodes.map(node => node.id);
			return ids.filter((id, index) => ids.indexOf(id) !== index);
		});
		assert.deepEqual(duplicateIds, [], `${demo.slug}: unique IDs`);
		await checkLayout(page, `${engine}/${demo.slug}`);
		await page.locator("[data-benchmark-run]").scrollIntoViewIfNeeded();
		await page.waitForFunction(() => globalThis.document.querySelector("[data-benchmark-progress]").textContent
			!== "Waiting to enter view");
		if(await page.locator("[data-benchmark-cancel]").isEnabled())
			await page.locator("[data-benchmark-cancel]").click();
		await page.locator("[data-benchmark-run]").click();
		await page.evaluate(() => {
			globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pagehide", { persisted: true }));
			globalThis.dispatchEvent(new globalThis.PageTransitionEvent("pageshow", { persisted: true }));
		});
		assert.equal(await page.locator("[data-benchmark-progress]").textContent(), "Cancelled");
		await page.locator("[data-benchmark-run]").click();
		await page.waitForFunction(() => /Completed|failed/u.test(
			globalThis.document.querySelector("[data-benchmark-progress]").textContent), null, { timeout: 120000 });
		assert.match(await page.locator("[data-benchmark-progress]").textContent(), /^Completed/u,
			`${engine}/${demo.slug}: ${await page.locator("[data-benchmark-summary]").textContent()}`);
		assert.doesNotMatch(await page.locator(".browser-benchmark-metrics").textContent(), /NaN|Infinity/u);
		assert.equal(await page.locator(".benchmark-bar").count(), 10);
		for(const tab of await page.locator(".source-tab").all())
		{
			await tab.click();
			assert.equal(await tab.getAttribute("aria-selected"), "true");
			assert.equal(await page.locator("#source-label").textContent(), await tab.getAttribute("data-source"));
		}
		await page.evaluate(() => Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true, value: { writeText: async () => undefined }
		}));
		await page.locator("#copy-source").click();
		await page.waitForFunction(() => globalThis.document.querySelector("#copy-source").textContent === "Copied");
		await page.evaluate(() => Object.defineProperty(globalThis.navigator, "clipboard", {
			configurable: true
			, value: { writeText: async () => { throw new Error("Clipboard denied"); } }
		}));
		await page.locator("#copy-source").click();
		await page.waitForFunction(() => globalThis.document.querySelector("#copy-source").textContent === "Copy failed");
		const payloads = await page.locator("#open-wasm, #open-lean-web").evaluateAll(links => links.map(link => link.href));
		assert.ok(payloads[0].startsWith("https://lean.cau.li/#s="));
		const challenge = new URLSearchParams(new URL(payloads[1]).hash.slice(1));
		assert.match(challenge.get("challenge"), /theorem\s+\w+[\s\S]*:= by\s+sorry/u);
		assert.ok(challenge.get("code").includes("#print axioms"));
		assert.deepEqual(errors, [], `${engine}/${demo.slug}: no browser or HTTP errors`);
		report.checks.push({ engine, demo: demo.slug, status: "passed" });
		console.log(`PASS ${engine}: ${demo.slug} (Wasm, proof, clipboard, layout, benchmark cancel/rerun)`);
	}
	catch(error)
	{
		await page.screenshot({ path: resolve(output, `${engine}-${demo.slug}.png`), fullPage: true });
		throw error;
	}
	finally
	{ await page.close(); }
};

const auditFailures = async browser => {
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.route("**/build-identity.json", route => route.abort());
	await page.goto(base);
	await page.waitForFunction(() => globalThis.document.querySelectorAll(".demo-card").length === 12);
	await page.route("**/manifest.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
	await page.reload();
	await page.waitForFunction(() => globalThis.document.querySelector("#build-identity").textContent.includes("Could not refresh"));
	assert.equal(await page.locator(".demo-card").count(), manifest.demos.length);
	await page.route("**/Sweep.lean", route => route.fulfill({ status: 404, body: "Missing" }));
	await page.goto(base + "lean-sweep-and-prune/");
	await page.waitForFunction(() => globalThis.document.querySelector("#audit-status").textContent === "Proof receipt unavailable");
	assert.equal(await page.locator("#copy-source").isDisabled(), true);
	assert.equal(await page.locator("#launch-wasm").isDisabled(), true);
	await page.unroute("**/Sweep.lean");
	await page.route("**/Sweep.lean", async route => {
		const response = await route.fetch();
		await route.fulfill({ response, body: (await response.text()) + "\n-- changed source\n" });
	});
	await page.reload();
	await page.waitForFunction(() => globalThis.document.querySelector("#audit-status").textContent === "Proof receipt unavailable");
	assert.equal(await page.locator("#launch-lean-web").isDisabled(), true);
	await page.unroute("**/Sweep.lean");
	let releaseSource;
	const delayed = new Promise(resolve => { releaseSource = resolve; });
	await page.route("**/Sweep.lean", async route => { await delayed; await route.continue(); });
	await page.reload({ waitUntil: "domcontentloaded" });
	assert.equal(await page.locator("#copy-source").isDisabled(), true);
	for(const tab of await page.locator(".source-tab").all()) assert.equal(await tab.isDisabled(), true);
	releaseSource();
	await page.waitForFunction(() => !globalThis.document.querySelector("#launch-wasm").disabled);
	await page.unroute("**/Sweep.lean");
	await page.route("**/Sweep.lean", route => route.fulfill({ status: 404, body: "Missing after reload" }));
	await page.reload();
	await page.waitForFunction(() => globalThis.document.querySelector("#audit-status").textContent === "Proof receipt unavailable");
	assert.equal(await page.locator("#launch-wasm").isDisabled(), true);
	assert.equal(await page.locator("#launch-lean-web").isDisabled(), true);
	await page.unroute("**/Sweep.lean");
	await page.addInitScript(() => { delete globalThis.CompressionStream; });
	await page.reload();
	await page.waitForFunction(() => !globalThis.document.querySelector("#launch-lean-web").disabled);
	assert.equal(await page.locator("#launch-wasm").isDisabled(), true);
	assert.equal(await page.locator("#audit-status").textContent(), "Source matches checked build");
	await page.evaluate(() => { globalThis.open = () => null; });
	await page.locator("#launch-lean-web").click();
	assert.match(await page.locator("#playground-panel b").textContent(), /Popup blocked/u);
	await page.evaluate(() => {
		globalThis.checkerTest = { opens: 0, focuses: 0, window: null };
		globalThis.open = () => {
			globalThis.checkerTest.opens++;
			const opened = {
				closed: false, opener: null
				, location: { replace: () => undefined }
				, focus: () => { globalThis.checkerTest.focuses++; }
			};
			globalThis.checkerTest.window = opened;
			return opened;
		};
	});
	const label = await page.locator("#launch-lean-web").textContent();
	await page.locator("#launch-lean-web").click();
	await page.locator("#launch-lean-web").click();
	assert.deepEqual(await page.evaluate(() => [globalThis.checkerTest.opens, globalThis.checkerTest.focuses]), [1, 1]);
	await page.evaluate(() => { globalThis.checkerTest.window.closed = true; });
	await page.locator("#launch-lean-web").click();
	assert.equal(await page.evaluate(() => globalThis.checkerTest.opens), 2);
	assert.equal(await page.locator("#launch-lean-web").textContent(), label);
	assert.deepEqual(errors, []);
	await page.close();
};

try
{
	for(const engine of (process.env.DEMO_BROWSERS ?? "chromium").split(","))
	{
		const type = { chromium, firefox, webkit }[engine];
		assert.ok(type, `Unknown browser engine ${engine}`);
		let executablePath;
		if(engine === "chromium")
		{
			executablePath = process.env.CHROMIUM_PATH;
			if(!executablePath)
			{
				try
				{
					await access("/usr/bin/chromium");
					executablePath = "/usr/bin/chromium";
				}
				catch { /* Use Playwright's pinned browser. */ }
			}
		}
		const browser = await type.launch({ headless: true, executablePath, args: engine === "chromium" ? ["--no-sandbox"] : [] });
		try
		{
			report.engines.push({ name: engine, version: browser.version() });
			const noScript = await browser.newPage({ javaScriptEnabled: false });
			await noScript.goto(base);
			assert.equal(await noScript.locator(".demo-card").count(), manifest.demos.length);
			await checkLayout(noScript, `${engine}/gallery-without-JS`);
			await noScript.close();
			for(const demo of manifest.demos) await auditDemo(browser, engine, demo);
			await auditFailures(browser);
			if(engine === "chromium")
			{
				const checks = [
					["lean-dijkstra/browser-ux-check.mjs", "lean-dijkstra/"]
					, ["lean-aho-corasick/browser-ux-check.mjs", "lean-aho-corasick/"]
					, ["lean-dinic/browser-animation-check.mjs", "lean-dinic/"]
					, ["lean-myers/browser-ux-check.mjs", "lean-myers/"]
					, ["lean-sweep-and-prune/browser-ux-check.mjs", "lean-sweep-and-prune/"]
					, ["interaction-check.mjs", ""]
					, ["runtime-retry-check.mjs", ""]
				];
				for(const [script, route] of checks)
				{
					const result = await execute(process.execPath, [resolve(repository, "demos", script), base + route], {
						cwd: repository, timeout: 180000
						, env: { ...process.env, CHROMIUM_PATH: executablePath ?? chromium.executablePath() }
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
	await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
	await new Promise(resolve => server.close(resolve));
}
