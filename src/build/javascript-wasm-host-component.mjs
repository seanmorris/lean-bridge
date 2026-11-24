/** @file Compile checked host-object exports and their shared wasm32 identity broker. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { javaScriptHostBrokerSymbols as brokerSymbols, validateJavaScriptHostModules } from "../abi/component-host-io.mjs";
import { generateJavaScriptHostExports } from "../backends/javascript/host-wasm-exports.mjs";
import { compileHostSources } from "./host-elaboration.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { identifyJavaScriptWasmCompiler, javascriptWasmOwnedPins as pins, javascriptWasmTargetHeaders } from "./javascript-wasm-toolchain.mjs";

const sources=["host-wasm-domain.c","host-wasm-domain.h","host-wasm-errors.h","host-wasm-public.h","host-wasm-wire.h"];
/**
 * Use fresh host Lean elaboration and checked target headers. No native host
 * program or local compiler is ever shipped to a consumer.
 *
 * @param o - Captured author project, checked SDK directories and private output.
 */
export const compileJavaScriptHostComponent = async o => {
	const {app,projectContract: c,leanPrefix,emsdkRoot: sdk,leanRuntimeRoot: target,signal}=o;
	if(!c?.ir || c.generatedHostModule!=="LeanBridge.Host.Javascript" || c.hostImportsSourceSha256!==sha256(c.hostImportsSource??"")
		|| !Array.isArray(c.nativeEffects) || c.nativeEffects.length || [c.leanResources,c.taskExports,c.taskIOErrors,c.asyncIterators].some(x=>x?.length))
		throw new TypeError("Expected synchronous JavaScript host imports and no worker or native OS effects");
	const env={...process.env,...o.environment,EMSDK: sdk,EM_CONFIG: join(sdk,".emscripten"),EMCC_CORES: "1",LANG: "C.UTF-8",LC_ALL: "C.UTF-8"};
	for(const k of ["CPATH","C_INCLUDE_PATH","CPLUS_INCLUDE_PATH","OBJC_INCLUDE_PATH","COMPILER_PATH","GCC_EXEC_PREFIX","LIBRARY_PATH","CFLAGS","CPPFLAGS","LDFLAGS","EMCC_CFLAGS","CCC_OVERRIDE_OPTIONS","DEPENDENCIES_OUTPUT","SUNPRO_DEPENDENCIES"]) delete env[k];
	const run=(command,args,cwd=sdk,environment=env)=>processBuildRunner.capture({command,args,cwd,env: environment,signal});
	const lean=join(leanPrefix,"bin/lean"), emcc=join(sdk,"upstream/emscripten/emcc");
	if((await run(lean,["--githash"])).stdout.trim()!==pins.leanCommit
		|| (await readFile(join(target,"source/.lean-wasm-patched"),"utf8")).trim()!==pins.leanCommit+" "+pins.patchSetSha256+" browser")
		throw new Error("JavaScript host imports require pinned Lean and matching wasm32 target headers");
	const compiler=await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run}), inputs={};
	const save=(file,bytes)=>writeFile(join(app,file),bytes,{flag: "wx"});
	const asset=async (file,bytes)=>{inputs[file]=sha256(bytes);await save(file,bytes);};
	await mkdir(join(app,"include/lean"),{recursive: true});
	for(const name of javascriptWasmTargetHeaders)
	{
		const bytes=await readFile(join(target,"cmake/include/lean",name));
		if(name==="version.h" && !bytes.toString().includes('#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"')) throw new Error("Invalid Wasm target headers");
		await asset("include/lean/"+name,bytes);
	}
	for(const f of sources) await asset(f,await readFile(new URL("../backends/javascript/"+f,import.meta.url)));
	await asset("component_scalar.h",await readFile(new URL("../../poc/lean-link-spike/component_scalar.h",import.meta.url)));
	const built=await compileHostSources({...o,ir: c.ir,run,environment: env,target: "npm"});
	const {api,evidence}=built, modules=evidence.selection.exportModules;
	const emit=identity=>generateJavaScriptHostExports({api,hosts: c.ir,identity,modules});
	const flags=["-O2","-g0","-fPIC","-fvisibility=hidden","-fwasm-exceptions","-DLEAN_EMSCRIPTEN","-ffp-contract=off","-I.","-Iinclude"];
	const link=["-O2","-g0","-fwasm-exceptions","-sSIDE_MODULE=2","-Wl,--no-entry"];
	const identity=sha256(canonicalJson({compiler,evidence,inputs,skeleton: emit("0".repeat(64)),flags,link,brokerSymbols}));
	const gen=emit(identity), iface=evidence.interfaces.findIndex(f=>f.module===c.generatedHostModule);
	if(iface<0 || sha256(await readFile(join(app,built.objects[iface])))!==evidence.interfaces[iface].cSha256) throw new Error("Checked JavaScript host C module missing");
	await save(gen.module+".lean",gen.entryLean);await run(lean,["-j1","-c","entry.c",gen.module+".lean"],app,built.env);
	await save("renames.h",gen.imports.renames);await save("members.c",'#include "'+built.objects[iface]+'"\n'+gen.imports.source+gen.imports.service);
	await save("checked.c",'#include "entry.c"\n'+gen.header);await save("control.c",gen.control);
	const objects=[];
	for(const file of [...built.objects.filter((_,i)=>i!==iface),"members.c","checked.c","control.c","host-wasm-domain.c"])
	{
		const obj=file.slice(0,-2)+".o", broker=file==="host-wasm-domain.c";
		await run(emcc,[...flags,"-ffile-prefix-map="+app+"=/build/js-host",...broker?[]:["-include","renames.h"],"-c",file,"-o",obj],app);
		if(!broker) objects.push(obj);
	}
	await run(emcc,[...link,"-Wl,--export="+gen.abi.controlSymbol,...objects,"-o","component.wasm"],app);
	await run(emcc,[...link,...brokerSymbols.map(s=>"-Wl,--export="+s),"host-wasm-domain.o","-o","host-domain.wasm"],app);
	const binary=await readFile(join(app,"component.wasm")),broker=await readFile(join(app,"host-domain.wasm"));
	await validateJavaScriptHostModules(binary,broker,gen.abi);
	if(canonicalJson(compiler)!==canonicalJson(await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run}))) throw new Error("JavaScript host compiler changed during build");
	return {api,evidence,compiler,inputs,abi: gen.abi,model: gen.imports.model,binary,integrity: sha256(binary),broker,brokerIntegrity: sha256(broker)};
};
