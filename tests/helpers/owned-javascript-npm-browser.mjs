/**
 * Browser, StrictMode React and worker callers of isolated owned npm archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { build } from "vite";
import { sha256 } from "../../src/capsule/node.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { browserFrameworkArchives } from "./type-corpus-browser.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const base = "/owned/nested/";
const probe = name => `import api from ${JSON.stringify(name)};
export const close = () => api.close();
export function run() {
  let checks = 0;
  const check = condition => { checks++; if(!condition) throw new Error("Owned browser check " + checks); };
  const ticket = api.newTicket(1n << 90n, "browser\\0🙂");
  const bundle = {primary: ticket, spare: {tag: "some", value: ticket}, peers: [ticket], history: [ticket],
    payload: {count: -(1n << 140n), bytes: new Uint8Array([0,255])}};
  check(api.serial(ticket) === 1n << 90n); check(api.label(ticket) === "browser\\0🙂");
  const echoed = api.echoRecord(bundle);
  check(echoed.primary === ticket && echoed.spare.value === ticket);
  check(echoed.payload.count === -(1n << 140n)); check(echoed.payload.bytes[1] === 255);
  check(api.echoOption({tag:"none"}).tag === "none");
  check(api.echoResult({ok:bundle}).ok.primary === ticket); check(api.echoResult({error:ticket}).error === ticket);
  const tree = {kind:"branch", children:[{kind:"leaf",ticket},{kind:"branch",children:[]}]};
  check(api.echoRecursive(tree).children[0].ticket === ticket);
  let borrowed, retained;
  check(api.callbackRecord(bundle, value => {borrowed=value.primary;retained=borrowed.retain();return value;}).primary === ticket);
  check(borrowed.disposed); check(api.serial(retained) === 1n << 90n); retained.dispose();
  const closure = api.dispatch(bundle); check(closure(value=>value).primary === ticket); closure.dispose();
  const failure = new Error("browser callback");
  let caught; try {api.callbackRecord(bundle, ()=>{throw failure;});}catch(error){caught=error;}
  check(caught === failure); check(api.viaNat(value=>value+1n,1n<<200n) === (1n<<200n)+1n);
  ticket.dispose(); check(ticket.disposed);
  return {checks,serial:(1n<<90n).toString(),unicode:true,borrowExpired:true,closureDisposed:closure.disposed};
}
`;
const render = `const render = value => {globalThis.ownedResult=value;document.querySelector("#result").textContent=JSON.stringify(value);};`;
const page = `import {run,close} from "../probe.mjs";
${render}
let sequence=0;
const repeat=()=>{try{render({sequence:++sequence,value:run()});}catch(error){render({error:error.stack});}};
document.querySelector("#rerun").onclick=repeat;
document.querySelector("#close").onclick=()=>{globalThis.ownedClosed=close();};
repeat();
`;
const worker = `const ready = import("../probe.mjs");
globalThis.onmessage=async()=>{try{const {run}=await ready;postMessage({value:run()});}catch(error){postMessage({error:error.stack});}};
`;
const workerPage = `${render}
let worker,sequence=0;
document.querySelector("#rerun").onclick=()=>{
  if(!worker){worker=new Worker(new URL("./worker.mjs",import.meta.url),{type:"module"});
    worker.onmessage=event=>render({sequence:++sequence,...event.data});worker.onerror=event=>render({error:event.message});}
  worker.postMessage("run");
};
document.querySelector("#close").onclick=()=>{worker?.terminate();worker=null;globalThis.ownedClosed=true;};
document.querySelector("#rerun").click();
`;
const react = `import React,{StrictMode,useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
globalThis.ownedLifecycle={effects:0,cleanups:0,commits:0};
function Consumer(){const [result,setResult]=useState(null);useEffect(()=>{
  let active=true;globalThis.ownedLifecycle.effects++;
  import("../probe.mjs").then(({run})=>{if(!active)return;
    try{const value=run();globalThis.ownedResult={sequence:++globalThis.ownedLifecycle.commits,value};setResult(value);}
    catch(error){globalThis.ownedResult={error:error.stack};setResult({error:error.stack});}});
  return()=>{active=false;globalThis.ownedLifecycle.cleanups++;};
},[]);return React.createElement("pre",{id:"result"},JSON.stringify(result));}
function App(){const [visible,setVisible]=useState(true);return React.createElement(React.Fragment,null,
  React.createElement("button",{id:"toggle",onClick:()=>setVisible(value=>!value)},"Toggle"),visible?React.createElement(Consumer):null);}
createRoot(document.querySelector("#app")).render(React.createElement(StrictMode,null,React.createElement(App)));
`;

/**
 * Bundle only installed dependencies, remove that installation, and serve the
 * static output under a nested path with outside network requests blocked.
 *
 * @param options - Isolated npm installation and process boundary.
 * @param options.root - Installed consumer directory.
 * @param options.name - Public component package name.
 * @param options.run - Compiler-free npm process runner rooted in the consumer.
 * @param options.probeSource - Optional consuming API checks against that installation.
 * @param options.expected - Exact result expected from the consuming checks.
 */
