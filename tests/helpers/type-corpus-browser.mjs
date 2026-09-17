/**
 * Real browser, React and dedicated-worker consumers of isolated npm releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { corpusCases } from "../fixtures/type-corpus/cases.mjs";
import { corpusBrowserSelection, validateCorpusObservation } from "./type-corpus.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixtures = join(repository, "tests/fixtures/type-corpus/consumers/browser");
const base = "/corpus/nested/";
const json = async path => JSON.parse(await readFile(path, "utf8"));

/**
 * Prepare exact locally locked framework archives, without registry access.
 *
 * @param root - Isolated consumer directory receiving the framework handoff.
 */
export const browserFrameworkArchives = async root => {
	const archives = [];
	for(const name of ["react", "react-dom", "scheduler"])
	{
		const directory = join(repository, "node_modules", name);
		const manifest = await json(join(directory, "package.json"));
		assert.equal(manifest.name, name);
		const bytes = await createDeterministicTarGz({ directory, archiveRoot: "package", sourceDateEpoch: 1 });
		const archive = `framework/${name}-${manifest.version}.tgz`;
		await saveLakeFile(root, archive, bytes);
		archives.push({ name, version: manifest.version, archive, sha256: sha256(bytes) });
	}
	return archives;
};

const ready = async page => {
	await page.locator('#result[data-status="ready"], #result[data-status="error"]').waitFor();
	assert.equal(await page.locator("#result").getAttribute("data-status"), "ready", await page.locator("#result").textContent());
};
const observation = async (page, browser, library, oracle) => {
	const result = { ...await page.evaluate(() => globalThis.corpusResult), hostVersion: browser.version() };
	validateCorpusObservation(library, corpusCases(library), oracle, result);
	return result;
};
const instrumentWorkers = page => page.addInitScript(() => {
	let created = 0, terminated = 0;
	const live = new Set();
	globalThis.Worker = new Proxy(globalThis.Worker, {
		construct: (target, args) => {
			const worker = Reflect.construct(target, args), terminate = worker.terminate.bind(worker);
			created++; live.add(worker);
			worker.terminate = () => { if(live.delete(worker)) terminated++; terminate(); };
			return worker;
		}
	});
	globalThis.corpusWorkers = () => ({ created, terminated, live: live.size });
});
const openPage = async (browser, url, intercept = undefined) => {
	const context = await browser.newContext({ serviceWorkers: "block" });
	const errors = [], foreignRequests = [], assets = [], pendingAssets = [];
	await context.route("**/*", async route => {
		if(!route.request().url().startsWith(url))
		{ foreignRequests.push(route.request().url()); await route.abort(); return; }
		if(intercept && route.request().url().endsWith(".wasm")) await intercept(route);
		else await route.continue();
	});
	context.on("response", response => {
		if(response.url().endsWith(".wasm") && response.status() === 200)
			pendingAssets.push(response.body().then(bytes => {
				assets.push({ path: new URL(response.url()).pathname
					, status: response.status(), mime: response.headers()["content-type"]
					, bytes: bytes.length, sha256: sha256(bytes) });
			}).catch(error => errors.push(error.message)));
	});
	const page = await context.newPage();
	page.setDefaultTimeout(20_000);
	page.on("pageerror", error => errors.push(error.message));
	await instrumentWorkers(page);
	return { context, page, errors, foreignRequests, assets, pendingAssets };
};

