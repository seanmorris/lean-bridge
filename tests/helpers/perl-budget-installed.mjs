/** @file Run the original CPAN distributions on threaded and unthreaded Perl. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,isAbsolute,join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

test("installed XS preserves one-call admission and the original Perl exception across four ABIs",{timeout: 14400000},async t=>{
	const env=process.env,perls=JSON.parse(env.LEAN_BRIDGE_PERLS),deps=env.LEAN_BRIDGE_PERL_TASK_DEPS;
	assert.ok(perls.length===4 && new Set(perls).size===4 && perls.every(isAbsolute) && deps);
	const work=await mkdtemp(join(tmpdir(),"perl-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_PERL_BUDGET_KEEP,replay=env.LEAN_BRIDGE_PERL_BUDGET_REPLAY;assert.ok(!(keep && replay));
	// Check the same platform contract as Makefile.PL before compiling two Lean
	// projects. Original archives still enforce their own recorded floor on replay.
	const platform=resolve("src/backends/perl/Platform.pm"),floor=env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR??"2.38";
	const abiKeys=new Set();
	for(const perl of perls)
	{
		const check="require $ARGV[0]; "+(replay?"":"LeanBridge::Runtime::Platform::platform($ARGV[1]); ")
			+"print LeanBridge::Runtime::Platform::abi_key()";
		const key=await run(perl,["-MFuture=0.54","-MIO::Async=0.805","-e",check,platform,floor],work,{...env,PERL5LIB: deps});
		assert.match(key,/^[a-f0-9]{64}$/u);abiKeys.add(key);
	}
	assert.equal(abiKeys.size,4,"Expected four distinct installed Perl ABIs");
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_PERL_BUDGET_OUTPUT??"build/perl-budget");await mkdir(output,{recursive: true});
	const client=resolve("tests/fixtures/native-callback-budget/client.pl"),source=await readFile(client);
	const routes=["ordinary","reviewed"];let ordinary,runtime,first;
	for(const route of routes) if(!replay)
	{
		const checked=await buildNativeBudget({target: "cpan",work,set: join(sets,route),route,ordinary});
		if(route==="ordinary") ordinary=checked;
	}
	for(const route of routes)
	{
		const set=join(sets,route),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		const [profile]=receipt.profiles;assert.equal(profile.id,"native-perl-task-v1");
		const component=receipt.packages.find(p=>p.role==="component"),rt=receipt.packages.find(p=>p.role==="runtime");
		assert.ok(receipt.packages.length===2 && component.name==="LeanBridge-Budget" && rt.name==="LeanBridge-Runtime");
		const [archive]=component.artifacts,dist=join(set,archive.path),top=basename(dist,".tar.gz");
		const json=async f=>JSON.parse(await run("tar",["-xOzf",dist,top+"/"+f+".json"],work,env));
		const api=await json("binding-ir"),proof=await json("elaboration"),manifest=await json("lean-bridge-package");
		assert.equal(hashBindingIr(api),profile.bindingIrSha256);assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(proof.selection.perlTaskCallbacks,true);assert.equal(manifest.taskDelivery.bindingIrSha256,profile.bindingIrSha256);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
			assert.equal(api.types.find(t=>t.id===p.type.id).callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		if(route==="ordinary")
		{
			first=archive;runtime=rt.artifacts[0];ordinary=api;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.deepEqual(rt.artifacts[0],runtime);assert.notEqual(archive.sha256,first.sha256);
			assert.deepEqual(api,{...ordinary,documentation: {...ordinary.documentation,summary: nativeBudgetReview}});
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));
		}
		const observations=[];
		for(const [i,perl] of perls.entries())
		{
			const at=join(work,route+"-"+i),lib=p=>join(p,"lib/perl5");
			const install=(archive,prefix,mode,libs)=>installCpanArchive({archive,prefix,mode,perl,workingRoot: at,environment: {...env,PERL5LIB: libs}});
			const rtPrefix=join(at,"runtime"),moved=join(at,"relocated-runtime");
			await install(join(set,rt.artifacts[0].path),rtPrefix,"prebuilt-only",deps);await rename(rtPrefix,moved);
			const arch=await run(perl,["-MConfig","-e","print $Config{archname}"],at,env);
			for(const mode of ["prebuilt-only","build-xs"])
			{
				const original=join(at,"prefix"),deployed=join(at,mode);
				await install(dist,original,mode,[lib(moved),deps].join(":"));await rename(original,deployed);
				const module=join(lib(deployed),arch,"LeanBridge/Budget");
				const receipt=JSON.parse(await readFile(join(module,"install-receipt.json")));
				const binary=await readFile(join(lib(deployed),arch,"auto/LeanBridge/Budget/Budget.so"));
				assert.equal(sha256(binary),receipt.outputSha256);assert.equal(receipt.operation,mode==="build-xs"?"generated-xs-only":"prebuilt-xs");
				const fixture=join(deployed,"client.pl");await copyFile(client,fixture);assert.deepEqual(await readFile(fixture),source);
				const isolated={PATH: "/unavailable",LANG: "C.UTF-8",PERL5LIB: [lib(deployed),lib(moved),deps].join(":")};
				const row=JSON.parse(await run(perl,["client.pl"],deployed,isolated,180000));
				const abi=manifest.prebuilt.find(x=>x.abiKey===row.abiKey);
				assert.equal(abi?.abi.archname,arch);if(mode==="prebuilt-only") assert.equal(receipt.outputSha256,manifest.files[abi.path]);
				assert.equal(row.live,0);assert.equal(row.races,16);
				observations.push({...row,mode,xsSha256: receipt.outputSha256});
				await rm(deployed,{recursive: true});
			}
			await rm(at,{recursive: true});
		}
		for(const mode of ["prebuilt-only","build-xs"]) assert.deepEqual(observations.filter(o=>o.mode===mode).map(o=>o.perl+"-"+o.threads).sort(),["5.36.3-0","5.36.3-1","5.38.2-0","5.38.2-1"]);
		const row={route,archive,runtime,observations
			, receiptSha256: result.receiptSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256
			, sourceTreeSha256: proof.sourceTreeSha256
			, bindingIrSha256: profile.bindingIrSha256
			, clientSha256: sha256(source)};
		await writeFile(join(output,route+".json"),canonicalJson(row));
	}
	t.diagnostic("Handoffs: "+sets);
});
