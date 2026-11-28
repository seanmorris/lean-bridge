/** @file Test per-registration admission from a relocated .NET 8 consumer on each author route. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {mkdir,mkdtemp,readFile,rename,rm,stat,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {isAbsolute,join,relative,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {installCopiedConsumer,nativeFixtureEnvironment,runCopied} from "./copied-fixture-install.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {ownedDotnetRuntimeOnly} from "./owned-dotnet-installed.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";

const digest=async path=>{
	const h=createHash("sha256");for await(const bytes of createReadStream(path)) h.update(bytes);return h.digest("hex");
};
const observation="CLR: 16 one-call worker races; factory, terminal, typed and original errors distinct; capture released; zero leases";
test("installed NuGet workers preserve the distinct one-call, factory, typed and host exceptions",{timeout: 7200000},async t=>{
	const env=nativeFixtureEnvironment(["dotnet"]),work=await mkdtemp(join(tmpdir(),"clr-budget-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_DOTNET_BUDGET_KEEP,replay=env.LEAN_BRIDGE_DOTNET_BUDGET_REPLAY;assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const out=resolve(env.LEAN_BRIDGE_DOTNET_BUDGET_OUTPUT??"build/dotnet-budget");await mkdir(out,{recursive: true});
	const source=await readFile("tests/fixtures/native-callback-budget/Client.cs","utf8");
	const parseResult=text=>{assert.equal(text.trim(),observation);return {checks: 16};};
	const host=await ownedDotnetRuntimeOnly(join(work,"framework"),env.LEAN_BRIDGE_DOTNET);
	let ordinary,first,shared;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,route),handoff=join(work,route+"-handoff"),consumer=join(work,route+"-app");
		if(!replay) await buildNativeBudget({work,set,target: "nuget",route,ordinary});
		await copyPackageSetHandoff(set,handoff);
		const {result,receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-dotnet-task-v1"]);assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages;assert.equal(pkg.target,"nuget");assert.equal(pkg.name,"nuget-budget");
		assert.equal(pkg.runtimeDelivery,"embedded");assert.equal(pkg.artifacts.length,1);const [archive]=pkg.artifacts;
		const fixture={source: ()=>source,parseResult,expectedChecks: 16};
		const installed=await installCopiedConsumer({profile: "dotnet",environment: env,consumer,handoff,packages: [pkg],fixture});
		const app=join(consumer,"dotnet"),root=join(app,"packages",pkg.name,pkg.version);
		assert.equal(await digest(join(app,"consumer.cs")),sha256(source));assert.equal(installed.consumerSha256,sha256(source));
		assert.equal(await digest(join(root,pkg.name+"."+pkg.version+".nupkg")),archive.sha256);
		const json=async file=>JSON.parse(await readFile(join(root,"lean-bridge",file+".json")));
		const api=await json("binding-ir"),proof=await json("elaboration"),inner=await json("package-receipt");
		assert.equal(inner.bindingIrSha256,hashBindingIr(api));assert.equal(inner.bindingIrSha256,receipt.profiles[0].bindingIrSha256);
		assert.equal(inner.sourceTreeSha256,proof.sourceTreeSha256);assert.equal(inner.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(inner.runtimeIdentity,pkg.runtimeIdentity);assert.equal(inner.assembly,"LeanBridge.Budget");
		const runtimeLibraries={};
		for(const [path,record] of Object.entries(inner.files))
		{
			// NuGet consumes ZIP bookkeeping itself. Rehash every installed
			// executable, managed assembly, author input and bridge manifest.
			if(!/^(?:lib|runtimes|lean-bridge)\//u.test(path)) continue;
			const file=resolve(root,path);assert.ok(!isAbsolute(path) && !relative(root,file).startsWith(".."));
			assert.equal((await stat(file)).size,record.bytes);assert.equal(await digest(file),record.sha256);
			if(path.endsWith("/libleanshared.so") || path.endsWith("/liblean_bridge_native.so")) runtimeLibraries[path]=record.sha256;
		}
		assert.equal(Object.keys(runtimeLibraries).length,2);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
		{
			const cb=api.types.find(t=>t.id===p.type.id);
			assert.equal(cb.callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		}
		if(route==="ordinary")
		{
			ordinary=api;first=archive.sha256;shared=runtimeLibraries;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));assert.equal(api.documentation.summary,nativeBudgetReview);
			assert.notEqual(archive.sha256,first);assert.deepEqual(runtimeLibraries,shared);
		}
		const moved=join(work,route+"-moved");await rename(join(app,"out"),moved);
		await rm(consumer,{recursive: true});await rm(handoff,{recursive: true});
		const assembly=inner.assembly+".dll";assert.equal(await digest(join(moved,assembly)),inner.files["lib/net8.0/"+assembly].sha256);
		const call=await runCopied(host.executable,["Consumer.dll"],moved,{...host.env,DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "4"});
		assert.equal(call.stderr,"");parseResult(call.stdout);
		const row={
			route,archive,observation,clientSha256: installed.consumerSha256
			, clientAssemblySha256: await digest(join(moved,"Consumer.dll"))
			, assemblySha256: await digest(join(moved,assembly))
			, sdk: inner.sdk
			, receiptSha256: result.receiptSha256
			, bindingIrSha256: inner.bindingIrSha256
			, sourceTreeSha256: inner.sourceTreeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256
			, runtimeIdentity: inner.runtimeIdentity
			, runtimeLibraries
		};
		await writeFile(join(out,route+".json"),canonicalJson(row));await rm(moved,{recursive: true});
	}
	t.diagnostic("Handoffs: "+sets);
});
