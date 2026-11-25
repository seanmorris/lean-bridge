/** @file Build two real npm releases and exercise their immediate Lean pulls in five consumer profiles. */
import assert from "node:assert/strict";
import test from "node:test";
import {copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {createRequire} from "node:module";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {build} from "vite";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {assertJavaScriptIOAbi, javaScriptIOAbi, componentImmediateIOAbi} from "../../src/abi/component-sync-io.mjs";

const fixture=resolve("tests/fixtures/javascript-immediate"), require=createRequire(import.meta.url);
const pkg="@example/pulls", want={pulls: 13,closes: 7};
const exerciseInstalled=async (root,app)=>{
	const src=`import * as api from "${pkg}";import {exercise} from "./calls.mjs";`;
	const env={PATH: "/no-author-tools",LANG: "C.UTF-8",TMPDIR: root};
	await copyFile(join(fixture,"calls.mjs"),join(app,"calls.mjs"));
	await writeFile(join(app,"node.mjs"),src+"console.log(JSON.stringify(exercise(api)));");
	const js=JSON.parse(await run(process.execPath,["node.mjs"],app,env));
	assert.deepEqual(js,want);
	await writeFile(join(app,"shutdown.mjs"),src+`
const held=[api.sequence(1),api.sequence(2)]; held[1].next();
process.on("exit",()=>{if(api.counts()!==102 || held.some(it=>!it.next().done))throw new Error("Node shutdown did not finalize both cursors");console.log("102");});
`);
	assert.equal(await run(process.execPath,["shutdown.mjs"],app,env),"102");
	await writeFile(join(app,"consumer.mts"),`import {sequence, checked, EIO_Pulls_checked, Step_Pulls_checked} from "${pkg}";
const nums: IterableIterator<number> & {return(): IteratorResult<number>} = sequence(4);
const saved: number[] = [];
for(const n of nums) { saved.push(n); if(n === 1) break; }
if(saved.join()!=="0,1" || !nums.return().done) throw new Error("TypeScript early close");
const phases: string[] = [];
try { checked(0); } catch(e) { if(!(e instanceof EIO_Pulls_checked)) throw e; phases.push(e.payload); }
const it=checked(1); it.next();
try { it.next(); } catch(e) { if(!(e instanceof Step_Pulls_checked)) throw e; phases.push(e.payload); }
if(phases.join()!=="open,pull λ") throw new Error("TypeScript failure stage");
if(false) {
  // @ts-expect-error -- a pull returns an immediate IteratorResult, not a Promise.
  const pending: Promise<number> = it.next();
  // @ts-expect-error -- a synchronous cursor has no async iteration method.
  it[Symbol.asyncIterator]();
}
console.log("typed client passed");
`);
	await writeFile(join(app,"tsconfig.json"),JSON.stringify({files: ["consumer.mts"],compilerOptions: {strict: true,types: [],module: "NodeNext",target: "ES2022"}}));
	await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],app,env);
	assert.equal(await run(process.execPath,["consumer.mjs"],app,env),"typed client passed");
	await writeFile(join(app,"worker.mjs"),`import {exercise} from "./calls.mjs";
self.onmessage=async()=>{try{ self.postMessage({value:exercise(await import("${pkg}"))}); }
catch(error){ self.postMessage({error:error.stack??String(error)}); }};`);
	await writeFile(join(app,"app.mjs"),`import {exercise} from "./calls.mjs";
import React from "react"; import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom";
globalThis.prepareExit=async report=>{
  const api=await import("${pkg}"), held=[api.sequence(1),api.sequence(2)];
  dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));
  if(held[1].next().value!==0 || api.counts()!==100)throw new Error("Cached page lost its cursors");
  addEventListener("pagehide",event=>report({persisted:event.persisted,count:api.counts(),done:held.every(it=>it.next().done)}),{once:true});
};
globalThis.exerciseAll=async()=>{
  const api=await import("${pkg}");
  const plain=exercise(api), root=createRoot(document.querySelector("#component"));
  const before=api.counts();
  function Tiles(){ const [tiles,setTiles]=React.useState([]);
    return React.createElement("button",{onClick:()=>{const found=[];for(const n of api.sequence(4)){found.push(n);if(n===1)break;}setTiles(found);}},tiles.join(",")); }
  flushSync(()=>root.render(React.createElement(Tiles)));
  const b=document.querySelector("#component button"); flushSync(()=>b.click());
  const react={text:b.textContent,cost:api.counts()-before};root.unmount();
  const worker=await new Promise((ok,no)=>{const w=new Worker(new URL("./worker.mjs",import.meta.url),{type:"module"});
    w.onmessage=({data})=>{w.terminate();if(data.error)no(new Error(data.error));else ok(data.value);};w.onerror=e=>{w.terminate();no(new Error(e.message))};w.postMessage("go");});
  const frame=document.createElement("iframe");
  await new Promise((ok,no)=>{frame.onload=ok;frame.onerror=no;frame.src=location.href;document.body.append(frame);});
  let report;const finished=new Promise(ok=>{report=ok;});
  await frame.contentWindow.prepareExit(report);frame.remove();
  return {plain,react,worker,departure:await finished};
};`);
	await writeFile(join(app,"index.html"),'<div id="component"></div><script type="module" src="./app.mjs"></script>');
	await build({root: app,configFile: false,envDir: false,publicDir: false,logLevel: "error",worker: {format: "es"},build: {target: "esnext",minify: false,assetsInlineLimit: 0}});
	const site=join(root,"site"); await rename(join(app,"dist"),site);
	const assets=join(site,"assets"), shipped=(await readdir(assets)).filter(name=>name.endsWith(".wasm"));
	const digests=paths=>Promise.all(paths.map(file=>readFile(file).then(sha256)));
	const expected=await digests([join(app,"node_modules",pkg,"internal/component.wasm"),join(app,"node_modules/@lean-bridge/runtime/internal/main.wasm")]);
	assert.deepEqual((await digests(shipped.map(file=>join(assets,file)))).sort(),expected.sort());
	await rm(app,{recursive: true});
	const result=await runInstalledChromium({root,consumer: app
		, assembledDirectory: site,names: [pkg],timeoutMs: 90_000
		, evaluate: ()=>globalThis.exerciseAll()});
	assert.deepEqual(result,{plain: want,react: {text: "0,1",cost: 201},worker: want,departure: {persisted: false,count: 102,done: true}});
	await rm(site,{recursive: true});
};