const checkExecution = async ({ browser, engine, variant, url, library, profile, oracle, installedAssets }) => {
	const state = await openPage(browser, url);
	const { page } = state;
	try
	{
		await page.goto(url);
		await ready(page);
		const first = await observation(page, browser, library, oracle);
		await Promise.all(state.pendingAssets);
		const initialRequests = state.assets.length;
		let lifecycle;
		if(profile === "browser-react")
		{
			for(let index = 0; index < 2; index++)
			{
				await page.locator("#toggle").click();
				assert.equal(await page.locator("#result").count(), 0);
				await page.locator("#toggle").click();
				await ready(page);
				assert.deepEqual(await observation(page, browser, library, oracle), first);
			}
			lifecycle = await page.evaluate(() => globalThis.corpusLifecycle);
			assert.deepEqual(lifecycle, variant === "strict"
				? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
				: { effects: 3, cleanups: 2, ignored: 0, commits: 3 });
		}
		else
		{
			const before = await page.locator("#result").textContent();
			await page.locator("#rerun").click();
			await page.waitForFunction(previous => document.querySelector("#result").textContent !== previous, before);
			await ready(page);
			assert.deepEqual(await observation(page, browser, library, oracle), first);
			lifecycle = { rerun: true };
		}
		await Promise.all(state.pendingAssets);
		assert.equal(state.assets.length, initialRequests, "Reruns and React remounts must reuse the loaded module");
		if(profile === "browser-worker")
		{
			await page.locator("#stop").click();
			assert.deepEqual(await page.evaluate(() => globalThis.corpusWorkers()), { created: 1, terminated: 1, live: 0 });
			await page.locator("#rerun").click();
			await ready(page);
			assert.deepEqual(await observation(page, browser, library, oracle), first);
			await page.locator("#stop").click();
			lifecycle = await page.evaluate(() => globalThis.corpusWorkers());
			assert.deepEqual(lifecycle, { created: 2, terminated: 2, live: 0 });
		}
		await Promise.all(state.pendingAssets);
		assert.deepEqual(state.errors, []);
		assert.deepEqual(state.foreignRequests, []);
		assert.deepEqual([...new Set(state.assets.map(asset => asset.sha256))].sort(), installedAssets.map(asset => asset.sha256).sort());
		for(const asset of state.assets)
		{
			assert.ok(asset.path.startsWith(base));
			assert.match(asset.mime, /^application\/wasm/);
			assert.equal(asset.bytes, installedAssets.find(input => input.sha256 === asset.sha256)?.bytes);
		}
		return { engine, variant, observation: first, assets: state.assets, lifecycle };
	}
	finally
	{ await state.context.close(); }
};

const checkFailure = async (browser, url, library, oracle) => {
	let failing = true;
	const state = await openPage(browser, url, route => failing ? route.fulfill({ status: 404, body: "Missing test WASM asset" }) : route.continue());
	try
	{
		await state.page.goto(url);
		await state.page.locator('#result[data-status="error"]').waitFor();
		assert.notEqual(await state.page.locator("#result").textContent(), "");
		assert.equal(await state.page.evaluate(() => globalThis.corpusResult), undefined);
		failing = false;
		await state.page.reload();
		await ready(state.page);
		await observation(state.page, browser, library, oracle);
		await Promise.all(state.pendingAssets);
		assert.deepEqual(state.errors, []);
		assert.deepEqual(state.foreignRequests, []);
		return true;
	}
	finally
	{ await state.context.close(); }
};

const checkPendingUnmount = async (browser, url, variant, library, oracle) => {
	let release;
	const held = new Promise(resolveHeld => { release = resolveHeld; });
	const state = await openPage(browser, url, async route => { await held; await route.continue().catch(() => {}); });
	try
	{
		const requested = state.page.waitForRequest(request => request.url().endsWith(".wasm"));
		await state.page.goto(url, { waitUntil: "domcontentloaded" });
		await requested;
		await state.page.locator("#toggle").click();
		assert.equal(await state.page.locator("#result").count(), 0);
		release();
		await state.page.waitForFunction(count => globalThis.corpusLifecycle.ignored === count, variant === "strict" ? 2 : 1);
		assert.equal(await state.page.evaluate(() => globalThis.corpusLifecycle.commits), 0);
		assert.equal(await state.page.evaluate(() => globalThis.corpusResult), undefined);
		await state.page.locator("#toggle").click();
		await ready(state.page);
		await observation(state.page, browser, library, oracle);
		await Promise.all(state.pendingAssets);
		assert.deepEqual(state.errors, []);
		assert.deepEqual(state.foreignRequests, []);
		return true;
	}
	finally
	{ release(); await state.context.close(); }
};

