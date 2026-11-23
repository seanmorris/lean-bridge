/**
 * Install compiled CPAN workers and exercise their retained callbacks on a real IO::Async loop.
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

const env={...process.env,LEAN_NUM_THREADS: "1"};
const json=async path=>JSON.parse(await readFile(path,"utf8"));
const capture=env.LEAN_BRIDGE_PERL_CALLBACK_CAPTURE, replay=env.LEAN_BRIDGE_PERL_CALLBACK_REPLAY;
const smoke=env.LEAN_BRIDGE_PERL_CALLBACK_SMOKE==="1";
test(smoke?"installed compiled workers invoke genuine Perl callbacks on four ABIs":"installed compiled workers invoke genuine Perl callbacks across both package orders",{skip: !capture&&!replay,timeout: 7_200_000},async t=>{
	assert.ok(!(capture&&replay));
	const root=resolve(capture??replay),deps=env.LEAN_BRIDGE_PERL_TASK_DEPS;
	assert.ok(deps,"Set LEAN_BRIDGE_PERL_TASK_DEPS to the installed Future and IO::Async modules");
	const stage=await mkdtemp(join(tmpdir(),"installed-perl-callback-"));
	t.after(()=>rm(stage,{recursive: true,force: true}));
	const obs=smoke?join(root,"smoke"):root;
	if(smoke&&capture) await mkdir(obs);
	const original=replay?await readFile(join(obs,"acceptance.json")):null;
	if(env.LEAN_BRIDGE_PERL_CALLBACK_EXPECTED)
	{
		assert.ok(original&&!smoke,"A release pin applies to full replay only");
		assert.equal(sha256(original),(await json(env.LEAN_BRIDGE_PERL_CALLBACK_EXPECTED)).acceptanceSha256);
	}
	const retained=original?JSON.parse(original):null;
	const byRoute=new Map(),reports=[],rows=[],pending=new Map(),sources={};
	for(const f of ["installed.t","registration.t","example.pl",...smoke?[]:["compose.t","retired.t","Observe.xs","build-observer.pl","verify.py"]])
	{
		const fixture=["Observe.xs","build-observer.pl","verify.py"].includes(f)?"perl-sync-io":"perl-retained-tasks";
		const source=await readFile(replay?join(obs,f):resolve("tests/fixtures",fixture,f));
		sources[f]=sha256(source); if(replay) assert.equal(retained.sources[f],sources[f]);
		await writeFile(join(stage,f),source,{flag: "wx"}); pending.set(f,source);
	}
	for(const route of smoke?["ordinary"]:["ordinary","reviewed","peer"])
	{
		const at=join(root,route,"handoff"),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(at,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,"native-perl-task-v1");
		const runtime=receipt.packages.find(p=>p.role==="runtime"),component=receipt.packages.find(p=>p.role==="component");
		assert.equal(component.name,route==="peer"?"LeanBridge-Relay":"LeanBridge-Retained");
		assert.deepEqual(runtime.artifacts[0],reports[0]?.runtime??runtime.artifacts[0]);
		assert.deepEqual(component.requires,[{ecosystem: "cpan",name: runtime.name,version: runtime.version}]);
		const manifest=await json(join(at,"packages/component/lean-bridge-package.json"));
		assert.equal(manifest.taskDelivery.bindingIrSha256,receipt.profiles[0].bindingIrSha256);
		const rt=join(at,runtime.artifacts[0].path),app=join(at,component.artifacts[0].path);
		byRoute.set(route,{rt,app,manifest});
		const inspection={};
		if(!smoke)
		{
			const inspect=async (role,path)=>JSON.parse(await run("python3",["-I",join(stage,"verify.py"),role,path,join(at,"binding-ir.json"),join(at,"host-export-evidence.json"),"task"],stage,env,240_000));
			inspection.runtimeInspection=reports[0]?.runtimeInspection??await inspect("runtime",rt);
			inspection.componentInspection=await inspect("component",app);
			assert.equal(inspection.componentInspection.nativeRuntime,runtime.runtimeIdentity);
			assert.equal(inspection.componentInspection.bindingRuntime,inspection.runtimeInspection.bindingRuntime);
			const proof=await json(join(at,"host-export-evidence.json"));
			inspection.modules={};
			for(const {module,sourceSha256} of proof.interfaces)
			{
				assert.match(module,/^[A-Za-z][A-Za-z0-9_]*$/u);
				if(capture) assert.equal(sha256(await readFile(join(root,route,"source",module+".lean"))),sourceSha256);
				inspection.modules[module]=sourceSha256;
			}
		}
		reports.push({route,receipt: result.receiptSha256,profile: receipt.profiles[0],runtime: runtime.artifacts[0],component: component.artifacts[0],...inspection});
	}
	for(const [i,perl] of JSON.parse(env.LEAN_BRIDGE_PERLS).entries())
	{
		const dir=join(stage,"abi-"+i),prefix=join(dir,"installed"),moved=join(dir,"relocated"); await mkdir(prefix,{recursive: true});
		const install=(archive,name,lib)=>installCpanArchive({archive,workingRoot: dir,prefix: join(prefix,name),perl,mode: "prebuilt-only",environment: {...env,PERL5LIB: lib}});
		const rt=await install(byRoute.get("ordinary").rt,"runtime",deps);
		for(const [route,f] of byRoute) await install(f.app,route,rt.perl5lib);
		await rename(prefix,moved);
		const observer=join(dir,"observer");
		if(!smoke)
		{
			await mkdir(observer);
			await run(perl,[join(stage,"build-observer.pl"),join(stage,"Observe.xs")],observer,{...env,PERL5LIB: join(moved,"runtime/lib/perl5")});
		}
		for(const route of smoke?["ordinary"]:["ordinary","reviewed"])
		{
			const lib=name=>join(moved,name,"lib/perl5");
			const child={PATH: "/unavailable",PERL5LIB: [lib(route),...smoke?[]:[lib("peer")],lib("runtime"),deps].join(":"),LANG: "C.UTF-8",TMPDIR: dir,LEAN_NUM_THREADS: "1"};
			const abi=JSON.parse(await run(perl,["-MLeanBridge::Runtime::Platform","-MJSON::PP","-e","print JSON::PP->new->canonical->encode({key=>LeanBridge::Runtime::Platform::abi_key(),version=>sprintf('%vd',$^V),threaded=>!!$Config::Config{useithreads}?1:0})"],dir,child));
			const observations={};
			assert.equal(await run(perl,[join(stage,"example.pl")],dir,child,180_000),"go!!");
			const manifest=byRoute.get(route).manifest,variant=manifest.prebuilt.find(x=>x.abiKey===abi.key);
			assert.ok(variant);
			const arch=join(lib(route),variant.abi.archname),module=manifest.module.split("::");
			const installed=await json(join(arch,...module,"install-receipt.json"));
			assert.equal(installed.operation,"prebuilt-xs");
			assert.equal(installed.outputSha256,manifest.files[variant.path]);
			assert.equal(sha256(await readFile(join(arch,"auto",...module,module.at(-1)+".so"))),installed.outputSha256);
			for(const [label,script,...args] of [["public","installed.t"],["registration","registration.t"],...smoke?[]:[["primary-first","compose.t","primary-first"],["relay-first","compose.t","relay-first"],["retirement","retired.t"]]])
			{
				const tap=await run(perl,[...label==="retirement"?["-I"+observer]:[],join(stage,script),...args],dir,child,180_000);
				assert.doesNotMatch(tap,/^not ok\b/mu);
				const count=Number(/^1\.\.(\d+)$/mu.exec(tap)?.[1]);
				assert.ok(count>0); assert.equal(tap.split("\n").filter(l=>/^ok \d+\b/u.test(l)).length,count);
				observations[label]={tests: count,tapSha256: sha256(tap+"\n")};
				const file=route+"-"+abi.key+"-"+label+".tap";
				if(replay) assert.equal(await readFile(join(obs,file),"utf8"),tap+"\n");
				else pending.set(file,tap+"\n");
			}
			rows.push({route,...abi,installedXsSha256: installed.outputSha256,observations});
			t.diagnostic(route+" "+abi.version+" "+(abi.threaded?"threaded":"unthreaded")+": installed retained callback checks passed");
		}
	}
	if(!smoke)
	{
		assert.equal(reports[0].profile.bindingIrSha256,reports[1].profile.bindingIrSha256);
		assert.notEqual(reports[0].profile.bindingIrSha256,reports[2].profile.bindingIrSha256);
		for(const route of ["ordinary","reviewed"])
			assert.deepEqual(rows.filter(r=>r.route===route).map(r=>r.version+":"+r.threaded).sort(),["5.36.3:0","5.36.3:1","5.38.2:0","5.38.2:1"]);
	}
	const report={schemaVersion: 1,sources,packages: reports,rows};
	if(replay) assert.deepEqual(report,retained);
	else
	{
		for(const [file,data] of pending) await writeFile(join(obs,file),data,{flag: "wx"});
		await writeFile(join(obs,"acceptance.json"),canonicalJson(report),{flag: "wx"});
	}
});
