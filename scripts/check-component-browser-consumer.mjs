#!/usr/bin/env node
/**
 * Install the author's exact archives in an external React and worker consumer.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium, firefox, webkit } from "playwright";
import { build } from "vite";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { startSiteServer } from "../site/serve.mjs";

const execute = promisify(execFile);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documentationFixtures = join(repository, "tests/fixtures/documentation/consumers");
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	if(!["--release", "--output", "--browsers", "--registry"].includes(name) || options.has(name) || !process.argv[index + 1])
		throw new Error("Usage: check-component-browser-consumer.mjs --release DIRECTORY [--output DIRECTORY] [--browsers chromium,firefox,webkit]");
	options.set(name, process.argv[index + 1]);
}
if(!options.has("--release")) throw new Error("--release must name the author's exact npm release directory");
const release = resolve(options.get("--release"));
const registry = options.get("--registry");
if(registry) assert.ok(new URL(registry).protocol === "http:" && ["localhost", "127.0.0.1"].includes(new URL(registry).hostname), "Consumer rehearsal registry must be loopback HTTP");
const output = resolve(options.get("--output") ?? join(repository, "build/documentation-consumer-acceptance"));
const engines = (options.get("--browsers") ?? "chromium,firefox,webkit").split(",");
for(const engine of engines) assert.ok(["chromium", "firefox", "webkit"].includes(engine), `Unknown browser ${engine}`);
const receiptPath = join(release, "component-package-receipt.json");
const verified = await verifyComponentPackageReceipt({ receiptPath });
assert.equal(verified.component, "onboarding-small@1.0.0");
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-installed-react-"));
const observations = [];
const base = "/consumer-example/";
const maximum = ((1n << 128n) - 1n).toString();

const installPackage = async directory => {
	const flags = ["install", "--ignore-scripts", "--no-audit", "--no-fund"];
	if(registry) await execute("npm", flags, { cwd: directory, maxBuffer: 8_000_000 });
	await execute("npm", [...flags
		, ...(registry
			? ["--registry", registry, receipt.package.package]
			: [join(release, receipt.runtime.archive), join(release, receipt.package.archive)])], { cwd: directory, maxBuffer: 8_000_000 });
};

/**
 * Wait for an observable installed-component result, not a script handle.
 *
 * @param page Browser page containing the fixture.
 * @param selector Main-thread or worker result element.
 */
const resultReady = (page, selector = "#lean-result") => page.locator(`${selector}[data-status="ready"]`).waitFor();

/**
 * Count owned worker instances without holding their DOM or React component.
 *
 * @param page Browser page receiving worker instrumentation.
 */
const observeWorkers = page => page.addInitScript(() => {
	let created = 0;
	let terminated = 0;
	const workers = new Set();
	const Original = globalThis.Worker;
	globalThis.Worker = new Proxy(Original, {
		construct: (target, args) => {
			const worker = Reflect.construct(target, args);
			const terminate = worker.terminate.bind(worker);
			created++;
			workers.add(worker);
			worker.terminate = () => {
				if(workers.delete(worker)) terminated++;
				terminate();
			};
			return worker;
		}
	});
	globalThis.componentWorkerAudit = () => ({ created, terminated, live: workers.size });
});

/**
 * Exercise a current package in both production React and development StrictMode.
 *
 * @param browser Selected Playwright browser.
 * @param url Deployed fixture URL.
 * @param engine Browser engine name for the evidence.
 * @param variant Production or development StrictMode build.
 */
