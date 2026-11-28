/** @file Compile two real Lean projects, install the npm releases, and run five downstream programs. */
import assert from "node:assert/strict";
import {access,cp,copyFile,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import test from "node:test";
import {build as bundle} from "vite";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {generateJavaScriptHostExports} from "../../src/backends/javascript/host-wasm-exports.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const require=createRequire(import.meta.url),fx=resolve("tests/fixtures/javascript-host-record");
const names=["@example/gauge-records","@example/record-peer"];
const load=async p=>JSON.parse(await readFile(p,"utf8"));
test("compiled npm host records preserve application objects in five installed clients",{timeout: 3_600_000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"npm-host-record-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env,npm_config_offline: "true",npm_config_cache: join(root,"cache")};
	delete env.NODE_TEST_CONTEXT;
	const cli=await installOfflineAuthor(root);
	const output=resolve(process.env.LEAN_BRIDGE_JS_HOST_RECORD_OUTPUT??"build/javascript-host-record");
	await mkdir(output,{recursive: true});
	const build=(src,out)=>run(process.execPath,[cli,"build","--target","npm","--project",src,"--output",out,"--json","--progress","none"],root,env,900_000);
	const prepare=async(route,review)=>{
		const peer=route==="peer",src=join(root,route),out=join(root,route+"-release");
		await cp(resolve("tests/fixtures/javascript-host-meter"),src,{recursive: true});
		const cfgPath=join(src,"lean-bridge.exports.json"),cfg=await load(cfgPath);
		const module=peer?"Inspector":"Gauge",source=peer?"rust-host-record/Inspector.lean":"dotnet-host-record/Workshop.lean";
		let lean=await readFile(resolve("tests/fixtures",source),"utf8");
		lean=lean.replaceAll(peer?"LeanBridge.Host.Rust":"LeanBridge.Host.Dotnet","LeanBridge.Host.Javascript");
		await rm(join(src,"Workshop.lean"));await writeFile(join(src,module+".lean"),lean);
		await writeFile(join(src,"lakefile.toml"),'name="'+module.toLowerCase()+'"\nversion="1.0.0"\n[[lean_lib]]\nname="'+module+'"\n');
		cfg.targets.npm.name=names[peer?1:0];cfg.modules=[module];
		if(review)
{delete cfg.exports;await writeFile(join(src,"api.binding-ir.json"),review);}
		else cfg.exports=peer?["Inspector.increment"]:["Gauge.createPair","Gauge.flip","Gauge.sumRead","Gauge.choose","Gauge.duplicateSample"];
		await writeFile(cfgPath,canonicalJson(cfg));await build(src,out);
		const dir=join(out,"packages/npm"),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		const find=role=>receipt.packages.find(p=>p.role===role).artifacts[0];
		const tar=join(dir,find("component").path),meta=async file=>JSON.parse(await run("tar",["-xzOf",tar,"package/metadata/"+file],root,env));
		const api=await meta("binding-ir.json"),evidence=await meta("compiler.json");
		assert.equal(api.schemaVersion,peer?3:4);
		assert.equal(evidence.reviewedSourceSha256,review?sha256(review):null);
		if(route==="ordinary")
		{
			const hosts=await load(join(src,"lean-bridge.hosts.json"));
			const emit=(entries,doc=api)=>generateJavaScriptHostExports({api: doc,hosts,entries,identity: "1".repeat(64),modules: [module]});
			const original=evidence.metadata.entries;
			assert.equal(emit(original).abi.version,19);
			const edited=structuredClone(original);
			const fields=edited.find(e=>e.declaration==="Gauge.flip").result.fields;
			[fields[0],fields[3]]=[fields[3],fields[0]]; // Both are Box. A carrier-only check misses this swap.
			assert.throws(()=>emit(edited),/does not match the public fields/u);
			const wrongOwner=structuredClone(api);
			wrongOwner.declarations.find(d=>d.name==="flip").parameters[0].ownership="transfer";
			assert.throws(()=>emit(original,wrongOwner));
			const shadow=structuredClone(api);
			shadow.types.find(d=>d.id==="lean:Gauge.Pair").fields[0].name="dispose";
			assert.throws(()=>emit(original,shadow));
		}
		if(review)
		{
			assert.deepEqual(api,JSON.parse(review));
			const bad=structuredClone(api);bad.types.find(v=>v.id==="lean:Gauge.Pair").fields.reverse();
			await writeFile(join(src,"api.binding-ir.json"),canonicalJson(bad));
			const refused=join(root,"reordered");await assert.rejects(build(src,refused),/Reviewed API differs/u);
			await assert.rejects(access(refused),{code: "ENOENT"});
		}
		await rm(src,{recursive: true});
		await writeFile(join(output,route+".package-set.json"),canonicalJson(receipt));
		return {out,api,digest: result.receiptSha256,tar,runtime: join(dir,find("runtime").path),runtimeHash: find("runtime").sha256};
	};
	const peer=await prepare("peer"),ordinary=await prepare("ordinary"),edited=structuredClone(ordinary.api);
	edited.types.find(v=>v.id==="lean:Gauge.Pair").fields[0].documentation.summary="The original application meter.";
	const reviewed=await prepare("reviewed",canonicalJson(edited));
	assert.equal(ordinary.runtimeHash,reviewed.runtimeHash);assert.equal(ordinary.runtimeHash,peer.runtimeHash);
	const frameworks=[];
	for(const pkg of ["react","react-dom","scheduler"])
	{
		const location=dirname(require.resolve(pkg+"/package.json"));
		frameworks.push(join(root,await run("npm",["pack","--offline","--silent","--ignore-scripts","--pack-destination",root,location],root,env)));
	}
	const sources={};for(const file of ["calls.mjs","typed.mts","page.mjs","worker.mjs"]) sources[file]=sha256(await readFile(join(fx,file)));
	for(const [route,release] of [["ordinary",ordinary],["reviewed",reviewed]])
	{
		const consumer=join(root,"app-"+route);await mkdir(consumer);
		await writeFile(join(consumer,"package.json"),'{"private":true,"type":"module"}');
		await run("npm",["install","--offline","--ignore-scripts","--no-fund","--no-audit",release.runtime,release.tar,peer.tar,...frameworks],consumer,env);
		for(const file of Object.keys(sources))await copyFile(join(fx,file),join(consumer,file));
	}
	for(const release of [ordinary,reviewed,peer])await rm(release.out,{recursive: true});
	const noTools={PATH: "/no-author-tools",LANG: "C.UTF-8",TMPDIR: root};
	for(const [route,release] of [["ordinary",ordinary],["reviewed",reviewed]])
	{
		const consumer=join(root,"app-"+route),site=join(root,"site-"+route);
		const expected=peerFirst=>({copy: true,originalError: true,partialResultRejected: true,peerLevel: 24,peerFirst});
		const node=JSON.parse(await run(process.execPath,["--input-type=module","-e",'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(exercise(false)))'],consumer,noTools));
		assert.deepEqual(node,expected(false));
		await writeFile(join(consumer,"tsconfig.json"),JSON.stringify({files: ["typed.mts"],compilerOptions: {strict: true,module: "NodeNext",target: "ES2022",types: [],lib: ["ES2024","DOM"]}}));
		await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],consumer,noTools);
		const typed=await run(process.execPath,["typed.mjs"],consumer,noTools);assert.equal(typed,"typed record reached independent peer");
		await writeFile(join(consumer,"index.html"),'<main></main><script>globalThis.recordReady=Promise.withResolvers();addEventListener("error",e=>recordReady.reject(e.message));</script><script type="module" src="./page.mjs"></script>');
		await bundle({root: consumer,configFile: false,envDir: false,publicDir: false,logLevel: "error",worker: {format: "es"},build: {target: "esnext",assetsInlineLimit: 0,minify: false}});
		await rename(join(consumer,"dist"),site);
		const hash=async file=>sha256(await readFile(file)),installed=join(consumer,"node_modules");
		const main=await hash(join(installed,"@lean-bridge/runtime/internal/main.wasm"));
		const sides=await Promise.all(names.map(n=>hash(join(installed,n,"internal/component.wasm"))));
		const brokers=await Promise.all(names.map(n=>hash(join(installed,n,"internal/host-domain.wasm"))));
		assert.equal(brokers[0],brokers[1]);assert.notEqual(sides[0],sides[1]);
		const assets=join(site,"assets"),wasm=(await readdir(assets)).filter(f=>f.endsWith(".wasm"));
		const deployed=[...new Set(await Promise.all(wasm.map(f=>hash(join(assets,f)))))].sort();
		assert.deepEqual(deployed,[...new Set([main,...sides,...brokers])].sort());
		await rm(consumer,{recursive: true});
		const browser=await runInstalledChromium({root,names,assembledDirectory: site,timeoutMs: 120000,evaluate: async()=>(await globalThis.recordReady.promise)()});
		assert.deepEqual(browser,{page: expected(false),react: expected(true),worker: expected(true)});
		await writeFile(join(output,route+".execution.json"),canonicalJson({route,sources,packageSetSha256: release.digest,peerReceiptSha256: peer.digest,deployed,node,typed,browser}));
		t.diagnostic(route+" "+release.digest);
	}
});
