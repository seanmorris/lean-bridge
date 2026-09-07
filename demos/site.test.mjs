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
	measureAsyncBenchmark, measureSyncBenchmark
} from "./shared/browser-benchmark.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(repositoryRoot, "demos");
const siteRoot = resolve(repositoryRoot, "build/github-pages");

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
	assert.deepEqual(manifest.demos.map(demo => demo.slug), ["lean-dijkstra", "lean-flood-fill", "lean-union-find", "lean-topological-sort", "lean-aho-corasick", "lean-lru-cache", "lean-a-star", "lean-tarjan"]);
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
	for(const path of ["index.html", "lean-dijkstra/index.html", "lean-flood-fill/index.html", "lean-union-find/index.html", "lean-topological-sort/index.html", "lean-aho-corasick/index.html", "lean-lru-cache/index.html", "lean-a-star/index.html", "lean-tarjan/index.html"])
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
	for(const path of ["lean-dijkstra/index.html", "lean-flood-fill/index.html", "lean-union-find/index.html", "lean-topological-sort/index.html", "lean-aho-corasick/index.html", "lean-lru-cache/index.html", "lean-a-star/index.html", "lean-tarjan/index.html"])
	{
		const html = await readFile(resolve(siteRoot, path), "utf8");
		assert.match(html, /id="browser-benchmark"/u);
		assert.match(html, /Five excluded runs warm both solvers/u);
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
