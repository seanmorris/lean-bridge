/** @file Install a NuGet handoff and run a C# function-forwarding application with a runtime-only host. */
import assert from "node:assert/strict";
import {readFile,rename,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {verifyNativeFiles} from "../../src/build/native-artifacts.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {installCopiedConsumer,runCopied} from "./copied-fixture-install.mjs";
import {ownedDotnetRuntimeOnly} from "./owned-dotnet-installed.mjs";
import {checkStagedQuoteIdentities,checkApplicationFunctionPositions,checkTicketExchangePositions} from "./staged-quote-project.mjs";

/**
 * Exercise the public delegates, not a hand-written native adapter. A combined
 * release additionally checks the resource passed to and returned by a callback.
 *
 * @param options - Isolated directory, verified package, source route, SDK and fixture variant.
 */
export const runDotnetApplication=async options=>{
	const {work,set,pkg,profile,route,env,tickets}=options,consumer=join(work,"consumer");
	assert.equal(pkg.target,"nuget");assert.equal(pkg.name,"tariff-quotes");assert.equal(pkg.version,"1.0.0");
	const read=n=>readFile(resolve("tests/fixtures/structured-types",n),"utf8");
	const app=await read("tariff-application.cs"),observer=await read("tariff-incoming-observer.cs");
	const cs=(tickets?"#define DIRECT_TICKETS\n":"")+app+"\n"+observer;
	const expected=["baseline","expired","held","forward","nested",...tickets?["ticket42","ticket71"]:[],"fresh","afterThreadExit"];
	const parseResult=output=>{
		const counts=JSON.parse(output);assert.deepEqual(Object.keys(counts),expected);
		assert.ok(Number.isSafeInteger(counts.held)&&counts.held>1);
		for(const key of expected.filter(k=>k!=="held"))assert.equal(counts[key],key==="afterThreadExit"?0:1,key);
		return {counts,checks: expected.length};
	};
	const fixture={source: ()=>cs,parseResult,expectedChecks: expected.length};
	const installed=await installCopiedConsumer({profile: "dotnet",consumer,handoff: set,packages: [pkg],environment: env,fixture});
	assert.equal(installed.consumerSha256,sha256(cs));
	const dir=join(consumer,"dotnet/packages",pkg.name,pkg.version),sub="lean-bridge/component";
	const json=async file=>JSON.parse(await readFile(join(dir,file)));
	const receipt=await json("lean-bridge/package-receipt.json");
	const inventory=Object.entries(receipt.files).filter(([n])=>/^(lean-bridge|runtimes|lib)\//u.test(n));
	const native=Object.fromEntries(inventory.filter(([n])=>n.startsWith("runtimes/linux-x64/native/")));
	assert.ok(Object.keys(native).length>=5);await verifyNativeFiles(dir,Object.fromEntries(inventory));
	const meta=await json(join(sub,"native-component.json")),model=await json(join(sub,"model.json")),ir=await json(join(sub,"binding-ir.json"));
	const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: tickets});
	checkApplicationFunctionPositions(ir);if(tickets)checkTicketExchangePositions(ir);
	const sourceSha256=model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256;
	assert.equal(sourceSha256,tickets?"a758f8e7a4210d99fe965aa06c4b42006df3c087c70f2bde8d0e1403c30a98fb":"a5b7145185c50be1f7984d06b262556e5ef1ec94d67b8c9bab9dbb301b074415");
	const componentSha256=meta.nativeLibrary.sha256;
	assert.equal(native["runtimes/linux-x64/native/"+meta.library].sha256,componentSha256);
	const deployed=join(work,"relocated");await rename(join(consumer,"dotnet/out"),deployed);
	await verifyNativeFiles(deployed,native);await rm(consumer,{recursive: true});
	const host=await ownedDotnetRuntimeOnly(join(work,"runtime-only"),env.LEAN_BRIDGE_DOTNET);
	const result=await runCopied(host.executable,["Consumer.dll"],deployed,{...host.env,DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "1"});
	assert.equal(result.stderr,"");const moved=parseResult(result.stdout);assert.deepEqual(moved,installed.result);
	const sources={clientSha256: sha256(cs),applicationSha256: sha256(app),observerSha256: sha256(observer)};
	const assemblySha256=sha256(await readFile(join(deployed,"Consumer.dll")));
	return {...pins,...sources,sourceSha256,componentSha256,assemblySha256,counts: moved.counts};
};
