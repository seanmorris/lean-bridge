/**
 * Run documented imports against two verified prepared releases in Node and browsers.
 *
 * @file
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { chromium, firefox, webkit } from 'playwright';
import { verifyComponentPackageReceipt } from '../src/release/component-package-receipt.mjs';
import { startSiteServer } from '../site/serve.mjs';

const root = path.resolve(import.meta.dirname, '..');
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const [name, value] = process.argv.slice(index, index + 2);
	assert.ok(['--tutorial', '--scalars', '--output'].includes(name) && !options.has(name)
		&& value && !value.startsWith('--'), 'Use --tutorial PACKAGES --scalars PACKAGES --output NEW_DIRECTORY');
	options.set(name, path.resolve(value));
}
assert.equal(options.size, 3, 'Supply both prepared package directories and a new output directory');
const execute = promisify(execFile);
const output = options.get('--output');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const consumer = path.join(output, 'consumer');
await mkdir(consumer);
const report = { status: 'running', packages: [], examples: [], browsers: [] };
let server;

/**
 * Execute a bounded local check with isolated npm configuration and no lifecycle scripts.
 *
 * @param command - Local executable used for the consumer check.
 * @param args - Arguments passed directly without a shell.
 * @param extra - Explicit process options for a particular check.
 */
const run = (command, args, extra = {}) => execute(command, args, {
	cwd: consumer, timeout: 120000, maxBuffer: 4 * 1024 * 1024
	, env: { ...process.env, NPM_CONFIG_USERCONFIG: path.join(output, 'npmrc'), NPM_CONFIG_GLOBALCONFIG: path.join(output, 'global-npmrc') }
	, ...extra
});

