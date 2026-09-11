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
import contributingCompatibility from '../tests/fixtures/documentation/contributing-compatibility.json' with { type: 'json' };
import { demos, docPages, prerenderPaths } from './registry.mjs';
import routes from './app/routes.ts';
import {
	compileDocumentationPage, generateSiteContent
	, rewriteDocumentationLink, validateDocumentationAnchors
} from '../scripts/generate-site-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const revision = '1234567890abcdef1234567890abcdef12345678';
const page = docPages.find(entry => entry.id === 'javascript-typescript');

test('registry preserves all artifacts and routes every demo through React', () => {
	assert.equal(demos.length, manifest.demos.length);
	assert.deepEqual(demos.map(demo => demo.slug), manifest.demos.map(demo => demo.slug));
	const migrated = manifest.demos.map(demo => demo.slug);
	assert.deepEqual(demos.filter(demo => demo.renderingMode === 'react').map(demo => demo.slug), migrated);
	for(const demo of demos)
	{
		assert.equal(demo.artifactBase, `/${demo.entrypoint}`);
		assert.equal(demo.canonicalPage, migrated.includes(demo.slug)
			? `/demos/${demo.slug}/` : demo.artifactBase);
		assert.equal(prerenderPaths.includes(demo.canonicalPage), demo.renderingMode === 'react');
	}
	assert.equal(new Set(prerenderPaths).size, prerenderPaths.length);
	assert.equal(new Set(docPages.map(entry => entry.id)).size, docPages.length);
	assert.equal(prerenderPaths.length, docPages.length + demos.length + 3);
	assert.equal(docPages.filter(entry => entry.source).length, 79);
	assert.equal(new Set(docPages.filter(entry => entry.source)
		.map(entry => entry.source)).size, docPages.length);
});

test('every indexed guide has an explicit React route and its matching content module', async () => {
	const guides = routes.filter(entry => entry.file.startsWith('routes/guides/'));
	assert.deepEqual(guides.map(entry => `/${entry.path}/`).sort(),
		docPages.map(entry => entry.route).sort(), 'Guide links must not fall through to the not-found route');
	for(const entry of docPages)
	{
		const route = guides.find(guide => `/${guide.path}/` === entry.route);
		const source = await readFile(path.join(root, 'site/app', route.file), 'utf8');
		assert.ok(source.includes(`import Content from "../../../../build/site-content/${entry.id}.mjs";`),
			`${entry.route}: load the indexed guide instead of another page`);
		assert.match(source, /<Documentation Content=\{Content\}\s*\/>/u, entry.route);
	}
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

test('documentation links to maintained demos use canonical pages under both bases', () => {
	for(const demo of demos)
	{
		const link = rewriteDocumentationLink(`../demos/${demo.entrypoint}index.html#main-content`, page, { revision });
		for(const base of ['/', '/lean-bridge/'])
		{
			const target = new URL(link, `https://example.test${base}${page.route.slice(1)}`);
			assert.equal(target.pathname, `${base}${demo.canonicalPage.slice(1)}`);
			assert.equal(target.hash, '#main-content');
		}
	}
	assert.equal(rewriteDocumentationLink('../demos/index.html', page, { revision }), '../../../demos/');
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

test('reviewed workflow references remain source links without allowing private directories', () => {
	const target = '.github/workflows/demos-pages.yml';
	assert.equal(rewriteDocumentationLink(`../${target}`, page, {
		revision, trackedFiles: new Set([target])
	}), `https://github.com/seanmorris/lean-bridge/blob/${revision}/${target}`);
	assert.throws(() => rewriteDocumentationLink('../.github/private.json', page, { revision }), /Private/u);
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

test('React, HTML, and Nix examples are highlighted as inert documentation', async () => {
	const compiled = await compileDocumentationPage([
		'# React example', '', '```tsx'
		, 'export const Example = () => <output>42</output>;', '```'
		, '', '```html', '<script type="module" src="/main.tsx"></script>', '```'
		, '', '```nix', '{ nix.settings.require-sigs = true; }', '```'
		, '', '```ini', 'require-sigs = true', '```'
	].join('\n'), page, { revision });
	assert.match(compiled.code, /"data-language": "tsx"/u);
	assert.match(compiled.code, /"data-language": "html"/u);
	assert.match(compiled.code, /"data-language": "nix"/u);
	assert.match(compiled.code, /"data-language": "ini"/u);
	assert.doesNotMatch(compiled.code, /^export const Example/mu);
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
		assert.equal(Object.keys(generated.pages).length, docPages.length);
		assert.equal(search.length, docPages.filter(entry => !entry.legacy).length);
		assert.deepEqual(search.map(entry => entry.route), docPages.filter(entry => !entry.legacy).map(entry => entry.route));
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
		for(const migration of contributingCompatibility)
		{
			const entry = generated.pages[migration.route];
			assert.equal(entry.legacy, true, migration.id);
			assert.deepEqual(entry.headings.map(({ depth, id }) => [depth, id]),
				migration.headings, `${migration.id}: historical headings stay available at the old URL`);
			assert.equal(generated.pages[migration.target].group, 'Contributing');
			const module = await generated.pageModules[migration.route]();
			const html = renderToStaticMarkup(createElement(module.default));
			for(const [, id] of migration.headings)
			{
				const destination = path.posix.relative(migration.route, migration.target) + `/#${id}`;
				assert.ok(html.includes(`href="${destination}"`), `${migration.id}: forwarding link for ${id}`);
			}
		}
	}
	finally
	{
		await rm(output, { recursive: true, force: true });
	}
});
