/** @file Link checked Lean C objects to a Wasmtime synchronous IO or task library. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileWitSyncIO } from "../backends/wit/sync-io-model.mjs";
import { generateWitSyncHost } from "../backends/wit/sync-io-host.mjs";
import { guardWitHostSource, witHostDependencyPrelude } from "../backends/wit/host-evidence.mjs";
import { compileWitTaskResources } from "../backends/wit/task-model.mjs";
import { generateWitTaskSession } from "../backends/wit/task-session.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "./native-artifacts.mjs";
import { snapshotWasmtimeCapi } from "./native-wit-projection.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

/**
 * Work inside the producer's private compileHostSources workspace. The SDK
 * is snapshotted; the shared runtime remains a separate verified dependency.
 *
 * @param options - Fresh Lean objects and evidence, pinned toolchains, private workspace and process runner.
 */
export const linkWitHost = async options => {
	const {app,built,runtimeRoot,leanPrefix,run,settings,wasmTools} = options;
	const {entries,api,evidence,objects,env} = built;
	const cc = env.CC ?? "cc", bindingIrSha256 = hashBindingIr(api);
	const tasks=options.tasks===true;
	const model = (tasks ? compileWitTaskResources : compileWitSyncIO)({api,evidence,bindingIrSha256,settings});
	const witCallbacks=tasks && model.methods.some(m=>m.callbacks?.length);
	const save = (path,data)=>writeFile(join(app,path),data,{flag: "wx"});
	if(!/^wasm-tools 1\.245\.1\b/u.test((await run(wasmTools,["--version"],app,env)).stdout)) throw new Error("WIT IO requires wasm-tools 1.245.1");
	await save("world.wit",model.wit); await save("component.wat",model.wat);
	await run(wasmTools,["parse","component.wat","-o","component.wasm"],app,env);
	await run(wasmTools,["validate","--features","component-model","component.wasm"],app,env);
	await run(wasmTools,["component","targets","world.wit","component.wasm"],app,env);
	const componentBytes = await readFile(join(app,"component.wasm"));
	const {identity: runtimeIdentity,manifest} = await readVerifiedNativeRuntime(runtimeRoot);
	if((await run(join(leanPrefix,"bin/lean"),["--githash"],app,env)).stdout.trim()!==manifest.leanCommit)
		throw new Error("WIT IO host requires the compiler matching its Lean runtime");
	const sdk = join(app,"wasmtime"), wasmtimeFiles = await snapshotWasmtimeCapi(options.wasmtimeRoot,sdk);
	const ledger=model.heap?.length?await taskResourceLedger(runtimeIdentity):null;
	if(ledger) await compileTaskResourceLedger({ledger,app,runtimeRoot,cc,run: (command,args,cwd)=>run(command,args,cwd,env)});
	const config = { name: "wit-"+sha256(api.component.id)
		, modules: evidence.selection.exportModules, entries
		, ...ledger?{resources: api.types.filter(type=>type.kind==="resource")}:{}
		, ...witCallbacks?{witCallbacks}:{}
		, synchronousIO: !tasks, witDelivery: tasks, integerMode: "words" };
	const template = generateCTaskExports({...config,componentIdentity: "0".repeat(64)});
	if(template.prefix!==model.prefix || canonicalJson(generateSyncWire(template.prefix,entries,{tasks,resources: config.resources,witCallbacks}))!==canonicalJson(model.wire)) throw new Error("WIT and native entry points disagree");
	const delivery = await nativeDeliveryHeader(false);
	const integers = template.integerMode ? await readFile(new URL("../backends/c/task-integers.h",import.meta.url)) : null;
	const notification=tasks && await readFile(new URL("../backends/native/task-notification.h",import.meta.url));
	const callbackHeaders=witCallbacks?await Promise.all(["c/task-callback-port.h","native/task-callback-queue.h"].map(async path=>[
		path.split("/")[1]
		, await readFile(new URL("../backends/"+path,import.meta.url))
	])):[];
	const host = await (tasks ? generateWitTaskSession : generateWitSyncHost)(model,componentBytes), p = host.prefix;
	const dependencies = ["liblean_bridge_native.so","libleanshared.so","libwasmtime.so"].map(name=>{
		const id = (name==="libwasmtime.so"?wasmtimeFiles:manifest.files)["lib/"+name];
		if(!id || !Number.isSafeInteger(id.bytes) || id.bytes<1 || !/^[a-f0-9]{64}$/u.test(id.sha256)) throw new Error("Missing native WIT IO dependency: "+name);
		return {name,bytes: id.bytes,sha256: id.sha256};
	});
	const brands=host.scopedCursors?"liblb_wit_cursor_brands_v1.so":null;
	if(brands)
	{
		await save("cursor-brands.c",await readFile(new URL("../backends/wit/cursor-brands.c",import.meta.url)));
		await run(cc,["-std=c11","-O1","-g0","-shared","-fPIC","cursor-brands.c","-Wl,--build-id=none,-z,nodelete,-soname,"+brands,"-o",brands],app,env);
		const bytes=await readFile(join(app,brands)); dependencies.push({name: brands,bytes: bytes.length,sha256: sha256(bytes)});
	}
	if(ledger)
	{
		const bytes=await readFile(join(app,ledger.name));
		dependencies.push({name: ledger.name,bytes: bytes.length,sha256: sha256(bytes)});
	}
	const guarded = tasks || host.scopedCursors ? witHostDependencyPrelude(dependencies)+host.source : guardWitHostSource(host.source,p,dependencies);
	const identityInputs = { runtimeIdentity, bindingIrSha256, evidence, template
		, delivery: sha256(delivery), integers: integers && sha256(integers)
		, ...tasks ? {notification: sha256(notification)} : {}
		, ...witCallbacks?{callbackHeaders: Object.fromEntries(callbackHeaders.map(([name,bytes])=>[name,sha256(bytes)]))}:{}
		, wire: sha256(model.wire.source)
		, host: sha256(guarded)
		, header: sha256(host.header)
		, wasmtimeFiles: sha256(canonicalJson(wasmtimeFiles)) };
	const componentIdentity = sha256(canonicalJson(identityInputs));
	const gen = generateCTaskExports({...config,componentIdentity});
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","entry.c","BridgeCAsync.lean"],app,env);
	await save("checked-entry.c",'#include "entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header); await save("adapter.c",gen.source);
	await save("host-wire.c",model.wire.source); await save("task-delivery.h",delivery);
	if(tasks) await save("task-notification.h",notification);
	for(const [name,bytes] of callbackHeaders) await save(name,bytes);
	if(integers) await save("task-integers.h",integers);
	await save(p+"_wasmtime.h",host.header); await save("wit-host.c",guarded);
	const exported = host.symbols ? [...host.symbols] : ["open","call","call_instance","link","close"].map(n=>p+"_wasmtime_"+n);
	exported.push("__lean_bridge_wit_host_process_origin_v1");
	await save("exports.map","{ global: "+exported.join("; ")+"; local: *; };\n");
	const library = "lib"+p+"_wasmtime.so", inc = ["-I",join(sdk,"include"),"-I",join(runtimeRoot,"include")];
	const flags = ["-std=gnu11","-O1","-g0","-fPIC","-ffp-contract=off"
		, ...ledger?[ledger.flag]:[]
		, "-ffile-prefix-map="+app+"=/build/wit-io"
		, "-ffile-prefix-map="+runtimeRoot+"=/build/wit-runtime",...inc];
	// Apply strict diagnostics to the host, not to upstream compiler output.
	await run(cc,[...flags,"-Wall","-Wextra","-Werror","-c","wit-host.c","-o","wit-host.o"],app,env);
	const compiled = ["wit-host.o"];
	for(const source of [...objects,"checked-entry.c","adapter.c","host-wire.c"])
	{
		const object = source.slice(0,-2)+".o";
		await run(cc,[...flags,"-c",source,"-o",object],app,env); compiled.push(object);
	}
	await run(cc,[...flags,"-shared",...compiled
		, "-L",join(runtimeRoot,"lib"),"-L",join(sdk,"lib")
		, ...ledger?["-L.","-l:"+ledger.name]:[]
		, ...brands?["-L.","-l:"+brands]:[]
		, "-lwasmtime","-llean_bridge_native","-lleanshared","-ldl","-lm","-pthread"
		, "-Wl,-Bsymbolic-functions,-z,defs,-z,now,-z,nodelete"
		, "-Wl,--build-id=none","-Wl,--version-script=exports.map"
		, "-Wl,-soname,"+library,"-Wl,-rpath,$ORIGIN","-o",library],app,env);
	const bytes = await readFile(join(app,library)); validateNativeElf(bytes);
	if(bytes.includes(Buffer.from(app)) || (await readVerifiedNativeRuntime(runtimeRoot)).identity!==runtimeIdentity)
		throw new Error("WIT IO host retained a build path or runtime inputs changed");
	return { library, header: p+"_wasmtime.h", prefix: p
		, componentIdentity, runtimeIdentity, bindingIrSha256, dependencies
		, ...ledger?{leaseLibrary: ledger.name}:{}
		, ...brands?{cursorBrands: brands}:{}
		, librarySha256: sha256(bytes),componentSha256: sha256(componentBytes)};
};
