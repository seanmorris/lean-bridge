/** @file Run the actual threaded SDK and the same compiled DSOs in both browser owner realms. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

/**
 * Serve only the test assets and their real module dependencies under COOP/COEP.
 *
 * @param cwd - Private directory holding the compiled components.
 * @param kit - Verified pthread SDK directory.
 * @param checks - Number of assertions completed by the Node owner.
 */
export const checkThreadedHostBrowsers=async (cwd,kit,checks)=>{
	const pkg=join(cwd,"node_modules/probe");
	const files=["tests/fixtures/javascript-threaded-host/member-cases.mjs"
		, "src/runtime/wasm-task-host-members.mjs"
		, "src/runtime/wasm-task-notifications.mjs"
		, "src/runtime/wasm-host-wire.mjs"
		, "src/runtime/wasm-host-domain.mjs"
		, "src/runtime/wasm-host-members.mjs"
		, "src/abi/component-scalars.mjs"
		, "src/release/component-scalar-codec.mjs"];
	for(const file of files)
	{
		await mkdir(dirname(join(pkg,file)),{recursive: true});await copyFile(resolve(file),join(pkg,file));
	}
	for(const name of ["task.mjs","task.wasm"]) await copyFile(join(kit,name),join(pkg,name));
	for(const name of ["C.wasm","D.wasm"]) await copyFile(join(cwd,name),join(pkg,name));
	const model=JSON.parse(await readFile(join(cwd,"model.json")));
	await writeFile(join(pkg,"start.mjs"),`import create from "./task.mjs";
import {exerciseThreadedMembers} from "./tests/fixtures/javascript-threaded-host/member-cases.mjs";
const bytes=async name=>new Uint8Array(await (await fetch(new URL(name,import.meta.url))).arrayBuffer());
export const check=async()=>exerciseThreadedMembers({create,main:await bytes("task.wasm"),
  components:await Promise.all(["C.wasm","D.wasm"].map(bytes)),model:${JSON.stringify(model)}});
`);
	await writeFile(join(pkg,"module-worker.mjs"),`import {check} from "./start.mjs";
try {postMessage({checks:await check()});} catch(error){postMessage({error:String(error.stack??error)});}`);
	const evaluate=async ()=>{
		const page=await (await import("/installed/probe/start.mjs")).check();
		const worker=new globalThis.Worker("/installed/probe/module-worker.mjs",{type: "module"});
		try
		{
			const workerChecks=await new Promise((ok,fail)=>{
				worker.onmessage=({data})=>data.error?fail(new Error(data.error)):ok(data.checks);
				worker.onerror=e=>fail(new Error(e.message));
			});
			return {page,worker: workerChecks};
		} finally
		{worker.terminate();}
	};
	const result=await runInstalledChromium({root: cwd,consumer: cwd,names: ["probe"],isolated: true,timeoutMs: 90000,evaluate});
	assert.deepEqual(result,{page: checks,worker: checks});
	return result;
};
