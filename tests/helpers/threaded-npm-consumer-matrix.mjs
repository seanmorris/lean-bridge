/** @file Build and replay both threaded npm author routes in five real downstream clients. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import test from "node:test";
import {build} from "vite";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {installedTaskHarness} from "./javascript-wasm-task-cli-harness.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";

const require=createRequire(import.meta.url), runtime="@lean-bridge/runtime", hash=async path=>sha256(await readFile(path));

export const testThreadedNpmClients=({title,fixture,cfg,summary,envPrefix,defaultOutput,check,checkIr,clientFiles={}}) =>
test(title, {timeout:7_200_000}, async t => {
	const name=cfg.targets.npm.name, [moduleName]=cfg.modules;
	const work=await mkdtemp(join(tmpdir(),"npm-matrix-")); t.after(()=>rm(work,{recursive:true,force:true}));
	const keep=process.env[envPrefix+"_KEEP"], replay=process.env[envPrefix+"_REPLAY"];
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):keep?await mkdtemp(join(resolve(keep),moduleName+"-")):join(work,"sets");
	const routes=["ordinary","reviewed"];
	if(!replay) {
		const h=await installedTaskHarness(t,fixture), project=await h.source(moduleName,cfg,moduleName);
		const ordinary=await h.release(project,"ordinary");
		await copyPackageSetHandoff(join(ordinary.out,"packages/npm"),join(sets,"ordinary"));
		const {reviewed}=await h.review(project,cfg,ordinary.ir,summary);
		await copyPackageSetHandoff(join(reviewed.out,"packages/npm"),join(sets,"reviewed"));
		await rm(project,{recursive:true});
	}
	const output=resolve(process.env[envPrefix+"_OUTPUT"]??defaultOutput);
	await mkdir(output,{recursive:true});
	const npmEnv={...process.env,npm_config_offline:"true",npm_config_cache:join(work,"cache")}, frameworks=[];
	for(const pkg of ["react","react-dom","scheduler"]) {
		const p=dirname(require.resolve(pkg+"/package.json"));
		frameworks.push(join(work,await run("npm",["pack","--offline","--silent","--ignore-scripts","--pack-destination",work,p],work,npmEnv)));
	}
	const env={PATH:"/no-author-tools",LANG:"C.UTF-8",TMPDIR:work};
	const packageDigests=[];
	for(const route of routes) {
		const handoff=join(work,route+"-feed"),app=join(work,route+"-app"),site=join(work,route+"-site");
		await copyPackageSetHandoff(join(sets,route),handoff);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath:join(handoff,"package-set-receipt.json")});
		assert.deepEqual(receipt.packages.map(p=>p.name).sort(),[runtime,name].sort());
		assert.equal(receipt.profiles[0].id,"javascript-wasm-threaded-task-v1");
		const archives=receipt.packages.map(p=>p.artifacts[0]);
		packageDigests.push(receipt.packages.find(p=>p.name===runtime).artifacts[0].sha256);
		await mkdir(app); await writeFile(join(app,"package.json"),'{"type":"module","private":true}');
		await run("npm",["install","--offline","--ignore-scripts","--no-audit","--no-fund",...archives.map(a=>join(handoff,a.path)),...frameworks],app,npmEnv);
		await rm(handoff,{recursive:true});
		const component=join(app,"node_modules",name),meta=JSON.parse(await readFile(join(component,"metadata/compiler.json")));
		assert.equal(meta.sourceTreeSha256,receipt.source.treeSha256);
		if(checkIr) checkIr(JSON.parse(await readFile(join(component,"metadata/binding-ir.json"))));
		if(route==="ordinary") assert.equal(meta.reviewedSourceSha256,null);
		else {
			const review=await readFile(join(component,"metadata/review.binding-ir.json"));
			assert.equal(meta.reviewedSourceSha256,sha256(review));
			assert.equal(JSON.parse(review).documentation.summary,summary);
		}
		const sources={};
		for(const file of ["calls.mjs","calls.d.mts","public.mjs","node.mjs","typed.mts","page.mjs","worker.mjs"]) {
			await copyFile(clientFiles[file]??join(fixture,file),join(app,file)); sources[file]=await hash(join(app,file));
		}
		const node=JSON.parse(await run(process.execPath,["node.mjs"],app,env,120000));
		check(node);
		await writeFile(join(app,"tsconfig.json"),JSON.stringify({files:["typed.mts"],compilerOptions:{strict:true,module:"NodeNext",target:"ES2022",types:[],lib:["ES2024","DOM"]}}));
		await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],app,env);
		const typescript=JSON.parse(await run(process.execPath,["typed.mjs"],app,env,120000)); check(typescript);
		await writeFile(join(app,"index.html"),'<main></main><script>globalThis.readerReady=Promise.withResolvers();onerror=e=>readerReady.reject(String(e));onunhandledrejection=e=>readerReady.reject(String(e.reason))</script><script type="module" src="./page.mjs"></script>');
		await build({root:app,configFile:false,publicDir:false,envDir:false,logLevel:"error",worker:{format:"es"},build:{target:"esnext",assetsInlineLimit:0}});
		const installedBytes=[await hash(join(component,"internal/component.wasm")),await hash(join(app,"node_modules",runtime,"internal/task.wasm"))].sort();
		await rename(join(app,"dist"),site); await rm(app,{recursive:true});
		const assets=join(site,"assets"),images=(await readdir(assets)).filter(f=>f.endsWith(".wasm"));
		assert.deepEqual([...new Set(await Promise.all(images.map(f=>hash(join(assets,f)))))].sort(),installedBytes);
		const browser=await runInstalledChromium({root:work,assembledDirectory:site,isolated:true,timeoutMs:120000,evaluate:async()=>(await globalThis.readerReady.promise)()});
		assert.deepEqual(Object.keys(browser).sort(),["page","react","worker"]); Object.values(browser).forEach(check);
		await writeFile(join(output,route+".json"),canonicalJson({route,receiptSha256:result.receiptSha256,archives,reviewedSourceSha256:meta.reviewedSourceSha256,installedBytes,sources,node,typescript,browser}));
	}
	assert.equal(packageDigests[0],packageDigests[1]); t.diagnostic("Handoffs: "+sets);
});
