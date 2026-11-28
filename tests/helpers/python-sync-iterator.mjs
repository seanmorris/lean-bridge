/** @file Publish real immediate Lean cursors and install both Python wheel routes. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {reconcileHostExports} from "../../src/analyze/host-export-model.mjs";
import {resolveNativeHostEffects} from "../../src/analyze/native-host-effects.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const run=promisify(execFile),fixture=resolve("tests/fixtures/python-sync-iterator");
const python=process.env.LEAN_BRIDGE_PYTHON??"python3";
const p=(open,next)=>({open: "Counting."+open,next: "Counting."+next,close: "Counting.finish"});

// Use the exact compiled application for the negative checks; the protocol
// is not established by parsing a source string or by supplying synthetic IR.
const checkProtocols=async(src,evidence,api)=>{
	const lean=process.env.LEAN_BRIDGE_LEAN_PREFIX?join(process.env.LEAN_BRIDGE_LEAN_PREFIX,"bin/lean"):"lean",cwd=src,env={...process.env,LEAN_PATH: src};
	await run(lean,["-j1","-o","Counting.olean","Counting.lean"],{cwd,env});
	const actual=async selection=>{
		const request=join(src,"request.json");await writeFile(request,canonicalJson(selection));
		const args=["-j1","--run",resolve("src/analyze/HostExports.lean"),request];
		return JSON.parse((await run(lean,args,{cwd,env})).stdout);
	};
	const changed=field=>({...evidence.selection,iterators: evidence.selection.iterators.map(s=>
		s.open==="Counting.numbers"?{...s,...field}:s)});
	await assert.rejects(actual(changed({next: "Counting.threaded"})),e=>/immediate Option, not a Task/u.test(e.stderr+" "+e.stdout));
	const ungranted={...changed({close: "Counting.writes"}),nativeEffects: []},metadata=await actual(ungranted);
	assert.throws(()=>resolveNativeHostEffects(ungranted,metadata.nativeEffectAudit),/Counting\.writes requires nativeEffects "filesystem"/u);
	const granted={...ungranted,nativeEffects: ["filesystem"]};
	const {phases}=resolveNativeHostEffects(granted,metadata.nativeEffectAudit);
	assert.deepEqual(phases.get("Counting.numbers"),{close: ["capability:native.filesystem"]});
	// This is a valid reviewed interface, but it describes the wrong application
	// method. Refuse it during source reconciliation, not just schema validation.
	const stale=structuredClone(api);
	const decl=stale.declarations.find(d=>d.source.declaration==="Counting.numbers");
	decl.source.extensions["lean-bridge.dev/pull-protocol"].next="Counting.threaded";
	assert.throws(()=>reconcileHostExports({ir: null,selection: evidence.selection,metadata: evidence.metadata,component: api.component,review: {source: canonicalJson(stale)}}),
		/Reviewed API differs from compiled host exports/u);
	await rm(join(src,"request.json"));await rm(join(src,"Counting.olean"));
};
test("synchronous iterators publish and run without a task or event loop",async t=>{
	const root=await mkdtemp(join(tmpdir(),"lean-immediate-cursor-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"producer");await mkdir(src);
	await copyFile(join(fixture,"Counting.lean"),join(src,"Counting.lean"));
	await copyFile("LICENSE",join(src,"LICENSE"));
	await writeFile(join(src,"lean-toolchain"),"leanprover/lean4:v4.32.2\n");
	await writeFile(join(src,"lakefile.toml"),'name = "counting"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Counting"\n');
	const iterators=[p("numbers","next"),p("checked","checkedNext"),{...p("units","nextUnit"),close: "Counting.writes"}];
	const cfg={schemaVersion: 1,modules: ["Counting"],nativeEffects: ["filesystem"],iterators
		, exports: ["Counting.counts",...iterators.map(p=>p.open)]
		, targets: {pypi: {name: "lean-counting",version: "1.0.0"}}};
	const config=join(src,"lean-bridge.exports.json");
	const save=c=>writeFile(config,canonicalJson(c));
	const build=out=>buildCanonicalProject({projectRoot: src,outputRoot: join(root,out),targets: ["pypi"]})
		.catch(e=>{throw new Error(e.message+" "+JSON.stringify(e.details),{cause: e});});
	const handoffs=[];let first;
	for(const route of ["ordinary","reviewed"])
	{
		if(first)
		{
			delete cfg.exports;await writeFile(join(src,"counting.binding-ir.json"),canonicalJson(first));
		}
		await save(cfg);await build(route);
		const out=join(root,route),file=join(out,"package-set-receipt.json");
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: file});
		assert.equal(receipt.profiles[0].id,"native-python-io-v1");
		const ir=JSON.parse(await readFile(join(out,"binding-ir.json"),"utf8"));
		const decls=ir.declarations.filter(d=>d.resultMode==="iterator");
		assert.equal(decls.length,3);assert.ok(decls.every(d=>!d.effects.includes("async")));
		assert.deepEqual(decls.map(d=>d.source.extensions["lean-bridge.dev/pull-effect"]).sort(),["BaseIO","EIO","IO"]);
		assert.ok(ir.errors.some(e=>e.id==="error:Step.Counting.checked"));
		if(first)assert.deepEqual(ir,first);first??=ir;
		if(route==="reviewed")await checkProtocols(src,JSON.parse(await readFile(join(out,"host-export-evidence.json"),"utf8")),ir);
		const feed=join(root,"feed-"+route);await mkdir(feed);
		const wheels=[];
		for(const pkg of receipt.packages)
		{
			const [{path}]=pkg.artifacts,name=path.split("/").at(-1);
			await rename(join(out,path),join(feed,name));wheels.push(join(feed,name));
		}
		handoffs.push({route,feed,wheels});
		t.diagnostic(route+" receipt "+sha256(await readFile(file)));
		await rm(out,{recursive: true});
	}
	await rm(src,{recursive: true});
	for(const {route,feed,wheels} of handoffs)
	{
		const app=join(root,"app-"+route),moved=app+"-moved";await mkdir(app);
		await run(python,["-m","pip","--disable-pip-version-check","install","--no-index","--no-cache-dir","--no-deps","--no-compile","--target",app,...wheels]);
		await rm(feed,{recursive: true});await rename(app,moved);
		await cp(join(fixture,"client.py"),join(moved,"client.py"));
		const result=await run(python,["-sB","client.py"],{cwd: moved,env: {PATH: "/no-author-tools",PYTHONNOUSERSITE: "1"}});
		assert.equal(result.stderr,"");assert.match(result.stdout,/immediate native pulls.*seven finalizers passed/u);
		assert.match(result.stdout,/shutdown closed the final live cursor exactly once/u);
		t.diagnostic(route+": "+result.stdout.trim());
		await cp(join(fixture,"fork.py"),join(moved,"fork.py"));
		const fork=await run(python,["-sB","fork.py"],{cwd: moved,timeout: 30_000,env: {PATH: "/no-author-tools",PYTHONNOUSERSITE: "1"}});
		assert.equal(fork.stderr,"");assert.match(fork.stdout,/child exit left the owner cursor usable/u);
	}
});
