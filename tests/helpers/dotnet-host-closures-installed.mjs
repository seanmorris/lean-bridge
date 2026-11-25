/** @file Exercise owner-bound returned Lean functions from relocated NuGet clients. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const json=async path=>JSON.parse(await readFile(path,"utf8"));
const exercise=async(root,out,receipt,worker)=>{
	const [pkg]=receipt.packages;
	assert.equal(receipt.packages.length,1);assert.equal(pkg.name,"Workshop.Host");
	const temp=await mkdtemp(join(root,"install-")),src=join(temp,"src"),cache=join(temp,"cache"),dest=join(temp,"deployed");
	await mkdir(src);await copyFile("tests/fixtures/dotnet-host-closures/Program.cs",join(src,"Program.cs"));
	if(worker)await copyFile("tests/fixtures/dotnet-host-closures/WorkerChecks.cs",join(src,"WorkerChecks.cs"));
	await writeFile(join(src,"NuGet.Config"),"<configuration><packageSources><clear/></packageSources></configuration>");
	await writeFile(join(src,"Client.csproj"),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><UseAppHost>false</UseAppHost><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors>'
		+(worker?"<DefineConstants>WORKER</DefineConstants>":"")+'</PropertyGroup><ItemGroup><PackageReference Include="Workshop.Host" Version="[1.0.0]"/></ItemGroup></Project>');
	const dotnet=process.env.LEAN_BRIDGE_DOTNET??"dotnet",env={...process.env,DOTNET_CLI_HOME: temp,NUGET_PACKAGES: cache,DOTNET_PROCESSOR_COUNT: "1",DOTNET_CLI_TELEMETRY_OPTOUT: "1",DOTNET_NOLOGO: "1",MSBUILDDISABLENODEREUSE: "1"};
	const feed=dirname(join(out,pkg.artifacts[0].path));
	await run(dotnet,["restore","--source",feed,"--configfile","NuGet.Config","--disable-parallel","-m:1","-p:NuGetAudit=false"],src,env);
	assert.deepEqual(Object.keys((await json(join(src,"obj/project.assets.json"))).libraries),["Workshop.Host/1.0.0"]);
	assert.match(await readFile(join(cache,"workshop.host/1.0.0/README.md"),"utf8"),/Api\.DrainHostCloses\(\)/u);
	await rm(out,{recursive: true});
	await run(dotnet,["build","--no-restore","-c","Release","--disable-build-servers","-m:1","-p:UseSharedCompilation=false"],src,env);
	await rename(join(src,"bin/Release/net8.0"),dest);
	for(const path of [src,cache])await rm(path,{recursive: true});
	const isolated={PATH: "/no-tools",LANG: "C.UTF-8",DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "1",TMPDIR: dest};
	const execute=args=>run(dotnet,[join(dest,"Client.dll"),...args],dest,isolated,120000);
	const normal=await execute([]);
	assert.match(normal,/CLR functions: original object and exception, reentry, stale lease and owner-thread cleanup/u);
	if(worker)
	{
		assert.match(normal,/CLR future and file-reading closure passed/u);
		assert.match(normal,/original exception, cancellation, sibling completed once/u);
	}
	assert.match(await execute(["poison"]),/retired CLR runtime: original fatal exception and binding-local cleanup/u);
	await rm(temp,{recursive: true});
};

test("installed ordinary, reviewed and worker NuGet packages return owner-bound Lean IO functions",{timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"nuget-returned-functions-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"project"),cfgFile=join(src,"lean-bridge.exports.json"),env=process.env;
	const cli=await installOfflineAuthor(root);await prepareNativeHostFixture(src,"dotnet");await copyFile("LICENSE",join(src,"LICENSE"));
	const lean=await readFile("tests/fixtures/c-host-closures/Closures.lean","utf8");
	await writeFile(join(src,"Closures.lean"),lean.replaceAll("LeanBridge.Host.C","LeanBridge.Host.Dotnet"));
	await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
	const cfg=await json(cfgFile);cfg.modules.push("Closures");cfg.exports.push("Closures.remember","Closures.reader","Closures.identityReader");
	const build=out=>run(process.execPath,[cli,"build","--target","nuget","--project",src,"--output",out,"--json","--progress","none"],root,env,900000);
	await writeFile(cfgFile,canonicalJson({...cfg,exports: [...cfg.exports,"Closures.fileReader"]}));
	const denied=join(root,"missing-grant");await assert.rejects(build(denied),e=>e.message.includes("Closures.fileReader requires nativeEffects") && e.message.includes("filesystem"));
	await assert.rejects(access(denied),{code: "ENOENT"});
	let first;
	for(const route of ["ordinary","reviewed","worker"])
	{
		const out=join(root,route),review=join(src,"workshop.binding-ir.json");
		if(route==="reviewed")
		{
			delete cfg.exports;await writeFile(cfgFile,canonicalJson(cfg));
			const invalid=join(root,"wrong-owner"),bad=structuredClone(first);
			bad.types.find(k=>k.source.declaration==="Closures.remember").source.extensions["lean-bridge.dev/closure-owner"]="rust-host-binding";
			await writeFile(review,canonicalJson(bad));
			await assert.rejects(build(invalid),e=>e.message.includes("Reviewed API differs from compiled host exports"));
			await assert.rejects(access(invalid),{code: "ENOENT"});await writeFile(review,canonicalJson(first));
		}
		if(route==="worker")
		{
			await rm(review);cfg.exports=["Workshop.make","Closures.remember","Closures.reader","Closures.identityReader","Closures.fileReader","Closures.echoBox"];
			await copyFile("tests/fixtures/dotnet-host-workers/Workers.lean",join(src,"Workers.lean"));
			await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Workers"\n');
			cfg.modules.push("Workers");cfg.exports.push("Workers.relay");
			cfg.taskExports=["Closures.echoBox","Workers.relay"];cfg.taskIOErrors=["Workers.relay"];cfg.nativeEffects=["filesystem"];
		}
		await writeFile(cfgFile,canonicalJson(cfg));await build(out);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,[route==="worker"?"native-dotnet-task-v1":"native-dotnet-io-v1"]);assert.equal(result.archives,1);
		const api=await json(join(out,"binding-ir.json")),decl=api.declarations.find(d=>d.source.declaration==="Closures.remember"),kind=api.types.find(k=>k.id===decl.result.type.id);
		assert.equal(kind.source.extensions["lean-bridge.dev/closure-owner"],"dotnet-host-binding");assert.equal(decl.result.ownership,"lease");
		assert.equal(kind.callable.invocation,"many");assert.equal(kind.callable.selfDisposal,"defer");
		assert.ok(kind.callable.failure.errors.includes("error:DotNetHostException"));
		if(route==="reviewed")assert.deepEqual(api,first);else if(!first)first=api;
		await exercise(root,out,receipt,route==="worker");t.diagnostic(route+" "+result.receiptSha256);
	}
});
