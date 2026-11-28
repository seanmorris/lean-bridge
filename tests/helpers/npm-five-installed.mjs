/** @file Run JS, strict TS, a page, mounted React and a worker from the same verified npm install. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,readdir,rename,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join} from "node:path";
import {build} from "vite";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
const require=createRequire(import.meta.url);
const hash=async file=>sha256(await readFile(file));
const json=async path=>JSON.parse(await readFile(path));
/**
 * Copy—not modify—the original packages; execute the browser site after removing npm and source inputs.
 *
 * @param o - Verified source route, package name, downstream fixtures, framework archives and metadata check.
 */
export const runFiveInstalledNpm=async o=>{
	const {work,set,route,name,files,frameworks,verify}=o;
	const handoff=join(work,route+"-handoff"),app=join(work,route+"-app"),site=join(work,route+"-site");
	await copyPackageSetHandoff(set,handoff);
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
	assert.equal(receipt.packages.length,2);
	const pkg=receipt.packages.find(p=>p.role==="component"),runtime=receipt.packages.find(p=>p.role==="runtime");
	assert.equal(pkg.name,name);assert.equal(runtime.name,"@lean-bridge/runtime");
	assert.equal(pkg.requires[0].version,runtime.version);
	await mkdir(app);await writeFile(join(app,"package.json"),'{"type":"module","private":true}');
	const env={...process.env,npm_config_offline: "true",npm_config_cache: join(work,"npm-cache")};
	await run("npm",["install","--offline","--ignore-scripts","--no-fund","--no-audit",...[runtime,pkg].map(p=>join(handoff,p.artifacts[0].path)),...frameworks],app,env);
	await rm(handoff,{recursive: true});
	const installed=join(app,"node_modules",name),meta=join(installed,"metadata/compiler");
	const identity=verify(await json(join(meta,"model.json")),await json(join(meta,"binding-ir.json")),receipt.profiles.find(p=>p.id===pkg.profile),route);
	const sourceHashes={};
	for(const [dest,source] of Object.entries(files))
	{
		const copy=join(app,dest);await copyFile(source,copy);sourceHashes[dest]=await hash(copy);
	}
	const noTools={PATH: "/no-author-tools",LANG: "C.UTF-8",TMPDIR: work};
	const node=JSON.parse(await run(process.execPath,["--input-type=module","-e",'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(exercise(false)))'],app,noTools));
	await writeFile(join(app,"tsconfig.json"),JSON.stringify({files: ["typed.mts"],compilerOptions: {strict: true,module: "NodeNext",target: "ES2022",types: [],lib: ["ES2024","DOM"]}}));
	await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],app,noTools);
	const typescript=JSON.parse(await run(process.execPath,["typed.mjs"],app,noTools));
	await writeFile(join(app,"index.html"),'<main></main><script>globalThis.recordReady=Promise.withResolvers();onerror=e=>recordReady.reject(String(e));onunhandledrejection=e=>recordReady.reject(String(e.reason))</script><script type="module" src="./page.mjs"></script>');
	await build({root: app,configFile: false,envDir: false,publicDir: false,logLevel: "error",worker: {format: "es"},build: {target: "esnext",assetsInlineLimit: 0,minify: false}});
	const installedBytes=[await hash(join(installed,"internal/component.so.wasm")),await hash(join(app,"node_modules/@lean-bridge/runtime/internal/main.wasm"))].sort();
	await rename(join(app,"dist"),site);await rm(app,{recursive: true});
	const assets=join(site,"assets"),wasm=(await readdir(assets)).filter(f=>f.endsWith(".wasm"));
	assert.deepEqual([...new Set(await Promise.all(wasm.map(f=>hash(join(assets,f)))))].sort(),installedBytes);
	const browser=await runInstalledChromium({root: work,names: [name],assembledDirectory: site,timeoutMs: 120000,evaluate: async()=>(await globalThis.recordReady.promise)()});
	assert.deepEqual(Object.keys(browser).sort(),["page","react","worker"]);
	return {
		route
		, receiptSha256: result.receiptSha256
		, ...identity
		, archives: receipt.packages.map(p=>p.artifacts[0])
		, installedBytes
		, sourceHashes
		, node
		, typescript
		, browser
	};
};
