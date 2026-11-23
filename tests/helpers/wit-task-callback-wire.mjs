/** @file Exercise the Wasmtime owner's private callback transport with compiler-checked Lean workers. */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { compileWitTaskResources } from "../../src/backends/wit/task-model.mjs";
import { renderWitTaskImports } from "../../src/backends/wit/task-host.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { nativeDeliveryHeader } from "../../src/build/jvm-io-owner.mjs";
import { readVerifiedNativeRuntime } from "../../src/build/native-artifacts.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { linkWitHost } from "../../src/build/wit-sync-io-host.mjs";
import { canonicalJson,sha256 } from "../../src/capsule/node.mjs";

test("the WIT owner receives the original retained callback failure and its Lean phase",{
	skip: process.env.LEAN_BRIDGE_WIT_CALLBACK_WIRE_TEST!=="1"
},async t=>{
	const leanPrefix=process.env.LEAN_BRIDGE_LEAN_PREFIX, tools=process.env.LEAN_BRIDGE_WASM_TOOLS;
	assert.ok(leanPrefix && tools,"Set LEAN_BRIDGE_LEAN_PREFIX and LEAN_BRIDGE_WASM_TOOLS to the pinned producer tools");
	const root=await mkdtemp(join(tmpdir(),"wit-callback-wire-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const runtimeRoot=process.env.LEAN_BRIDGE_WIT_TASK_RUNTIME??join(root,"runtime");
	if(!process.env.LEAN_BRIDGE_WIT_TASK_RUNTIME) await buildNativeSharedRuntime({outputRoot: runtimeRoot,leanPrefix});
	const runtime=await readVerifiedNativeRuntime(runtimeRoot);
	const project=join(root,"project"), fx=resolve("tests/fixtures/wit-task-package");
	await mkdir(project);
	for(const name of ["lean-toolchain","lakefile.toml"]) await cp(resolve("tests/fixtures/wit-tasks",name),join(project,name));
	await cp(join(fx,"retained-phase.lean"),join(project,"Meter.lean"));
	const decl="Meter.through";
	const config={schemaVersion: 1,modules: ["Meter"],exports: [decl]
		, taskExports: [decl],taskIOErrors: [decl]
		, targets: {"wit-wasi": {name: "meter",version: "1.0.0"}}};
	const lean=join(leanPrefix,"bin/lean"),run=async (command,args,cwd,env)=>{
		try
{ return await processBuildRunner.capture({command,args,cwd,env}); }
		catch(error)
{ t.diagnostic(error.details?.stderr??error.message); throw error; }
	};
	const keep=process.env.LEAN_BRIDGE_WIT_CALLBACK_WIRE_EVIDENCE;
	if(keep) await mkdir(keep);
	let publicApi,ordinaryWorld;
	for(const route of ["ordinary","reviewed"])
{
		const app=join(root,route);await mkdir(app);
		if(publicApi)
{
			delete config.exports;await writeFile(join(project,"author.binding-ir.json"),canonicalJson(publicApi));
}
		await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(config));
		const inventory=await inspectLeanProject(project);
		const source=await openHostProjectSource({project,inventory,component: elaboratedComponent(inventory.project),leanPrefix});
		let built;
		try
{
			built=await compileHostSources({app,ir: source.projectContract.ir
				, sources: source.sources
				, projectContract: source.projectContract
				, leanPrefix
				, run
				, environment: process.env
				, target: "wit-wasi"});
			await source.verify();
} finally
{ await source.dispose(); }
		const {api,entries,evidence,env,objects}=built;
		if(publicApi) assert.deepEqual(api,publicApi); else publicApi=api;
		assert.equal(evidence.selection.witTaskCallbacks,true);
		const [cb]=api.types;
		assert.equal(cb.kind,"callback"); assert.equal(cb.source.extensions["lean-bridge.dev/callback-scheduler"],"wasmtime-store-owner");
		assert.deepEqual(cb.callable.failure.errors,["error:WitCallbackError"]);
		const params=api.declarations[0].parameters; assert.equal(params[2].ownership,"lease");assert.equal(params[2].lifetime.scope,"explicit");
		const replay=alter=>reconcileHostExports({...evidence,component: api.component,selection: {...evidence.selection,...alter},review: {source: canonicalJson(api)}});
		assert.throws(()=>replay({witTaskCallbacks: false}),/Unverified retained-callback/u);
		assert.throws(()=>replay({pythonTaskCallbacks: true}),/Ambiguous retained-callback/u);
		assert.throws(()=>replay({witTaskCallbacks: false,pythonTaskCallbacks: true}),/Reviewed API differs/u);
		const model=compileWitTaskResources({api,evidence,bindingIrSha256: hashBindingIr(api),settings: config.targets["wit-wasi"]});
		const [request]=model.methods[0].callbacks;
		assert.equal(request.parameter,"transform");assert.equal(request.slot,2);
		assert.equal(model.wire.methods[0].callbacks[0][0],request.slot);
		const gen=generateCTaskExports({name: "witprobe",entries,modules: ["Meter"]
			, componentIdentity: sha256(canonicalJson(evidence))
			, integerMode: "words",witDelivery: true,witCallbacks: true});
		const wire=generateSyncWire(gen.prefix,entries,{tasks: true,witCallbacks: true}),[method]=wire.methods;
		assert.deepEqual(method.callbacks,[[2,"uint32","uint32"]]); assert.equal(method.error,"string");assert.equal(method.terminal,"string");
		const exec=(cmd,args)=>run(cmd,args,app,env),save=(name,value)=>writeFile(join(app,name),value,{flag: "wx"});
		await assert.rejects(linkWitHost({app,built,tasks: true,settings: config.targets["wit-wasi"]}),/before an installed package can be emitted/u);
		await assert.rejects(access(join(app,"world.wit")),{code: "ENOENT"});
		assert.match((await exec(tools,["--version"])).stdout,/^wasm-tools 1\.245\.1\b/u);
		await save("world.wit",model.wit);await save("world.wat",model.wat);
		await exec(tools,["parse","world.wat","-o","world.wasm"]);
		await exec(tools,["validate","--features","component-model","world.wasm"]);
		await exec(tools,["component","targets","world.wit","world.wasm"]);
		const consuming=request.resolve+": func(%request: own<"+request.resource+">";
		assert.ok(model.wit.includes(consuming));
		await save("wrong.wit",model.wit.replaceAll(consuming,consuming.replace("own<","borrow<")));
		await assert.rejects(processBuildRunner.capture({command: tools,cwd: app,args: ["component","targets","wrong.wit","world.wasm"]}));
		await assert.rejects(renderWitTaskImports(model),/require a store-owner dispatch adapter/u);
		assert.equal((await exec(lean,["--githash"])).stdout.trim(),runtime.manifest.leanCommit);
		await save("BridgeCAsync.lean",gen.entryLean);await exec(lean,["-j1","-c","entry.c","BridgeCAsync.lean"]);
		await save("checked-entry.c",'#include "entry.c"\n'+gen.declarations+"\n");
		await save(gen.prefix+".h",gen.header);await save("adapter.c",gen.source);await save("wire.c",wire.source);
		await save("task-delivery.h",await nativeDeliveryHeader(false));
		for(const [base,name] of [["c","task-callback-port.h"],["native","task-callback-queue.h"],["native","task-notification.h"]])
			await cp(resolve("src/backends",base,name),join(app,name));
		await cp(join(fx,"retained-wire.c"),join(app,"probe.c"));
		const cc=env.CC??"cc",libs=join(runtimeRoot,"lib");
		await exec(cc,["-std=gnu11","-O1","-g0","-I",join(runtimeRoot,"include")
			, ...objects,"checked-entry.c","adapter.c","probe.c"
			, "-L"
			, libs
			, "-llean_bridge_native"
			, "-lleanshared"
			, "-lm"
			, "-ldl"
			, "-pthread"
			, "-Wl,-z,defs,-z,now"
			, "-o"
			, "probe"]);
		const result=await run(join(app,"probe"),[],app,{PATH: "/no-producer-tools",LD_LIBRARY_PATH: libs,LEAN_NUM_THREADS: "1"});
		assert.match(result.stdout,/Native WIT callback wire: 8 factory\/worker outcomes passed/u);
		const world=sha256(await readFile(join(app,"world.wasm")));
		if(route==="ordinary") ordinaryWorld=world; else assert.equal(world,ordinaryWorld);
		const report={route,api: hashBindingIr(api),runtime: runtime.identity,world
			, probe: sha256(await readFile(join(app,"probe")))
			, result: result.stdout.trim()};
		if(keep)
		{
			const dir=join(keep,route);await mkdir(dir);
			for(const name of ["world.wit","world.wasm","probe"]) await cp(join(app,name),join(dir,name));
			for(const [file,data] of [["binding-ir",api],["host-evidence",evidence],["result",report]])
				await writeFile(join(dir,file+".json"),canonicalJson(data),{flag: "wx"});
		}
		t.diagnostic(JSON.stringify(report));
}
});
