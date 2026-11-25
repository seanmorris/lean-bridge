/** @file Build a C application-owned reference domain and compiler-checked Lean component. */
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {cHostFacade} from "../backends/c/host-facade.mjs";
import {cppHostFacade} from "../backends/cpp/host-facade.mjs";
import {staticHostMembers} from "../backends/native/static-host-members.mjs";
import {emitWordHostMembers} from "../backends/native/word-host-members.mjs";
import {emitWordHostExports} from "../backends/native/word-host-exports.mjs";
import {wordHostFrame} from "../backends/native/word-host-frame.mjs";
import {compileHostSources} from "./host-elaboration.mjs";
import {readVerifiedNativeRuntime,validateNativeElf} from "./native-artifacts.mjs";
import {processBuildRunner} from "./process-runner.mjs";

/**
 * Compile the application and its generated members against one shared reference
 * store. Component-local statics must never be used for cross-component identity.
 *
 * @param o - Captured Lake inputs, private work directory and verified SDK.
 */
export const compileCHostComponent=async o=>{
	const {app,ir,projectContract: contract,runtimeRoot,leanPrefix,environment,signal}=o;
	const target=o.target??"c",cpp=target==="cpp",lang=cpp?"Cpp":"C";
	if(!["cpp","c"].includes(target) || !ir || contract?.generatedHostModule!=="LeanBridge.Host."+lang || !contract.hostImportsSource
		|| contract.taskExports.length || contract.asyncIterators.length || contract.leanResources.length)
		throw new TypeError("Expected synchronous application-owned C host imports");
	const run=(cmd,args,cwd=app,env=environment)=>processBuildRunner.capture({command: cmd,args,cwd,env,signal});
	const save=(name,data)=>writeFile(join(app,name),data,{flag: "wx"});
	const {identity: runtimeIdentity,manifest}=await readVerifiedNativeRuntime(runtimeRoot);
	if((await run(join(leanPrefix,"bin/lean"),["--githash"])).stdout.trim()!==manifest.leanCommit)
		throw new Error("C host requires matching Lean runtime and compiler");
	const checked=await compileHostSources({...o,target,run});
	const model=staticHostMembers(ir,target);
	const members=emitWordHostMembers(ir,{...model,kinds: model.kinds.map(k=>({...k,strong: k.identity==="strong-canonical"}))},target);
	const gen=id=>emitWordHostExports({ir,entries: checked.entries,modules: contract.modules,identity: id},members,target);
	const hashes={};
	const domainInputs=["dotnet/host-domain.c","dotnet/host-domain.h","dotnet/host-frame.h","c/host-registry.h","c/host-registry.c"];
	if(cpp) domainInputs.push("cpp/host-shared.cpp","cpp/host-shared.hpp");
	const support={};
	for(const f of [...domainInputs,"dotnet/host-wire.h","c/task-integers.h","c/host-copied.h",...cpp?["cpp/host-binding.hpp","cpp/sync-values.hpp"]:[]])
	{
		const bytes=await readFile(new URL("../backends/"+f,import.meta.url));
		hashes[f]=sha256(bytes); await save(f.split("/").at(-1),bytes);
		if(cpp && ["cpp/host-binding.hpp","cpp/sync-values.hpp"].includes(f)) support["lean_bridge/sync_v1/"+f.slice(4)]=bytes;
	}
	const frame=await wordHostFrame(target); hashes.frame=sha256(frame); await save("host-frame.c",frame);
	let abi=null;
	const cxx=environment.CXX??"c++";
	if(cpp)
	{
		await save("stdlib.cpp","#include <memory>\n");
		const macros=(await run(cxx,["-std=c++20","-dM","-E","stdlib.cpp"])).stdout;
		abi=Object.fromEntries(["__GLIBCXX__","_GLIBCXX_USE_CXX11_ABI","__GXX_ABI_VERSION","__SIZEOF_POINTER__"].map(k=>{
			const value=macros.match(new RegExp("^#define "+k+" ([0-9]+)$","mu"))?.[1];
			if(!value) throw new Error("Unsupported C++ host standard library ABI: "+k);
			return [k,value];
		}));
	}
	const domainId=sha256(canonicalJson({runtimeIdentity,...cpp?{abi}:{},hashes: Object.fromEntries(domainInputs.map(k=>[k,hashes[k]]))}));
	const domain="liblb_"+target+"_host_domain_"+domainId+".so";
	const domainPrefix="lb_cd_"+domainId+"_",refPrefix="lb_cr_"+domainId+"_";
	const base=gen("0".repeat(64));
	const ownerPrefix="lb_cs_"+domainId+"_";
	const facadeFor=(identity,prefix)=>cHostFacade({ir,entries: checked.entries,model,name: cpp?"lb_cpp_detail_"+identity:o.name,identity,prefix,cpp});
	const wrapper=(identity,facade)=>cppHostFacade({ir,entries: checked.entries,model,name: o.name,identity,facade,ownerPrefix,abi});
	const publicBase=facadeFor("0".repeat(64),base.prefix);
	const identity=sha256(canonicalJson({
		domainId
		, api: checked.api
		, evidence: checked.evidence
		, hashes
		, publicBase
		, ...cpp?{cppHeader: wrapper("0".repeat(64),publicBase)}:{}
		, header: base.header
		, source: base.source
		, entry: base.entryLean
		, name: o.name
		, version: o.version
	}));
	const actual=gen(identity), component="lib"+actual.prefix+".so";
	const facade=facadeFor(identity,actual.prefix);
	const cc=environment.CC??"cc";
	const flags=["-std=gnu11","-O1","-g0","-shared","-fPIC","-fvisibility=hidden","-Werror=implicit-function-declaration","-Werror=incompatible-pointer-types","-DLB_C_REF_PREFIX="+refPrefix,"-DLB_DN_DOMAIN_PREFIX="+domainPrefix,"-I"+join(leanPrefix,"include"),"-I"+join(runtimeRoot,"include"),"-ffile-prefix-map="+app+"=/build/lean-bridge/c-host"];
	const libs=["-L"+join(runtimeRoot,"lib"),"-lleanshared","-Wl,-z,defs,-z,nodelete","-Wl,--build-id=none","-Wl,-rpath,$ORIGIN"];
	if(cpp)
	{
		for(const file of ["host-domain","host-registry"]) await run(cc,[...flags.filter(x=>x!=="-shared"),"-c",file+".c","-o",file+".o"]);
		await run(cxx,["-std=c++20","-O1","-g0","-shared","-fPIC","-fvisibility=hidden","-DLB_C_REF_PREFIX="+refPrefix,"-DLB_CPP_OWNER_PREFIX="+ownerPrefix,"host-shared.cpp","host-domain.o","host-registry.o",...libs,"-Wl,-soname,"+domain,"-o",domain]);
	}
	else await run(cc,[...flags,"host-domain.c","host-registry.c",...libs,"-Wl,-soname,"+domain,"-o",domain]);
	const entryFile="Bridge"+lang+"Exports.lean";
	await save(entryFile,actual.entryLean); await save("entry-abi.h",actual.header);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","entry.c",entryFile],app,checked.env);
	const units=[];
	for(const [i,obj] of [...checked.objects,"entry.c"].entries())
	{
		const unit="checked"+i+".c"; await save(unit,'#include "'+obj+'"\n#include "entry-abi.h"\n'); units.push(unit);
	}
	await save("public.h",facade.header);
	await save("provider.c",actual.source+"\n"+facade.source);
	await save("public.map","{ global: "+facade.symbols.join("; ")+"; local: *; };\n");
	await run(cc,[...flags,...units,"provider.c","host-frame.c","-L.","-l:"+domain,...libs,"-llean_bridge_native","-Wl,--version-script=public.map","-Wl,-soname,"+component,"-o",component]);
	const binaries={};
	for(const lib of [component,domain])
	{
		const bytes=await readFile(join(app,lib)); validateNativeElf(bytes); binaries[lib]=sha256(bytes);
	}
	return {...checked,identity,component,domain,domainId,domainPrefix,refPrefix,runtimeIdentity,binaries,prefix: actual.prefix,publicHeader: cpp?wrapper(identity,facade):facade.header,symbols: facade.symbols,model,...cpp?{support,abi}:{}};
};
