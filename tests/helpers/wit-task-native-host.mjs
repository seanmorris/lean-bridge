/** @file Link and execute a real Wasmtime embedding for the checked task world. */
import assert from "node:assert/strict";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "../../src/build/task-resource-ledger.mjs";
import { renderWitTaskImports } from "../../src/backends/wit/task-host.mjs";
import { nativeDeliveryHeader } from "../../src/build/jvm-io-owner.mjs";
import { readVerifiedNativeRuntime } from "../../src/build/native-artifacts.mjs";
import { snapshotWasmtimeCapi } from "../../src/build/native-wit-projection.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

/**
 * Validate exact compiler/runtime inputs before running the public WIT exports.
 *
 * @param options - Fresh producer workspace and elaboration, checked WIT world, toolchains and runner.
 * @param options.app - Private directory containing the compiled component and Lean objects.
 * @param options.built - Fresh declarations, environment and compiler evidence.
 * @param options.model - Authenticated task resource and method layout.
 * @param options.leanPrefix - Producer's Lean compiler installation.
 * @param options.runtimeRoot - Verified native runtime for the same compiler commit.
 * @param options.wasmtimeRoot - Pinned Linux Wasmtime C SDK.
 * @param options.run - Bounded producer subprocess runner.
 */
export const exerciseWitTaskHost = async ({app,built,model,leanPrefix,runtimeRoot,wasmtimeRoot,run})=>{
	const {identity,manifest}=await readVerifiedNativeRuntime(runtimeRoot);
	const {env,entries,objects,evidence,api}=built, exec=(cmd,args)=>run(cmd,args,app,env);
	const lean=join(leanPrefix,"bin/lean"), cc=env.CC ?? "cc";
	assert.equal((await exec(lean,["--githash"])).stdout.trim(),manifest.leanCommit);
	const sdk=join(app,"wasmtime"), sdkFiles=await snapshotWasmtimeCapi(wasmtimeRoot,sdk);
	const component=await readFile(join(app,"component.wasm"));
	const imports=await renderWitTaskImports(model), delivery=await nativeDeliveryHeader(false);
	const notification=await readFile(new URL("../../src/backends/native/task-notification.h",import.meta.url));
	const ledger=model.heap?.length?await taskResourceLedger(identity):null;
	if(ledger) await compileTaskResourceLedger({ledger,app,runtimeRoot,cc,run: (cmd,args)=>exec(cmd,args)});
	const config={name: "wit-"+sha256(api.component.id)
		, modules: evidence.selection.exportModules
		, entries,integerMode: "words",witDelivery: true
		, ...(ledger?{resources: api.types}:{})};
	const skeleton=generateCTaskExports({...config,componentIdentity: "0".repeat(64)});
	const componentIdentity=sha256(canonicalJson({evidence,identity
		, skeleton,sdkFiles
		, ir: model.bindingIrSha256
		, imports: sha256(imports)
		, component: sha256(component)
		, delivery: sha256(delivery)
		, notification: sha256(notification)
		, wire: sha256(model.wire.source)}));
	const gen=generateCTaskExports({...config,componentIdentity});
	assert.equal(gen.prefix,model.prefix);
	const save=(name,data)=>writeFile(join(app,name),data,{flag: "wx"});
	await save("BridgeCAsync.lean",gen.entryLean); await exec(lean,["-j1","-c","entry.c","BridgeCAsync.lean"]);
	await save("checked-entry.c",'#include "entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header); await save("task-delivery.h",delivery); await save("adapter.c",gen.source);
	await save("task-notification.h",notification);
	await save("wire.c",model.wire.source);
	await save("task-host.h",imports+"\nstatic const uint8_t lb_task_component[]={"+Array.from(component).join(",")+"};\n");
	await cp(resolve("tests/fixtures/wit-tasks/wasmtime-lab.h"),join(app,"wasmtime-lab.h"));
	await cp(resolve("tests/fixtures/wit-tasks/"+(ledger?"heap.c":"host.c")),join(app,"consumer.c"));
	const flags=["-std=gnu11","-O1","-g0","-I",join(runtimeRoot,"include"),"-I",join(sdk,"include"),...ledger?[ledger.flag]:[]], compiled=[];
	for(const src of [...objects,"checked-entry.c","adapter.c","wire.c","consumer.c"])
	{
		const obj=src.slice(0,-2)+".o"; compiled.push(obj);
		await exec(cc,[...flags,...src==="consumer.c"?["-Wall","-Wextra","-Werror"]:[],"-c",src,"-o",obj]);
	}
	await exec(cc,[...compiled,"-o","consumer"
		, "-L",join(runtimeRoot,"lib"),"-L",join(sdk,"lib")
		, "-lwasmtime"
		, ...ledger?["-L.","-l:"+ledger.name]:[]
		, "-llean_bridge_native"
		, "-lleanshared"
		, "-lm"
		, "-ldl"
		, "-pthread"
		, "-Wl,-z,now,-z,defs"]);
	const result=await run(join(app,"consumer"),[],app,{...env,RAYON_NUM_THREADS: "1"
		, LD_LIBRARY_PATH: [app,join(runtimeRoot,"lib"),join(sdk,"lib")].join(":")});
	assert.match(result.stdout,/Wasmtime Lean tasks: .* checks passed/u);
	assert.equal((await readVerifiedNativeRuntime(runtimeRoot)).identity,identity);
	return {runtimeIdentity: identity,componentIdentity
		, wasmtimeSdkSha256: sha256(canonicalJson(sdkFiles))
		, componentSha256: sha256(component)
		, nativeConsumerSha256: sha256(await readFile(join(app,"consumer")))
		, result: result.stdout.trim()};
};
