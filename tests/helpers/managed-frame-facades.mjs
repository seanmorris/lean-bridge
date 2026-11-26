/** @file Run generated managed APIs against an authenticated Lean component; this is not a package install. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve} from "node:path";
import test from "node:test";
import {compileJvmSources} from "../../src/build/compile-jvm-sources.mjs";
import {frameReplaySource} from "./callback-frame-source.mjs";
import {directQuoteLabels,verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

import {buildFrameFacade,privateGmp} from "./direct-native-facade.mjs";
const env=process.env,fixture=resolve("tests/fixtures");
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
			const p=await buildFrameFacade(o,name),observed=await execute(o,p);
			st.diagnostic(JSON.stringify({route,origin: source.origin,gmp: gmp.donorReceipt,observed}));
		});
});
