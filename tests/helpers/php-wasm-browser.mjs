/**
 * Run installed ordinary PHP-Wasm packages in a real, network-isolated browser.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { build as buildVite } from "vite";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmOrdinaryConsumer } from "./php-wasm-ordinary.mjs";

/**
 * Execute the full copied-value corpus through published browser asset URLs.
 *
 * @param options - Relocated installed app, pinned PHP host and test-only probe.
 */
export const exerciseBrowserPhpWasmPackages = async options => {
	const { consumer, phpHost, probe, t } = options;
	const guide = join(consumer, "browser-guide");
	await mkdir(guide);
	for(const file of ["browser.mjs", "index.html", "vite.config.mjs"])
		await cp(join("tests/fixtures/documentation/consumers/php-wasm/ordinary", file), join(guide, file));
	await buildVite({ root: guide, configFile: join(guide, "vite.config.mjs"), publicDir: false, logLevel: "silent", build: { outDir: join(consumer, "bundled/guide") } });
	await saveLakeFile(consumer, "bundled/browser.mjs", `import { PhpWeb } from '/php-host/PhpWeb.mjs';
import { api0, api1 } from './consumer.mjs';
const loading = new URL(location.href).searchParams.get('loading') ?? 'startup';
const strict = new URL(location.href).searchParams.get('caller') === 'strict';
const failure = new URL(location.href).searchParams.get('failure');
const apis = [api0, api1, api0];
const php = new PhpWeb({version: '8.4', autoTransaction: false, ini: 'memory_limit=512M' + (failure === 'disabled' ? '\\nenable_dl=0' : ''), sharedLibs: loading === 'startup' ? apis : [], dynamicLibs: [{name: 'probe.so', url: new URL('/probe.so', location.href), ini: false}, ...(loading === 'lazy' ? apis.map(api => api.lazy) : [])]});
let stdout = '', stderr = '';
php.addEventListener('output', event => { for (const value of event.detail) stdout += value; });
php.addEventListener('error', event => { for (const value of event.detail) stderr += value; });
const run = async code => { const status = await php.run(code); if (status !== 0 || stderr) throw new Error(JSON.stringify({status, stdout, stderr})); };
window.ticks = 0;
const timer = setInterval(() => window.ticks++, 10);
const stage = async name => { window.stage = name; await new Promise(resolve => { window.advance = resolve; }); };
try {
  for (const api of apis) await run("<?php require_once '" + api.autoload + "';");
  window.failureProbe = async namespace => {
    stdout = ''; stderr = '';
    await run("<?php try { " + namespace + "\\\\answer(); throw new Exception('Expected loading error'); } catch (" + namespace + "\\\\LeanBridgeError $error) { echo $error->getMessage(); }");
    return stdout;
  };
  await stage('ready');
  await run("<?php try { LeanWillow\\\\echo_u32(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}");
  await stage('invalid');
  const ticksBefore = window.ticks;
  await php.writeFile('/Willow-consumer.php', strict ? ${JSON.stringify(phpWasmOrdinaryConsumer("Willow", { strict: true }).replace("require_once '/Willow/src/Api.php';", ""))} : ${JSON.stringify(phpWasmOrdinaryConsumer("Willow").replace("require_once '/Willow/src/Api.php';", ""))});
  await run("<?php require '/Willow-consumer.php';");
  window.loadTicks = window.ticks - ticksBefore;
  await stage('willow');
  await php.writeFile('/Aspen-consumer.php', strict ? ${JSON.stringify(phpWasmOrdinaryConsumer("Aspen", { strict: true }).replace("require_once '/Aspen/src/Api.php';", ""))} : ${JSON.stringify(phpWasmOrdinaryConsumer("Aspen").replace("require_once '/Aspen/src/Api.php';", ""))});
  await run("<?php require '/Aspen-consumer.php';");
  await stage('aspen');
  if (stdout !== 'Willow:okAspen:ok') throw new Error('Copied value checks: ' + stdout);
  stdout = '';
  for (let i = 0; i < 20; i++) await run("<?php echo LeanWillow\\\\answer(), ':', LeanAspen\\\\answer(), ';';");
  if (stdout !== '17:29;'.repeat(20)) throw new Error('Repeated calls: ' + stdout);
  stdout = '';
  await run("<?php if (!dl('probe.so')) throw new Exception('Probe failed'); echo json_encode(lean_bridge_test_snapshot());");
  window.result = {strict, exports: 88, repeatedRequests: 20, counters: JSON.parse(stdout)};
} catch(error) { window.result = {error: error.stack}; }
finally { clearInterval(timer); }
`);
	const roots = [["/nested/app/", await realpath(join(consumer, "bundled"))], ["/php-host/", await realpath(phpHost)]];
	const requests = [], errors = [];
	let delayLibraries = false, corruptRuntime = false;
	const server = createServer(async (request, response) => {
		try
		{
			const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
			requests.push(path);
			if(corruptRuntime && (path.includes("liblean_bridge_php_wasm_copied_") || /php8\.4-lb_.*\.so\.so$/.test(path)))
			{
				response.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" });
				response.end("deliberately corrupt test library"); return;
			}
			if(path === "/nested/app/")
			{
				response.writeHead(200, { "Content-Type": "text/html" });
				response.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
				return;
			}
			let file;
			if(path === "/probe.so") file = probe;
			else
			{
				const entry = roots.find(([prefix]) => path.startsWith(prefix));
				if(!entry) throw new Error("Unknown asset");
				const [prefix, root] = entry;
				file = await realpath(resolve(root, path.slice(prefix.length)));
				if(!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error("Invalid asset path");
			}
			const bytes = await readFile(file);
			if(delayLibraries && path.endsWith(".so") && path !== "/probe.so")
				await new Promise(accept => setTimeout(accept, 100));
			const type = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm" }[extname(file)] ?? "application/octet-stream";
			response.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "no-store" });
			response.end(bytes);
		} catch(error)
		{
			errors.push(`${request.url}: ${error.message}`);
			response.writeHead(404); response.end("Not found");
		}
	});
	await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept); });
	const origin = `http://127.0.0.1:${server.address().port}`;
	let browser;
	try
	{
		const executablePath = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : chromium.executablePath());
		browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
		const page = await browser.newPage();
		await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : (errors.push(`External request: ${route.request().url()}`), route.abort()));
		page.on("pageerror", error => errors.push(error.message));
		page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
		const stage = async expected => {
			await page.waitForFunction(name => globalThis.stage === name || globalThis.result !== undefined, expected, { timeout: 120000 });
			assert.equal(await page.evaluate(() => globalThis.result?.error), undefined);
			assert.equal(await page.evaluate(() => globalThis.stage), expected);
		};
		for(const loading of ["startup", "lazy"])
		for(const strict of [false, true])
		{
			const start = requests.length;
			const libraries = () => requests.slice(start).filter(path => path.endsWith(".so") && path !== "/probe.so");
			await page.goto(`${origin}/nested/app/?loading=${loading}&caller=${strict ? "strict" : "weak"}`);
			await stage("ready");
			assert.equal(libraries().length, loading === "lazy" ? 0 : 3, "Import and autoload must not fetch lazy libraries");
			await page.evaluate(() => globalThis.advance()); await stage("invalid");
			assert.equal(libraries().length, loading === "lazy" ? 0 : 3, "Invalid input must not fetch lazy libraries");
			delayLibraries = loading === "lazy";
			await page.evaluate(() => globalThis.advance()); await stage("willow");
			assert.equal(libraries().length, loading === "lazy" ? 2 : 3);
			if(loading === "lazy") assert.ok(await page.evaluate(() => globalThis.loadTicks > 0), "Browser timers must run while a cold library fetch is pending");
			delayLibraries = false;
			await page.evaluate(() => globalThis.advance()); await stage("aspen");
			assert.equal(libraries().length, 3);
			await page.evaluate(() => globalThis.advance());
			await page.waitForFunction(() => globalThis.result !== undefined, undefined, { timeout: 120000 });
			const result = await page.evaluate(() => globalThis.result);
			assert.deepEqual(result, { strict, exports: 88, repeatedRequests: 20, counters: [1, 2, 1, 2, 2, 0] });
			assert.deepEqual(errors, []);
			assert.equal(libraries().length, 3); assert.equal(new Set(libraries()).size, 3);
			assert.equal(libraries().filter(path => path.includes("liblean_bridge_php_wasm_copied_")).length, 1);
			t.diagnostic(`Chromium ${browser.version()} ${loading}/${strict ? "strict" : "weak"}: 88 exports, 20 requests, one runtime and two extensions fetched once under /nested/app/`);
		}
		for(const failure of ["disabled", "corrupt-runtime"])
		{
			const start = requests.length;
			corruptRuntime = failure === "corrupt-runtime";
			await page.goto(`${origin}/nested/app/?loading=lazy&failure=${failure}`);
			await stage("ready");
			const libraries = () => requests.slice(start).filter(path => path.endsWith(".so"));
			assert.equal(libraries().length, 0);
			const first = await page.evaluate(() => globalThis.failureProbe("LeanWillow"));
			assert.match(first, failure === "disabled" ? /enable_dl=1/ : /create a new PHP instance/);
			const afterFirst = libraries().length;
			const second = await page.evaluate(() => globalThis.failureProbe("LeanAspen"));
			const repeated = await page.evaluate(() => globalThis.failureProbe("LeanWillow"));
			assert.equal(second, first); assert.equal(repeated, first);
			assert.equal(libraries().length, afterFirst);
			if(failure === "disabled") assert.equal(afterFirst, 0);
			else assert.ok(afterFirst > 0);
			assert.deepEqual(errors, []);
			t.diagnostic(`Chromium ${failure}: explicit failure without another lazy load`);
		}
		corruptRuntime = false;
		const guideRequestsStart = requests.length;
		await page.goto(`${origin}/nested/app/guide/index.html`);
		await page.waitForFunction(() => globalThis.document.querySelector("#result")?.dataset.state !== undefined, undefined, { timeout: 120000 });
		assert.equal(await page.locator("#result").getAttribute("data-state"), "ready");
		assert.equal(await page.locator("#result").textContent(), "4294967295");
		assert.deepEqual(errors, []);
		const guideLibraries = requests.slice(guideRequestsStart).filter(path => path.endsWith(".so"));
		assert.equal(guideLibraries.length, 2); assert.equal(new Set(guideLibraries).size, 2);
		t.diagnostic("published browser PHP-Wasm HTML, Vite config and consumer file: exact UInt32 upper bound");
	} finally
	{
		try
		{ await browser?.close(); }
		finally
		{
			server.closeAllConnections();
			await new Promise(accept => server.close(accept));
		}
	}
};
