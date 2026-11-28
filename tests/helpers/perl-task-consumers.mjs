/**
 * Consume only installed original CPAN task archives and an ordinary CPAN event loop.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const env={...process.env,LEAN_NUM_THREADS: "1"}, capture=env.LEAN_BRIDGE_PERL_TASK_CAPTURE, replay=env.LEAN_BRIDGE_PERL_TASK_REPLAY;
const json=async p=>JSON.parse(await readFile(p,"utf8")), smoke=env.LEAN_BRIDGE_PERL_TASK_SMOKE==="1";
const audit=env.LEAN_BRIDGE_PERL_TASK_AUDIT;
test("published Perl task evidence matches the original installed TAP and the offline CLI rebuild",{skip: !audit},async()=>{
	const pin=await json("docs/evidence/perl-tasks-20261123.json");
	const root=resolve(audit), repro=resolve(env.LEAN_BRIDGE_PERL_TASK_REPRODUCED);
	const bytes=await readFile(join(root,"acceptance.json")), reproduction=await readFile(join(repro,"reproduction.json"));
	assert.equal(sha256(bytes),pin.acceptanceSha256); assert.equal(sha256(reproduction),pin.reproductionSha256);
	const evidence=JSON.parse(bytes), rebuilt=JSON.parse(reproduction);
	assert.deepEqual(rebuilt,pin.offlineCLI);
	assert.equal(rebuilt.receiptSha256,evidence.packages.find(p=>p.route==="ordinary").receiptSha256);
	assert.deepEqual(evidence.rows,pin.rows); assert.deepEqual(evidence.fallback,pin.fallback);
	assert.deepEqual(evidence.sources,pin.sources);
	for(const [name,hash] of Object.entries(pin.sources)) assert.equal(sha256(await readFile(join(root,name))),hash);
	for(const original of evidence.packages)
	{
		const match=pin.packages.find(p=>p.route===original.route);
		assert.deepEqual(original.runtime,pin.sharedRuntime); assert.deepEqual(original.component,match.component);
		assert.deepEqual(original.profile,match.profile); assert.equal(original.receiptSha256,match.receiptSha256);
		assert.deepEqual(original.leanSources,match.modules);
	}
	const counts=()=>({planned: 0,skipped: 0,passed: 0}), prebuilt=counts(),fallback=counts();
	const sum=async (name,obs,total)=>{
		const tap=await readFile(join(root,name),"utf8"); assert.equal(sha256(tap),obs.tapSha256);
		const results=tap.split("\n").filter(l=>/^ok \d+\b/u.test(l));
		assert.equal(results.length,obs.tests);
		const skipped=results.filter(l=>/#\s*SKIP\b/iu.test(l)).length;
		total.planned+=results.length; total.skipped+=skipped; total.passed+=results.length-skipped;
	};
	for(const row of evidence.rows) for(const [label,obs] of Object.entries(row.observations))
		await sum(row.route+"-"+row.key+"-"+label+".tap",obs,prebuilt);
	for(const row of evidence.fallback) await sum("fallback-"+row.key+"-public.tap",row,fallback);
	assert.deepEqual(prebuilt,pin.prebuiltTAP); assert.deepEqual(fallback,pin.fallbackTAP);
});
test("installed CPAN futures and demand-driven cursors execute compiled Lean on the application event loop",{skip: !capture&&!replay,timeout: 7_200_000},async t=>{
	assert.ok(!(capture&&replay)); const root=resolve(capture??replay), stage=await mkdtemp(join(tmpdir(),"installed-perl-task-"));
	const observationsRoot=smoke&&env.LEAN_BRIDGE_PERL_TASK_SMOKE_OUTPUT ? resolve(env.LEAN_BRIDGE_PERL_TASK_SMOKE_OUTPUT) : root;
	if(capture&&observationsRoot!==root) await mkdir(observationsRoot);
	if(env.LEAN_BRIDGE_PERL_TASK_KEEP) t.diagnostic("Kept isolated installed clients: "+stage); else t.after(()=>rm(stage,{recursive: true,force: true}));
	const prior=replay?await readFile(join(observationsRoot,"acceptance.json")):null;
	if(env.LEAN_BRIDGE_PERL_TASK_EXPECTED)
	{
		assert.ok(prior&&!smoke,"A pinned acceptance digest requires replay of the full original release");
		assert.equal(sha256(prior),(await json(env.LEAN_BRIDGE_PERL_TASK_EXPECTED)).acceptanceSha256);
	}
	const checked=prior?JSON.parse(prior):null;
	const affinity=!replay || Boolean(checked.sources["affinity.t"]);
	const parked=!smoke && (!replay || Object.hasOwn(checked.sources,"parked.pl"));
	const packages=[], files=new Map(), rows=[], sources={}, collected=new Map(), fallback=[];
	const recordTap=async (name,tap)=>{
		assert.doesNotMatch(tap,/^not ok\b/mu);
		const plan=/^1\.\.(\d+)$/mu.exec(tap); assert.ok(plan,"installed Perl client did not finish TAP");
		const tests=Number(plan[1]);
		assert.equal(tap.split("\n").filter(line=>/^ok \d+\b/u.test(line)).length,tests);
		const original=tap+"\n";
		if(replay) assert.equal(await readFile(join(observationsRoot,name),"utf8"),original); else collected.set(name,original);
		return {tests,tapSha256: sha256(original)};
	};
	const clients=["installed.t",...affinity?["affinity.t"]:[]];
	for(const name of smoke?clients:[...clients,...parked?["parked.pl"]:[],"peer.t","retired.t","example.pl","Observe.xs","build-observer.pl","verify.py"])
	{
		const fixture=["Observe.xs","build-observer.pl","verify.py"].includes(name)?"perl-sync-io":"perl-tasks";
		const b=await readFile(replay?join(observationsRoot,name):resolve("tests/fixtures",fixture,name)); sources[name]=sha256(b);
		if(replay) assert.equal(checked.sources[name],sources[name]);
		await writeFile(join(stage,name),b,{flag: "wx"});
	}
	for(const route of smoke?["ordinary"]:["ordinary","reviewed","peer"])
	{
		const dir=join(root,route,"handoff"), {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		await assertJsonSchema("package-set-receipt",receipt);
		const [component,runtime]=["component","runtime"].map(role=>receipt.packages.find(p=>p.role===role)); assert.equal(receipt.profiles[0].id,"native-perl-task-v1");
		const name=route==="peer"?"Signals":"Pulse"; assert.equal(component.name,"LeanBridge-"+name); assert.deepEqual(component.requires,[{ecosystem: "cpan",name: runtime.name,version: runtime.version}]);
		const manifest=await json(join(dir,"packages/component/lean-bridge-package.json")), meta=await json(join(dir,"packages/component/META.json"));
		assert.equal(manifest.taskDelivery.bindingIrSha256,receipt.profiles[0].bindingIrSha256); assert.equal(meta.prereqs.runtime.requires["IO::Async::Loop"],"0.805"); assert.equal(meta.prereqs.runtime.requires.Future,"0.54");
		assert.ok(!manifest.syncIO); assert.ok(!(await json(join(dir,"packages/runtime/META.json"))).prereqs.runtime.requires.Future);
		assert.equal(runtime.artifacts[0].sha256,packages[0]?.runtime.sha256??runtime.artifacts[0].sha256);
		if(replay) assert.equal(result.receiptSha256,checked.packages.find(p=>p.route===route).receiptSha256);
		files.set(route,{name,manifest,component: join(dir,component.artifacts[0].path),runtime: join(dir,runtime.artifacts[0].path)});
		const inspection={};
		if(!smoke)
		{
			const evidence=await json(join(dir,"host-export-evidence.json"));
			inspection.leanSources={};
			for(const {module,sourceSha256} of evidence.interfaces)
			{
				assert.match(module,/^[A-Za-z][A-Za-z0-9_]*$/u);
				if(capture) assert.equal(sha256(await readFile(join(root,route,"source",module+".lean"))),sourceSha256);
				inspection.leanSources[module]=sourceSha256;
			}
			const inspect=async role=>JSON.parse(await run("python3",["-I",join(stage,"verify.py"),role,files.get(route)[role],join(dir,"binding-ir.json"),join(dir,"host-export-evidence.json"),"task"],stage,env,240_000));
			inspection.runtimeInspection=packages[0]?.runtimeInspection??await inspect("runtime");
			inspection.componentInspection=await inspect("component");
			assert.equal(inspection.runtimeInspection.version,inspection.componentInspection.runtimeVersion);
			assert.equal(inspection.runtimeInspection.bindingRuntime,inspection.componentInspection.bindingRuntime);
			assert.equal(inspection.componentInspection.nativeRuntime,runtime.runtimeIdentity);
		}
		packages.push({route,receiptSha256: result.receiptSha256,profile: receipt.profiles[0],component: component.artifacts[0],runtime: runtime.artifacts[0],...inspection});
	}
	const deps=env.LEAN_BRIDGE_PERL_TASK_DEPS; assert.ok(deps,"Set LEAN_BRIDGE_PERL_TASK_DEPS to the installed upstream Perl modules");
	for(const [i,perl] of JSON.parse(env.LEAN_BRIDGE_PERLS).entries())
	{
		const dir=join(stage,"abi-"+i), before=join(dir,"installed"), moved=join(dir,"relocated"); await mkdir(before,{recursive: true});
		const install=(archive,n,libs)=>installCpanArchive({archive,workingRoot: dir,prefix: join(before,n),perl,mode: "prebuilt-only",environment: {...env,PERL5LIB: libs}});
		const rt=await install(files.get("ordinary").runtime,"runtime",deps);
		for(const [route,f] of files) await install(f.component,route,rt.perl5lib);
		await rename(before,moved);
		const lib=n=>join(moved,n,"lib/perl5"), observer=join(dir,"observer");
		if(!smoke)
{ await mkdir(observer); await run(perl,[join(stage,"build-observer.pl"),join(stage,"Observe.xs")],observer,{...env,PERL5LIB: lib("runtime")}); }
		for(const route of smoke?["ordinary"]:["ordinary","reviewed"])
		{
			const pwd=join(dir,route); await mkdir(pwd);
			const child={PATH: "/unavailable",LANG: "C.UTF-8",TMPDIR: pwd,LEAN_NUM_THREADS: "1",PERL5LIB: [lib(route),...smoke?[]:[lib("peer")],lib("runtime"),deps].join(":")};
			const abi=JSON.parse(await run(perl,["-MLeanBridge::Runtime::Platform","-MJSON::PP","-e","print JSON::PP->new->canonical->encode({key=>LeanBridge::Runtime::Platform::abi_key(),version=>sprintf('%vd',$^V),threaded=>!!$Config::Config{useithreads}?1:0})"],pwd,child));
			if(!smoke)
			{
				const modules=JSON.parse(await run(perl,["-MFuture","-MIO::Async::Loop","-MJSON::PP","-e","print JSON::PP->new->canonical->encode({future=>[q{}.$Future::VERSION,$INC{'Future.pm'}],loop=>[q{}.$IO::Async::Loop::VERSION,$INC{'IO/Async/Loop.pm'}]})"],pwd,child));
				for(const [name,version,path] of [["future","0.54","Future.pm"],["loop","0.805","IO/Async/Loop.pm"]])
					assert.deepEqual(modules[name].map(String),[version,join(deps,path)]);
			}
			const manifest=files.get(route).manifest, exp=manifest.prebuilt.find(x=>x.abiKey===abi.key); assert.ok(exp);
			const arch=join(lib(route),exp.abi.archname), installed=await json(join(arch,"LeanBridge/Pulse/install-receipt.json"));
			assert.equal(installed.operation,"prebuilt-xs"); assert.equal(installed.outputSha256,manifest.files[exp.path]); assert.equal(sha256(await readFile(join(arch,"auto/LeanBridge/Pulse/Pulse.so"))),installed.outputSha256);
			const observations={};
			for(const [label,script,...args] of [["public","installed.t"],...affinity?[["affinity","affinity.t"]]:[],...smoke?[]:[["pulse-first","peer.t","pulse-first"],["peer-first","peer.t","peer-first"],["retirement","retired.t"]]])
			{
				const tap=await run(perl,[...label==="retirement"?["-I"+observer]:[],join(stage,script),...args],pwd,child,240_000);
				const name=route+"-"+abi.key+"-"+label+".tap";
				observations[label]=await recordTap(name,tap);
			}
			if(!smoke) assert.equal(await run(perl,[join(stage,"example.pl")],pwd,child),"42\nfirst\n73");
			const parkedPull={};
			if(parked) for(const order of ["peer-first","pulse-first"])
			{
				parkedPull[order]=await run(perl,[join(stage,"parked.pl"),order],pwd,child,120_000);
				assert.equal(parkedPull[order],"blocked pull: reader cancel and cursor close each finalized once; usable peer, no late value, zero live owners and descriptor delta");
			}
			rows.push({route,...abi,installedXsSha256: installed.outputSha256,observations,...parked?{parkedPull}:{}});
			t.diagnostic(route+" "+abi.version+" "+(abi.threaded?"threaded":"unthreaded")+": installed task and cursor checks passed");
		}
		if(!smoke&&i===0)
		{
			const prefix=join(dir,"xs-only"),pwd=join(dir,"fallback-client"); await mkdir(pwd);
			const {component,manifest}=files.get("ordinary");
			await installCpanArchive({archive: component,workingRoot: dir,prefix,perl,mode: "build-xs",environment: {...env,PERL5LIB: [lib("runtime"),deps].join(":")}});
			const relocated=join(dir,"relocated-xs-only"); await rename(prefix,relocated);
			const own=join(relocated,"lib/perl5"),child={PATH: "/unavailable",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1",TMPDIR: pwd,PERL5LIB: [own,lib("runtime"),deps].join(":")};
			assert.equal(await run(perl,[join(stage,"example.pl")],pwd,child),"42\nfirst\n73");
			const key=rows[0].key,arch=join(own,manifest.prebuilt.find(p=>p.abiKey===key).abi.archname);
			const receipt=await json(join(arch,"LeanBridge/Pulse/install-receipt.json"));
			assert.equal(receipt.operation,"generated-xs-only");
			assert.equal(receipt.sourceSha256,manifest.files["Component.xs"]);
			assert.equal(receipt.outputSha256,sha256(await readFile(join(arch,"auto/LeanBridge/Pulse/Pulse.so"))));
			const obs=await recordTap("fallback-"+key+"-public.tap",await run(perl,[join(stage,"installed.t")],pwd,child,240_000));
			fallback.push({key,installedXsSha256: receipt.outputSha256,sourceSha256: receipt.sourceSha256,...obs});
		}
	}
	if(!smoke)
	{
		assert.equal(packages[0].profile.bindingIrSha256,packages[1].profile.bindingIrSha256);
		assert.notEqual(packages[0].profile.bindingIrSha256,packages[2].profile.bindingIrSha256);
		for(const route of ["ordinary","reviewed"]) assert.deepEqual(rows.filter(x=>x.route===route).map(x=>x.version+":"+x.threaded).sort(),["5.36.3:0","5.36.3:1","5.38.2:0","5.38.2:1"]);
	}
	const report={schemaVersion: 1,packages,sources,rows,...smoke?{}:{fallback}};
	if(replay) assert.deepEqual(report,checked);
	else
{
		for(const [name,tap] of collected) await writeFile(join(observationsRoot,name),tap,{flag: "wx"});
		for(const f of Object.keys(sources)) await writeFile(join(observationsRoot,f),await readFile(join(stage,f)),{flag: "wx"});
		await writeFile(join(observationsRoot,"acceptance.json"),canonicalJson(report),{flag: "wx"});
}
});
