/**
 * Run both installed package kinds in each browser, React and worker realm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, realpath, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { build } from "vite";
import { sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { browserFrameworkArchives } from "./type-corpus-browser.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const base = "/coexistence/nested/", orders = ["owned-first", "copied-first", "concurrent"];
const render = `const render=value=>{globalThis.coexistenceResult=value;document.querySelector("#result").textContent=JSON.stringify(value);};
const order=new URL(location.href).searchParams.get("order");`;
const pageSource = `import {open} from "../probe.mjs";
${render}
let sequence=0;
const ready=open(order);
const repeat=async()=>{try{render({sequence:++sequence,value:(await ready).run()});}catch(error){render({error:error.stack});}};
document.querySelector("#rerun").onclick=repeat;
document.querySelector("#close").onclick=async()=>{globalThis.coexistenceFinished=(await ready).close();};
repeat();
`;
const workerSource = `const ready=import("../probe.mjs");
globalThis.onmessage=async({data})=>{try{const api=await(await ready).open(data.order);
  postMessage(data.finish ? {finished:api.close()} : {value:api.run()});
}catch(error){postMessage({error:error.stack});}};
`;
const workerPage = `${render}
let sequence=0;
const worker=new Worker(new URL("./worker.mjs",import.meta.url),{type:"module"});
worker.onmessage=({data})=>{if(data.finished){globalThis.coexistenceFinished=data.finished;worker.terminate();}
  else render({sequence:++sequence,...data});};
worker.onerror=event=>render({error:event.message});
document.querySelector("#rerun").onclick=()=>worker.postMessage({order});
document.querySelector("#close").onclick=()=>worker.postMessage({order,finish:true});
worker.postMessage({order});
`;
const reactSource = `import React,{StrictMode,useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
const order=new URL(location.href).searchParams.get("order");
globalThis.coexistenceLifecycle={effects:0,cleanups:0,commits:0};
function Consumer(){const[result,setResult]=useState(null);useEffect(()=>{
  let active=true;globalThis.coexistenceLifecycle.effects++;
  import("../probe.mjs").then(module=>module.open(order)).then(api=>{if(!active)return;
    try{const value=api.run();globalThis.coexistenceResult={sequence:++globalThis.coexistenceLifecycle.commits,value};setResult(value);}
    catch(error){globalThis.coexistenceResult={error:error.stack};setResult({error:error.stack});}
  }).catch(error=>{globalThis.coexistenceResult={error:error.stack};});
  return()=>{active=false;globalThis.coexistenceLifecycle.cleanups++;};
},[]);return React.createElement("pre",{id:"result"},JSON.stringify(result));}
function App(){const[visible,setVisible]=useState(true);return React.createElement(React.Fragment,null,
  React.createElement("button",{id:"toggle",onClick:()=>setVisible(value=>!value)},"Toggle"),visible?React.createElement(Consumer):null);}
document.querySelector("#close").onclick=async()=>{globalThis.coexistenceFinished=(await(await import("../probe.mjs")).open(order)).close();};
createRoot(document.querySelector("#app")).render(React.createElement(StrictMode,null,React.createElement(App)));
`;

/**
 * Bundle the isolated installation, then remove everything except static assets.
 *
 * @param options - Public package names and the consumer installation.
 * @param options.root - Disposable installed consumer with probe.mjs.
 * @param options.ownedName - Owned package name.
 * @param options.copiedName - Copied package name.
 */
