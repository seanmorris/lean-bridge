/** @file Run the installed callback and IO packages in independent Chromium module workers. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { build } from "vite";
import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";

/**
 * Build an ordinary browser consumer with lazy package imports, then serve
 * only its deployment directory. Page import maps do not apply to workers.
 *
 * @param options - Offline-installed consumer, its package names and expected Node observations.
 */
export const checkCallbackWorker = async options => {
	const {root, consumer, names, cases} = options;
	const loaders = [...names, "@lean-bridge/runtime"].map(n => "[" + JSON.stringify(n) + ",()=>import(" + JSON.stringify(n) + ")]");
	await writeFile(join(consumer, "loaders.mjs"), "const packages=new Map([" + loaders.join(",") + "]);export const load=n=>packages.get(n)();");
	await writeFile(join(consumer, "retire-worker.mjs"), `import {exercise} from "./calls.mjs";
import {load} from "./loaders.mjs";
self.onmessage=async event=>{try{self.postMessage({value:await exercise(event.data,load)});}
catch(error){self.postMessage({error:String(error.stack??error)});}};`);
	await writeFile(join(consumer, "driver.mjs"), `import {load} from "./loaders.mjs";
const run=options=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL("./retire-worker.mjs",import.meta.url),{type:"module"});
  worker.onmessage=({data})=>{worker.terminate();if(data.error)reject(new Error(data.error));else resolve(data.value);};
  worker.onerror=error=>{worker.terminate();reject(new Error(error.message));};worker.postMessage(options);
});
globalThis.replay=async cases=>{
  const io=await load(cases[0].ioName),owned=await load(cases[0].ownedName);
  const ticket=owned.newTicket(31n,"parent"),workers=[];
  if(io.add(20)!==20)throw new Error("Parent counter was not fresh");
  for(const options of cases){
    workers.push(await run(options));
    if(owned.serial(ticket)!==31n||io.add(1)!==20+workers.length)throw new Error("Worker retired or mutated its parent");
  }
  if(!ticket.dispose()||ticket.dispose()||!owned.close())throw new Error("Parent lease cleanup failed");
  return {workers,parentCounter:io.read_total()};
};`);
	await writeFile(join(consumer, "index.html"), '<script type="module" src="./driver.mjs"></script>');
	const installed = join(consumer, "node_modules") + sep, seen = new Set();
	const observe = id => {
		if(id.includes(sep + "node_modules" + sep))
		{
			assert.ok(id.startsWith(installed), "dependency escaped the offline install: " + id);
			seen.add(id.slice(installed.length));
		}
		return null;
	};
	const audit = () => ({name: "installed-worker-imports", load: observe});
	await build({root: consumer, configFile: false, envDir: false, publicDir: false
		, plugins: [audit()], logLevel: "error"
		, worker: {format: "es", plugins: () => [audit()]}
		, build: {target: "esnext", assetsInlineLimit: 0, minify: false}});
	for(const n of [...names, "@lean-bridge/runtime"]) assert.ok([...seen].some(id => id.startsWith(n + "/")), "not bundled from installed " + n);
	const report = await runInstalledChromium({root, consumer, names
		, assembledDirectory: join(consumer, "dist")
		, timeoutMs: 90000, argument: cases.map(c => c.options)
		, evaluate: async requests => globalThis.replay(requests)});
	assert.deepEqual(report.workers, cases.map(c => c.node));
	assert.equal(report.parentCounter, 20 + cases.length);
	return report;
};