test("immediate npm iterators install and close in Node JS/TS, browser, React and a browser worker",async t=>{
	const root=await mkdtemp(join(tmpdir(),"js-immediate-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env}; delete env.NODE_TEST_CONTEXT;
	const frameworks=[];
	for(const name of ["react","react-dom","scheduler"])
	{
		const local=dirname(require.resolve(name+"/package.json"));
		const file=await run("npm",["pack","--offline","--ignore-scripts","--silent","--pack-destination",root,local],root,env);
		frameworks.push(join(root,file));
	}
	let review;
	for(const route of ["ordinary","reviewed"])
	{
		const dir=join(root,route),source=join(dir,"source"),out=join(dir,"release"),app=join(dir,"app");
		await mkdir(source,{recursive: true});await mkdir(app);
		await copyFile(join(fixture,"Pulls.lean"),join(source,"Pulls.lean"));
		await writeFile(join(source,"lean-toolchain"),"leanprover/lean4:v4.32.2\n");
		await writeFile(join(source,"lakefile.toml"),'name="pulls"\nversion="1.0.0"\n[[lean_lib]]\nname="Pulls"\n');
		const iterators=[["sequence","next"],["checked","nextChecked"],["units","nextUnit"],["replies","nextReply"]].map(([open,next])=>({open: "Pulls."+open,next: "Pulls."+next,close: "Pulls.finish"}));
		const cfg={schemaVersion: 1,modules: ["Pulls"],nativeEffects: [],iterators,targets: {npm: {name: pkg,version: "1.0.0"}}};
		if(review) await writeFile(join(source,"pulls.binding-ir.json"),canonicalJson(review));
		else cfg.exports=["Pulls.counts",...iterators.map(p=>p.open)];
		await writeFile(join(source,"lean-bridge.exports.json"),canonicalJson(cfg));
		await buildCanonicalProject({projectRoot: source,targets: ["npm"],outputRoot: out,environment: env}).catch(e=>{throw new Error(e.message+" "+JSON.stringify(e.details),{cause: e});});
		await rm(source,{recursive: true});
		const handoff=join(out,"packages/npm");
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		const component=receipt.packages.find(p=>p.role==="component"); assert.equal(component.name,pkg);
		const archives=receipt.packages.map(p=>join(handoff,p.artifacts[0].path));
		const tar=join(handoff,component.artifacts[0].path);
		const ir=JSON.parse(await run("tar",["-xzOf",tar,"package/metadata/binding-ir.json"],dir,env));
		if(review) assert.deepEqual(ir,review); else review=ir;
		assert.equal(ir.declarations.filter(d=>d.resultMode==="iterator").length,4);
		const abi=javaScriptIOAbi(ir,"1".repeat(64)); assert.equal(abi.version,componentImmediateIOAbi);
		assertJavaScriptIOAbi(abi,ir);
		const changed=structuredClone(abi), typed=changed.methods.find(m=>m.cursor && m.errorId && m.stepId && !m.stepIO);
		typed.stepId=typed.errorId;
		assert.throws(()=>assertJavaScriptIOAbi(changed,ir),/differs from its Binding IR/u);
		await writeFile(join(app,"package.json"),'{"private":true,"type":"module"}');
		await run("npm",["install","--offline","--ignore-scripts","--no-audit","--no-fund","--cache",join(dir,"cache"),...archives,...frameworks],app,env);
		const original=await promisify(execFile)("tar",["-xzOf",tar,"package/index.mjs"],{encoding: "buffer"});
		assert.equal(sha256(await readFile(join(app,"node_modules",pkg,"index.mjs"))),sha256(original.stdout));
		await rm(out,{recursive: true}); await rm(join(dir,"cache"),{recursive: true});
		await exerciseInstalled(dir,app);
		t.diagnostic(route+" package set "+result.receiptSha256+"; five installed clients passed");
	}
});
