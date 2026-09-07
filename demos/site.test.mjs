/**
 * Structural tests for the assembled static GitHub Pages gallery.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	attachBrowserBenchmark, measureAsyncBenchmark, measureSyncBenchmark
} from "./shared/browser-benchmark.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(repositoryRoot, "demos");
const siteRoot = resolve(repositoryRoot, "build/github-pages");

const mockBenchmarkBrowser = context => {
	const elements = new Map();
	const frames = [];
	const waiting = [];
	const makeElement = () => ({
		textContent: "unchanged", disabled: false, clientWidth: 620
		, addEventListener: () => undefined, setAttribute: () => undefined
		, replaceChildren: () => undefined, append: () => undefined
	});
	/** Keep automatic observation dormant until the test starts a run. */
	class ObserverMock
	{
		/** Leave visibility and resize callbacks under test control. */
		observe() { return undefined; }
		/** Release the inert observer. */
		disconnect() { return undefined; }
	}
	const replacements = {
		ResizeObserver: ObserverMock, IntersectionObserver: ObserverMock
		, document: { createElementNS: makeElement }
		, requestAnimationFrame: callback => {
			frames.push(callback);
			waiting.shift()?.();
			return frames.length;
		}
	};
	const originals = new Map(Object.keys(replacements).map(name =>
		[name, Object.getOwnPropertyDescriptor(globalThis, name)]));
	context.after(() => {
		for(const [name, descriptor] of originals)
		{
			if(descriptor) Object.defineProperty(globalThis, name, descriptor);
			else Reflect.deleteProperty(globalThis, name);
		}
	});
	for(const [name, value] of Object.entries(replacements))
		Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
	const root = { querySelector: selector => {
		if(!elements.has(selector)) elements.set(selector, makeElement());
		return elements.get(selector);
	} };
	return {
		root, elements
		, waitForFrame: () => frames.length ? Promise.resolve() : new Promise(resolve => waiting.push(resolve))
		, releaseFrame: () => { assert.ok(frames.length > 0); frames.shift()(0); }
	};
};

const assertBenchmarkCancelled = browser => {
	assert.equal(browser.elements.get("[data-benchmark-progress]").textContent, "Cancelled");
	assert.equal(browser.elements.get("[data-benchmark-summary]").textContent, "unchanged");
	assert.equal(browser.elements.get("[data-benchmark-lean]").textContent, "unchanged");
	assert.equal(browser.elements.get("[data-benchmark-run]").disabled, false);
	assert.equal(browser.elements.get("[data-benchmark-cancel]").disabled, true);
};

test("browser benchmark cancellation during a warmup frame prevents another sample", async context => {
	const browser = mockBenchmarkBrowser(context);
	const calls = [];
	let disposed = false;
	let summarized = false;
	const controller = attachBrowserBenchmark({
		root: browser.root, prepare: async () => undefined
		, warmupCount: 2, trialCount: 1
		, sample: (index, warmup) => {
			calls.push([index, warmup]);
			assert.equal(disposed, false, "a cancelled warmup must not touch disposed state");
			return { leanMs: 1, javascriptMs: 1 };
		}
		, summarize: () => { summarized = true; return "completed"; }
	});
	const running = controller.run();
	await browser.waitForFrame();
	controller.cancel();
	disposed = true;
	browser.releaseFrame();
	await running;
	assert.deepEqual(calls, [[0, true]]);
	assert.equal(summarized, false);
	assertBenchmarkCancelled(browser);
});

test("browser benchmark cancellation while its last sample is pending preserves cancelled state", async context => {
	const browser = mockBenchmarkBrowser(context);
	let releaseSample;
	let announceSample;
	let summarized = false;
	const pending = new Promise(resolve => { releaseSample = resolve; });
	const started = new Promise(resolve => { announceSample = resolve; });
	const controller = attachBrowserBenchmark({
		root: browser.root, prepare: async () => undefined
		, warmupCount: 0, trialCount: 1
		, sample: () => { announceSample(); return pending; }
		, summarize: () => { summarized = true; return "completed"; }
	});
	const running = controller.run();
	await started;
	controller.cancel();
	releaseSample({ leanMs: 1, javascriptMs: 1 });
	await running;
	assert.equal(summarized, false);
	assertBenchmarkCancelled(browser);
});

test("browser benchmark cancellation during its final measured frame prevents completion", async context => {
	const browser = mockBenchmarkBrowser(context);
	let calls = 0;
	let summarized = false;
	const controller = attachBrowserBenchmark({
		root: browser.root, prepare: async () => undefined
		, warmupCount: 0, trialCount: 2
		, sample: () => { calls++; return { leanMs: 1, javascriptMs: 1 }; }
		, summarize: () => { summarized = true; return "completed"; }
	});
	const running = controller.run();
	await browser.waitForFrame();
	assert.equal(calls, 2);
	controller.cancel();
	browser.releaseFrame();
	await running;
	assert.equal(summarized, false);
	assertBenchmarkCancelled(browser);
});

