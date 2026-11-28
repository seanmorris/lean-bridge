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
	const {dir,evidence,gen,wire,previous,clients,sdk,siblings}=o;
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
	await save("exports.map","{ global: "+[...gen.symbols,...wire.symbols].join("; ")+"; local: *; };\n");
	await run(cc,["-std=gnu11","-O0","-g0","-shared","-fPIC",...modules
		, "checked-entry.c","adapter.c","wire.c","-I"+join(runtime,"include")
		, "-L"+runtimeLib,"-Wl,-rpath,"+runtimeLib
		, "-llean_bridge_native","-lleanshared","-pthread","-lm"
		, "-Wl,-z,defs,-z,nodelete","-Wl,--version-script=exports.map"
		, "-o","libbudget.so"],dir,env);
	await run(cc,["-std=c11","-Wall","-Wextra","-Werror","canonical-command.c"
		, "-I"+join(resolve(sdk),"include"),"-L.","-lbudget","-L"+sdkLib,"-lwasmtime"
		, "-Wl,-rpath,$ORIGIN:"+sdkLib,"-Wl,-rpath-link,"+runtimeLib
		, "-o","budget-run"],dir,env);
	await save("guest-provider.wasm",clients[0]);
	for(const [app,expected] of [[clients[1],"27"],[siblings,"62"]])
	{
		await save("guest-app.wasm",app);
		const value=await run(join(dir,"budget-run"),["guest-provider.wasm","guest-app.wasm"],dir,
			{PATH: "/no-producer-tools",LEAN_NUM_THREADS: "2",RAYON_NUM_THREADS: "1"},120000);
		assert.equal(value,expected);
	}
};
