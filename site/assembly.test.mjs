/**
 * Checks static publishing allowlists, base-path mapping, and staged replacement safety.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { demos, prerenderPaths } from './registry.mjs';
import {
	allowedDemoPath, assembleSite, demoRedirect, publishStagedSite, reactOutputPath
	, validateOutputDirectory
} from '../scripts/build-demos-site.mjs';

test('demo allowlist excludes private files, build scripts, test code, and runtime extras', () => {
	const included = [
		'manifest.json', 'shared/proof-services.mjs', 'lean-myers/Myers.lean'
		, 'lean-myers/runtime/lean-myers.wasm', 'lean-myers/runtime/proof-audit.json'
	];
	for(const file of included)
		assert.equal(allowedDemoPath(file), true, file);
	for(const file of ['.env', 'shared/.env', 'shared/proof-services.test.mjs'
		, 'lean-myers/build.sh'
		, 'lean-myers/test.mjs'
		, 'lean-myers/runtime/secret.json'
		, 'lean-myers/runtime/lean-myers.wasm.map'
		, 'unknown/index.html'
		, 'shared/nested/site.css'])
		assert.equal(allowedDemoPath(file), false, file);
});

test('React output strips configured prefixes but never publishes a SPA fallback', () => {
	for(const base of ['/', '/lean-bridge/', '/nested/project/'])
	{
		assert.equal(reactOutputPath(`${base.slice(1)}docs/lean/index.html`, base), 'docs/lean/index.html');
		assert.equal(reactOutputPath(`${base.slice(1)}docs/lean/_.data`, base), 'docs/lean/_.data');
		assert.equal(reactOutputPath('assets/entry.client-abcd.js', base), 'assets/entry.client-abcd.js');
		assert.equal(reactOutputPath('__spa-fallback.html', base), null);
		assert.equal(reactOutputPath('.vite/manifest.json', base), null);
		assert.throws(() => reactOutputPath('.env', base), /Unapproved/u);
		assert.throws(() => reactOutputPath('assets/runtime.wasm', base), /Unapproved/u);
		assert.throws(() => reactOutputPath('source/secret.mjs', base), /Unapproved/u);
	}
	assert.throws(() => reactOutputPath('docs/index.html', '/lean-bridge/'), /Unapproved/u);
	assert.throws(() => reactOutputPath('index.html', '//evil/'), /absolute directory/u);
});

test('every migrated redirect preserves query and hash with a no-JavaScript link fallback', () => {
	for(const demo of demos.filter(entry => entry.renderingMode === 'react'))
	{
		const html = demoRedirect('/nested/project/', demo.slug);
		const target = `/nested/project${demo.canonicalPage}`;
		assert.ok(html.includes(`content="0;url=${target}"`));
		assert.ok(html.includes(`<a href="${target}">Open`));
		const script = html.match(/<script>([^<]*)<\/script>/u)[1];
		for(const [search, hash] of [['', ''], ['?mode=characters', '#proof-code'], ['?q=%3Cscript%3E', '#section']])
		{
			let destination;
			vm.runInNewContext(script, { location: { search, hash, replace: value => { destination = value; } } });
			assert.equal(destination, `${target}${search}${hash}`);
		}
		assert.throws(() => demoRedirect('/"><script>/', demo.slug));
	}
	assert.throws(() => demoRedirect('/', 'lean-dijkstra'), /No React redirect/u);
	assert.throws(() => demoRedirect('/', '../.env'), /No React redirect/u);
});

test('output validation rejects source, checkout ancestors, and compiler overlaps before writes', async () => {
	const root = fileURLToPath(new URL('../', import.meta.url));
	const client = path.resolve(root, 'build/react-site/client');
	const invalid = [
		root, path.dirname(path.resolve(root)), path.resolve(root, 'site')
		, path.resolve(root, 'demos/lean-myers'), path.resolve(root, 'build')
		, path.resolve(root, 'build/react-site')
		, client
		, path.resolve(client, 'published')
	];
	for(const output of invalid)
	{
		assert.throws(() => validateOutputDirectory(root, output, client), /separate generated directory/u);
		await assert.rejects(assembleSite({ root, output, clientRoot: client, build: false }),
			/separate generated directory/u);
	}
	const external = path.resolve(tmpdir(), 'lean-site-validation');
	assert.throws(() => validateOutputDirectory(root, external, path.resolve(external, 'client')),
		/separate generated directory/u);
	assert.doesNotThrow(() => validateOutputDirectory(root, path.resolve(root, 'build/github-pages'), client));
	assert.doesNotThrow(() => validateOutputDirectory(root, path.resolve(external, 'published'), client));
});

test('staged publication replaces a complete site and restores it after rename failure', async () => {
	const scratch = await mkdtemp(path.join(tmpdir(), 'lean-site-assembly-'));
	try
	{
		const output = path.join(scratch, 'published');
		const stage = path.join(scratch, 'staged');
		await mkdir(output);
		await writeFile(path.join(output, 'index.html'), 'previous');
		await assert.rejects(publishStagedSite(stage, output), /ENOENT/u);
		assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'previous');
		assert.deepEqual(await readdir(scratch), ['published']);
		await mkdir(stage);
		await writeFile(path.join(stage, 'index.html'), 'complete');
		await publishStagedSite(stage, output);
		assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'complete');
		assert.deepEqual(await readdir(scratch), ['published']);
	}
	finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});

test('missing or streaming-only guides leave the existing public artifact untouched', async () => {
	const scratch = await mkdtemp(path.join(tmpdir(), 'lean-site-inputs-'));
	try
	{
		const output = path.join(scratch, 'published');
		const client = path.join(scratch, 'client');
		await mkdir(output);
		await mkdir(client);
		await writeFile(path.join(output, 'index.html'), 'previous');
		await assert.rejects(assembleSite({ output, clientRoot: client, build: false, base: '/' }),
			/Missing prerendered page/u);
		assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'previous');
		for(const route of prerenderPaths)
		{
			const directory = path.join(client, route.slice(1));
			await mkdir(directory, { recursive: true });
			await writeFile(path.join(directory, 'index.html'), '<html><article><h1>Ready</h1></article></html>');
		}
		await writeFile(path.join(client, 'docs/lean/index.html'), '<p>Loading guide…</p><div hidden id="S:0">Content</div>');
		await assert.rejects(assembleSite({ output, clientRoot: client, build: false, base: '/' }),
			/readable without JavaScript/u);
		assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'previous');
	}
	finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});

test('standalone navigation honors the published base and source preview fallback', async () => {
	const script = await readFile(fileURLToPath(new URL('../demos/shared/site-nav.mjs', import.meta.url)), 'utf8');
	for(const base of [undefined, '/', '/lean-bridge/'])
	{
		let header;
		const element = tagName => {
			const children = [];
			const attributes = {};
			return { tagName, children, attributes, setAttribute: (name, value) => { attributes[name] = value; }, append: (...items) => children.push(...items) };
		};
		const document = {
			documentElement: { dataset: { demoTitle: 'Example algorithm', siteBase: base } }
			, createElement: element, body: { prepend: value => { header = value; } }
		};
		vm.runInNewContext(script, { document });
		assert.equal(header.tagName, 'header');
		assert.equal(header.className, 'site-header');
		const inner = header.children[0];
		assert.equal(inner.className, 'site-header-inner');
		assert.equal(inner.children[0].href, base ?? '../');
		assert.equal(inner.children[0].className, 'site-brand');
		const nav = inner.children[1];
		assert.equal(nav.attributes['aria-label'], 'Main navigation');
		const links = nav.children;
		assert.deepEqual(links.map(link => link.textContent.trim()), ['Home', 'Demos', 'Docs', 'GitHub']);
		assert.equal(links[1].href, base ? `${base}demos/` : '../');
		assert.equal(links[1].attributes['aria-current'], 'page');
		assert.equal(links[2].href, base ? `${base}docs/` : '../../build/github-pages/docs/');
		assert.equal(links[3].href, 'https://github.com/seanmorris/lean-bridge');
		assert.equal(links[3].children[0].attributes['aria-hidden'], 'true');
		const mobile = inner.children[2];
		assert.equal(mobile.tagName, 'details');
		assert.equal(mobile.className, 'mobile-navigation');
		assert.equal(mobile.children[0].textContent, 'Menu');
		assert.equal(mobile.children[1].attributes['aria-label'], 'Mobile navigation');
		assert.deepEqual(mobile.children[1].children.map(link => link.href), links.map(link => link.href));
	}
});
