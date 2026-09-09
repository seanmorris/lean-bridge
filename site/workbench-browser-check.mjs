/**
 * Audit the nine scoped React ports with actual Wasm, edits, history, and native handles.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { instrumentLifecycle, settle, pageTransition } from "./graph-browser-helpers.mjs";
import { waitForWorkbench } from "./workbench-readiness.mjs";

const base = new URL(process.env.SITE_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:8765/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const configurations = [
	["dijkstra", [["demo_prepare_graph", "demo_release_graph"]]]
	, ["flood-fill", [["capability_prepare", "capability_release"]]]
	, ["union-find", [["union_find_prepare_partition", "union_find_release_partition"]]]
	, ["topological-sort", [["topological_sort_prepare", "topological_sort_release"]]]
	, ["aho-corasick", [["aho_prepare", "aho_release"]]]
	, ["lru-cache", [["lru_create", "lru_destroy"], ["lru_prepare_trace", "lru_destroy_trace"]]]
	, ["a-star", [["astar_prepare_c", "astar_release"]]]
	, ["tarjan", [["tarjan_prepare_c", "tarjan_release"]]]
	, ["token-bucket", [["token_bucket_create", "token_bucket_release"], ["token_bucket_prepare_trace", "token_bucket_release_trace"]]]
];
const report = {
	base: base.pathname, createdAt: new Date().toISOString(), status: "running"
	, benchmark: process.env.WORKBENCH_SKIP_BENCHMARK ? "separate browser suite" : "checked 100-sample comparison"
	, checks: []
};

const toDocs = async page => {
	await page.locator(".site-links a").filter({ hasText: /^Docs$/u }).click();
	await page.waitForURL(new URL("docs/", base).href);
	await page.locator(".docs-layout").waitFor();
	await settle(page);
};
const returnToDemo = async (page, slug) => {
	await page.goBack();
	await page.waitForURL(new URL(`demos/${slug}/`, base).href);
	await waitForWorkbench(page, slug);
	await settle(page);
};
const dragAcross = async (page, first, last) => {
	await page.locator(first).scrollIntoViewIfNeeded();
	const from = await page.locator(first).boundingBox();
	const to = await page.locator(last).boundingBox();
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
	await page.mouse.up();
	await settle(page);
};

const edit = async (page, name) => {
	switch(name)
	{
		case "dijkstra":
			await page.locator("#clear").click();
			await dragAcross(page, '[data-index="140"]', '[data-index="146"]');
			assert.equal(await page.locator('.cell.wall[data-index="143"]').count(), 1);
			await page.locator('[data-mode="start"]').click();
			await page.locator('[data-index="170"]').click();
			break;
		case "flood-fill":
			await page.locator("#keys button").first().click();
			await page.locator('#world [data-room="1"]').click();
			await dragAcross(page, '#room-grid [data-tile="42"]', '#room-grid [data-tile="45"]');
			for(const tile of [35, 47, 48, 49])
			{
				const cell = page.locator(`#room-grid [data-tile="${tile}"]`);
				if(await cell.evaluate(node => node.classList.contains("wall"))) await cell.click();
			}
			await page.locator('[data-tool="key"]').click();
			await page.locator("#key-picker button").nth(2).click();
			await page.locator('#room-grid [data-tile="49"]').click();
			await page.locator('[data-tool="ledge"]').click();
			await page.locator('[data-ledge-mode="up-left"]').click();
			await page.locator('#room-grid [data-tile="48"]').click();
			await settle(page);
			assert.match(await page.locator('#room-grid [data-tile="48"]').getAttribute("aria-label"), /ledge up \+ left/u);
			await page.locator('#direction-picker button[title="Erase one-way ledges"]').click();
			await page.locator('#room-grid [data-tile="48"]').click();
			await settle(page);
			assert.equal(await page.locator('#room-grid [data-tile="48"].has-ledge').count(), 0);
			await page.locator('[data-ledge-mode="up-left"]').click();
			await page.locator('#room-grid [data-tile="48"]').click();
			await page.locator("#room-grid .door-requirement").first().click();
			await page.locator("#room-grid .door-status").first().click();
			break;
		case "union-find":
			await page.locator("#pause").evaluate(button => { if(!button.disabled) button.click(); });
			await page.locator("#seed").fill("1130cafe");
			await page.locator("#apply-seed").click();
			await page.locator("#pause").evaluate(button => { if(!button.disabled) button.click(); });
			await page.locator("#tool-wall").click();
			await dragAcross(page, '[data-site="120"]', '[data-site="125"]');
			assert.equal(await page.locator('.site.wall[data-site="123"]').count(), 1);
			break;
		case "topological-sort":
			await page.locator("#cycle-preset").click();
			await page.locator("#task-name").fill("React release");
			await page.locator("#task-name").press("Tab");
			break;
		case "aho-corasick":
			await page.locator("#patterns").fill("aba\nba\nλ");
			await page.locator("#input").fill("ababa λ");
			await page.waitForFunction(() => globalThis.document.querySelector("#match-count").textContent === "5");
			await page.locator("#pattern-results button").first().click();
			break;
		case "lru-cache":
			await page.locator('[data-scenario="scan"]').click();
			await page.locator("#capacity").selectOption("4");
			for(let index = 0; index < 8; index++) await page.locator("#step").click();
			break;
		case "a-star":
			await page.locator("#terrain-seed").fill("react-parity");
			await page.locator("#terrain-seed").press("Enter");
			await page.locator('[data-strength="50"]').click();
			await page.locator('[data-tool="forest"]').click();
			await page.locator("#astar-map").click({ position: { x: 100, y: 100 } });
			break;
		case "tarjan":
			await page.locator("#module-name").fill("React module");
			await page.locator("#module-name").press("Tab");
			await page.locator("#toggle-feedback").click();
			await page.locator("#collapse-groups").click();
			break;
		case "token-bucket":
			await page.locator('[data-advance="250"]').click();
			await page.locator('[data-advance="250"]').click();
			await page.locator("#request-cost").fill("2");
			await page.locator("#request-cost").press("Tab");
			await page.locator("#send-request").click();
			break;
	}
	await settle(page);
};

const state = (page, name) => page.evaluate(name => {
	const all = selector => [...globalThis.document.querySelectorAll(selector)];
	const value = selector => globalThis.document.querySelector(selector)?.value;
	const text = selector => globalThis.document.querySelector(selector)?.textContent;
	const attribute = (selector, attr) => globalThis.document.querySelector(selector)?.getAttribute(attr);
	switch(name)
	{
		case "dijkstra": return {
			walls: all(".cell.wall").map(node => node.dataset.index)
			, start: attribute(".cell.start", "data-index")
			, target: attribute(".cell.end", "data-index")
			, mode: attribute('.mode[aria-checked="true"]', "data-mode")
		};
		case "flood-fill": return {
			seed: text("#seed")
			, room: text("#room-name")
			, keys: all("#keys button").map(node => node.getAttribute("aria-pressed"))
			, tiles: all("#room-grid .tile").map(node => node.getAttribute("aria-label"))
			, editor: attribute('.tool[aria-checked="true"]', "data-tool")
			, ledge: attribute("#direction-picker .active", "data-ledge-mode")
		};
		case "union-find": return {
			seed: value("#seed")
			, sites: all(".site").map(node => [node.classList.contains("wall"), node.classList.contains("active")])
			, tool: attribute("#site-grid", "data-tool"), active: text("#active-count")
		};
		case "topological-sort": return { name: value("#task-name"), schedule: text("#schedule"), dependencies: text("#dependency-list") };
		case "aho-corasick": return { patterns: value("#patterns"), input: value("#input"), matches: text("#match-count"), selected: all('#pattern-results [aria-pressed="true"]').map(node => node.textContent) };
		case "lru-cache": return { capacity: value("#capacity"), slots: text("#cache-slots"), hits: text("#hit-count"), misses: text("#miss-count"), title: text("#timeline-title"), next: text("#next-resource") };
		case "a-star": return { seed: value("#terrain-seed"), estimate: text("#astar-estimate"), heuristic: text("#heuristic-copy"), route: text("#astar-route"), tool: attribute('[data-tool][aria-pressed="true"]', "data-tool"), raster: globalThis.document.querySelector("#astar-map").toDataURL() };
		case "tarjan": return { name: value("#module-name"), nodes: text("#node-layer"), imports: text("#import-list"), collapsed: attribute("#collapse-groups", "aria-pressed") };
		case "token-bucket": return { balance: text("#token-balance"), now: text("#clock-value"), cost: value("#request-cost"), allowed: text("#allowed-count"), throttled: text("#throttled-count"), history: text("#request-timeline"), decision: text("#decision-explanation") };
	}
}, name);

const instrumentHandles = (page, slug, pairs) => page.evaluate(async ({ url, pairs }) => {
	const runtime = await import(url);
	const module = await (runtime.ready ?? runtime.initRuntime)();
	const handles = new Set();
	const pointers = new Set();
	let created = 0;
	let released = 0;
	let invalid = 0;
	for(const [prepareName, releaseName] of pairs)
	{
		const prepare = module[`_lean_${prepareName}`];
		const release = module[`_lean_${releaseName}`];
		if(!prepare || !release) throw new Error(`Missing native ownership exports: ${prepareName}`);
		module[`_lean_${prepareName}`] = (...args) => {
			const handle = prepare(...args) >>> 0;
			if(handle)
{ handles.add(`${prepareName}:${handle}`); created++; }
			return handle;
		};
		module[`_lean_${releaseName}`] = handle => {
			if(!handles.delete(`${prepareName}:${handle >>> 0}`)) invalid++;
			released++;
			return release(handle);
		};
	}
	const malloc = module._malloc;
	const free = module._free;
	module._malloc = bytes => { const pointer = malloc(bytes); if(pointer) pointers.add(pointer); return pointer; };
	module._free = pointer => { if(pointer && !pointers.delete(pointer)) invalid++; return free(pointer); };
	globalThis.__portHandles = () => ({ live: handles.size, allocations: pointers.size, created, released, invalid });
}, { url: new URL(`${slug}/runtime.mjs`, base).href, pairs });

const resourceSnapshot = async (page, cdp) => {
	await settle(page);
	if(cdp) await cdp.send("HeapProfiler.collectGarbage");
	return {
		...await page.evaluate(() => ({ handles: globalThis.__portHandles(), lifecycle: globalThis.__graphLifecycle() }))
		, dom: cdp ? await cdp.send("Memory.getDOMCounters") : null
	};
};

try
{
	for(const engine of (process.env.WORKBENCH_BROWSERS ?? "chromium").split(","))
	{
		const browser = await ({ chromium, firefox, webkit }[engine]).launch(engine === "chromium"
			? { executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
		try
		{
			for(const [name, pairs] of configurations)
			{
				if(process.env.WORKBENCH_DEMOS && !process.env.WORKBENCH_DEMOS.split(",").includes(name)) continue;
				const slug = `lean-${name}`;
				console.log(`CHECK ${engine}: ${slug}`);
				const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
				const errors = [];
				page.on("pageerror", error => errors.push(error.message));
				page.on("console", message => { if(message.type() === "error") errors.push(message.text()); });
				await instrumentLifecycle(page);
				await page.goto(new URL("docs/", base).href);
				await page.locator(".docs-layout").waitFor();
				await instrumentHandles(page, slug, pairs);
				await page.evaluate(() => { globalThis.__portDocument = "same document"; });
				await page.locator(".site-links a").filter({ hasText: /^Demos$/u }).click();
				await page.locator(`.demo-card a[href$="/demos/${slug}/"]`).click();
				await waitForWorkbench(page, slug);
				await edit(page, name);
				await waitForWorkbench(page, slug);
				// Canvas focus outlines are presentation, not retained graph state.
				await page.locator("h1").click();
				await settle(page);
				const edited = await state(page, name);
				await toDocs(page);
				await returnToDemo(page, slug);
				assert.deepEqual(await state(page, name), edited, `${slug}: edits and selected controls survive React navigation`);
				assert.equal(await page.evaluate(() => globalThis.__portDocument), "same document");
				await pageTransition(page, "pagehide");
				await pageTransition(page, "pageshow");
				await waitForWorkbench(page, slug);
				await settle(page);
				assert.deepEqual(await state(page, name), edited, `${slug}: persisted pages restore paused input state`);
				if(!process.env.WORKBENCH_SKIP_BENCHMARK)
				{
					await page.locator("#browser-benchmark").scrollIntoViewIfNeeded();
					if(await page.locator("[data-benchmark-progress]").textContent() === "Cancelled") await page.locator("[data-benchmark-run]").click();
					await page.waitForFunction(() => /Completed|failed/u.test(globalThis.document.querySelector("[data-benchmark-progress]").textContent), null, { timeout: 120000 });
					assert.match(await page.locator("[data-benchmark-progress]").textContent(), /^Completed/u);
				}
				await toDocs(page);
				const cdp = engine === "chromium" ? await page.context().newCDPSession(page) : null;
				let baseline;
				for(let visit = 0; visit < 6; visit++)
				{
					await returnToDemo(page, slug);
					await toDocs(page);
					const current = await resourceSnapshot(page, cdp);
					assert.equal(current.handles.live, 0, `${slug}: all native handles released`);
					assert.equal(current.handles.created, current.handles.released);
					assert.equal(current.handles.invalid, 0, `${slug}: no unowned or double release`);
					if(visit === 2) baseline = current;
					if(visit > 2)
					{
						assert.deepEqual(current.lifecycle, baseline.lifecycle, `${slug}: no observers or frames retained`);
						assert.equal(current.handles.allocations, baseline.handles.allocations, `${slug}: runtime scratch storage stays bounded`);
						if(cdp)
						{
							assert.ok(current.dom.nodes <= baseline.dom.nodes, `${slug}: no detached DOM accumulation ${JSON.stringify({ baseline, current })}`);
							assert.ok(current.dom.jsEventListeners <= baseline.dom.jsEventListeners, `${slug}: no listener accumulation`);
						}
					}
				}
				assert.deepEqual(errors, [], `${slug}: browser errors`);
				report.checks.push({ engine, slug, status: "passed", baseline });
				console.log(`PASS ${engine}: ${slug} edits, paused restoration, six route lifetimes, native ownership${process.env.WORKBENCH_SKIP_BENCHMARK ? "" : ", 100 benchmark samples"}`);
				await page.close();
			}
		}
		finally
		{ await browser.close(); }
	}
	report.status = "passed";
}
finally
{
	const variant = process.env.WORKBENCH_AUDIT_VARIANT ?? (base.pathname === "/" ? "root" : "prefixed");
	assert.match(variant, /^[a-z0-9-]+$/u);
	const output = resolve("build/react-site-audit", variant);
	await mkdir(output, { recursive: true });
	await writeFile(resolve(output, "workbench-lifecycles.json"), JSON.stringify(report, null, 2) + "\n");
}
