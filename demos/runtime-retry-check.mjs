/**
 * Retry each real Wasm runtime after a failed first initialization in Chromium.
 *
 * Run with a served gallery root, including a nested Pages prefix if present.
 *
 * @file
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:8765/demos/");
if(!base.pathname.endsWith("/")) base.pathname += "/";
const response = await fetch(new URL("manifest.json", base));
assert.ok(response.ok, "The served gallery manifest must be available");
const manifest = await response.json();
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium"
	, headless: true, args: ["--no-sandbox"]
});

try
{
	for(const { slug, entrypoint } of manifest.demos)
	{
		const page = await browser.newPage();
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		const root = new URL(entrypoint, base);
		const runtime = new URL("runtime.mjs", root).href;
		const wasm = new URL(`runtime/${slug}.wasm`, root).href;
		const fixture = new URL("__runtime-retry-check__.html", base).href;
		let failing = true;
		let rejectedFetches = 0;
		let successfulFetches = 0;
		await page.route(fixture, route => route.fulfill({
			contentType: "text/html"
			, body: "<!doctype html><title>Runtime retry check</title>"
		}));
		await page.route(wasm, route => {
			if(failing)
			{
				rejectedFetches++;
				return route.abort("failed");
			}
			successfulFetches++;
			return route.continue();
		});
		try
		{
			await page.goto(fixture);
			const first = await page.evaluate(async url => {
				globalThis.retryRuntime = await import(url);
				globalThis.retryLoad = globalThis.retryRuntime.initRuntime ?? globalThis.retryRuntime.ready;
				const results = await Promise.allSettled([globalThis.retryLoad(), globalThis.retryLoad()]);
				return results.map(result => result.status);
			}, runtime);
			assert.deepEqual(first, ["rejected", "rejected"], `${slug}: the first shared initialization must fail`);
			assert.equal(rejectedFetches, 2, `${slug}: one initialization attempts streaming and ArrayBuffer fetches`);
			failing = false;
			const retried = await page.evaluate(async () => {
				const results = await Promise.all([
					globalThis.retryLoad(), globalThis.retryLoad(), globalThis.retryLoad()
				]);
				return results.every(module => module === results[0] && module.HEAPU32.length > 0);
			});
			assert.equal(retried, true, `${slug}: concurrent retries must share one initialized module`);
			assert.equal(successfulFetches, 1, `${slug}: retries must fetch Wasm once`);

			const works = await page.evaluate(async name => {
				const api = globalThis.retryRuntime;
				const words = (...values) => Uint32Array.of(...values);
				switch(name)
				{
					case "lean-dijkstra":
						return (await api.shortestPath({
								vertexCount: 1, offsets: words(0, 0), targets: words()
								, weights: words(), start: 0, target: 0
						}))[0] === 0;
					case "lean-flood-fill":
						return (await api.reachable({
							vertexCount: 1, offsets: words(0, 0), targets: words()
							, allowedVertices: words(1), allowedEdges: words(), start: 0
						}))[0] === 0;
					case "lean-union-find":
						return (await api.partition({ elementCount: 1, links: words() })).representatives[0] === 0;
					case "lean-topological-sort":
						return (await api.sortGraph({ vertexCount: 1, edges: words() })).vertices[0] === 0;
					case "lean-aho-corasick":
					{
						const matcher = await api.prepareMatcher(["a"]);
						try
						{ return [...matcher.scanBytes("a")].join(",") === "0,0,1"; }
						finally
						{ matcher.dispose(); }
					}
					case "lean-lru-cache":
					{
						const cache = await api.createCache(1);
						try
						{ cache.put(7, 9); return cache.get(7).value === 9; }
						finally
						{ cache.dispose(); }
					}
					case "lean-a-star":
						return (await api.solveGraph({
							vertexCount: 1, offsets: words(0, 0), targets: words()
							, weights: words(), heuristic: words(0), start: 0, target: 0
						})).path[0] === 0;
					case "lean-tarjan":
						return (await api.solveGraph({
							vertexCount: 1, offsets: words(0, 0), targets: words()
						})).labels[0] === 0;
					case "lean-token-bucket":
					{
						const bucket = await api.createBucket({ capacity: 1, rate: 0 });
						try
						{ return bucket.request(0, 1).allowed; }
						finally
						{ bucket.dispose(); }
					}
					case "lean-dinic":
						return (await api.solveGraph({
							vertexCount: 2, source: 0, sink: 1, offsets: words(0, 1, 1)
							, targets: words(1), capacities: words(3)
						})).value === 3;
					case "lean-myers":
						return (await api.diffTokens(words(1), words(2))).distance === 2;
					case "lean-sweep-and-prune":
						return [...(await api.findOverlaps({ boxes: new Int32Array(8), dimensions: 2 })).overlaps]
							.join(",") === "0,1";
					default: throw new Error(`No runtime probe for ${name}`);
				}
			}, slug);
			assert.equal(works, true, `${slug}: the recovered runtime must execute its real Lean algorithm`);
			await page.evaluate(async () => { await globalThis.retryLoad(); });
			assert.equal(successfulFetches, 1, `${slug}: successful initialization must remain cached`);
			assert.deepEqual(errors, [], `${slug}: handled initialization failures must not escape as page errors`);
			console.log(`Runtime retry passed: ${slug}, shared failed attempt, shared retry, compiled execution.`);
		}
		finally
		{ await page.close(); }
	}
}
finally
{ await browser.close(); }