export const checkCoexistingNpmBrowsers = async ({ root, ownedName, copiedName }) => {
	const frameworks = await browserFrameworkArchives(root);
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	await processBuildRunner.capture({ command: process.execPath
		, args: [npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...frameworks.map(item => "./" + item.archive)]
		, cwd: root, timeoutMs: 120000 });
	const copiedWasmRoot = join(root, "node_modules", copiedName, "internal/wasm");
	const copiedFiles = (await readdir(copiedWasmRoot)).filter(path => path.endsWith(".wasm"));
	assert.equal(copiedFiles.length, 1);
	const installedAssets = (await Promise.all([
		join(root, "node_modules/@lean-bridge/runtime/internal/main.wasm")
		, join(root, "node_modules", ownedName, "internal/component.so.wasm")
		, join(copiedWasmRoot, copiedFiles[0])
	].map(async path => sha256(await readFile(path))))).sort();
	const profiles = ["page", "react", "worker"];
	for(const [profile, source] of [["page", pageSource], ["react", reactSource], ["worker", workerPage]])
	{
		await saveLakeFile(root, `${profile}/entry.mjs`, source);
		await saveLakeFile(root, `${profile}/index.html`, '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="app"></div><button id="rerun">Run</button><button id="close">Close</button>'
			+ (profile === "react" ? "" : '<pre id="result"></pre>') + '<script type="module" src="./entry.mjs"></script></body></html>');
	}
	await saveLakeFile(root, "worker/worker.mjs", workerSource);
	const modules = new Set();
	const audit = () => ({ name: "coexisting-installed-dependencies"
		, load: id => {
			if(id.includes("/node_modules/") && !id.startsWith("\0"))
			{ assert.ok(id.startsWith(`${root}/node_modules/`), `Dependency escaped installation: ${id}`); modules.add(relative(root, id.split("?")[0])); }
			return null;
		}
	});
	await build({ root, base, configFile: false, envDir: false, publicDir: false
		, logLevel: "silent", plugins: [audit()]
		, define: { "process.env.NODE_ENV": JSON.stringify("development") }
		, build: { outDir: "dist", target: "esnext", assetsInlineLimit: 0
			, minify: false
			, rollupOptions: { input: Object.fromEntries(profiles.map(profile => [profile, join(root, profile, "index.html")])) } }
		, worker: { format: "es", plugins: () => [audit()] } });
	for(const name of [ownedName, copiedName, "@lean-bridge/runtime", "react"])
		assert.ok([...modules].some(path => path.startsWith(`node_modules/${name}/`)), name);
	for(const path of await readdir(root)) if(path !== "dist") await rm(join(root, path), { recursive: true, force: true });
	const engines = await import("playwright"), executions = [];
	const server = await startSiteServer({ root: join(root, "dist"), base });
	try
	{
		for(const engine of ["chromium", "firefox", "webkit"])
		{
			const browser = await engines[engine].launch({ headless: true, ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}) });
			try
			{
				for(const order of orders) for(const profile of profiles)
				{
					const context = await browser.newContext({ serviceWorkers: "block" }), errors = [], foreign = [], assets = [], pending = [];
					try
					{
						await context.route("**/*", route => {
							if(route.request().url().startsWith(server.url)) return route.continue();
							foreign.push(route.request().url()); return route.abort();
						});
						context.on("response", response => {
							if(response.url().endsWith(".wasm")) pending.push(response.body().then(bytes => {
								assert.equal(response.status(), 200); assert.match(response.headers()["content-type"], /^application\/wasm/);
								assets.push(sha256(bytes));
							}).catch(error => errors.push(error.message)));
						});
						const page = await context.newPage(); page.setDefaultTimeout(60000);
						page.on("pageerror", error => errors.push(error.message));
						await page.goto(new URL(`${profile}/?order=${order}`, server.url).href);
						try
						{ await page.waitForFunction(() => globalThis.coexistenceResult !== undefined); }
						catch(error)
						{ throw new Error(`${engine}/${order}/${profile}: ${error.message}; errors: ${JSON.stringify(errors)}; requests: ${JSON.stringify(foreign)}`, { cause: error }); }
						const first = await page.evaluate(() => globalThis.coexistenceResult);
						assert.equal(first.error, undefined, first.error); assert.equal(first.value.checks, 22); assert.equal(first.value.order, order);
						for(let iteration = 0; iteration < 2; iteration++)
						{
							if(profile === "react")
							{ await page.locator("#toggle").click(); await page.locator("#toggle").click(); }
							else await page.locator("#rerun").click();
							await page.waitForFunction(sequence => globalThis.coexistenceResult.sequence === sequence, iteration + 2);
							assert.deepEqual((await page.evaluate(() => globalThis.coexistenceResult)).value, first.value);
						}
						if(profile === "react") assert.deepEqual(await page.evaluate(() => globalThis.coexistenceLifecycle), { effects: 6, cleanups: 5, commits: 3 });
						await page.locator("#close").click(); await page.waitForFunction(() => globalThis.coexistenceFinished !== undefined);
						const finished = await page.evaluate(() => globalThis.coexistenceFinished);
						assert.deepEqual(finished, { heaps: 1, initializations: 1, libraries: 2, components: 0, identities: 0, state: 2 });
						await Promise.all(pending);
						assert.deepEqual(assets.sort(), installedAssets); assert.deepEqual(errors, []); assert.deepEqual(foreign, []);
						executions.push({ engine, version: browser.version(), order, profile, checks: first.value.checks, reruns: 2, stats: first.value.stats, finished, assets });
					}
					finally
					{ await context.close(); }
				}
			}
			finally
			{ await browser.close(); }
		}
	}
	finally
	{ await server.close(); }
	return { executions, installedSourcesRemoved: true, externalNetworkBlocked: true };
};