const checkPage = async (browser, url, engine, variant) => {
	const page = await browser.newPage();
	const errors = [];
	const wasmRequests = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("response", response => {
		if(response.url().endsWith(".wasm")) wasmRequests.push({ url: new URL(response.url()).pathname, status: response.status(), type: response.headers()["content-type"] });
	});
	await observeWorkers(page);
	try
	{
		await page.goto(url);
		await resultReady(page);
		assert.equal(await page.locator("#lean-result").textContent(), "Sum: 42. Empty string: true.");
		const initial = await page.evaluate(() => globalThis.componentConsumer);
		assert.equal(initial.effects, variant === "strict" ? 2 : 1);
		assert.equal(initial.commits, 1, "Only the currently mounted effect publishes a result");
		const initialWasmRequests = wasmRequests.length;
		assert.ok(initialWasmRequests >= 2, "The installed runtime and component load as real Wasm assets");
		await page.locator("#left").fill("100");
		await page.locator("#right").fill("23");
		await page.locator("#text").fill("Lean λ");
		await page.locator("#calculate").click();
		await page.locator("#lean-result").filter({ hasText: "Sum: 123. Empty string: false." }).waitFor();
		await page.locator("#left").fill(maximum);
		await page.locator("#right").fill("0");
		await page.locator("#calculate").click();
		await page.locator("#lean-result").filter({ hasText: `Sum: ${maximum}.` }).waitFor();
		const beforeBoundarySum = await page.evaluate(() => globalThis.componentConsumer.commits);
		await page.locator("#left").fill(String(BigInt(maximum) - 1n));
		await page.locator("#right").fill("1");
		await page.locator("#calculate").click();
		await page.waitForFunction(previous => globalThis.componentConsumer.commits === previous + 1, beforeBoundarySum);
		assert.match(await page.locator("#lean-result").textContent(), new RegExp(`^Sum: ${maximum}\\.`));
		await page.locator("#left").fill(maximum);
		await page.locator("#calculate").click();
		await page.locator("#lean-result").filter({ hasText: `Sum: ${BigInt(maximum) + 1n}.` }).waitFor();
		await page.locator("#left").fill("-1");
		await page.locator("#calculate").click();
		await page.locator("#lean-result").filter({ hasText: "Enter nonnegative whole numbers." }).waitFor();
		await page.locator("#left").fill("20");
		await page.locator("#right").fill("22");
		await page.locator("#calculate").click();
		await resultReady(page);
		for(let index = 0; index < 4; index++)
		{
			await page.locator("#toggle-component").click();
			assert.equal(await page.locator("#lean-result").count(), 0);
			await page.locator("#toggle-component").click();
			await resultReady(page);
		}
		assert.equal(wasmRequests.length, initialWasmRequests, "React remounts reuse the installed module rather than creating a runtime per effect");
		await page.locator("#toggle-worker").click();
		await resultReady(page, "#worker-result");
		assert.equal(await page.locator("#worker-result").textContent(), "Sum: 42. Empty string: false.");
		await page.locator("#toggle-worker").click();
		assert.equal(await page.locator("#worker-result").count(), 0);
		const workers = await page.evaluate(() => globalThis.componentWorkerAudit());
		assert.equal(workers.live, 0);
		assert.equal(workers.created, workers.terminated);
		assert.equal(workers.created, variant === "strict" ? 2 : 1);
		for(const request of wasmRequests)
		{
			assert.ok(request.url.startsWith(base), "Worker and main assets retain the deployment prefix");
			assert.equal(request.status, 200);
			assert.match(request.type, /^application\/wasm/u);
		}
		assert.deepEqual(errors, []);
		return { engine, browserVersion: browser.version(), variant, initial, workers, wasmAssets: [...new Set(wasmRequests.map(request => request.url))], maximumCheckedInput: maximum, maximumCheckedSum: maximum, result: "passed" };
	}
	finally
	{ await page.close(); }
};

/**
 * Unmounting while the real runtime is loading must suppress retired results.
 *
 * @param browser Selected Playwright browser.
 * @param url Deployed StrictMode fixture URL.
 * @param engine Browser engine name for the evidence.
 */
const checkPending = async (browser, url, engine) => {
	const page = await browser.newPage();
	let releaseRequest;
	const held = new Promise(resolveHeld => { releaseRequest = resolveHeld; });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	const requested = page.waitForRequest(request => request.url().endsWith(".wasm"));
	await page.route("**/*.wasm", async route => { await held; await route.continue().catch(() => {}); });
	try
	{
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await requested;
		await page.locator("#toggle-component").click();
		assert.equal(await page.locator("#lean-result").count(), 0);
		releaseRequest();
		await page.waitForFunction(() => globalThis.componentConsumer.ignored >= 2);
		assert.equal(await page.evaluate(() => globalThis.componentConsumer.commits), 0);
		await page.locator("#toggle-component").click();
		await resultReady(page);
		assert.equal(await page.evaluate(() => globalThis.componentConsumer.commits), 1);
		assert.deepEqual(errors, []);
		return { engine, pendingUnmount: "passed" };
	}
	finally
	{ releaseRequest(); await page.close(); }
};

/**
 * Show failed asset loading and recover with a fresh browser module map.
 *
 * @param browser Selected Playwright browser.
 * @param url Deployed production fixture URL.
 * @param engine Browser engine name for the evidence.
 */
const checkFailure = async (browser, url, engine) => {
	const page = await browser.newPage();
	try
	{
		await page.route("**/*.wasm", route => route.fulfill({ status: 404, body: "Missing test asset" }));
		await page.goto(url);
		await page.locator('#lean-result[data-status="error"]').waitFor();
		assert.notEqual(await page.locator("#lean-result").textContent(), "");
		await page.unroute("**/*.wasm");
		await page.reload();
		await resultReady(page);
		return { engine, failedAssetAndReload: "passed" };
	}
	finally
	{ await page.close(); }
};