test("adaptive browser timing produces finite per-operation samples", async () => {
	let synchronousCalls = 0;
	const synchronous = measureSyncBenchmark(() => { synchronousCalls += 1; return synchronousCalls; });
	let asynchronousCalls = 0;
	const asynchronous = await measureAsyncBenchmark(async () => {
		asynchronousCalls += 1;
		return asynchronousCalls;
	});
	assert.ok(Number.isFinite(synchronous.milliseconds) && synchronous.milliseconds > 0);
	assert.ok(Number.isFinite(asynchronous.milliseconds) && asynchronous.milliseconds > 0);
	assert.ok(synchronousCalls > 1);
	assert.ok(asynchronousCalls > 1);
});

test("gallery manifest names every published standalone demo", async () => {
	const manifest = JSON.parse(await readFile(resolve(sourceRoot, "manifest.json"), "utf8"));
	assert.deepEqual(manifest.demos.map(demo => demo.slug), ["lean-dijkstra", "lean-flood-fill", "lean-union-find", "lean-topological-sort", "lean-aho-corasick", "lean-lru-cache", "lean-a-star", "lean-tarjan", "lean-token-bucket", "lean-dinic", "lean-myers", "lean-sweep-and-prune"]);
	for(const demo of manifest.demos)
	{
		assert.equal(demo.entrypoint, `${demo.slug}/`);
		assert.ok(demo.theorems.length >= 2);
		await access(resolve(siteRoot, demo.slug, "index.html"));
		await access(resolve(siteRoot, demo.slug, "runtime", `${demo.slug}.wasm`));
	}
});

test("assembled Pages artifact is commit-bound and base-path safe", async () => {
	const identity = JSON.parse(await readFile(resolve(siteRoot, "build-identity.json"), "utf8"));
	assert.match(identity.commit, /^[0-9a-f]{40}$/u);
	await access(resolve(siteRoot, ".nojekyll"));
	for(const path of ["index.html", "lean-dijkstra/index.html", "lean-flood-fill/index.html", "lean-union-find/index.html", "lean-topological-sort/index.html", "lean-aho-corasick/index.html", "lean-lru-cache/index.html", "lean-a-star/index.html", "lean-tarjan/index.html", "lean-token-bucket/index.html", "lean-dinic/index.html", "lean-myers/index.html", "lean-sweep-and-prune/index.html"])
	{
		const html = await readFile(resolve(siteRoot, path), "utf8");
		assert.doesNotMatch(html, /(?:href|src)="\/(?!\/)/u,
			`${path} must not assume a domain-root deployment`);
	}
});

test("union-find places its shared browser benchmark after the editable sample", async () => {
	const html = await readFile(resolve(siteRoot, "lean-union-find/index.html"), "utf8");
	assert.equal((html.match(/id="site-grid"/gu) || []).length, 1);
	assert.doesNotMatch(html, /id="panel-trials"/u);
	assert.match(html, /Five excluded runs warm both solvers/u);
	assert.match(html, /partition the same 653 elements and 2,611 links 100 times/u);
	assert.match(html, /id="browser-benchmark"/u);
	assert.match(html, /data-benchmark-histogram/u);
	assert.match(html, /Run again/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"site-grid\""));
	await access(resolve(siteRoot, "lean-union-find/percolation.mjs"));
});

test("topological sort publishes both graph outcomes and its standalone benchmark", async () => {
	const html = await readFile(resolve(siteRoot, "lean-topological-sort/index.html"), "utf8");
	assert.match(html, /id="healthy-preset"/u);
	assert.match(html, /id="cycle-preset"/u);
	assert.match(html, /id="dependency-list"/u);
	assert.match(html, /Five excluded runs warm both solvers/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"graph-canvas\""));
	await access(resolve(siteRoot, "lean-topological-sort/runtime", "lean-topological-sort.wasm"));
});

test("Aho–Corasick publishes editable overlapping scans and its byte matcher", async () => {
	const html = await readFile(resolve(siteRoot, "lean-aho-corasick/index.html"), "utf8");
	assert.match(html, /id="patterns"/u);
	assert.match(html, /id="highlighted-text"/u);
	assert.match(html, /data-scenario="operations"/u);
	assert.match(html, /data-scenario="moderation"/u);
	assert.match(html, /data-scenario="threats"/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"highlighted-text\""));
	await access(resolve(siteRoot, "lean-aho-corasick/runtime", "lean-aho-corasick.wasm"));
});