export const checkOwnedJavaScriptBrowsers = async ({ root, name, run, probeSource, expected }) => {
	const frameworks = await browserFrameworkArchives(root);
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...frameworks.map(item => "./" + item.archive)]);
	const installedAssets = await Promise.all([
		join(root, "node_modules/@lean-bridge/runtime/internal/main.wasm")
		, join(root, "node_modules", name, "internal/component.so.wasm")
	].map(async path => sha256(await readFile(path))));
	await saveLakeFile(root, "probe.mjs", probeSource ?? probe(name));
	for(const [profile, source] of [["page", page], ["react", react], ["worker", workerPage]])
	{
		await saveLakeFile(root, `${profile}/entry.mjs`, source);
		await saveLakeFile(root, `${profile}/index.html`, '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="app"></div><button id="rerun">Run</button><button id="close">Close</button>'
			+ (profile === "react" ? "" : '<pre id="result"></pre>') + '<script type="module" src="./entry.mjs"></script></body></html>');
	}
	await saveLakeFile(root, "worker/worker.mjs", worker);
	const modules = new Set();
	const audit = () => ({ name: "owned-installed-dependencies"
		, load: id => {
			if(id.includes("/node_modules/") && !id.startsWith("\0"))
			{ assert.ok(id.startsWith(`${root}/node_modules/`), `Dependency escaped isolated installation: ${id}`); modules.add(relative(root, id.split("?")[0])); }
			return null;
		}
	});
	await build({ root, base, configFile: false, envDir: false, publicDir: false
		, logLevel: "silent", plugins: [audit()]
		, define: { "process.env.NODE_ENV": JSON.stringify("development") }
		, build: { outDir: "dist", target: "esnext", assetsInlineLimit: 0
			, minify: false
			, rollupOptions: { input: Object.fromEntries(["page", "react", "worker"].map(profile => [profile, join(root, profile, "index.html")])) } }
		, worker: { format: "es", plugins: () => [audit()] } });
	for(const dependency of [name, "@lean-bridge/runtime", "react"])
		assert.ok([...modules].some(path => path.startsWith(`node_modules/${dependency}/`)), dependency);
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
				for(const profile of ["page", "react", "worker"])
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
						await page.goto(new URL(profile + "/", server.url).href);
						try
						{ await page.waitForFunction(() => globalThis.ownedResult !== undefined); }
						catch(error)
						{ throw new Error(`${engine}/${profile}: ${error.message}; page errors: ${JSON.stringify(errors)}; foreign requests: ${JSON.stringify(foreign)}; body: ${await page.locator("body").innerText()}`, { cause: error }); }
						const first = await page.evaluate(() => globalThis.ownedResult);
						assert.equal(first.error, undefined, first.error);
						if(expected) assert.deepEqual(first.value, expected);
						else assert.equal(first.value.checks, 16);
						assert.equal(first.value.serial, (1n << 90n).toString());
						assert.equal(first.value.borrowExpired, true); assert.equal(first.value.closureDisposed, true);
						for(let iteration = 0; iteration < 2; iteration++)
						{
							const sequence = await page.evaluate(() => globalThis.ownedResult.sequence);
							if(profile === "react")
							{ await page.locator("#toggle").click(); await page.locator("#toggle").click(); }
							else await page.locator("#rerun").click();
							await page.waitForFunction(previous => globalThis.ownedResult.sequence > previous, sequence);
							assert.deepEqual((await page.evaluate(() => globalThis.ownedResult)).value, first.value);
						}
						if(profile === "react") assert.deepEqual(await page.evaluate(() => globalThis.ownedLifecycle), { effects: 6, cleanups: 5, commits: 3 });
						else
						{ await page.locator("#close").click(); assert.equal(await page.evaluate(() => globalThis.ownedClosed), true); }
						await Promise.all(pending);
						assert.deepEqual(errors, []); assert.deepEqual(foreign, []);
						assert.deepEqual(assets.sort(), [...installedAssets].sort(), "Reruns must reuse the two installed Wasm assets");
						executions.push({ engine, version: browser.version(), profile, checks: first.value.checks, reruns: 2, assets });
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