/**
 * Bundle the installed API and exercise each requested browser without sources.
 *
 * @param options - Isolated installation and its independently computed oracle.
 * @param options.library - Catalog library.
 * @param options.profile - Browser execution context.
 * @param options.root - Private installed npm project.
 * @param options.oracle - Fresh Lean results.
 * @param options.framework - Exact framework archives, when React is selected.
 * @param options.environment - Compiler-free consumer environment.
 */
export const installedBrowserCorpus = async ({ library, profile, root, oracle, framework, environment }) => {
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const entry = { "browser-javascript": "plain", "browser-react": "react", "browser-worker": "worker-main" }[profile];
	for(const name of [entry, ...(profile === "browser-worker" ? ["worker"] : [])])
		await saveLakeFile(root, `${name}.mjs`, await readFile(join(fixtures, `${name}.mjs`)));
	await saveLakeFile(root, "package.mjs", `import request from "./request.json";\nexport { request };\nexport const loadApi = () => import(${JSON.stringify(library.npmModule)});\n`);
	await saveLakeFile(root, "index.html", `<!doctype html><meta charset="utf-8"><title>Installed corpus</title><div id="root"><button id="rerun">Run again</button><button id="stop">Stop worker</button><pre id="result" data-status="loading"></pre></div><script type="module" src="./${entry}.mjs"></script>\n`);
	for(const item of framework) assert.equal((await json(join(root, "node_modules", item.name, "package.json"))).version, item.version);
	for(const name of [library.npmModule, "@lean-bridge/runtime"])
		assert.equal((await json(join(root, "node_modules", name, "package.json"))).exports["."].browser, "./index.mjs");
	const component = `node_modules/${library.npmModule}/internal/wasm`;
	const files = (await readdir(join(root, component))).filter(name => name.endsWith(".wasm"));
	assert.equal(files.length, 1);
	const installedAssets = [];
	for(const path of [`${component}/${files[0]}`, "node_modules/@lean-bridge/runtime/internal/main.wasm"])
	{
		const bytes = await readFile(join(root, path));
		installedAssets.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	const deployments = [];
	for(const variant of variants)
	{
		const output = await processBuildRunner.capture({ command: process.execPath
			, args: [join(repository, "tests/helpers/type-corpus-browser-build.mjs"), root, variant]
			, cwd: root, env: environment, timeoutMs: 120_000 });
		const deployment = JSON.parse(output.stdout);
		assert.deepEqual(deployment.files.filter(file => file.path.endsWith(".wasm")).map(file => file.sha256).sort(), installedAssets.map(file => file.sha256).sort());
		deployments.push(deployment);
	}
	// Only the static deployments survive. No browser can fall back to the source
	// project, unpacked npm installation, bundler or a compiler.
	for(const name of await readdir(root)) if(!variants.some(variant => name === `dist-${variant}`)) await rm(join(root, name), { recursive: true, force: true });
	const executions = [];
	const engines = await import("playwright");
	for(const engine of requestedEngines)
	{
		const browser = await engines[engine].launch({ headless: true, ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}) });
		try
		{
			for(const variant of variants)
			{
				const server = await startSiteServer({ root: join(root, `dist-${variant}`), base });
				try
				{
					const execution = await checkExecution({ browser, engine, variant, url: server.url, library, profile, oracle, installedAssets });
					execution.failedAssetRecovery = await checkFailure(browser, server.url, library, oracle);
					if(profile === "browser-react") execution.pendingUnmount = await checkPendingUnmount(browser, server.url, variant, library, oracle);
					executions.push(execution);
				}
				finally
				{ await server.close(); }
			}
		}
		finally
		{ await browser.close(); }
	}
	return { observation: executions[0].observation
		, browser: { requestedEngines
			, installedAssets, framework, deployments, executions
			, installedSourcesRemoved: true, externalNetworkBlocked: true } };
};