/**
 * Execute the framework-free guide and verify asset failures and reload recovery.
 *
 * @param browser Selected Playwright browser.
 * @param url Deployed plain JavaScript example URL.
 * @param engine Browser engine name recorded in the report.
 */
const checkPlainBrowser = async (browser, url, engine) => {
	const page = await browser.newPage();
	const assets = [];
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("response", response => {
		if(response.url().endsWith(".wasm")) assets.push({ path: new URL(response.url()).pathname, status: response.status(), type: response.headers()["content-type"] });
	});
	try
	{
		await page.goto(url);
		await page.locator('#result[data-status="ready"]').waitFor();
		assert.equal(await page.locator("#result").innerText(), "Sum: 42. Empty string: true.");
		assert.ok(assets.length >= 2);
		for(const asset of assets)
		{
			assert.ok(asset.path.startsWith(base));
			assert.equal(asset.status, 200);
			assert.match(asset.type, /^application\/wasm/u);
		}
		assert.deepEqual(errors, []);
		await page.route("**/*.wasm", route => route.fulfill({ status: 404, body: "Missing test asset" }));
		await page.reload();
		await page.locator('#result[data-status="error"]').waitFor();
		assert.match(await page.locator("#result").innerText(), /Could not load Lean/u);
		await page.unroute("**/*.wasm");
		await page.reload();
		await page.locator('#result[data-status="ready"]').waitFor();
		return { engine, variant: "plain-javascript", result: "passed", failedAssetAndReload: "passed" };
	}
	finally
	{ await page.close(); }
};

