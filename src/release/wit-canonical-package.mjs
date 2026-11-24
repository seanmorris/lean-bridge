/** @file Ship an independently runnable WIT application world and its Lean future scheduler. */
import {mkdir,readFile,readdir,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {validateNativeElf} from "../build/native-artifacts.mjs";
import {canonicalAppModel,canonicalNativeHooks,splitCanonicalTemplate} from "../backends/wit/canonical-app.mjs";
import {createDeterministicTarGzFromFiles} from "./deterministic-archive.mjs";
import {writePackageSetReceipt} from "./package-set-receipt.mjs";

const profile="native-wit-canonical-task-v1",target="wit-wasi";
const sdkIdentity={version: "51.0.0",archiveSha256: "515694e57d8b376f536280a7343a69b976e83d1ce6fb57bdb87c658b18b356d3",filesSha256: "e2cc848e0b52c352d56296e2606934abf65fe3111ec3aba46ccc371b1af56c49"};
const asset=path=>readFile(new URL(path,import.meta.url));
const digest=b=>({bytes: b.length,sha256: sha256(b)});
const snapshotSdk=async(from,to)=>{
	if(!from) throw new Error("Set LEAN_BRIDGE_ASYNC_WASMTIME_C_API to the Wasmtime 51.0.0 Linux x86-64 C SDK");
	const root=resolve(from),files=new Map(),inventory={};
	const visit=async sub=>{
		for(const item of await readdir(join(root,sub),{withFileTypes: true}))
		{
			const path=join(sub,item.name);
			if(item.isDirectory()) await visit(path);else if(item.isFile() && path.endsWith(".h")) files.set(path,await readFile(join(root,path)));
		}
	};
	await visit("include");
	for(const path of ["LICENSE","lib/libwasmtime.so"]) files.set(path,await readFile(join(root,path)));
	for(const [path,b] of files) inventory[path]=digest(b);
	if(sha256(canonicalJson(inventory))!==sdkIdentity.filesSha256) throw new Error("Canonical Wasmtime SDK differs from the pinned v51 archive");
	for(const [path,b] of files)
	{
		const dest=join(to,path);await mkdir(dirname(dest),{recursive: true});await writeFile(dest,b,{flag: "wx"});
	}
	return files;
};

/**
 * Create the opt-in canonical task archive. The original host elaboration is
 * reused; no function type or native symbol is accepted from a separate manifest.
 *
 * @param o - Compiler evidence, validated native binaries and release staging.
 */
export const writeCanonicalWitRelease=async o=>{
	const {app,prefix,run,api,evidence,gen,environment,files,projectContract,name,version,floor,entries,manifest,runtimeIdentity,bindingIrSha256}=o;
	const model=canonicalAppModel({api,entries,prefix,name,version}),sdk=join(app,"canonical-sdk");
	const sdkFiles=await snapshotSdk(environment.LEAN_BRIDGE_ASYNC_WASMTIME_C_API,sdk);
	const sdkLib=sdkFiles.get("lib/libwasmtime.so");files.set("lib/libwasmtime.so",sdkLib);
	const save=(name,b)=>writeFile(join(app,name),b,{flag: "wx"});
	const tools=environment.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	if(!/^wasm-tools 1\.245\.1\b/u.test((await run(tools,["--version"],app)).stdout)) throw new Error("Canonical WIT requires wasm-tools 1.245.1");
	await save("application.wit",model.wit);await save("canonical.wat",model.wat);
	await save("guest-contract.wat",model.guestContract);
	await run(tools,["component","targets","application.wit","guest-contract.wat"],app);
	await run(tools,["parse","canonical.wat","-o","canonical.wasm"],app);
	await run(tools,["validate","--features","cm-async,cm-async-builtins","canonical.wasm"],app);
	const template=await readFile(join(app,"canonical.wasm")),[head,tail]=splitCanonicalTemplate(template);
	const embed=(name,b)=>"static const uint8_t "+name+"[]={"+[...b].join(",")+"};\n";
	const hooks=canonicalNativeHooks(model),driver=await asset("../backends/wit/canonical-command.c"),reactor=await asset("../backends/wit/canonical-future-reactor.h");
	await save("package.h",'#include "'+prefix+'.h"\n#define LB_SLOTS 64\n#define LB_METHODS '+model.channels.length+"\n"+embed("template_head",head)+embed("template_tail",tail));
	await save("canonical-hooks.h",hooks);await save("canonical-command.c",driver);await save("canonical-future-reactor.h",reactor);
	const binary=name+"-run";
	await run(environment.CC??"cc",["-std=c11","-O1","-g0"
		, "-Wall","-Wextra","-Werror"
		, "-ffile-prefix-map="+app+"=/build/canonical-wit"
		, "canonical-command.c"
		, "-I"+join(sdk,"include")
		, "-L."
		, "-L"+join(sdk,"lib")
		, "-Wl,-rpath-link,"+join(o.runtimeRoot,"lib")
		, "-l"+prefix
		, "-lwasmtime"
		, "-Wl,-z,now,--build-id=none,-rpath,$ORIGIN/../lib"
		, "-o"
		, binary],app);
	const command=await readFile(join(app,binary));validateNativeElf(command);validateNativeElf(sdkLib);
	for(const path of [join(app,binary),join(sdk,"lib/libwasmtime.so")])
	{
		for(const m of (await run("readelf",["--version-info",path],app)).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
            if(+m[1]>2 || (+m[1]===2 && (+m[2]>+floor.slice(2) || (+m[2]===+floor.slice(2) && +m[3]>0)))) throw new Error("Canonical WIT library exceeds glibc "+floor);
	}
	if(command.includes(Buffer.from(o.workRoot))) throw new Error("Canonical WIT command retained private staging path");
	files.set("bin/"+binary,command);files.set("wit/application.wit",model.wit);
	const share="share/lean-bridge";
	files.set(share+"/binding-ir.json",canonicalJson(api));files.set(share+"/elaboration.json",canonicalJson(evidence));
	files.set(share+"/runtime.json",canonicalJson(manifest));files.set(share+"/generated.lean",gen.entryLean);
	files.set(share+"/licenses/Wasmtime-LICENSE",sdkFiles.get("LICENSE"));
	files.set(share+"/licenses/LeanBridge-LICENSE",await asset("../../LICENSE"));
	for(const f of ["LICENSE","LICENSES"]) files.set(share+"/licenses/Lean-"+f,await readFile(join(o.leanPrefix,f)));
	for(const [path,bytes] of Object.entries(projectContract.notices)) files.set(share+"/licenses/"+path,bytes);
	const review=projectContract.review;
	if(review)
	{
		if(review.sha256!==evidence.reviewedSourceSha256 || sha256(review.source)!==review.sha256 || review.semanticSha256!==bindingIrSha256) throw new Error("Canonical WIT review differs from compiled source");
		files.set(share+"/reviewed.binding-ir.json",review.source);
	}
	files.set("package-metadata.json",canonicalJson(projectContract.metadata??{}));
	files.set("README.md","# "+name+" "+version+"\n\nExtract the whole archive. Build a Wasm component for wit/application.wit, then run `bin/"+binary+" /path/to/application.wasm`. The command prints the signed 64-bit result of the guest’s async run export. The guest imports Lean functions by their WIT names and uses canonical futures and streams. No SDK, scheduler hooks or Lean compiler are needed at runtime. Linux x86-64, glibc "+floor+" or later.\n\nEach factory permits 64 outstanding operations. Results remain pinned until read or abandoned. A cursor pulls only on stream demand; dropping its reader closes the cursor. If next fails, the stream sends one typed error frame and ends. A returned Except is an ordinary item. Exiting the application closes remaining Lean owners; it does not promise to stop Lean worker computation. Factory failure is the outer WIT result; selected worker IO failures are inside the future. An ordinary returned Except is a value. Strings use UTF-8. ByteArray values use list<u8> and keep all bytes, including NUL. String and byte arguments share a 16 MiB limit per call. Numeric, Boolean, Char and nested result values are supported. No WASI or host capabilities are linked.\n");
	const records=[...files].map(([path,v])=>({path,bytes: Buffer.from(v),mode: path==="bin/"+binary?0o755:0o644}));
	const componentIdentity=sha256(canonicalJson({nativeIdentity: o.nativeIdentity
		, template: sha256(template)
		, hooks: sha256(hooks)
		, driver: sha256(driver)
		, reactor: sha256(reactor)
		, command: sha256(command)
		, wasmtime: sdkIdentity}));
	const inner={schemaVersion: 1
		, kind: "lean-bridge-wit-canonical-task-package"
		, profile,name,version
		, component: api.component,componentIdentity
		, runtimeIdentity
		, bindingIrSha256
		, glibcMinimumVersion: floor
		, wasmtime: sdkIdentity
		, command: "bin/"+binary
		, world: "wit/application.wit"
		, ...(review?{reviewedSourceSha256: review.sha256}:{})
		, files: Object.fromEntries(records.map(f=>[f.path,digest(f.bytes)]))};
	records.push({path: "lean-bridge-package.json",mode: 0o644,bytes: Buffer.from(canonicalJson(inner))});
	const base=name+"-"+version+"-wit-wasi",archive=base+".tar.gz";
	const packed=createDeterministicTarGzFromFiles({sourceDateEpoch: 1,files: records.map(f=>({...f,path: base+"/"+f.path}))});
	await writeFile(join(o.output,archive),packed,{flag: "wx"});
	const receipt=await writePackageSetReceipt({root: o.workRoot
		, component: api.component
		, source: {treeSha256: projectContract.sourceTreeSha256}
		, profiles: [{id: profile,bindingIrSha256,runtimeIdentity}],signal: o.signal
		, packages: [{target,ecosystem: target,name,version,profile,role: "component",runtimeIdentity,runtimeDelivery: "embedded",requires: [],artifacts: [{path: "archives/"+archive,...digest(packed)}]}]});
	return {receipt,api,evidence,bindingIrSha256,runtimeIdentity};
};
