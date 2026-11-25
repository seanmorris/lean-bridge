/** @file Compile synchronous Lean IO into a side module for the existing JavaScript heap. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson,sha256 } from "../capsule/node.mjs";
import { immediateCloseBase, immediateNextBase, javaScriptIOAbi } from "../abi/component-sync-io.mjs";
import { validateJavaScriptWasmControl } from "../abi/component-wasm-control.mjs";
import { compileHostSources } from "./host-elaboration.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { generateOwnedWasmBroker } from "../backends/javascript/owned-wasm-broker.mjs";
import { identifyJavaScriptWasmCompiler, javascriptWasmOwnedPins as pins, javascriptWasmTargetHeaders } from "./javascript-wasm-toolchain.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const magic = 0x4a53494f;
const owner = `#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || defined(__EMSCRIPTEN_PTHREADS__) || !LB_SYNC_ONLY
#error Expected a single-threaded JavaScript wasm32 synchronous component
#endif
static int lb_context(void) { return lean_bridge_native_process_valid(); }
`;
const control = (abi,wire)=>`#include <stdint.h>
#include <stddef.h>
extern void ${wire.clear}(uint64_t *);
${wire.methods.map(m=>m.delivery==="iterator"?`extern int ${m.names.open}(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);
extern int ${m.names.next}(uint64_t *,uint64_t *,uint8_t *);
extern int ${m.names.close}(uint64_t *);`:`extern int ${m.symbol}(const uint64_t *,uint64_t *,uint8_t *);`).join("\n")}
__attribute__((visibility("default"))) uint32_t ${abi.controlSymbol}(uint32_t *f) {
    uintptr_t base=(uintptr_t)f; uint64_t limit=(uint64_t)__builtin_wasm_memory_size(0)*65536u;
    if (!base || base%8 || base+UINT64_C(48)>limit || f[0]!=${magic}u || base+(uint64_t)f[1]>limit) return 5;
    uint64_t *out=(uint64_t *)(f+4), *args=out+4;
    if (f[3]==UINT32_MAX) { ${wire.clear}(out); return 0; }
    switch(f[3]) {
${wire.methods.map((m,i)=>m.delivery==="iterator"?`    case ${i}: {
        if (f[1]!=${48+24*m.args.length+m.tagBytes}) return 5;
        uint64_t h[2]={0}; int s=${m.names.open}(args,h,out,(uint8_t *)(args+${3*m.args.length}));
        if (!s) { out[0]=h[0]; out[1]=h[1]; } return s;
    }
    case ${immediateNextBase+i}u: case ${immediateCloseBase+i}u: {
        if (f[1]!=${96+m.tagBytes} || !args[0] || !args[3] || args[1] || args[2] || args[4] || args[5]) return 5;
        uint64_t h[2]={args[0],args[3]};
        return f[3]==${immediateNextBase+i}u ? ${m.names.next}(h,out,(uint8_t *)(args+6)) : ${m.names.close}(h);
    }`:`    case ${i}: if (f[1]!=${48+24*m.args.length+m.tagBytes}) return 5; return ${m.symbol}(args,out,(uint8_t *)(args+${3*m.args.length}));`).join("\n")}
    default: return 5;
    }
}
`;
const assets = async file=>readFile(new URL("../backends/c/"+file,import.meta.url));

/**
 * The host Lean compiler determines the public IO signature; only pinned
 * browser Lean headers and Emscripten 6.0.6 compile its generated C.
 *
 * @param options - Private output, captured project and verified author tool locations.
 */
