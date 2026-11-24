/** @file Build the Perl-independent Lean component once, before compiling any Perl XS. */
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {hashBindingIr} from "../binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {generatePerlHostExports} from "../backends/perl/host-exports.mjs";
import {validatePerlIOSettings} from "../backends/perl/sync-io.mjs";
import {compileHostSources} from "./host-elaboration.mjs";
import {readVerifiedNativeRuntime,validateNativeElf} from "./native-artifacts.mjs";
import {processBuildRunner} from "./process-runner.mjs";

/** Files consumed by the compiled XS, including the shared registry's private ABI. */
export const perlHostHeaders = async () => {
	const headers={};
	for(const f of ["host-frame.h","host-scope.h","host-wire.h","sync-wire.h","host-domain.h"])
		headers[f]=await readFile(new URL("../backends/perl/"+f,import.meta.url));
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
 */
export const perlHostComponentIdentity = ({ir,entries,modules,name,version,api,evidence,runtimeIdentity},headers) => {
	const source=generatePerlHostExports({ir,entries,modules,name,identity: "0".repeat(64)});
	const headerHashes=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,sha256(v)]));
	return sha256(canonicalJson({schemaVersion: 1,ir,api,evidence,name,version,runtimeIdentity,source,headerHashes}));
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
	if(!ir || projectContract.taskExports?.length || projectContract.asyncIterators?.length || projectContract.leanResources?.length)
		throw new TypeError("Perl host imports require standalone synchronous exports");
	const app=await mkdtemp(join(workRoot,".perl-host-")), run=(command,args,cwd=app,env=environment)=>processBuildRunner.capture({command,args,cwd,env,signal});
	try
	{
		const {identity: runtimeIdentity}=await readVerifiedNativeRuntime(runtimeRoot);
		const {entries,objects,evidence,api,env}=await compileHostSources({...o,app,target: "cpan",environment,run});
		const options={ir,entries,modules: projectContract.modules,name,version,api,evidence,runtimeIdentity}, headers=await perlHostHeaders();
		const componentIdentity=perlHostComponentIdentity(options,headers);
		const generated=generatePerlHostExports({...options,identity: componentIdentity});
		const library="liblbc_perl_"+sha256(name)+".so";
		const save=(p,s)=>writeFile(join(app,p),s,{flag: "wx"});
		await save("ph-interface.h",generated.interfaceHeader); await save("ph-lean.h",generated.leanHeader);
		await save("BridgePerlExports.lean",generated.entryLean); await save("component.c",generated.component);
		await save("exports.map","{global: "+generated.symbols.join("; ")+"; local: *;};\n");
		await run(join(leanPrefix,"bin/lean"),["-j1","-R",app,"-c","exports.c","BridgePerlExports.lean"],app,env);
		const units=[];
		for(const [i,f] of [...objects,"exports.c"].entries())
		{
			const file="checked"+i+".c"; units.push(file);
			await save(file,'#include "'+f+'"\n#include "ph-lean.h"\n#include "ph-interface.h"\n');
		}
		await run(environment.CC??"cc",["-O2","-g0","-fPIC","-shared","-pthread"
			, "-Werror=implicit-function-declaration"
			, "-Werror=incompatible-pointer-types"
			, "-ffile-prefix-map="+resolve(app)+"=/build/lean-bridge/component"
			, "-ffile-prefix-map="+resolve(runtimeRoot)+"=/lean-bridge/runtime"
			, "-I"+join(runtimeRoot,"include")
			, ...units
			, "component.c"
			, "-L"+join(runtimeRoot,"lib")
			, "-Wl,--build-id=none"
			, "-Wl,-z,defs"
			, "-Wl,-z,nodelete"
			, "-Wl,-soname,"+library
			, "-Wl,--version-script=exports.map"
			, "-llean_bridge_native"
			, "-lleanshared"
			, "-o"
			, library]);
		const bytes=await readFile(join(app,library)); validateNativeElf(bytes);
		const dynamic=(await run("readelf",["-d",library])).stdout, needed=[...dynamic.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(m=>m[1]);
		if(!["libleanshared.so","liblean_bridge_native.so"].every(n=>needed.includes(n))
			|| needed.some(n=>!["libleanshared.so","liblean_bridge_native.so","ld-linux-x86-64.so.2","libc.so.6"].includes(n))
			|| !dynamic.includes("Library soname: ["+library+"]") || /\((?:RPATH|RUNPATH)\)/u.test(dynamic)
			|| [resolve(app),resolve(runtimeRoot),resolve(leanPrefix)].some(path=>bytes.includes(Buffer.from(path)))) throw new Error("Non-portable Perl host component");
		const syms=(await run("nm",["-D","--defined-only",library])).stdout.trim().split("\n").map(l=>l.trim().split(/\s+/u).at(-1)).sort();
		if(canonicalJson(syms)!==canonicalJson([...generated.symbols].sort())) throw new Error("Unexpected Perl host component symbol surface");
		const floor=environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR??"2.38";
		if(!/^2\.\d+$/u.test(floor)) throw new Error("Invalid Perl host glibc floor");
		for(const m of (await run("readelf",["--version-info",library])).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(+m[1]>2 || (+m[1]===2 && (+m[2]>+floor.slice(2) || (+m[2]===+floor.slice(2) && +m[3]>0)))) throw new Error("Perl host component exceeds glibc "+floor);
		return {...options,componentIdentity,bindingIrSha256: hashBindingIr(api),library,bytes,generated,headers};
	} finally
	{ await rm(app,{recursive: true,force: true}); }
};
