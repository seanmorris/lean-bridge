/** @file Relink the real Lean modules for a fast scheduler check, independently of installed-package qualification. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {nativeDeliveryHeader} from "../../src/build/jvm-io-owner.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Recompile the original four application modules and check their generated C
 * bytes against the compiler evidence from the immutable pollable release.
 * This spot check does not construct, replace or qualify either archive.
 *
 * @param o - Release staging directory, original evidence, adapter, runtime and both guest modules.
 */
export const executeCanonicalBudgetNative=async o=>{
	const {dir,evidence,gen,wire,previous,clients,sdk}=o;
	const runtime=resolve(process.env.LEAN_BRIDGE_WIT_CALLBACK_NATIVE_RUNTIME),p=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX);
	const lean=join(p,"bin/lean"),save=(f,b)=>writeFile(join(dir,f),b),cc=process.env.CC??"cc";
	const env={...process.env,LEAN_SYSROOT: p,LEAN_PATH: dir,LEAN_SRC_PATH: dir,LEAN_NUM_THREADS: "1"};
	assert.equal(sha256(await readFile(lean)),evidence.compilerSha256);
	for(const n of ["lib/liblean_bridge_native.so","lib/libleanshared.so"])
		assert.equal(sha256(await readFile(join(runtime,n))),previous.runtimeLibraries[n]);
	const modules=[];
	for(const name of ["Budget","Racing","TypedBudget","FactoryFault"])
	{
		const original=evidence.interfaces.find(s=>s.module===name);
		const where=name==="Budget"?"javascript-once-callback":"native-callback-budget";
		const source=await readFile(resolve("tests/fixtures",where,name+".lean"));
		assert.equal(sha256(source),original.sourceSha256);await save(name+".lean",source);
		const c="module"+modules.length+".c";modules.push(c);
		await run(lean,["-j1","-R",dir,"-o",name+".olean","-c",c,name+".lean"],dir,env);
		assert.equal(sha256(await readFile(join(dir,c))),original.cSha256);
	}
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(lean,["-j1","-c","entry.c","BridgeCAsync.lean"],dir,env);
	await save("checked-entry.c",'#include "entry.c"\n'+gen.declarations);
	await save("adapter.c",gen.source);await save("wire.c",wire.source);
	await save("task-delivery.h",await nativeDeliveryHeader(false));
	for(const [d,n] of [["native","task-notification.h"],["c","task-callback-port.h"],["native","task-callback-queue.h"]])
		await save(n,await readFile(new URL("../../src/backends/"+d+"/"+n,import.meta.url)));
	const runtimeLib=join(runtime,"lib"),sdkLib=join(resolve(sdk),"lib");
	await run(cc,["-std=gnu11","-O0","-g0",...modules
		, "checked-entry.c","adapter.c","wire.c","canonical-command.c"
		, "-I"+join(runtime,"include"),"-I"+join(resolve(sdk),"include")
		, "-L"+runtimeLib,"-L"+sdkLib,"-Wl,-rpath,"+runtimeLib+":"+sdkLib
		, "-llean_bridge_native","-lleanshared","-lwasmtime"
		, "-pthread","-lm","-ldl","-o","budget-run"],dir,env);
	await save("guest-provider.wasm",clients[0]);await save("guest-app.wasm",clients[1]);
	const result=await run(join(dir,"budget-run"),["guest-provider.wasm","guest-app.wasm"],dir,
		{PATH: "/no-producer-tools",LEAN_NUM_THREADS: "2",RAYON_NUM_THREADS: "1"},120000);
	assert.equal(result,"27");
};
