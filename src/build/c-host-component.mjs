/** @file Build a C application-owned reference domain and compiler-checked Lean component. */
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {cHostFacade} from "../backends/c/host-facade.mjs";
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
	if(!ir || contract?.generatedHostModule!=="LeanBridge.Host.C" || !contract.hostImportsSource
		|| contract.taskExports.length || contract.asyncIterators.length || contract.leanResources.length)
		throw new TypeError("Expected synchronous application-owned C host imports");
	const run=(cmd,args,cwd=app,env=environment)=>processBuildRunner.capture({command: cmd,args,cwd,env,signal});
	const save=(name,data)=>writeFile(join(app,name),data,{flag: "wx"});
	const {identity: runtimeIdentity,manifest}=await readVerifiedNativeRuntime(runtimeRoot);
	if((await run(join(leanPrefix,"bin/lean"),["--githash"])).stdout.trim()!==manifest.leanCommit)
		throw new Error("C host requires matching Lean runtime and compiler");
	const checked=await compileHostSources({...o,target: "c",run});
	const model=staticHostMembers(ir,"c");
	const members=emitWordHostMembers(ir,{...model,kinds: model.kinds.map(k=>({...k,strong: k.identity==="strong-canonical"}))},"c");
	const gen=id=>emitWordHostExports({ir,entries: checked.entries,modules: contract.modules,identity: id},members,"c");
	const hashes={};
	const domainInputs=["dotnet/host-domain.c","dotnet/host-domain.h","dotnet/host-frame.h","c/host-registry.h","c/host-registry.c"];
	for(const f of [...domainInputs,"dotnet/host-wire.h","c/task-integers.h","c/host-copied.h"])
	{
		const bytes=await readFile(new URL("../backends/"+f,import.meta.url));
		hashes[f]=sha256(bytes); await save(f.split("/").at(-1),bytes);
	}
	const frame=await wordHostFrame("c"); hashes.frame=sha256(frame); await save("host-frame.c",frame);
	const domainId=sha256(canonicalJson({runtimeIdentity,hashes: Object.fromEntries(domainInputs.map(k=>[k,hashes[k]]))}));
	const domain="liblb_c_host_domain_"+domainId+".so";
	const domainPrefix="lb_cd_"+domainId+"_",refPrefix="lb_cr_"+domainId+"_";
	const base=gen("0".repeat(64));
	const facadeFor=(identity,prefix)=>cHostFacade({ir,entries: checked.entries,model,name: o.name,identity,prefix});
	const publicBase=facadeFor("0".repeat(64),base.prefix);
	const identity=sha256(canonicalJson({
		domainId
		, api: checked.api
		, evidence: checked.evidence
		, hashes
		, publicBase
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
	await run(cc,[...flags,"host-domain.c","host-registry.c",...libs,"-Wl,-soname,"+domain,"-o",domain]);
	await save("BridgeCExports.lean",actual.entryLean); await save("entry-abi.h",actual.header);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","entry.c","BridgeCExports.lean"],app,checked.env);
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
	return {...checked,identity,component,domain,domainId,domainPrefix,refPrefix,runtimeIdentity,binaries,prefix: actual.prefix,publicHeader: facade.header,symbols: facade.symbols,model};
};
