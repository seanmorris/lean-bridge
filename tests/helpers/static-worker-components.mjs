/** @file Compile the actual worker adapter, scoped ledger and native object provider together. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { rustHostFacade } from "../../src/backends/rust/host-facade.mjs";
import { compileCHostComponent } from "../../src/build/c-host-component.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { prepareStaticWorkerProject, staticOwners } from "./static-worker-project.mjs";

const leanPrefix=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const rustScope = async (app,runtimeRoot,b) => {
	const echo=b.workerWire.methods.find(m=>m.declaration==="Jobs.echo"), names=echo.names;
	const symbols=[
		[b.prefix+"_call","fn call(cookie:usize,id:u64,d:Dispatch,op:i32,args:*const u64,n:usize,out:*mut u64,tags:*mut u8,fault:*mut u32)->i32;"]
		, [b.prefix+"_visit","fn visit(cookie:usize,id:u64,d:Dispatch,cleanup:i32,f:Visit)->i32;"]
		, [b.prefix+"_object","fn object(cookie:usize,op:i32,kind:u32,input:u64,h:*mut u64,out:*mut u64)->i32;"]
		, [names.start,"fn echo_start(a:*const u64,h:*mut u64,out:*mut u64,t:*mut u8)->i32;"]
		, [names.poll,"fn echo_poll(h:*mut u64,fd:*mut i32)->i32;"]
		, [names.take,"fn echo_take(h:*mut u64,out:*mut u64,t:*mut u8)->i32;"]
		, [names.close,"fn echo_close(h:*mut u64)->i32;"]
	];
	assert.deepEqual(echo.args,[b.workerWire.leases[0].type]); assert.equal(echo.result,echo.args[0]);
	for(const [s] of symbols) assert.ok(b.symbols.includes(s),s);
	await writeFile(join(app,"native.rs"),'const DOMAIN:&str='+JSON.stringify(b.domainId)+';const KIND:&str='+JSON.stringify(b.model.kinds[0].key)+';\nunsafe extern "C" {\n'+symbols.map(([s,f])=>'#[link_name='+JSON.stringify(s)+'] '+f).join("\n")+'\n}\n');
	await copyFile("src/backends/rust/task-runtime/src/owner.rs",join(app,"owner.rs"));
	await copyFile("tests/fixtures/static-host-workers/scope.rs",join(app,"probe.rs"));
	const lib=join(runtimeRoot,"lib");
	const run=(command,args,env)=>processBuildRunner.capture({command,args,cwd: app,env});
	await run(process.env.LEAN_BRIDGE_RUSTC??"rustc",["--edition=2021","-Dwarnings","-Ccodegen-units=1","probe.rs","-L","native="+app,"-l","dylib="+b.prefix,"-Clink-arg=-Wl,-rpath-link,"+app,"-Clink-arg=-Wl,-rpath-link,"+lib,"-o","probe"],process.env);
	const r=await run(join(app,"probe"),[],{PATH: "/no-tools",LD_LIBRARY_PATH: app+":"+lib,LEAN_NUM_THREADS: "1",LANG: "C"});
	assert.match(r.stdout,/compiled Lean task returned the original Rust Rc/u);
};
for(const owner of Object.keys(staticOwners)) test(owner+" private worker entries link with the real host domain and scoped task leases",{timeout: 600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"word-worker-kernel-")); t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"src"), runtimeRoot=join(root,"runtime"), app=join(root,"component");
	await mkdir(app); await prepareStaticWorkerProject(project,owner); const target=staticOwners[owner][1];
	const inventory=await inspectLeanProject(project), component=elaboratedComponent(inventory.project);
	const captured=await openHostProjectSource({project,inventory,component,targets: [target],leanPrefix});
	try
	{
		const o={...captured,app,target,runtimeRoot,environment: process.env,name: "workshop",version: "1.0.0",ir: captured.projectContract.ir};
		await assert.rejects(compileCHostComponent(o),/synchronous application-owned/u);
		await buildNativeSharedRuntime({outputRoot: runtimeRoot,leanPrefix});
		const b=await compileCHostComponent({...o,workerTransport: true}).catch(e=>{throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e});});
		await captured.verify();
		const inspect=async(command,args)=>(await processBuildRunner.capture({command,args,cwd: app,env: process.env})).stdout;
		const symbols=(await inspect("nm",["-D","--defined-only","--format=posix",b.component])).trim().split("\n").map(s=>s.split(" ")[0]).sort();
		assert.deepEqual(symbols,[...b.symbols].sort()); assert.ok(symbols.includes(b.prefix+"_visit")); assert.ok(symbols.includes(b.prefix+"_object"));
		assert.ok(!symbols.some(s=>s.includes("_private_visit")||s.includes("_private_object")));
		assert.deepEqual(b.workerWire.methods.map(m=>m.name).sort(),["echo","outcome","reject","relay","series"]);
		assert.ok(b.workerWire.leases.length); assert.ok(b.workerWire.leases.every(k=>k.host));
		const deps=await inspect("readelf",["-d",b.component]);
		for(const name of [b.domain,b.workerLedger,"libleanshared.so","liblean_bridge_native.so"]) assert.ok(deps.includes("["+name+"]"),name);
		for(const [name,digest] of Object.entries(b.binaries)) assert.equal(sha256(await readFile(join(app,name))),digest);
		if(owner==="rust")
		{
			const emit=wire=>rustHostFacade({...b,ir: o.ir,wire});
			assert.match(emit(b.workerWire),/pub fn relay/u);
			for(const mutate of [w=>{w.leases[0].tag++;},w=>{w.wait.open=w.wait.close;}
				, w=>{const m=w.methods.find(x=>x.callbacks);m.callbacks[0][1]="uint32";}
				, w=>{w.methods[0].names.take=w.methods[1].names.take;}]){
				const invalid=structuredClone(b.workerWire);mutate(invalid);
				assert.throws(()=>emit(invalid),/Invalid Rust host worker/u);
				}
			await rustScope(app,runtimeRoot,b);
		}
		t.diagnostic(JSON.stringify({owner,component: b.binaries[b.component],domain: b.binaries[b.domain],ledger: b.binaries[b.workerLedger],exports: symbols.length}));
	} finally
{ await captured.dispose(); }
});
