/** @file Run the same function-forwarding application against installed native C and Wasmtime packages. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {nativeFixtureEnvironment} from "./copied-fixture-install.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {checkStagedQuoteIdentities,checkApplicationFunctionPositions,checkTicketExchangePositions,prepareStagedQuoteProject} from "./staged-quote-project.mjs";

import {runCppApplication} from "./cpp-application-client.mjs";

const targets=["c","cpp","wit-wasi"],json=async path=>JSON.parse(await readFile(path));
const sources=["tariff-application-function.c","tariff-ticket-exchange.c","tariff-application-observer.c"];
const app=async ({root,handoff,pkg,profile,route,env})=>{
	const wit=pkg.target==="wit-wasi";assert.equal(pkg.artifacts.length,1);
	const [archive]=pkg.artifacts,top=basename(archive.path,".tar.gz");
	assert.equal(top,"tariff-quotes-1.0.0-"+pkg.target);
	const path=join(handoff,archive.path),entries=(await run("tar",["-tzf",path],root,env)).split("\n");
	assert.ok(entries.length&&entries.every(p=>p.startsWith(top+"/")&&!p.split("/").includes("..")));
	await run("tar",["-xzf",path],root,env);
	const install=join(root,"relocated");await rename(join(root,top),install);
	const manifest=await json(join(install,"lean-bridge-package.json"));
	assert.equal(manifest.kind,wit?"lean-bridge-owned-wit-package":"lean-bridge-native-"+pkg.target+"-package");
	assert.equal(manifest.pkgConfig,wit?"tariff-quotes-wit":"tariff-quotes");
	const meta=name=>json(join(install,"share/lean-bridge/component",name+".json"));
	const model=await meta("model"),ir=await meta("binding-ir");
	const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: true});
	checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);
	const author=model.sourceIdentity.modules.find(m=>m.module==="Owned").source;
	assert.equal(author.path,"Owned.lean");assert.equal(author.sha256,"a758f8e7a4210d99fe965aa06c4b42006df3c087c70f2bde8d0e1403c30a98fb");
	assert.equal(manifest.bindingIrSha256,pins.bindingIrSha256);assert.equal(manifest.runtimeIdentity,pkg.runtimeIdentity);
	if(pkg.target==="cpp")
	{
		assert.equal(manifest.cmakePackage,"LeanBridgeTariffQuotesCpp");assert.equal(manifest.cmakeTarget,"LeanBridge::tariff_quotes_cpp");
		const client=await runCppApplication(root,install,env);
		return {target: pkg.target,...pins,leanSourceSha256: author.sha256,runtimeIdentity: pkg.runtimeIdentity,archive,...client};
	}
	let componentSha256;
	if(wit)
	{
		const wasm=join(install,"component/tariff-quotes.wasm"),world=join(install,"wit/tariff-quotes.wit");
		componentSha256=sha256(await readFile(wasm));assert.equal(componentSha256,manifest.componentSha256);
		await run(env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",["component","targets",world,wasm],root,env);
	}
	const hashes={};
	for(const f of sources)
	{
		await copyFile(resolve("tests/fixtures/structured-types",f),join(root,f));
		hashes[f]=sha256(await readFile(join(root,f)));
	}
	const flags=await run("pkg-config",["--cflags","--libs",manifest.pkgConfig],root,{PATH: env.PATH,PKG_CONFIG_LIBDIR: join(install,"lib/pkgconfig")});
	const tokens=flags.match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
	await run(env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-UNDEBUG",wit?"-DTARIFF_WIT":"-DTARIFF_NATIVE_C",...sources,...tokens,"-ldl","-o","consumer"],root,env);
	const exe=join(root,"consumer");
	const output=await run(exe,[join(install,"lib/liblean_bridge_native.so")],root,{PATH: "/no-author-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LANG: "C.UTF-8"});
	const expected=["expired","forward","reply","nested","failure","control"].map(n=>n+":1");
	assert.deepEqual(output.split("\n"),[...expected,"exchange:42:43","ticket42:1","exchange:71:72","ticket71:1","afterShutdown:0"]);
	return {target: pkg.target
		, ...pins
		, leanSourceSha256: author.sha256
		, runtimeIdentity: pkg.runtimeIdentity
		, archive
		, ...wit?{componentSha256}:{}
		, sources: hashes
		, clientSha256: sha256(await readFile(exe))
		, output};
};

test("installed native and Wasmtime packages forward the actual application function on both author routes",{timeout: 7_200_000},async t=>{
	const env=nativeFixtureEnvironment(["c"]),work=await mkdtemp(join(tmpdir(),"c-wit-functions-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const replay=env.LEAN_BRIDGE_C_WIT_APP_REPLAY,keep=env.LEAN_BRIDGE_C_WIT_APP_KEEP;assert.ok(!(keep&&replay));
	if(!replay)
		for(const tool of [env.CXX??"c++","pkg-config","cmake"])await run(tool,["--version"],work,env);
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"sets-"));
	const out=resolve(env.LEAN_BRIDGE_C_WIT_APP_OUTPUT??"build/c-wit-application-functions");
	const results=[],failures=[];let activeTargets;
	for(const route of ["ordinary","reviewed"])
	{
		const project=join(work,"author-"+route),outputRoot=join(work,"producer-"+route),handoff=join(sets,route);
		if(!replay)
		{
			await prepareStagedQuoteProject(project,route,targets,{hostFunctions: true,ticketExchange: true});
			await buildCanonicalProject({projectRoot: project,outputRoot,targets,environment: env});
			await copyPackageSetHandoff(outputRoot,handoff);await rm(project,{recursive: true});await rm(outputRoot,{recursive: true});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		const actual=receipt.packages.map(p=>p.target).sort();
		if(replay&&actual.length===2)assert.deepEqual(actual,["c","wit-wasi"]);
		else assert.deepEqual(actual,targets);
		if(activeTargets)assert.deepEqual(activeTargets,actual);else activeTargets=actual;
		const reports=[];
		for(const pkg of receipt.packages)
		{
			const root=join(work,route+pkg.target);await mkdir(root);
			try
			{
				const row=await app({root,handoff,pkg,route,env,profile: receipt.profiles.find(p=>p.id===pkg.profile)});
				reports.push(row);await saveLakeFile(out,route+"."+pkg.target+".json",canonicalJson({route,receiptSha256: result.receiptSha256,...row}));
			}
			catch(cause)
			{
				const message=route+"/"+pkg.target+": "+cause.message;t.diagnostic(message);failures.push(new Error(message,{cause}));
			}
			finally
			{
				await rm(root,{recursive: true});
			}
		}
		for(const row of reports)assert.equal(row.bindingIrSha256,reports[0].bindingIrSha256);
		results.push({route,receiptSha256: result.receiptSha256,reports});
	}
	if(failures.length)throw new AggregateError(failures,"Failed installed clients: "+failures.length);
	for(const target of activeTargets)
	{
		const [a,b]=results.map(r=>r.reports.find(p=>p.target===target));assert.notEqual(a.archive.sha256,b.archive.sha256);
		assert.equal(a.runtimeIdentity,b.runtimeIdentity);assert.deepEqual(a.sources,b.sources);
		assert.equal(a.reviewedSourceSha256,null);assert.match(b.reviewedSourceSha256,/^[a-f0-9]{64}$/u);
	}
	await saveLakeFile(out,"pair.json",canonicalJson(results));t.diagnostic("Verified handoffs: "+sets);
});
