/** @file Restore the original NuGet archive and execute a relocated C# cursor client. */
import assert from "node:assert/strict";
import {copyFile, link, mkdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {basename, join} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Compile against the exact offline package, then remove the build and NuGet
 * cache before running the consumer and a separate normal-shutdown process.
 *
 * @param dir - Route scratch directory.
 * @param fixture - Sources for the application, not the producer.
 * @param output - Original package handoff.
 * @param receipt - Verified package set.
 */
export const exerciseDotnetCursors = async (dir,fixture,output,receipt) => {
	const [p]=receipt.packages, [a]=p.artifacts;
	const dotnet=process.env.LEAN_BRIDGE_DOTNET??"dotnet";
	const app=join(dir,"app"), feed=join(dir,"feed"), cache=join(dir,"packages"), moved=join(dir,"relocated");
	await mkdir(app); await mkdir(feed);
	await link(join(output,a.path),join(feed,basename(a.path)));
	await copyFile(join(fixture,"InstalledCursor.cs"),join(app,"Program.cs"));
	await copyFile(new URL("../fixtures/dotnet-sync-io/Audit.cs",import.meta.url),join(app,"Audit.cs"));
	await writeFile(join(app,"NuGet.Config"),"<configuration><packageSources><clear /></packageSources></configuration>");
	await writeFile(join(app,"Client.csproj"),`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><PackageReference Include="${p.name}" Version="[${p.version}]"/></ItemGroup></Project>`);
	const env={...process.env,NUGET_PACKAGES: cache,DOTNET_CLI_HOME: join(dir,"cli"),MSBUILDDISABLENODEREUSE: "1",DOTNET_CLI_TELEMETRY_OPTOUT: "1",DOTNET_NOLOGO: "1"};
	await run(dotnet,["restore","--source",feed,"--configfile","NuGet.Config","--disable-parallel"],app,env);
	const installed=join(cache,p.name.toLowerCase(),p.version,basename(a.path).toLowerCase());
	assert.equal(sha256(await readFile(installed)),a.sha256);
	await run(dotnet,["build","--no-restore","--disable-build-servers","-m:1","/p:UseSharedCompilation=false","-o","dist"],app,env);
	await rename(join(app,"dist"),moved);
	for(const scratch of [app,feed,cache]) await rm(scratch,{recursive: true});
	await rm(join(output,a.path));
	const leanFree={PATH: "/no-author-tools",LANG: "C.UTF-8",DOTNET_CLI_TELEMETRY_OPTOUT: "1",DOTNET_PROCESSOR_COUNT: "1"};
	const program=join(moved,"Client.dll");
	for(const mode of ["ordinary","shutdown"])
	{
		const cwd=join(dir,"run-"+mode); await mkdir(cwd);
		assert.equal(await run(dotnet,[program,mode],cwd,leanFree),mode==="ordinary"?"7 opens, 11 pulls, 7 closes":"");
		assert.equal(await readFile(join(cwd,"state"),"utf8"),"closed");
	}
	await rm(moved,{recursive: true});
};