try
{
	const archives = [];
	let runtime;
	for(const [option, name] of [['--tutorial', 'onboarding-small'], ['--scalars', 'onboarding-scalars']])
	{
		const directory = options.get(option);
		const receiptPath = path.join(directory, 'component-package-receipt.json');
		await verifyComponentPackageReceipt({ receiptPath });
		const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
		assert.equal(receipt.component.name, name);
		if(runtime) assert.deepEqual(receipt.runtime, runtime, 'The composition example needs the same exact runtime release');
		else
		{ runtime = receipt.runtime; archives.push(path.join(directory, receipt.runtime.archive)); }
		archives.push(path.join(directory, receipt.package.archive));
		report.packages.push({ component: receipt.component, runtime: receipt.runtime, package: receipt.package });
	}
	await writeFile(path.join(output, 'npmrc'), 'registry=http://127.0.0.1:1/\n');
	await writeFile(path.join(output, 'global-npmrc'), '');
	await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
	await run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...archives]);
	const dependencies = JSON.parse(await readFile(path.join(consumer, 'package-lock.json'), 'utf8')).packages;
	assert.equal(Object.keys(dependencies).filter(name => name.endsWith('node_modules/@lean-bridge/runtime')).length, 1);
	const apiMarkdown = await readFile(path.join(root, 'docs/reference/package-api.md'), 'utf8');
	const declarations = [...apiMarkdown.matchAll(/^```ts\n([\s\S]*?)^```/gmu)].map(match => match[1].trim());
	for(const [index, name] of ['onboarding-small', 'onboarding-scalars'].entries())
		assert.equal((await readFile(path.join(consumer, 'node_modules', name, 'index.d.ts'), 'utf8')).trim(), declarations[index]);
	for(const [source, expected] of [
		['docs/reference/package-api.md', ['42n\ntrue\n']]
		, ['docs/concepts/shared-runtime.md', ['42n\nfalse\n', '42n\n', '42n\n46n\n']]
	]){
		const markdown = await readFile(path.join(root, source), 'utf8');
		const snippets = [...markdown.matchAll(/^```js\n([\s\S]*?)^```/gmu)].map(match => match[1]);
		assert.equal(snippets.length, expected.length);
		for(const [index, snippet] of snippets.entries())
		{
			const filename = `example-${report.examples.length}.mjs`;
			await writeFile(path.join(consumer, filename), snippet);
			const result = await run(process.execPath, [filename]);
			assert.equal(result.stdout, expected[index]);
			assert.equal(result.stderr, '');
			report.examples.push({ source, index, filename, output: result.stdout });
		}
	}
	const assertions = `import assert from 'node:assert/strict';
import * as small from 'onboarding-small';
import * as scalars from 'onboarding-scalars';
assert.equal(small.add(1n << 4096n, 1n), (1n << 4096n) + 1n);
assert.equal(scalars.mixed(true, 2, 'Lean', 40n), 46n);
assert.equal(scalars.integer(-(1n << 4096n)), -(1n << 4096n));
assert.throws(() => small.add(1, 2), TypeError);
assert.throws(() => scalars.u8(256), TypeError);
assert.throws(() => scalars.u64(1n << 64n), TypeError);
assert.throws(() => scalars.text('\\ud800'), TypeError);
assert.equal(scalars.text('a\\0雪'), 'a\\0雪');
assert.equal(scalars.f32(1 / 3), Math.fround(1 / 3));
assert.equal(Object.is(scalars.f64(-0), -0), true);
const original = Uint8Array.of(1, 2, 3);
const copy = scalars.bytes(original);
original[0] = 9;
assert.deepEqual(copy, Uint8Array.of(1, 2, 3));
assert.equal(await import('onboarding-small'), small);
console.log('scalar boundaries and repeated imports passed');
`;
	await writeFile(path.join(consumer, 'boundaries.mjs'), assertions);
	report.boundaries = (await run(process.execPath, ['boundaries.mjs'])).stdout.trim();
	const typecheck = `import { add, isEmpty } from 'onboarding-small';
import { bytes, mixed, u64, unit } from 'onboarding-scalars';
const answer: bigint = add(20n, 22n);
const empty: boolean = isEmpty('');
const copied: Uint8Array = bytes(Uint8Array.of(1));
mixed(true, 2, 'Lean', answer);
unit(undefined);
// @ts-expect-error Nat arguments require bigint.
add(20, 22);
// @ts-expect-error UInt64 arguments require bigint.
u64(12);
// @ts-expect-error ByteArray arguments require Uint8Array.
bytes([1]);
void empty; void copied;
`;
	await writeFile(path.join(consumer, 'typecheck.mts'), typecheck);
	await run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'node', 'typecheck.mts']);
	await writeFile(path.join(consumer, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Prepared package examples</title></head><body><output>Loading</output><script type="module" src="./main.mjs"></script></body></html>');
	await writeFile(path.join(consumer, 'main.mjs'), [
		...report.examples.map(example => `await import('./${example.filename}');`)
		, "import * as first from 'onboarding-small';"
		, "const again = await import('onboarding-small');"
		// Bundlers can wrap static and dynamic namespaces differently. Their public exports must agree.
		, "if (first.add !== again.add || again.add(1n << 128n, 1n) !== (1n << 128n) + 1n) throw new Error('Repeated import or exact integer failed');"
		, "document.querySelector('output').textContent = 'Prepared examples passed';"
	].join('\n'));
	await writeFile(path.join(consumer, 'vite.config.mjs'), 'export default { base: "./", build: { target: "esnext", assetsInlineLimit: 0 } };\n');
	await run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build']);
	server = await startSiteServer({ root: path.join(consumer, 'dist'), base: '/prepared/' });
	for(const [engine, implementation] of Object.entries({ chromium, firefox, webkit }))
	{
		const executablePath = engine === 'chromium'
			? process.env.CHROMIUM_PATH ?? await access('/usr/bin/chromium').then(() => '/usr/bin/chromium', () => undefined)
			: undefined;
		const browser = await implementation.launch({ headless: true, executablePath, args: engine === 'chromium' ? ['--no-sandbox'] : [] });
		const evidence = { engine, version: browser.version(), binaries: [], logs: [], errors: [] };
		report.browsers.push(evidence);
		try
		{
			const page = await browser.newPage();
			const { errors, binaries } = evidence;
			page.on('pageerror', error => errors.push(error.message));
			// Serialize bigint in the page: browser console protocols do not agree on its display text.
			await page.exposeFunction('recordReferenceLog', value => evidence.logs.push(value));
			await page.addInitScript(() => {
				const original = console.log;
				globalThis.referenceLogPromises = [];
				console.log = (...values) => {
					globalThis.referenceLogPromises.push(globalThis.recordReferenceLog(values.map(value =>
						typeof value === 'bigint' ? `${value}n` : String(value)).join(' ')));
					original.apply(console, values);
				};
			});
			page.on('request', request => { if(new URL(request.url()).pathname.endsWith('.wasm')) binaries.push(request.url()); });
			assert.equal((await page.goto(server.url)).status(), 200);
			await page.getByText('Prepared examples passed').waitFor({ timeout: 30000 });
			await page.evaluate(() => Promise.all(globalThis.referenceLogPromises));
			assert.deepEqual(errors, []);
			assert.equal(binaries.length, 3, 'One main binary and two component binaries');
			assert.equal(binaries.filter(url => /\/main-[^/]+\.wasm$/u.test(url)).length, 1);
			assert.deepEqual(evidence.logs, report.examples.flatMap(example => example.output.trim().split('\n')));
		}
		finally
		{ await browser.close(); }
	}
	report.status = 'passed';
}
catch(error)
{
	report.status = 'failed';
	report.error = error.stack;
	throw error;
}
finally
{
	if(server) await server.close();
	await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Prepared reference package acceptance: ${report.status}`);
}
