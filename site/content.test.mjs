/**
 * Checks canonical documentation generation, route links, and build-only highlighting.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import manifest from '../demos/manifest.json' with { type: 'json' };
import { demos, docPages, prerenderPaths } from './registry.mjs';
import {
	compileDocumentationPage, generateSiteContent
	, rewriteDocumentationLink, validateDocumentationAnchors
} from '../scripts/generate-site-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const revision = '1234567890abcdef1234567890abcdef12345678';
const page = docPages.find(entry => entry.id === 'javascript-typescript');

test('registry preserves all artifacts and migrates only the Myers page', () => {
	assert.equal(demos.length, manifest.demos.length);
	assert.deepEqual(demos.map(demo => demo.slug), manifest.demos.map(demo => demo.slug));
	assert.equal(demos.filter(demo => demo.renderingMode === 'react').length, 1);
	for(const demo of demos)
	{
		assert.equal(demo.artifactBase, `/${demo.entrypoint}`);
		assert.equal(demo.canonicalPage, demo.slug === 'lean-myers'
			? '/demos/lean-myers/' : demo.artifactBase);
		assert.equal(prerenderPaths.includes(demo.canonicalPage), demo.renderingMode === 'react');
	}
	assert.equal(new Set(prerenderPaths).size, prerenderPaths.length);
	assert.equal(prerenderPaths.length, 14);
	assert.equal(docPages.filter(entry => entry.source).length, 8);
	assert.equal(new Set(docPages.filter(entry => entry.source)
		.map(entry => entry.source)).size, 8);
});

test('source-relative links preserve route fragments and deployment prefixes', () => {
	const actual = rewriteDocumentationLink('lean-author-guide.md#exit-codes', page, { revision });
	assert.equal(actual, '../../lean/#exit-codes');
	for(const base of ['/', '/lean-bridge/'])
	{
		assert.equal(new URL(actual, `https://example.test${base}${page.route.slice(1)}`).pathname,
			`${base}docs/lean/`);
	}
	assert.equal(rewriteDocumentationLink('javascript-typescript.md?view=all#typescript', page,
		{ revision }), './?view=all#typescript');
	assert.equal(rewriteDocumentationLink('#typescript', page, { revision }), '#typescript');
	assert.equal(rewriteDocumentationLink('https://lean-lang.org/', page, { revision }),
		'https://lean-lang.org/');
	assert.equal(rewriteDocumentationLink('mailto:author@example.test', page, { revision }),
		'mailto:author@example.test');
});

test('non-rendered source links pin a full revision and require tracked paths', () => {
	const options = { revision, trackedFiles: new Set(['docs/evidence/release-receipt.md']) };
	assert.equal(rewriteDocumentationLink('evidence/release-receipt.md#verification', page, options),
		`https://github.com/seanmorris/lean-bridge/blob/${revision}/docs/evidence/release-receipt.md#verification`);
	assert.throws(() => rewriteDocumentationLink('missing.md', page, options), /Untracked/);
	assert.throws(() => rewriteDocumentationLink('#typescript', page, { revision: 'main' }), /full Git revision/);
});

test('unsafe, secret, escaping, and host-root links fail instead of being published', () => {
	for(const link of [
		'javascript:alert(1)', 'data:text/html,example', '//outside.example/path'
		, '../.env', '../%2eenv', '../../outside.md', '..\\.env'
		, '/docs/status.md', 'hello%00.md', 'hello%0a.md'
	]){
		assert.throws(() => rewriteDocumentationLink(link, page, { revision }));
	}
});

test('Markdown metadata matches generated headings and keeps search text separate', async () => {
	const markdown = [
		'# Example `Nat`'
		, '', '## Install', '', '## Install', ''
		, '| Input | Output |', '| --- | --- |', '| `1` | **2** |', ''
		, '```lean', 'def answer : Nat := 42', '```'
	].join('\n');
	const compiled = await compileDocumentationPage(markdown, page, { revision });
	assert.deepEqual(compiled.metadata.headings.map(heading => heading.id),
		['example-nat', 'install', 'install-1']);
	assert.match(compiled.code, /id: "install-1"/u);
	assert.match(compiled.code, /table: "table"/u);
	assert.match(compiled.code, /shiki github-dark-default/u);
	assert.match(compiled.code, /color: "#/u);
	assert.match(compiled.code, /"data-language": "lean"/u);
	assert.match(compiled.searchText, /def answer : Nat := 42/u);
	assert.equal(Object.hasOwn(compiled.metadata, 'searchText'), false);
	assert.equal(compiled.metadata.sourceSha256,
		createHash('sha256').update(markdown).digest('hex'));
	assert.doesNotMatch(compiled.code, /from ["'](?:shiki|@mdx-js|node:)/u);
});

test('raw HTML, images, and non-canonical sources cannot enter compiled modules', async () => {
	await assert.rejects(compileDocumentationPage('<script>alert(1)</script>', page, { revision }),
		/raw HTML/u);
	await assert.rejects(compileDocumentationPage('![private](../bad-ledge-fill.png)', page, { revision }),
		/not allowlisted/u);
	await assert.rejects(compileDocumentationPage('![private][image]\n\n[image]: ../bad-ledge-fill.png',
		page, { revision }), /not allowlisted/u);
	await assert.rejects(compileDocumentationPage('# Secret',
		{ ...page, source: '.env' }, { revision }), /not allowlisted/u);
	const inert = await compileDocumentationPage('import value from "node:fs";\n\n{process.env.SECRET}',
		page, { revision });
	assert.match(inert.code, /children: "import value from/u);
	assert.match(inert.code, /children: "\{process.env.SECRET\}"/u);
	assert.doesNotMatch(inert.code, /^import value from/mu);
});

test('broken local and cross-guide fragments fail the build', () => {
	const results = {
		'/docs/lean/': {
			links: ['#exit-codes']
			, metadata: { headings: [{ id: 'exit-codes' }] }
		}
		, [page.route]: {
			links: ['../../lean/#exit-codes']
			, metadata: { headings: [] }
		}
	};
	assert.doesNotThrow(() => validateDocumentationAnchors(results));
	results[page.route].links = ['../../lean/#not-a-heading'];
	assert.throws(() => validateDocumentationAnchors(results), /Missing documentation heading/u);
});

test('all generated modules render without browser runtimes and match source hashes', async () => {
	await mkdir(path.join(root, 'build'), { recursive: true });
	const output = await mkdtemp(path.join(root, 'build/site-content-test-'));
	try
	{
		const result = await generateSiteContent({ output });
		const generated = await import(pathToFileURL(path.join(output, 'index.mjs')).href);
		const index = await readFile(path.join(output, 'index.mjs'), 'utf8');
		const metadata = await readFile(path.join(output, 'metadata.mjs'), 'utf8');
		const search = JSON.parse(await readFile(path.join(output, 'search-index.json'), 'utf8'));
		assert.equal(Object.keys(generated.pages).length, 8);
		assert.equal(search.length, 8);
		assert.doesNotMatch(index, /searchText|node:|@mdx-js|shiki/u);
		assert.doesNotMatch(metadata, /searchText|import\(|pageModules/u);
		assert.deepEqual((await readdir(output)).sort(), [
			...docPages.filter(entry => entry.source).map(entry => `${entry.id}.mjs`)
			, 'index.mjs'
			, 'index.d.mts'
			, 'metadata.mjs'
			, 'metadata.d.mts'
			, 'search-index.json'
		].sort());
		for(const entry of Object.values(generated.pages))
		{
			const module = await generated.pageModules[entry.route]();
			const html = renderToStaticMarkup(createElement(module.default));
			const source = await readFile(path.join(root, entry.source), 'utf8');
			assert.match(html, /<h1 id=/u);
			assert.equal(entry.sourceSha256, createHash('sha256').update(source).digest('hex'));
			assert.match(entry.sourceUrl, new RegExp(`/blob/${result.revision}/`, 'u'));
			for(const heading of entry.headings)
			{
				assert.ok(html.includes(`id="${heading.id}"`));
			}
		}
	}
	finally
	{
		await rm(output, { recursive: true, force: true });
	}
});
