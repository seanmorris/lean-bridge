/** @file Build two real author releases; consume each offline with pip, RubyGems and Cargo. */
import assert from "node:assert/strict";
import {access,mkdir,mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {nativeFixtureEnvironment} from "./copied-fixture-install.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runIncomingConsumer} from "./native-incoming-consumers.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {prepareStagedQuoteProject} from "./staged-quote-project.mjs";
import {prepareRustCorpusDependencies} from "./type-corpus-rust.mjs";

const targets=["pypi","rubygems","cargo"],fixture=resolve("tests/fixtures");

const application=process.env.LEAN_BRIDGE_NATIVE_APPLICATION_FUNCTIONS==="1";
const fixtureOptions=application?{hostFunctions: true}:{incoming: true};
test("offline installed "+(application?"application-origin functions":"direct callback borrows")+": wheel, gem and crate",{timeout: 14_400_000},async t=>{
	const env={...nativeFixtureEnvironment(["rust","ruby","python"]),CARGO_NET_OFFLINE: "true"
		, CARGO_HOME: process.env.CARGO_HOME??resolve(".toolchains/cargo-copied")
		, LEAN_BRIDGE_PYTHON: process.env.LEAN_BRIDGE_PYTHON??"/usr/bin/python3"};
	const prefix=application?"LEAN_BRIDGE_NATIVE_APP_QUOTE_":"LEAN_BRIDGE_NATIVE_INCOMING_";
	const keep=env[prefix+"KEEP"],replay=env[prefix+"REPLAY"],resume=env[prefix+"RESUME"];
	assert.ok([keep,replay,resume].filter(Boolean).length<=1,"select one retention, resume or replay directory");
	const only=env[prefix+"ROUTE"];
	if(only)assert.ok((replay||resume)&&["ordinary","reviewed"].includes(only),"one-route checks require a replay or resume directory; they do not establish the pair");
	const lane=env[prefix+"TARGET"];
	if(lane)assert.ok(replay&&targets.includes(lane),"one-target checks require a replay directory");
	const selected=lane?[lane]:targets;
	if(!replay)await runNativeTool(env.LEAN_BRIDGE_PYTHON,["-I","-B","-c","import venv, ensurepip; print(ensurepip.version())"],process.cwd(),env)
		.catch(cause=>{throw new Error("Set LEAN_BRIDGE_PYTHON to a Python with venv and ensurepip before starting the producer",{cause});});
	const work=await mkdtemp(join(tmpdir(),"native-incoming-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const sets=replay||resume?resolve(replay??resume):keep?await mkdtemp(join(resolve(keep),"sets-")):join(work,"sets");
	if(replay||resume) await access(sets);
	const out=resolve(env[prefix+"OUTPUT"]??(application?"build/native-application-functions":"build/native-incoming-reports"));
	const base=await readFile(join(fixture,"onboarding/leased-closure-fields/Owned.lean"),"utf8");
	const suffix=await readFile(join(fixture,"structured-types",application?"pass-application-quote.lean":"visit-quote.lean"),"utf8");
	const sourceSha256=sha256(base+"\n"+suffix);
	const reports=[],failures=[];
	for(const route of only?[only]:["ordinary","reviewed"])
	{
		const stage=join(work,route),dest=join(sets,route),handoff=join(dest,"package"),depRoot=join(dest,"locked");
		await mkdir(stage);
		const exists=resume&&await access(dest).then(()=>true,e=>{if(e.code!=="ENOENT")throw e;return false;});
		if(!replay&&!exists)
		{
			const project=join(stage,"project"),output=join(stage,"producer");
			await prepareStagedQuoteProject(project,route,targets,fixtureOptions);
			assert.equal(sha256(await readFile(join(project,"Owned.lean"))),sourceSha256);
			try
			{
				await buildCanonicalProject({projectRoot: project,outputRoot: output,targets,environment: env});
			}
			catch(e)
			{
				throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});
			}
			await copyPackageSetHandoff(output,handoff);await mkdir(depRoot);
			const deps=await prepareRustCorpusDependencies({rustRoot: join(output,"native/rust"),directory: stage,handoff: depRoot,environment: env});
			await saveLakeFile(depRoot,"dependencies.json",canonicalJson(deps));
			await rm(project,{recursive: true});await rm(output,{recursive: true});
			await rm(join(stage,"rust-dependencies"),{recursive: true});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		assert.deepEqual(receipt.packages.map(p=>p.target).sort(),targets.toSorted());
		assert.ok(receipt.packages.every(p=>p.role==="component" && p.name==="tariff-quotes" && p.version==="1.0.0"));
		const dependencies=JSON.parse(await readFile(join(depRoot,"dependencies.json")));
		const results={};
		for(const target of selected)
		{
			const pkg=receipt.packages.find(p=>p.target===target),profile=receipt.profiles.find(p=>p.id===pkg.profile);
			const app=join(stage,target);
			try
			{
				const checked=await runIncomingConsumer({app,handoff,depRoot,dependencies,env,sourceSha256,route,pkg,profile,application});
				results[target]={archive: pkg.artifacts[0],runtimeIdentity: pkg.runtimeIdentity,...checked};
				await saveLakeFile(out,route+"."+target+".json",canonicalJson({route,sourceSha256,receiptSha256: result.receiptSha256,...results[target]}));
				await rm(join(out,route+"."+target+".failure.json"),{force: true});
				t.diagnostic(route+" "+target+" passed");
			}
			catch(cause)
			{
				const message=route+"/"+target+": "+cause.message;failures.push(new Error(message,{cause}));t.diagnostic(message);
				await saveLakeFile(out,route+"."+target+".failure.json",canonicalJson({route,target,receiptSha256: result.receiptSha256,error: cause.message}));
			}
			finally
			{
				await rm(app,{recursive: true,force: true});
			}
		}
		if(Object.keys(results).length!==selected.length)continue;
		assert.equal(new Set(Object.values(results).map(p=>p.bindingIrSha256)).size,1);
		assert.equal(new Set(Object.values(results).map(p=>p.componentSha256)).size,1);
		assert.equal(new Set(Object.values(results).map(p=>p.runtimeIdentity)).size,1);
		reports.push({route,receiptSha256: result.receiptSha256,results});
	}
	if(failures.length)throw new AggregateError(failures,failures.map(e=>e.message.split("\n")[0]).join("\n"));
	if(only||lane)
	{
		t.diagnostic("Selected "+(only??"both routes")+"/"+(lane??"all targets")+"; no full paired report emitted");return;
	}
	for(const target of targets)
	{
		const [a,b]=reports.map(r=>r.results[target]);assert.notEqual(a.archive.sha256,b.archive.sha256);
		for(const key of ["runtimeIdentity","clientSha256","observerSha256","observed"]) assert.deepEqual(a[key],b[key]);
		assert.equal(a.reviewedSourceSha256,null);assert.match(b.reviewedSourceSha256,/^[a-f0-9]{64}$/u);
	}
	await saveLakeFile(out,"pair.json",canonicalJson({sourceSha256,reports}));
	t.diagnostic("Verified handoffs: "+sets);
});
