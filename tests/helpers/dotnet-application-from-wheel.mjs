/** @file Exercise a production NuGet projection without recompiling the authenticated native Lean component. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {projectOwnedDotnet} from "../../src/build/owned-dotnet-projection.mjs";
import {generateOwnedDotnetPackage} from "../../src/backends/dotnet/owned-package.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {projectApplicationWheel} from "./application-wheel-projection.mjs";
import {runDotnetApplication} from "./dotnet-application-client.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runCopied} from "./copied-fixture-install.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";

test("C# public interfaces support the forwarded delegate and direct Ticket client",async t=>{
	const env=process.env,sdk=env.LEAN_BRIDGE_DOTNET;assert.ok(sdk,"set LEAN_BRIDGE_DOTNET to the .NET 8 SDK host");
	const work=await mkdtemp(join(tmpdir(),"dotnet-forward-types-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const pkg=generateOwnedDotnetPackage(leasedClosureFieldReviewedIr({staged: true,hostFunctions: true,ticketExchange: true}));
	for(const [name,data] of Object.entries(pkg.files))if(name.endsWith(".cs")||name.endsWith(".csproj"))await saveLakeFile(work,name,data);
	const project=join(work,"src",pkg.assembly),dir="tests/fixtures/structured-types";
	const client=await readFile(join(dir,"tariff-application.cs"),"utf8"),observer=await readFile(join(dir,"tariff-incoming-observer.cs"),"utf8");
	await saveLakeFile(work,"NuGet.Config","<configuration><packageSources><clear/></packageSources></configuration>");
	await saveLakeFile(project,"Application.cs","#define DIRECT_TICKETS\n"+client+"\n"+observer);
	const buildEnv={...env,DOTNET_CLI_HOME: work,DOTNET_PROCESSOR_COUNT: "1",DOTNET_CLI_TELEMETRY_OPTOUT: "1",MSBUILDDISABLENODEREUSE: "1"};
	await runCopied(sdk,["build","--disable-build-servers","--nologo","-m:1","-p:UseSharedCompilation=false","-warnaserror"],project,buildEnv);
});

test("runtime-only C# application uses host delegates forwarded by the installed NuGet package",async t=>{
	const env=process.env,root=env.LEAN_BRIDGE_DOTNET_APP_OUTPUT,route=env.LEAN_BRIDGE_DOTNET_APP_ROUTE;
	const handoff=env.LEAN_BRIDGE_DOTNET_APP_WHEEL,pin=env.LEAN_BRIDGE_DOTNET_APP_WHEEL_SHA256,leanPrefix=env.LEAN_BRIDGE_LEAN_PREFIX;
	assert.ok(root&&["ordinary","reviewed"].includes(route)&&handoff&&pin&&leanPrefix&&env.LEAN_BRIDGE_DOTNET);
	const work=await mkdtemp(join(tmpdir(),"dotnet-forward-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const project=async o=>[await projectOwnedDotnet({...o,settings: {name: "tariff-quotes",version: "1.0.0"}})];
	const replayPin=env.LEAN_BRIDGE_DOTNET_APP_REPLAY_SHA256;
	const {set,pkg,profile,row}=await projectApplicationWheel({work,root,handoff,pin,route,leanPrefix,target: "nuget",project,replayPin});
	const checked=await runDotnetApplication({work,set,pkg,profile,route,env,tickets: false});
	assert.equal(checked.componentSha256,row.componentSha256);
	await saveLakeFile(root,route+".json",canonicalJson({...row,...checked}));
	t.diagnostic(route+": "+row.receiptSha256);
});
