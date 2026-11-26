/** @file Build both NuGet authoring routes and exercise typed function fields in relocated .NET applications. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {installCopiedConsumer,nativeFixtureEnvironment,runCopied} from "./copied-fixture-install.mjs";
import {ownedDotnetRuntimeOnly} from "./owned-dotnet-installed.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {checkStagedQuoteIdentities,prepareStagedQuoteProject} from "./staged-quote-project.mjs";

const points=["explicitly retained field survives source disposal"
	, "caller-built record crosses Lean", "repacked function survives the input"
	, "ordinary delegate cannot escape through a field", "closed field rejected"
	, "staged callback returns a native function", "host exception retains identity"
	, "binding reusable"];
const parseResult=stdout=>{
	const lines=stdout.trim().split("\n");assert.deepEqual(lines,points);return {checks: lines.length};
};
test("relocated .NET 8 applications call and return leased function fields",{timeout: 7_200_000},async t=>{
	const environment=nativeFixtureEnvironment(["dotnet"]),keep=process.env.LEAN_BRIDGE_DOTNET_TARIFF_KEEP,replay=process.env.LEAN_BRIDGE_DOTNET_TARIFF_REPLAY;
	assert.ok(!(keep && replay));
	const work=await mkdtemp(join(tmpdir(),"dotnet-tariff-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const set=replay?resolve(replay):keep?await mkdtemp(join(resolve(keep),"tariff-")):join(work,"handoffs");
	if(!keep && !replay) await mkdir(set);
	const routes=["ordinary","reviewed"];
	if(!replay)for(const route of routes)
	{
		const src=join(work,route+"-src"),out=join(work,route+"-release");
		await prepareStagedQuoteProject(src,route,"nuget");
		await buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["nuget"],environment})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		await copyPackageSetHandoff(out,join(set,route));
		await rm(src,{recursive: true});await rm(out,{recursive: true});
		t.diagnostic(route+" package built at "+join(set,route));
	}
	const cs=await readFile("tests/fixtures/structured-types/tariff-fields.cs","utf8");
	const output=resolve(process.env.LEAN_BRIDGE_DOTNET_TARIFF_OUTPUT??"build/dotnet-function-fields");await mkdir(output,{recursive: true});
	for(const route of routes)
	{
		const handoff=join(work,route+"-handoff"),consumer=join(work,route+"-app");
		await copyPackageSetHandoff(join(set,route),handoff);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		const [pkg]=receipt.packages;assert.equal(pkg.target,"nuget");assert.equal(pkg.name,"tariff-quotes");
		const installed=await installCopiedConsumer({profile: "dotnet",environment,consumer,handoff,packages: receipt.packages
			, fixture: {source: ()=>cs,parseResult,expectedChecks: points.length}});
		const pkgDir=join(consumer,"dotnet","packages",pkg.name.toLowerCase(),pkg.version);
		const model=JSON.parse(await readFile(join(pkgDir,"lean-bridge/component/model.json")));
		const ir=JSON.parse(await readFile(join(pkgDir,"lean-bridge/component/binding-ir.json")));
		const identity=checkStagedQuoteIdentities(model,ir,receipt.profiles.find(p=>p.id===pkg.profile),route);
		const app=join(work,route+"-moved");await rename(join(consumer,"dotnet","out"),app);
		await rm(consumer,{recursive: true});await rm(handoff,{recursive: true});
		const host=await ownedDotnetRuntimeOnly(join(work,route+"-runtime"),environment.LEAN_BRIDGE_DOTNET);
		const exec=await runCopied(host.executable,["Consumer.dll"],app,{...host.env,PATH: "/no-author-tools",DOTNET_PROCESSOR_COUNT: "1",LEAN_NUM_THREADS: "1"});
		assert.equal(exec.stderr,"");parseResult(exec.stdout);
		assert.equal(installed.consumerSha256,sha256(cs));
		const live=JSON.parse(await readFile(join(app,"ownership-counts.json")));
		assert.ok(live.held>live.baseline);assert.equal(live.afterThreadExit,0);
		for(const point of ["retain","echo","repack","expired","closed","afterCallbackFailure"]) assert.equal(live[point],live.baseline,point);
		await writeFile(join(output,route+".json"),canonicalJson({route,receiptSha256: result.receiptSha256,archive: pkg.artifacts[0],...identity,
			clientSha256: sha256(cs),clientAssemblySha256: sha256(await readFile(join(app,"Consumer.dll"))),live,relocated: points}));
	}
	t.diagnostic("Handoffs: "+set);
});