export const compileJavaScriptIOComponent = async options=>{
	const {app,projectContract: contract,leanPrefix,emsdkRoot: sdk,leanRuntimeRoot: target,signal} = options;
	if(!contract?.synchronousIO || !Array.isArray(contract.nativeEffects) || contract.nativeEffects.length
		|| contract.ir || contract.hostImportsSourceSha256!==null || [contract.leanResources,contract.asyncIterators,contract.taskExports,contract.taskIOErrors].some(x=>x?.length))
		throw new TypeError("JavaScript synchronous IO requires in-memory nativeEffects: [] without tasks or host imports");
	const env = {...process.env,...options.environment,EMSDK: sdk,EM_CONFIG: join(sdk,".emscripten"),LANG: "C.UTF-8",LC_ALL: "C.UTF-8"};
	for(const key of ["CPATH","C_INCLUDE_PATH","CPLUS_INCLUDE_PATH","OBJC_INCLUDE_PATH","COMPILER_PATH","GCC_EXEC_PREFIX","LIBRARY_PATH","CFLAGS","CPPFLAGS","LDFLAGS","EMCC_CFLAGS","CCC_OVERRIDE_OPTIONS","DEPENDENCIES_OUTPUT","SUNPRO_DEPENDENCIES"]) delete env[key];
	const run = (command,args,cwd=sdk,environment=env)=>processBuildRunner.capture({command,args,cwd,env: environment,signal});
	if((await run(join(leanPrefix,"bin/lean"),["--githash"])).stdout.trim()!==pins.leanCommit
		|| (await readFile(join(target,"source/.lean-wasm-patched"),"utf8")).trim()!==pins.leanCommit+" "+pins.patchSetSha256+" browser") throw new Error("JavaScript IO requires matching pinned host and browser Lean");
	const compiler = await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run});
	const save = (file,bytes)=>writeFile(join(app,file),bytes,{flag: "wx"});
	await mkdir(join(app,"include/lean"),{recursive: true});
	const headers = {};
	for(const name of javascriptWasmTargetHeaders)
	{
		const bytes = await readFile(join(target,"cmake/include/lean",name)); headers[name]=sha256(bytes);
		if(name==="version.h" && !bytes.toString().includes('#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"')) throw new Error("Invalid JavaScript target headers");
		await save("include/lean/"+name,bytes);
	}
	const built = await compileHostSources({...options,ir: null,run,environment: env,target: "npm"});
	const {api,evidence,entries} = built;
	const config = {name: "javascript-wasm-"+sha256(api.component.id),modules: evidence.selection.exportModules,entries,synchronousIO: true,integerMode: "words"};
	const skeleton = generateCTaskExports({...config,componentIdentity: "0".repeat(64)});
	const wire = generateSyncWire(skeleton.prefix,entries,{wasm32: true}), broker = generateOwnedWasmBroker().header;
	const delivery = await assets("task-delivery.h"), integers = await assets("task-integers.h");
	const seed = control(javaScriptIOAbi(api,"0".repeat(64)),wire);
	const componentIdentity = sha256(canonicalJson({evidence
		, compiler
		, headers
		, skeleton
		, owner
		, broker
		, control: sha256(seed)
		, wire: sha256(wire.source)
		, delivery: sha256(delivery)
		, integers: sha256(integers)}));
	const abi = javaScriptIOAbi(api,componentIdentity), gen = generateCTaskExports({...config,componentIdentity});
	for(const [i,m] of wire.methods.entries())
	{
		const d = abi.methods[i];
		if(m.declaration!==api.declarations[i].source.declaration || [m.args,m.result,m.error,m.tagBytes].some((v,j)=>canonicalJson(v)!==canonicalJson([d.args,d.result,d.error,d.tagBytes][j]))) throw new Error("JavaScript IO wire differs from public contract");
		if(Boolean(d.cursor)!==(m.delivery==="iterator") || d.cursor && (m.stepDeclaration!==d.next || canonicalJson(m.terminal)!==canonicalJson(d.terminal) || Boolean(m.stepIO)!==d.stepIO))
			throw new Error("JavaScript immediate pull differs from the compiled protocol");
	}
	await save("BridgeCAsync.lean",gen.entryLean); await run(join(leanPrefix,"bin/lean"),["-j1","-c","entry.c","BridgeCAsync.lean"],app,built.env);
	await save("checked.c",'#include "entry.c"\n'+gen.declarations+"\n"); await save(gen.prefix+".h",gen.header);
	await save("adapter.c",gen.source); await save("wire.c",wire.source); await save("control.c",control(abi,wire));
	await save("task-delivery.h",delivery); await save("task-integers.h",integers); await save("task-owner-policy.h",owner);
	await save("lean_bridge_native_runtime.h",broker);
	const emcc=join(sdk,"upstream/emscripten/emcc"),objects=[];
	for(const file of [...built.objects,"checked.c","adapter.c","wire.c","control.c"])
	{
		const o = file.slice(0,-2)+".o"; objects.push(o);
		await run(emcc,["-O2","-g0","-fPIC","-fvisibility=hidden","-fwasm-exceptions","-DLEAN_EMSCRIPTEN","-ffp-contract=off","-I.","-Iinclude","-ffile-prefix-map="+app+"=/build/js-io","-c",file,"-o",o],app);
	}
	await run(emcc,["-O2","-g0","-fwasm-exceptions","-sSIDE_MODULE=2","-Wl,--no-entry","-Wl,--export="+abi.controlSymbol,...objects,"-o","component.wasm"],app);
	const binary = await readFile(join(app,"component.wasm")); await validateJavaScriptWasmControl(binary,abi.controlSymbol,false);
	if(canonicalJson(compiler)!==canonicalJson(await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run}))) throw new Error("JavaScript compiler changed during IO build");
	return {api,evidence,abi,integrity: sha256(binary),binary};
};
