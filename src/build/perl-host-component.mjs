/** @file Build the Perl-independent Lean component once, before compiling any Perl XS. */
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {hashBindingIr} from "../binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {generatePerlHostExports} from "../backends/perl/host-exports.mjs";
import {validatePerlIOSettings} from "../backends/perl/sync-io.mjs";
import {compileHostSources} from "./host-elaboration.mjs";
import {readVerifiedNativeRuntime,validateNativeElf} from "./native-artifacts.mjs";
import {perlHostTaskKernel,stagePerlHostTasks} from "./perl-host-task-kernel.mjs";
import {processBuildRunner} from "./process-runner.mjs";

/**
 * Load the XS sources and add lexical worker cleanup only for mixed packages.
 *
 * @param worker - Include the owner-only worker ingress and shutdown hook.
 * @param functions - Include lexical revocation for returned functions over host objects.
 */
export const perlHostHeaders = async (worker=null,functions=false) => {
	const headers={};
	for(const f of ["host-frame.h","host-scope.h","host-wire.h","sync-wire.h","host-domain.h"])
		headers[f]=await readFile(new URL("../backends/perl/"+f,import.meta.url));
	if(functions)
	{
		headers["host-functions.h"]=await readFile(new URL("../backends/perl/host-functions.h",import.meta.url));
		// Sweep the releasing scope even when another package still uses the
		// same nominal kind. Unbinding alone only frees its last kind owner.
		const retire="\n  ENTER; SAVETMPS; lbp_host_enter(aTHX_ ph_session); phf_retire(); FREETMPS; LEAVE;";
		const hooks=[["static SV *ph_slots;",'\n#include "host-functions.h"'],["ph_slots=SvREFCNT_inc(slots);"," phf_accepting=1;"],["SV *slots=ph_slots; ph_slots=NULL;",retire]];
		let scope=headers["host-scope.h"].toString();
		for(const [hook,extra] of hooks)
		{
			if(scope.split(hook).length!==2)throw new Error("Perl function owner hook differs from its checked scope");
			scope=scope.replace(hook,hook+extra);
		}
		headers["host-scope.h"]=Buffer.from(scope);
	}
	if(worker)
	{
		headers["task-wire.h"]=worker.assets.header;
		headers["host-worker-xs.h"]=await readFile(new URL("../backends/perl/host-worker-xs.h",import.meta.url));
		const scope=headers["host-scope.h"].toString(), decl="static SV *ph_slots;", hook="SAVEDESTRUCTOR_X(ph_unbind_scope,(void *)(intptr_t)getpid());";
		if(scope.split(decl).length!==2 || scope.split(hook).length!==2) throw new Error("Perl worker binding hook differs from its checked scope");
		headers["host-scope.h"]=Buffer.from(scope.replace(decl,decl+'\n#include "host-worker-xs.h"')
			.replace(hook,hook+'\n  SSGROW(4); if (PHW_BEGIN()!=0) croak("Perl worker scope unavailable");\n  SAVEDESTRUCTOR_X(phw_end,(void *)(intptr_t)getpid()); phw_accepting=1;'));
	}
	return headers;
};

/**
 * Bind the generated program, checked source, coordinates and runtime before linking.
 *
 * @param options - Projected component inputs.
 * @param options.ir - Validated host contract.
 * @param options.entries - Compiler-selected public functions.
 * @param options.modules - Lean modules containing the entry functions.
 * @param options.name - CPAN namespace.
 * @param options.version - CPAN distribution version.
 * @param options.api - Compiler-derived public binding IR.
 * @param options.evidence - Inputs and observations from elaboration.
 * @param options.runtimeIdentity - Pinned native runtime.
 * @param headers - Private XS sources whose behavior contributes to the component identity.
 * @param worker - Optional independently generated class-bearing worker kernel.
 */
export const perlHostComponentIdentity = ({ir,entries,modules,name,version,api,evidence,runtimeIdentity},headers,worker=null) => {
	const source=generatePerlHostExports({ir,entries: entries.filter(e=>!e.delivery),modules,name,identity: "0".repeat(64),worker});
	const headerHashes=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,sha256(v)]));
	return sha256(canonicalJson({schemaVersion: 1,ir,api,evidence,name,version,runtimeIdentity,source,headerHashes,...worker?{worker: worker.fingerprint}:{} }));
};

/**
 * Check the discovered C ABI in the compiler's own translation units. No
 * Perl executable, headers, or development library is used to link this ELF.
 *
 * @param o - Captured project, pinned native SDK, coordinates and private work root.
 */