test("every proof demo publishes an automatic prewarmed browser benchmark", async () => {
	for(const path of ["lean-dijkstra/index.html", "lean-flood-fill/index.html", "lean-union-find/index.html", "lean-topological-sort/index.html", "lean-aho-corasick/index.html", "lean-lru-cache/index.html", "lean-a-star/index.html", "lean-tarjan/index.html", "lean-token-bucket/index.html", "lean-dinic/index.html", "lean-myers/index.html", "lean-sweep-and-prune/index.html"])
	{
		const html = await readFile(resolve(siteRoot, path), "utf8");
		assert.match(html, /id="browser-benchmark"/u);
		assert.match(html, /Five excluded runs warm both (?:solvers|implementations)/u);
		assert.match(html, /data-benchmark-histogram/u);
		assert.match(html, /Run again/u);
		assert.match(html, /\.\.\/shared\/demo-page\.mjs/u);
		assert.match(html, /\.\.\/shared\/proof-page\.css/u);
	}
	await access(resolve(siteRoot, "shared/browser-benchmark.mjs"));
	await access(resolve(siteRoot, "shared/browser-benchmark.css"));
	await access(resolve(siteRoot, "shared/demo-page.mjs"));
	await access(resolve(siteRoot, "shared/proof-page.css"));
});

test("LRU publishes the shared benchmark workload required by its browser entry point", async () => {
	const app = await readFile(resolve(siteRoot, "lean-lru-cache/app.mjs"), "utf8");
	assert.match(app, /from "\.\/benchmark-workload\.mjs"/u);
	const workload = await readFile(resolve(siteRoot, "lean-lru-cache/benchmark-workload.mjs"), "utf8");
	assert.match(workload, /from "\.\/runtime\.mjs"/u);
	await access(resolve(siteRoot, "lean-lru-cache/runtime.mjs"));
	await access(resolve(siteRoot, "lean-lru-cache/Lru.lean"));
});

test("A* publishes both graph comparisons, benchmark dependencies, and shared proof sources", async () => {
	const root = resolve(siteRoot, "lean-a-star");
	const html = await readFile(resolve(root, "index.html"), "utf8");
	assert.match(html, /data-comparator-theorem="solve_total"/u);
	assert.match(html, /LeanAStar\.solve_unreachable/u);
	assert.match(html, /Dijkstra/u);
	for(const file of ["terrain.mjs", "reference.mjs", "browser-benchmark.mjs", "benchmark-workload.mjs"])
		await access(resolve(root, file));
	for(const file of ["DijkstraCore.lean", "Dijkstra.lean"])
		assert.equal(await readFile(resolve(root, file), "utf8")
			, await readFile(resolve(sourceRoot, "lean-dijkstra", file), "utf8")
			, `${file} must match the maintained shared source`);
});

test("Tarjan publishes its editable graph, exact exported partition proof, and benchmark", async () => {
	const root = resolve(siteRoot, "lean-tarjan");
	const html = await readFile(resolve(root, "index.html"), "utf8");
	assert.match(html, /id="toggle-feedback"/u);
	assert.match(html, /id="collapse-groups"/u);
	assert.match(html, /id="import-list"/u);
	assert.match(html, /data-comparator-theorem="solve_total"/u);
	assert.match(html, /LeanTarjan\.exported_same_iff/u);
	assert.match(html, /LeanTarjan\.condensation_acyclic/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"graph-canvas\""));
	for(const file of ["graph.mjs", "reference.mjs", "browser-benchmark.mjs", "benchmark-workload.mjs"])
		await access(resolve(root, file));
});

test("token bucket publishes its request timeline, exact admission proof, and benchmark", async () => {
	const root = resolve(siteRoot, "lean-token-bucket");
	const html = await readFile(resolve(root, "index.html"), "utf8");
	for(const id of ["replay-example", "send-request", "play-clock", "request-timeline", "reset-bucket"])
		assert.ok(html.includes(`id="${id}"`));
	assert.match(html, /data-comparator-theorem="exportedRun_no_over_admission"/u);
	assert.match(html, /LeanTokenBucket\.exportedStep_admitted_iff/u);
	assert.match(html, /LeanTokenBucket\.retryDelay_earliest/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"request-timeline\""));
	for(const file of ["scenario.mjs", "reference.mjs", "browser-benchmark.mjs", "benchmark-workload.mjs"])
		await access(resolve(root, file));
	const audit = JSON.parse(await readFile(resolve(root, "runtime/proof-audit.json"), "utf8"));
	for(const theorem of ["refill_eq", "exportedRun_no_over_admission", "request_retry_earliest", "exportedRun_word_bounds"])
		assert.ok(audit.theorems.includes(theorem));
});