try
{
	const portable = JSON.parse((await execute(process.execPath, [join(release, "verify-component-package-receipt.mjs"), "--receipt", receiptPath], { cwd: scratch })).stdout);
	assert.deepEqual(portable, verified, "The shipped standalone verifier accepts the exact author archives");
	await cp(join(repository, "tests/fixtures/component-consumer"), scratch, { recursive: true });
	await installPackage(scratch);
	const manifest = JSON.parse(await readFile(join(scratch, "node_modules/onboarding-small/package.json"), "utf8"));
	assert.equal(manifest.leanBridge.componentIdentitySha256, verified.componentIdentitySha256);
	assert.equal(manifest.exports["."].browser, "./index.mjs");
	const installedRuntime = JSON.parse(await readFile(join(scratch, "node_modules/@lean-bridge/runtime/package.json"), "utf8"));
	assert.equal(`@lean-bridge/runtime@${installedRuntime.version}`, verified.runtime);
	assert.equal(installedRuntime.exports["."].browser, "./index.mjs");
	assert.doesNotMatch(await readFile(join(scratch, "node_modules/onboarding-small/index.d.ts"), "utf8"), /\bany\b/u);
	const dependencyPaths = (await execute("npm", ["ls", "@lean-bridge/runtime", "--all", "--parseable"], { cwd: scratch })).stdout.trim().split("\n");
	assert.equal(dependencyPaths.filter(path => path.endsWith("/node_modules/@lean-bridge/runtime")).length, 1);
	const versions = { node: process.versions.node };
	for(const dependency of ["react", "react-dom", "typescript", "vite"])
		versions[dependency] = JSON.parse(await readFile(join(scratch, "node_modules", dependency, "package.json"), "utf8")).version;
	await cp(join(documentationFixtures, "javascript"), join(scratch, "node-javascript"), { recursive: true });
	await cp(join(documentationFixtures, "typescript"), join(scratch, "node-typescript"), { recursive: true });
	const nodeResult = JSON.parse((await execute(process.execPath, ["node-javascript/index.mjs"], { cwd: scratch })).stdout);
	assert.deepEqual(nodeResult, { sum: "123", empty: true, nonempty: false });
	await execute(join(scratch, "node_modules/.bin/tsc"), ["--project", "node-typescript/tsconfig.json"], { cwd: scratch });
	const typescriptResult = JSON.parse((await execute(process.execPath, ["node-typescript/dist/index.js"], { cwd: scratch })).stdout);
	assert.deepEqual(typescriptResult, { sum: "42", empty: true });
	await execute(process.execPath, ["--input-type=module", "-e"
		, `
import assert from "node:assert/strict";
import { addInput } from "./node-typescript/dist/input.js";
assert.equal(addInput("20", "22"), 42n);
assert.equal(addInput("2147483647", "0"), 2147483647n);
assert.equal(addInput("18446744073709551616", "7"), 18446744073709551623n);
for(const [left, right] of [["-1", "0"], ["1.5", "1"], ["", "0"]])
  assert.throws(() => addInput(left, right), RangeError);
`], { cwd: scratch });
	const numericBoundarySource = `import {add} from "onboarding-small";
const values = [1n << 31n, 1n << 64n, (1n << 4096n) + 123n];
process.stdout.write(JSON.stringify(values.map(value => ({ input: String(value), sum: String(add(value, 7n)) }))));`;
	const numericBoundary = JSON.parse((await execute(process.execPath, ["--input-type=module", "-e", numericBoundarySource], { cwd: scratch })).stdout);
	assert.deepEqual(numericBoundary, [1n << 31n, 1n << 64n, (1n << 4096n) + 123n].map(value => ({ input: String(value), sum: String(value + 7n) })), "Installed Nat arithmetic preserves arbitrary precision");
	await execute("npm", ["run", "build"], { cwd: scratch, maxBuffer: 8_000_000 });
	await build({ root: scratch, configFile: join(scratch, "vite.config.ts"), envDir: false, logLevel: "error", define: { "process.env.NODE_ENV": JSON.stringify("development") }, build: { outDir: "dist-strict", minify: false } });
	const plainRoot = join(scratch, "plain-browser");
	await cp(join(documentationFixtures, "browser"), plainRoot, { recursive: true });
	await installPackage(plainRoot);
	await execute("npm", ["run", "build"], { cwd: plainRoot, maxBuffer: 8_000_000 });
	const servers = [];
	try
	{
		const production = await startSiteServer({ root: join(scratch, "dist"), base });
		servers.push(production);
		const strict = await startSiteServer({ root: join(scratch, "dist-strict"), base });
		servers.push(strict);
		const plain = await startSiteServer({ root: join(plainRoot, "dist"), base });
		servers.push(plain);
		for(const engine of engines)
		{
			const launchOptions = { headless: true };
			if(engine === "chromium")
			{
				const executable = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
				if(executable) launchOptions.executablePath = executable;
				launchOptions.args = ["--no-sandbox"];
			}
			const browser = await ({ chromium, firefox, webkit })[engine].launch(launchOptions);
			try
			{
				observations.push(await checkPage(browser, production.url, engine, "production"));
				observations.push(await checkPage(browser, strict.url, engine, "strict"));
				observations.push(await checkPending(browser, strict.url, engine));
				observations.push(await checkFailure(browser, production.url, engine));
				observations.push(await checkPlainBrowser(browser, plain.url, engine));
			}
			finally
			{ await browser.close(); }
		}
	}
	finally
	{ await Promise.all(servers.map(server => server.close())); }
	assert.deepEqual(await verifyComponentPackageReceipt({ receiptPath }), verified, "Acceptance does not rewrite the author's package bytes");
	const report = {
		schemaVersion: 1, kind: "lean-bridge-installed-component-consumer"
		, status: "passed", createdAt: new Date().toISOString()
		, receipt: verified
		, archives: { runtime: receipt.runtime, component: receipt.package }
		, installation: {
			outsideRepository: true, lifecycleScripts: false
			, componentOnlyFromRegistry: Boolean(registry)
			, runtimeResolvedAutomatically: Boolean(registry)
			, publicPackage: "onboarding-small", privateRepositoryImports: false
		}
		, node: nodeResult
		, typescript: typescriptResult
		, numericBoundary
		, typecheck: { strict: true, publicAny: false, wrongTypesRejected: true }
		, versions, requestedBrowsers: engines
		, browsers: observations
		, fixtureSha256: createHash("sha256").update(await readFile(join(scratch, "main.tsx"))).digest("hex")
	};
	await mkdir(output, { recursive: true });
	await writeFile(join(output, "numeric-boundary-diagnostic.json"), `${JSON.stringify({
		schemaVersion: 1, kind: "lean-bridge-component-nat-boundary"
		, receipt: verified
		, diagnostic: numericBoundary
	}, null, 2)}\n`);
	await writeFile(join(output, "acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
catch(error)
{
	await mkdir(output, { recursive: true });
	await writeFile(join(output, "acceptance.json"), `${JSON.stringify({
		schemaVersion: 1, kind: "lean-bridge-installed-component-consumer"
		, status: "failed", createdAt: new Date().toISOString(), receipt: verified
		, requestedBrowsers: engines, browsers: observations
		, error: error.message, stdout: error.stdout, stderr: error.stderr
	}, null, 2)}\n`);
	throw error;
}
finally
{ await rm(scratch, { recursive: true, force: true }); }
