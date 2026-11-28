/** @file Exercise file-backed worker and cursor effects through an installed .NET 8 package. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import test from "node:test";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareDotnetWorkerProject} from "./dotnet-worker-project.mjs";
import {checkHostWorkerEffects} from "./host-worker-effect-handoffs.mjs";

test("installed NuGet workers honor effect grants through initialization, pull and close",{timeout: 2400000},async t=>{
	const dotnet=process.env.LEAN_BRIDGE_DOTNET??"dotnet";
	const consume=async(root,handoff,receipt)=>{
		assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages;assert.equal(pkg.name,"Acme.Workshop");
		const folder=await mkdtemp(join(root,"dotnet-install-")),src=join(folder,"src"),cache=join(folder,"cache"),dest=join(folder,"deployed");
		try
		{
			await mkdir(src);await copyFile("tests/fixtures/dotnet-host-workers/Effects.cs",join(src,"Program.cs"));
			await writeFile(join(src,"NuGet.Config"),"<configuration><packageSources><clear/></packageSources></configuration>");
			await writeFile(join(src,"Client.csproj"),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><UseAppHost>false</UseAppHost><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup><ItemGroup><PackageReference Include="Acme.Workshop" Version="[1.0.0]"/></ItemGroup></Project>');
			const env={...process.env,DOTNET_CLI_HOME: folder,NUGET_PACKAGES: cache,DOTNET_PROCESSOR_COUNT: "1",DOTNET_CLI_TELEMETRY_OPTOUT: "1",DOTNET_NOLOGO: "1",MSBUILDDISABLENODEREUSE: "1"};
			const feed=dirname(join(handoff,pkg.artifacts[0].path));
			await run(dotnet,["restore","--source",feed,"--configfile","NuGet.Config","--disable-parallel","-m:1","-p:NuGetAudit=false"],src,env);
			const assets=JSON.parse(await readFile(join(src,"obj/project.assets.json")));
			assert.deepEqual(Object.keys(assets.libraries),["Acme.Workshop/1.0.0"]);
			await run(dotnet,["build","--no-restore","-c","Release","--disable-build-servers","-m:1","-p:UseSharedCompilation=false"],src,env);
			await rename(join(src,"bin/Release/net8.0"),dest);await rm(src,{recursive: true});await rm(cache,{recursive: true});
			const isolated={PATH: "/no-tools",DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "1",LEAN_BRIDGE_EFFECT_BOOT: "from-app",LANG: "C.UTF-8"};
			assert.match(await run(dotnet,[join(dest,"Client.dll")],dest,isolated,90000),/early disposal passed/u);
			return 1;
		}
		finally
		{await rm(folder,{recursive: true,force: true});}
	};
	await checkHostWorkerEffects(t,{target: "nuget",profile: "native-dotnet-task-v1",prepare: prepareDotnetWorkerProject,consume});
});