test("Dinic publishes its capacity editor, optimality proof, and benchmark dependencies", async () => {
	const root = resolve(siteRoot, "lean-dinic");
	const html = await readFile(resolve(root, "index.html"), "utf8");
	for(const id of ["widen-bottleneck", "network-svg", "edge-capacity", "cut-links", "reset-network"])
		assert.ok(html.includes(`id="${id}"`));
	assert.match(html, /data-comparator-theorem="solve_total"/u);
	assert.match(html, /LeanDinic\.exported_optimal/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"network-svg\""));
	for(const file of ["network.mjs", "reference.mjs", "browser-benchmark.mjs", "benchmark-workload.mjs"])
		await access(resolve(root, file));
	const audit = JSON.parse(await readFile(resolve(root, "runtime/proof-audit.json"), "utf8"));
	for(const theorem of ["solve_total", "exported_optimal", "flow_cut_upper_bound", "matching_cut_edges"])
		assert.ok(audit.theorems.includes(theorem));
});

test("Myers publishes its editable diff, exact reconstruction proof, and benchmark", async () => {
	const root = resolve(siteRoot, "lean-myers");
	const html = await readFile(resolve(root, "index.html"), "utf8");
	for(const id of ["before-text", "after-text", "swap-text", "diff-preview", "edit-count", "replay-title"])
		assert.ok(html.includes(`id="${id}"`));
	assert.match(html, /data-comparator-theorem="solve_total"/u);
	assert.match(html, /LeanMyers\.exported_shortest/u);
	assert.match(html, /LeanMyers\.exported_reconstructs/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"diff-preview\""));
	for(const file of ["scenario.mjs", "reference.mjs", "browser-benchmark.mjs", "benchmark-workload.mjs"])
		await access(resolve(root, file));
	const audit = JSON.parse(await readFile(resolve(root, "runtime/proof-audit.json"), "utf8"));
	for(const theorem of ["solve_total", "exported_shortest", "exported_patch_reconstructs", "solveExport_words_bounded"])
		assert.ok(audit.theorems.includes(theorem));
});

test("sweep and prune publishes its draggable scene, both pair sets, and exact proof", async () => {
	const root = resolve(siteRoot, "lean-sweep-and-prune");
	const html = await readFile(resolve(root, "index.html"), "utf8");
	for(const id of ["scene", "projection", "toggle-motion", "step-motion", "new-scene", "candidate-count", "overlap-count"])
		assert.ok(html.includes(`id="${id}"`));
	assert.match(html, /data-comparator-theorem="solve_total"/u);
	assert.match(html, /LeanSweep\.exported_candidates_exact/u);
	assert.match(html, /LeanSweep\.exported_overlaps_exact/u);
	assert.ok(html.indexOf("id=\"browser-benchmark\"") > html.indexOf("id=\"projection\""));
	for(const file of ["scenario.mjs", "reference.mjs", "browser-benchmark.mjs", "benchmark-workload.mjs"])
		await access(resolve(root, file));
	const audit = JSON.parse(await readFile(resolve(root, "runtime/proof-audit.json"), "utf8"));
	for(const theorem of ["solve_total", "exported_candidates_exact", "exported_overlaps_exact", "exported_overlaps_unique"])
		assert.ok(audit.theorems.includes(theorem));
});

test("browser proof bundles include every local import in dependency order", async () => {
	const manifest = JSON.parse(await readFile(resolve(siteRoot, "manifest.json"), "utf8"));
	for(const demo of manifest.demos)
	{
		const root = resolve(siteRoot, demo.slug);
		const html = await readFile(resolve(root, "index.html"), "utf8");
		const core = html.match(/data-proof-core="([^"]+)"/u)[1];
		const proof = html.match(/data-proof-module="([^"]+)"/u)[1];
		const dependencies = (html.match(/data-proof-dependencies="([^"]*)"/u)?.[1] || "")
			.split(",").filter(Boolean);
		const files = [core, ...dependencies, proof];
		const audit = JSON.parse(await readFile(resolve(root, "runtime/proof-audit.json"), "utf8"));
		assert.deepEqual(Object.keys(audit.sourceFiles).sort(), [...files].sort(), demo.slug);
		for(const [index, file] of files.entries())
		{
			const source = await readFile(resolve(root, file), "utf8");
			for(const imported of source.matchAll(/^import (\w+)$/gmu))
			{
				if(["Init", "Std"].includes(imported[1])) continue;
				assert.ok(files.slice(0, index).includes(`${imported[1]}.lean`),
					`${demo.slug}/${file}: checker bundle must load ${imported[1]} first`);
			}
		}
	}
});
