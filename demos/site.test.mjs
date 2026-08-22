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

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(repositoryRoot, "demos");
const siteRoot = resolve(repositoryRoot, "build/github-pages");

test("gallery manifest names every published standalone demo", async () => {
	const manifest = JSON.parse(await readFile(resolve(sourceRoot, "manifest.json"), "utf8"));
	assert.deepEqual(manifest.demos.map(demo => demo.slug), ["lean-dijkstra", "lean-flood-fill"]);
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
	for(const path of ["index.html", "lean-dijkstra/index.html", "lean-flood-fill/index.html"])
	{
		const html = await readFile(resolve(siteRoot, path), "utf8");
		assert.doesNotMatch(html, /(?:href|src)="\/(?!\/)/u,
			`${path} must not assume a domain-root deployment`);
	}
});
