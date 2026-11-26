/** @file Build both NuGet authoring routes and exercise typed function fields in relocated .NET applications. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {generateOwnedDotnetPackage} from "../../src/backends/dotnet/owned-package.mjs";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {verifyNativeFiles} from "../../src/build/native-artifacts.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {installCopiedConsumer,nativeFixtureEnvironment,runCopied} from "./copied-fixture-install.mjs";
import {directQuoteCases,verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {ownedDotnetRuntimeOnly} from "./owned-dotnet-installed.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {checkStagedQuoteIdentities,prepareStagedQuoteProject} from "./staged-quote-project.mjs";

const points=["explicitly retained field survives source disposal"
	, "caller-built record crosses Lean", "repacked function survives the input"
	, "ordinary delegate cannot escape through a field", "closed field rejected"
	, "staged callback returns a native function"
	, "host exception retains identity", "binding reusable"];
const hostCases=["delegate field captures managed state across two calls"
	, "nested calls have distinct input frames"
	, "escaped field and direct result refuse a late delegate"
	, "original delegate exception and healthy retry"
	, "genuine Lean field survives its source and rejects a closed input"
	, "invalid input rejected before dispatch"];
test("C# input views mix delegates, leased fields and ordinary data in two records", {timeout: 300000}, async t=>{
	const ir=leasedClosureFieldReviewedIr({exchange: true});
	const row=ir.types.find(n=>n.name==="Tariff"),fn=ir.declarations.find(n=>n.name==="applyTariff");
	row.fields.push({...row.fields[0],name: "rebate"}
		, {...row.fields[0],name: "label",type: {kind: "primitive",name: "string"}}
		, {...row.fields[0],name: "base",type: {kind: "primitive",name: "uint32"}});
	ir.aggregatePolicy.closureFields.push("Owned.Tariff.rebate");
	fn.parameters[1]={...fn.parameters[0],name: "other"};
	const pkg=generateOwnedDotnetPackage(ir);
	assert.deepEqual(pkg.contract.hostInputRecords,[{type: row.id,input: "TariffInput",fields: ["Quote","Rebate"],lifetime: "call"}]);
	const node=pkg.types.find(n=>n.id===row.id),slot=pkg.types.find(n=>n.id===row.fields[0].type.id);
	assert.deepEqual(node.hostInput.fields.map(f=>f.offset),[0,32,64,80]);
	const temp=await mkdtemp(join(tmpdir(),"dotnet-field-types-"));t.after(()=>rm(temp,{recursive: true,force: true}));
	for(const [name,text] of Object.entries(pkg.files)) if(name.endsWith(".cs") || name.endsWith(".csproj")) await saveLakeFile(temp,name,text);
	const app=join(temp,"src",pkg.assembly), env={...process.env,DOTNET_CLI_HOME: temp,DOTNET_CLI_TELEMETRY_OPTOUT: "1",DOTNET_PROCESSOR_COUNT: "1",MSBUILDDISABLENODEREUSE: "1"};
	const dotnet=nativeFixtureEnvironment(["dotnet"]).LEAN_BRIDGE_DOTNET;
	await saveLakeFile(temp,"NuGet.Config",'<configuration><packageSources><clear/></packageSources></configuration>');
	const compile=()=>runCopied(dotnet,["build","--disable-build-servers","--nologo","-m:1","-p:UseSharedCompilation=false"],app,env);
	await saveLakeFile(app,"Mixed.cs",`namespace ${pkg.namespace};
internal static class Mixed {
    internal static uint Run(Tariff leased, string label) {
        uint calls=0;
        ${slot.delegateType} quote=n=>n + ++calls;
        var mixed=new TariffInput(quote,leased.Rebate,label,2);
        return Api.ApplyTariffWithHostFields(mixed,leased);
    }
}`);
	await compile();
	await saveLakeFile(app,"Invalid.cs",`namespace ${pkg.namespace};
internal static class Invalid { internal static TariffInput Bad() => new TariffInput(n=>"wrong",n=>n,"text",2); }`);
	await assert.rejects(compile(),e=>/CS(0029|1662)/u.test(e.details?.stdout??e.message));
});
test("relocated .NET 8 applications call and return leased function fields",{timeout: 7_200_000},async t=>{
	const environment=nativeFixtureEnvironment(["dotnet"]),keep=process.env.LEAN_BRIDGE_DOTNET_TARIFF_KEEP,replay=process.env.LEAN_BRIDGE_DOTNET_TARIFF_REPLAY;
	const incoming=process.env.LEAN_BRIDGE_DOTNET_TARIFF_REQUIRE_INCOMING==="1";
	assert.ok(!(keep && replay));
	const work=await mkdtemp(join(tmpdir(),"dotnet-tariff-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const set=replay?resolve(replay):keep?await mkdtemp(join(resolve(keep),"tariff-")):join(work,"handoffs");
	if(!keep && !replay) await mkdir(set);
	const routes=["ordinary","reviewed"];
	if(!replay)for(const route of routes)
	{
		const src=join(work,route+"-src"),out=join(work,route+"-release");
		await prepareStagedQuoteProject(src,route,"nuget",{incoming});
		await buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["nuget"],environment})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		await copyPackageSetHandoff(out,join(set,route));
		await rm(src,{recursive: true});await rm(out,{recursive: true});
		t.diagnostic(route+" package built at "+join(set,route));
	}
	const legacy=await readFile("tests/fixtures/structured-types/tariff-fields.cs","utf8");
	const borrowed=await readFile("tests/fixtures/structured-types/tariff-host-fields.cs","utf8");
	const direct=incoming?await Promise.all(["tariff-incoming.cs","tariff-incoming-observer.cs"].map(n=>readFile(join("tests/fixtures/structured-types",n),"utf8"))):[];
	const output=resolve(process.env.LEAN_BRIDGE_DOTNET_TARIFF_OUTPUT??"build/dotnet-function-fields");await mkdir(output,{recursive: true});
	for(const route of routes)
	{
		const handoff=join(work,route+"-handoff"),consumer=join(work,route+"-app");
		await copyPackageSetHandoff(join(set,route),handoff);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		const [pkg]=receipt.packages;assert.equal(pkg.target,"nuget");assert.equal(pkg.name,"tariff-quotes");
		const manifest=JSON.parse((await runCopied("/usr/bin/unzip",["-p",join(handoff,pkg.artifacts[0].path),"lean-bridge/dotnet/binding-manifest.json"],work)).stdout);
		const advertised=manifest.ownedValues.hostInputRecords;
		if(replay && advertised===undefined)
		{
			const old=new URL("../../docs/evidence/dotnet-function-fields-20261126/"+route+".json",import.meta.url);
			assert.equal(result.receiptSha256,JSON.parse(await readFile(old)).receiptSha256);
		}
		else assert.deepEqual(advertised,[
			{type: "lean:Owned.Tariff",input: "TariffInput",fields: ["Quote"],lifetime: "call"}
		]);
		const extra=advertised !== undefined;
		if(incoming)
		{
			assert.ok(manifest.supportedFeatures.includes("canonical-resource-equality"));
			assert.equal(manifest.ownedValues.resultAnchors,undefined);
		}
		const cs=incoming?direct.join("\n"):legacy+(extra?"\n"+borrowed:""),expected=incoming?directQuoteCases:extra?[...points,...hostCases]:points;
		const parseResult=stdout=>{
			if(incoming)
			{
				const counts=JSON.parse(stdout);verifyDirectQuoteCounts(counts);return {checks: directQuoteCases.length,counts};
			}
			const lines=stdout.trim().split("\n");assert.deepEqual(lines,expected);return {checks: lines.length};
		};
		const installed=await installCopiedConsumer({profile: "dotnet"
			, environment, consumer, handoff, packages: receipt.packages
			, fixture: {source: ()=>cs,parseResult,expectedChecks: expected.length}});
		const pkgDir=join(consumer,"dotnet","packages",pkg.name.toLowerCase(),pkg.version);
		let shipped;
		if(incoming)
		{
			const entry="lean-bridge/package-receipt.json";
			const original=await runCopied("/usr/bin/unzip",["-p",join(handoff,pkg.artifacts[0].path),entry],work);
			assert.deepEqual(JSON.parse(await readFile(join(pkgDir,entry))),JSON.parse(original.stdout));
			const files=JSON.parse(original.stdout).files;
			shipped=Object.fromEntries(Object.entries(files).filter(([n])=>n.startsWith("runtimes/linux-x64/native/")));
			assert.ok(Object.keys(shipped).length>=5);
			await verifyNativeFiles(pkgDir,Object.fromEntries(Object.entries(files).filter(([n])=>/^(lean-bridge|runtimes|lib)\//u.test(n))));
		}
		const model=JSON.parse(await readFile(join(pkgDir,"lean-bridge/component/model.json")));
		const ir=JSON.parse(await readFile(join(pkgDir,"lean-bridge/component/binding-ir.json")));
		const identity=checkStagedQuoteIdentities(model,ir,receipt.profiles.find(p=>p.id===pkg.profile),route,{incoming});
		if(incoming)
		{
			const fn=ir.declarations.find(d=>d.source.declaration==="Owned.visitQuote");
			const arg=ir.types.find(t=>t.id===fn.parameters[1].type.id).callable.parameters[0];
			assert.equal(arg.ownership,"borrow");assert.equal(arg.lifetime.scope,"call");
			assert.equal(ir.types.find(t=>t.id===arg.type.id).kind,"callback");
		}
		const app=join(work,route+"-moved");await rename(join(consumer,"dotnet","out"),app);
		if(incoming) await verifyNativeFiles(app,shipped);
		await rm(consumer,{recursive: true});await rm(handoff,{recursive: true});
		const host=await ownedDotnetRuntimeOnly(join(work,route+"-runtime"),environment.LEAN_BRIDGE_DOTNET);
		const exec=await runCopied(host.executable,["Consumer.dll"],app,{...host.env,PATH: "/no-author-tools",DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "1"});
		assert.equal(exec.stderr,"");
		const moved=parseResult(exec.stdout);assert.deepEqual(moved,installed.result);
		assert.equal(installed.consumerSha256,sha256(cs));
		const live=incoming?moved.counts:JSON.parse(await readFile(join(app,"ownership-counts.json")));
		assert.ok(live.held>live.baseline);assert.equal(live.afterThreadExit,0);
		if(!incoming) for(const point of ["retain","echo","repack","expired","closed","afterCallbackFailure"]) assert.equal(live[point],live.baseline,point);
		if(extra && !incoming) for(const point of ["host-capture","host-nested","host-expired","host-error","host-lease","host-validation"])
			assert.equal(live[point],live.baseline,point);
		const clientAssemblySha256=sha256(await readFile(join(app,"Consumer.dll")));
		const report={route,receiptSha256: result.receiptSha256
			, archive: pkg.artifacts[0], ...identity, clientSha256: sha256(cs)
			, clientAssemblySha256, live, relocated: expected
			, ...incoming?{applicationSha256: sha256(direct[0])
				, observerSha256: sha256(direct[1]),nativeLibraries: shipped}:{}};
		await writeFile(join(output,route+".json"),canonicalJson(report));
	}
	t.diagnostic("Handoffs: "+set);
});
