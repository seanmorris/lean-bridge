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
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	if(!["--release", "--output", "--browsers"].includes(name) || !process.argv[index + 1])
		throw new Error("Usage: check-component-browser-consumer.mjs --release DIRECTORY [--output DIRECTORY] [--browsers chromium,firefox,webkit]");
	options.set(name, process.argv[index + 1]);
}
if(!options.has("--release")) throw new Error("--release must name the author's exact npm release directory");
const release = resolve(options.get("--release"));
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
const maximum = ((1n << 31n) - 1n).toString();

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
		await page.locator('#lean-result[data-status="error"]').waitFor();
		assert.match(await page.locator("#lean-result").textContent(), /supports sums through/u);
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

try
{
	const portable = JSON.parse((await execute(process.execPath, [join(release, "verify-component-package-receipt.mjs"), "--receipt", receiptPath], { cwd: scratch })).stdout);
	assert.deepEqual(portable, verified, "The shipped standalone verifier accepts the exact author archives");
	await cp(join(repository, "tests/fixtures/component-consumer"), scratch, { recursive: true });
	await execute("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(release, receipt.runtime.archive), join(release, receipt.package.archive)], { cwd: scratch, maxBuffer: 8_000_000 });
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
	const nodeResult = JSON.parse((await execute(process.execPath, ["--input-type=module", "-e", 'import {add,isEmpty} from "onboarding-small"; process.stdout.write(JSON.stringify({sum:String(add(100n,23n)),empty:isEmpty(""),nonempty:isEmpty("Lean")}));'], { cwd: scratch })).stdout);
	assert.deepEqual(nodeResult, { sum: "123", empty: true, nonempty: false });
	const numericBoundarySource = `import {add} from "onboarding-small";
const maximum = (1n << 31n) - 1n;
const unsupported = [[maximum + 1n, 0n], [maximum, 1n]].map(([left, right]) => {
  try { return {left: String(left), right: String(right), result: String(add(left, right))}; }
  catch(error) { return {left: String(left), right: String(right), error: error.message}; }
});
process.stdout.write(JSON.stringify({maximum: String(maximum), inputAtMaximum: String(add(maximum, 0n)), sumAtMaximum: String(add(maximum - 1n, 1n)), unsupported}));`;
	const numericBoundary = JSON.parse((await execute(process.execPath, ["--input-type=module", "-e", numericBoundarySource], { cwd: scratch })).stdout);
	assert.deepEqual(numericBoundary, {
		maximum, inputAtMaximum: maximum, sumAtMaximum: maximum
		, unsupported: [
			{ left: "2147483648", right: "0", error: "resolved is not a function" }
			, { left: maximum, right: "1", error: "resolved is not a function" }
		]
	}, "Record the current runtime limitation so a runtime change forces the tutorial range to be revisited");
	await execute("npm", ["run", "build"], { cwd: scratch, maxBuffer: 8_000_000 });
	await build({ root: scratch, configFile: join(scratch, "vite.config.ts"), envDir: false, logLevel: "error", define: { "process.env.NODE_ENV": JSON.stringify("development") }, build: { outDir: "dist-strict", minify: false } });
	const production = await startSiteServer({ root: join(scratch, "dist"), base });
	const strict = await startSiteServer({ root: join(scratch, "dist-strict"), base });
	try
	{
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
			}
			finally
			{ await browser.close(); }
		}
	}
	finally
	{ await production.close(); await strict.close(); }
	assert.deepEqual(await verifyComponentPackageReceipt({ receiptPath }), verified, "Acceptance does not rewrite the author's package bytes");
	const report = {
		schemaVersion: 1, kind: "lean-bridge-installed-component-consumer"
		, status: "passed", createdAt: new Date().toISOString()
		, receipt: verified
		, archives: { runtime: receipt.runtime, component: receipt.package }
		, installation: {
			outsideRepository: true, lifecycleScripts: false
			, publicPackage: "onboarding-small", privateRepositoryImports: false
		}
		, node: nodeResult
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
finally
{ await rm(scratch, { recursive: true, force: true }); }
