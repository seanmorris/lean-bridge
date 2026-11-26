/** @file Run generated managed APIs against an authenticated Lean component; this is not a package install. */
import assert from "node:assert/strict";
import {copyFile,link,mkdir,mkdtemp,readFile,realpath,rename,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedCPackage} from "../../src/backends/c/owned-package.mjs";
import {generateOwnedDotnetPackage} from "../../src/backends/dotnet/owned-package.mjs";
import {generateOwnedJvmPackage} from "../../src/backends/jvm/owned-package.mjs";
import {nativeCallbackHeader} from "../../src/backends/native/callback-broker.mjs";
import {linuxBrokerHeader} from "../../src/backends/native/runtime-broker.mjs";
import {compileJvmSources} from "../../src/build/compile-jvm-sources.mjs";
import {ownedDotnetAdapterSources} from "../../src/build/owned-dotnet-artifacts.mjs";
import {ownedJvmAdapterSources} from "../../src/build/owned-jvm-artifacts.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {frameReplaySource} from "./callback-frame-source.mjs";
import {directQuoteLabels,verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

const env=process.env,fixture=resolve("tests/fixtures"),digest=async p=>sha256(await readFile(p));
const readJson=async p=>JSON.parse(await readFile(p));

// Only borrow GMP and the broker ABI header from the older signed-off fixture.
// Never take its application model, component, binding, callbacks or clients.
const privateGmp=async(work,source,run)=>{
	const donor=resolve(env.LEAN_BRIDGE_FRAME_GMP_HANDOFF);
	const pin=await readJson(join("docs/evidence/dotnet-function-fields-20261126",basename(donor)+".json"));
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(donor,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,pin.receiptSha256);const [pkg]=receipt.packages;
	assert.deepEqual(pkg.artifacts,[pin.archive]);assert.equal(pkg.target,"nuget");
	assert.equal(pkg.runtimeIdentity,source.component.runtimeIdentity);
	const archive=join(donor,pin.archive.path),member=async path=>JSON.parse(await run("unzip",["-p",archive,path]));
	const inventory=await member("lean-bridge/package-receipt.json"),runtime=await member("lean-bridge/runtime.json");
	const lib="libgmp-lean-bridge.so.10",key="runtimes/linux-x64/native/"+lib;
	const hdr="lean-bridge/adapter/gmp/include/gmp.h";
	await run("unzip",["-j","-q",archive,key,hdr,"-d",work]);
	for(const k of [key,hdr]) assert.equal(await digest(join(work,basename(k))),inventory.files[k].sha256);
	const header=linuxBrokerHeader.replace("#ifdef __cplusplus\n}",nativeCallbackHeader+"\n#ifdef __cplusplus\n}");
	assert.equal(sha256(header),runtime.files["include/lean_bridge_native_runtime.h"].sha256);
	await saveLakeFile(work,"lean_bridge_native_runtime.h",header);
	for(const n of ["libleanshared.so","liblean_bridge_native.so"])
		assert.equal(await digest(join(source.lib,n)),runtime.files["lib/"+n].sha256);
	return {lib,donorReceipt: result.receiptSha256};
};
const build=async(o,target)=>{
	const {work,source,privateLib,run}=o, {metadata,component,model}=source;
	const jvm=target==="jvm",generator=jvm?generateOwnedJvmPackage:generateOwnedDotnetPackage;
	const ir=model.bindingIr, projection=generator(ir);
	const c=generateOwnedCPackage({metadata,sourceIdentity: model.sourceIdentity
		, component: model.component,valueCopies: Boolean(projection.c.copies?.length)
		, hostCallbacks: true});
	assert.ok(c.values.callbackArgumentViews && projection.canonicalEquality && !projection.wholeOwners);
	const prefix=c.values.prefix,library="lib"+prefix+"_"+target+".so",stage=join(work,target);
	const adapter=join(stage,"adapter"),native=join(stage,"native"),libraries={};
	await mkdir(native,{recursive: true});
	const inputs=[component.library,"liblean_bridge_native.so","libleanshared.so",privateLib];
	for(const n of inputs)
	{
		const path=await realpath(n===privateLib?join(work,n):join(source.lib,n));
		try
		{await link(path,join(native,n));}
		catch(e)
		{
			if(e.code!=="EXDEV") throw e;
			await copyFile(path,join(native,n));
		}
		libraries[n]=await digest(path);
	}
	assert.equal(libraries[component.library],component.nativeLibrary.sha256);
	const files=(jvm?ownedJvmAdapterSources:ownedDotnetAdapterSources)(c,projection);
	for(const [n,v] of Object.entries(files)) await saveLakeFile(adapter,n,v);
	const flags=["-O1","-g0","-fPIC","-Wall","-Wextra","-Werror","-Iinclude","-Iinternal","-I"+work,"-I"+join(env.LEAN_BRIDGE_LEAN_PREFIX,"include")];
	if(jvm) flags.push("-I"+join(env.JAVA_HOME,"include"),"-I"+join(env.JAVA_HOME,"include/linux"));
	await run(env.CC??"cc",["-std=c11",...flags,"-c","src/"+prefix+"-"+target+".c","-o","api.o"],adapter);
	await run(env.CXX??"c++",["-std=c++17",...flags,"-c","src/"+prefix+"-"+target+"-thread-exit.cpp","-o","guard.o"],adapter);
	const linkArgs=["-shared","-pthread","api.o","guard.o","-L"+native
		, "-Wl,--no-as-needed",...inputs.map(n=>"-l:"+n),"-Wl,-z,defs,-z,nodelete"
		, "-Wl,-rpath,$ORIGIN","-Wl,-soname,"+library,"-o",join(native,library)];
	await run(env.CXX??"c++",linkArgs,adapter);
	libraries[library]=await digest(join(native,library));
	const pkg=generator(ir,{componentId: ir.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, runtimeIdentity: component.runtimeIdentity
		, ownedValues: projection.contract,library,libraries});
	return {stage,native,pkg};
};
const executeDotnet=async(o,p)=>{
	const {work,run}=o,{stage,native,pkg}=p, app=join(stage,"app"),deploy=join(stage,"deploy");
	for(const [path,s] of Object.entries(pkg.files))
		if(path.endsWith(".cs") || path.endsWith(".csproj") || path==="NuGet.Config") await saveLakeFile(stage,path,s);
	await saveLakeFile(app,"Probe.csproj",`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><OutputType>Exe</OutputType><UseAppHost>false</UseAppHost><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup><ItemGroup><ProjectReference Include="../src/${pkg.assembly}/${pkg.assembly}.csproj"/></ItemGroup></Project>`);
	for(const n of ["tariff-incoming.cs","tariff-incoming-observer.cs"]) await copyFile(join(fixture,"structured-types",n),join(app,n));
	const sdk=env.LEAN_BRIDGE_DOTNET;
	await run(sdk,["publish","--disable-build-servers","-m:1","-p:UseSharedCompilation=false","-o",deploy],app,
		{...env,DOTNET_CLI_HOME: work,DOTNET_PROCESSOR_COUNT: "1",DOTNET_NOLOGO: "1",DOTNET_CLI_TELEMETRY_OPTOUT: "1",MSBUILDDISABLENODEREUSE: "1"});
	await mkdir(join(deploy,"runtimes/linux-x64"),{recursive: true});
	await rename(native,join(deploy,"runtimes/linux-x64/native"));
	await rm(app,{recursive: true});await rm(join(stage,"src"),{recursive: true});
	const counts=JSON.parse(await run(sdk,["Probe.dll"],deploy,{PATH: "/unavailable",DOTNET_ROOT: dirname(sdk),DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "1"}));
	verifyDirectQuoteCounts(counts);return counts;
};
const executeJvm=async(o,p)=>{
	const {run}=o,{stage,native,pkg}=p, files={...pkg.files}, kotlin=env.LEAN_BRIDGE_KOTLIN_HOME;
	for(const n of ["jvm-tasks/Observe.java","jvm-tariff/Ownership.java","jvm-tariff/JavaIncoming.java","jvm-tariff/KotlinIncoming.kt"])
		files["src/main/"+(n.endsWith(".kt")?"kotlin/":"java/")+basename(n)]=await readFile(join(fixture,n),"utf8");
	for(const [n,s] of Object.entries(files)) await saveLakeFile(stage,n,s);
	try
	{await compileJvmSources({root: stage,files,environment: env});}
	catch(e)
	{throw new Error(e.message+" "+JSON.stringify(e.details),{cause: e});}
	const res=join(stage,"classes/META-INF/lean-bridge/native");
	await mkdir(res,{recursive: true});await rename(native,join(res,"linux-x64"));await rm(join(stage,"src"),{recursive: true});
	const results={};
	for(const main of ["JavaIncoming","KotlinIncomingKt"])
	{
		const scratch=await mkdtemp(join(stage,"run-"));
		const lines=await run(env.LEAN_BRIDGE_JAVA,["--enable-native-access=ALL-UNNAMED","-XX:ActiveProcessorCount=1","-Xmx192m","-Xcheck:jni","-Djava.io.tmpdir="+scratch,"-cp","classes:"+join(kotlin,"lib/kotlin-stdlib.jar"),main],stage,{PATH: "/unavailable",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"});
		const points=lines.split("\n").map(l=>{const m=/^(\w+) (\d+)$/u.exec(l);assert.ok(m,l);return [m[1],Number(m[2])];});
		assert.deepEqual(points.map(([n])=>n),directQuoteLabels);results[main]=Object.fromEntries(points);verifyDirectQuoteCounts(results[main]);
		await rm(scratch,{recursive: true});
	}
	return results;
};
for(const route of env.LEAN_BRIDGE_FRAME_NATIVE_STAGE?["ordinary"]:["ordinary","reviewed"]) test(route+" managed direct closure runtime replay",{timeout: 2_400_000},async t=>{
	assert.ok(env.LEAN_BRIDGE_FRAME_GMP_HANDOFF,"provide the original NuGet GMP donor");
	const work=await mkdtemp(join(tmpdir(),"managed-frame-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const run=(cmd,args,cwd=work,environment=env)=>runNativeTool(cmd,args,cwd,environment);
	const source=await frameReplaySource({env,route,work,run,direct: true});
	const gmp=await privateGmp(work,source,run);
	const o={work,source,run,privateLib: gmp.lib};
	for(const [name,execute] of [["dotnet",executeDotnet],["jvm",executeJvm]])
		await t.test(name,async st=>{
			const p=await build(o,name),observed=await execute(o,p);
			st.diagnostic(JSON.stringify({route,origin: source.origin,gmp: gmp.donorReceipt,observed}));
		});
});