export const compilePerlHostComponent = async o => {
	const {ir,projectContract,name,version,leanPrefix,runtimeRoot,workRoot,environment=process.env,signal}=o;
	validatePerlIOSettings({name,version});
	const mixed=Boolean(projectContract.taskExports?.length || projectContract.asyncIterators?.length);
	if(!ir || projectContract.leanResources?.length)
		throw new TypeError("Perl host imports require a host contract without Lean-owned resources");
	const app=await mkdtemp(join(workRoot,".perl-host-")), run=(command,args,cwd=app,env=environment)=>processBuildRunner.capture({command,args,cwd,env,signal});
	try
	{
		const {identity: runtimeIdentity}=await readVerifiedNativeRuntime(runtimeRoot);
		const checked=await compileHostSources({...o,app,target: "cpan",environment,run});
		const {entries,objects,evidence,api,env}=checked;
		const options={ir,entries,modules: projectContract.modules,name,version,api,evidence,runtimeIdentity};
		const kernel=mixed?await perlHostTaskKernel({...options,checked}):null;
		const headers=await perlHostHeaders(kernel,entries.some(e=>e.result.kind==="io-closure")), componentIdentity=perlHostComponentIdentity(options,headers,kernel);
		const generated=generatePerlHostExports({...options,entries: entries.filter(e=>!e.delivery),identity: componentIdentity,worker: kernel});
		const library="liblbc_perl_"+sha256(name)+".so";
		const save=(p,s)=>writeFile(join(app,p),s,{flag: "wx"});
		await save("ph-interface.h",generated.interfaceHeader); await save("ph-lean.h",generated.leanHeader);
		await save("BridgePerlExports.lean",generated.entryLean); await save("component.c",generated.component);
		const scopeOps=["begin","end","create","borrow","release"];
		const symbols=[...generated.symbols,...kernel?[...kernel.wire.symbols,...scopeOps.map(n=>kernel.scope+n)]:[]];
		await save("exports.map","{global: "+symbols.join("; ")+"; local: *;};\n");
		await run(join(leanPrefix,"bin/lean"),["-j1","-R",app,"-c","exports.c","BridgePerlExports.lean"],app,env);
		const cc=environment.CC??"cc";
		const units=kernel?await stagePerlHostTasks({kernel,identity: componentIdentity,save,run,app,cc,leanPrefix,runtimeRoot,env}):[];
		for(const [i,f] of [...objects,"exports.c"].entries())
		{
			const file="checked"+i+".c"; units.push(file);
			await save(file,'#include "'+f+'"\n#include "ph-lean.h"\n#include "ph-interface.h"\n');
		}
		await run(cc,["-O2","-g0","-fPIC","-shared","-pthread"
			, "-Werror=implicit-function-declaration"
			, "-Werror=incompatible-pointer-types"
			, "-ffile-prefix-map="+resolve(app)+"=/build/lean-bridge/component"
			, "-ffile-prefix-map="+resolve(runtimeRoot)+"=/lean-bridge/runtime"
			, "-I"+join(runtimeRoot,"include")
			, ...kernel?[kernel.flag,kernel.ledger.flag]:[]
			, ...units
			, "component.c"
			, "-L"+join(runtimeRoot,"lib")
			, "-Wl,--build-id=none"
			, "-Wl,-z,defs"
			, "-Wl,-z,nodelete"
			, "-Wl,-soname,"+library
			, "-Wl,--version-script=exports.map"
			, "-llean_bridge_native"
			, ...kernel?["-L.","-l:"+kernel.ledger.name]:[]
			, "-lleanshared"
			, "-o"
			, library]);
		const bytes=await readFile(join(app,library)); validateNativeElf(bytes);
		const dynamic=(await run("readelf",["-d",library])).stdout, needed=[...dynamic.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(m=>m[1]);
		const required=["libleanshared.so","liblean_bridge_native.so",...kernel?[kernel.ledger.name]:[]];
		if(!required.every(n=>needed.includes(n))
			|| needed.some(n=>![...required,"ld-linux-x86-64.so.2","libc.so.6"].includes(n))
			|| !dynamic.includes("Library soname: ["+library+"]") || /\((?:RPATH|RUNPATH)\)/u.test(dynamic)
			|| [resolve(app),resolve(runtimeRoot),resolve(leanPrefix)].some(path=>bytes.includes(Buffer.from(path)))) throw new Error("Non-portable Perl host component");
		const syms=(await run("nm",["-D","--defined-only",library])).stdout.trim().split("\n").map(l=>l.trim().split(/\s+/u).at(-1)).sort();
		if(canonicalJson(syms)!==canonicalJson([...symbols].sort())) throw new Error("Unexpected Perl host component symbol surface");
		const floor=environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR??"2.38";
		if(!/^2\.\d+$/u.test(floor)) throw new Error("Invalid Perl host glibc floor");
		for(const m of (await run("readelf",["--version-info",library])).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(+m[1]>2 || (+m[1]===2 && (+m[2]>+floor.slice(2) || (+m[2]===+floor.slice(2) && +m[3]>0)))) throw new Error("Perl host component exceeds glibc "+floor);
		const ledgerBytes=kernel?await readFile(join(app,kernel.ledger.name)):null;
		if(ledgerBytes) validateNativeElf(ledgerBytes);
		return {...options,...kernel?{kernel,ledgerBytes}:{},componentIdentity,bindingIrSha256: hashBindingIr(api),library,bytes,generated,headers};
	} finally
	{ await rm(app,{recursive: true,force: true}); }
};
