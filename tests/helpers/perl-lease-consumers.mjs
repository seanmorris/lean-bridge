/**
 * Relocate authentic CPAN installations and exchange resources between all three
 * profiles in fresh consumer processes, with no Lean or compiler on PATH.
 *
 * @file
 */
import assert from "node:assert/strict";
import { appendFile, chmod, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env={...process.env,LEAN_NUM_THREADS: "1"}, capture=env.LEAN_BRIDGE_PERL_LEASE_CAPTURE, replay=env.LEAN_BRIDGE_PERL_LEASE_REPLAY;
const json=async p=>JSON.parse(await readFile(p,"utf8"));
const probe=env.LEAN_BRIDGE_PERL_LEASE_PROBE;
const smoke=env.LEAN_BRIDGE_PERL_LEASE_SMOKE;
test("independent task-result leases survive weak observers and refuse an ithread",{skip: !probe,timeout: 900_000},async()=>{
	const root=resolve(probe,"ordinary/handoff"),perl=JSON.parse(env.LEAN_BRIDGE_PERLS)[0];
	const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(root,"package-set-receipt.json")});
	const stage=await mkdtemp(join(tmpdir(),"perl-lease-probe-"));
	try
	{
		const install=(role,lib)=>installCpanArchive({archive: join(root,receipt.packages.find(p=>p.role===role).artifacts[0].path)
			, workingRoot: stage
			, prefix: join(stage,role)
			, perl
			, mode: "prebuilt-only"
			, environment: {...env,PERL5LIB: lib}});
		const deps=env.LEAN_BRIDGE_PERL_TASK_DEPS,rt=await install("runtime",deps),app=await install("component",rt.perl5lib);
		const child={PATH: "/unavailable",PERL5LIB: [app.perl5lib,rt.perl5lib,deps].join(":"),LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"};
		assert.equal(await run(perl,[resolve("tests/fixtures/perl-task-resources/thread-probe.pl")],stage,child,90_000),"parent owner survived");
	}
	finally
{ await rm(stage,{recursive: true,force: true}); }
});
test("installed CPAN resources cross three profiles and survive asynchronous ownership changes",{skip: !capture&&!replay&&!smoke,timeout: 7_200_000},async t=>{
	assert.equal([capture,replay,smoke].filter(Boolean).length,1);
	const root=resolve(capture??replay??smoke), deps=env.LEAN_BRIDGE_PERL_TASK_DEPS; assert.ok(deps);
	const stage=await mkdtemp(join(tmpdir(),"installed-perl-leases-")); t.after(()=>rm(stage,{recursive: true,force: true}));
	const retained=replay?await json(join(root,"acceptance.json")):null;
	if(env.LEAN_BRIDGE_PERL_LEASE_EXPECTED)
	{
		assert.ok(replay,"A release pin applies only to complete replay");
		assert.equal(sha256(await readFile(join(root,"acceptance.json"))),(await json(env.LEAN_BRIDGE_PERL_LEASE_EXPECTED)).acceptanceSha256);
	}
	const sources={};
	const from=new Map(),packages=[],rows=[],fallback=[],pending=new Map(); let runtime,archive,ledger;
	const recordTap=async(file,tap)=>{
		assert.doesNotMatch(tap,/^not ok\b/mu);
		const count=Number(/^1\.\.(\d+)$/mu.exec(tap)?.[1]);
		assert.ok(count>0); assert.equal(tap.split("\n").filter(l=>/^ok \d+\b/u.test(l)).length,count);
		const data=tap+"\n";
		if(replay) assert.equal(await readFile(join(root,file),"utf8"),data); else pending.set(file,data);
		return {tests: count,skips: tap.split("\n").filter(line=>/^ok \d+\b.*# skip\b/iu.test(line)).length,tapSha256: sha256(data)};
	};
	for(const [file,fixture] of [["example.pl","perl-task-resources"],["interop.t","perl-task-resources"],["retire.t","perl-task-resources"],["bad-ledger.t","perl-task-resources"],["foreign.t","perl-task-resources"],["verify.py","perl-task-resources"],["Observe.xs","perl-sync-io"],["build-observer.pl","perl-sync-io"]])
	{
		const data=await readFile(replay?join(root,file):resolve("tests/fixtures",fixture,file));
		sources[file]=sha256(data); await writeFile(join(stage,file),data,{flag: "wx"});
		if(!replay) pending.set(file,data);
	}
	if(replay) assert.deepEqual(sources,retained.sources);
	const profile={ordinary: "native-perl-task-v1",reviewed: "native-perl-task-v1",counter: "native-perl-io-v1",peer: "native-library-v1",foreign: "native-library-v1"};
	const names={ordinary: "Depot",reviewed: "Depot",counter: "Counter",peer: "ResourcePeer",foreign: "ForeignPeer"};
	for(const [route,id] of Object.entries(profile))
	{
		if(smoke && ["reviewed","foreign"].includes(route)) continue;
		const handoff=join(root,route,"handoff");
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,id);
		const rt=receipt.packages.find(p=>p.role==="runtime"), app=receipt.packages.find(p=>p.role==="component");
		assert.equal(app.name,"LeanBridge-"+names[route]); assert.deepEqual(app.requires,[{ecosystem: "cpan",name: rt.name,version: rt.version}]);
		const coordinates={name: rt.name,version: rt.version,sha256: rt.artifacts[0].sha256,runtimeIdentity: rt.runtimeIdentity};
		assert.deepEqual(coordinates,runtime??coordinates); runtime=coordinates;
		archive??=join(handoff,rt.artifacts[0].path);
		from.set(route,join(handoff,app.artifacts[0].path));
		const pkg={route,id,receiptSha256: result.receiptSha256,bindingIrSha256: receipt.profiles[0].bindingIrSha256,componentSha256: app.artifacts[0].sha256};
		const audit=JSON.parse(await run("python3",["-I",join(stage,"verify.py"),from.get(route),route],stage,env));
		assert.equal(audit.nativeRuntime,rt.runtimeIdentity);
		assert.equal(audit.bindingRuntime,packages[0]?.audit.bindingRuntime??audit.bindingRuntime);
		pkg.audit=audit;
		if(!replay) for(const [module,hash] of Object.entries(audit.sourceModules))
			assert.equal(sha256(await readFile(join(root,route,"source",module+".lean"))),hash);
		if(route==="foreign") assert.notEqual(pkg.audit.sourceModules.Shared,packages[0].audit.sourceModules.Shared);
		else assert.equal(pkg.audit.sourceModules.Shared,packages[0]?.audit.sourceModules.Shared??pkg.audit.sourceModules.Shared);
		if(route!=="peer"&&route!=="foreign")
		{
			const m=await json(join(handoff,"packages/component/lean-bridge-package.json"));
			const l=(m.taskDelivery??m.syncIO).resourceLedger; assert.ok(l); assert.deepEqual(ledger??l,l); ledger=l;
			assert.deepEqual(ledger,audit.ledger);
			assert.deepEqual(audit.nominal,packages[0]?.audit.nominal??audit.nominal);
		}
		packages.push(pkg);
	}
	if(!smoke) assert.equal(packages[0].bindingIrSha256,packages[1].bindingIrSha256);
	const perls=JSON.parse(env.LEAN_BRIDGE_PERLS);
	for(const [i,perl] of (smoke?perls.slice(0,1):perls).entries())
	{
		const dir=join(stage,"abi-"+i),prefix=join(dir,"installed"),moved=join(dir,"relocated"); await mkdir(prefix,{recursive: true});
		const install=(file,name,lib)=>installCpanArchive({archive: file,workingRoot: dir,prefix: join(prefix,name),perl,mode: "prebuilt-only",environment: {...env,PERL5LIB: lib}});
		const rt=await install(archive,"runtime",deps);
		for(const [route,file] of from) await install(file,route,[rt.perl5lib,deps].join(":"));
		await rename(prefix,moved);
		const lib=name=>join(moved,name,"lib/perl5");
		await cp(join(moved,"counter"),join(moved,"broken"),{recursive: true,errorOnExist: true,force: false});
		const arch=await run(perl,["-MConfig","-e","print $Config{archname}"],dir,env);
		const damaged=join(lib("broken"),arch,"LeanBridge/Counter/native",ledger.library);
		assert.equal(sha256(await readFile(damaged)),ledger.sha256);
		await chmod(damaged,0o644); await appendFile(damaged,Buffer.from([0]));
		const observer=join(dir,"observer"); await mkdir(observer);
		await run(perl,[join(stage,"build-observer.pl"),join(stage,"Observe.xs")],observer,{...env,PERL5LIB: lib("runtime")});
		for(const route of (smoke?["ordinary"]:["ordinary","reviewed"]))
		{
			const child={PATH: "/unavailable",PERL5LIB: [lib(route),lib("peer"),lib("counter"),...smoke?[]:[lib("foreign")],lib("runtime"),deps].join(":"),TMPDIR: dir,LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"};
			const abi=JSON.parse(await run(perl,["-MLeanBridge::Runtime::Platform","-MJSON::PP","-e","print JSON::PP->new->canonical->encode({key=>LeanBridge::Runtime::Platform::abi_key(),version=>sprintf('%vd',$^V),threaded=>!!$Config::Config{useithreads}?1:0})"],dir,child));
			const orders={},installed={};
			for(const pkg of packages.filter(p=>!["ordinary","reviewed"].includes(p.route)||p.route===route))
			{
				const name=names[pkg.route],base=join(lib(pkg.route),arch);
				const r=await json(join(base,"LeanBridge",name,"install-receipt.json"));
				assert.equal(r.operation,"prebuilt-xs");
				assert.equal(r.outputSha256,pkg.audit.installedVariants[abi.key]);
				assert.equal(sha256(await readFile(join(base,"auto/LeanBridge",name,name+".so"))),r.outputSha256);
				installed[pkg.route]=r.outputSha256;
			}
			assert.equal(await run(perl,[join(stage,"example.pl")],dir,child),"42");
			for(const order of ["ordinary-first","task-first","retirement","bad-ledger",...smoke?[]:["foreign-first","foreign-last"]])
			{
				const args=order==="retirement"?["-I"+observer,join(stage,"retire.t")]:order==="bad-ledger"?[join(stage,"bad-ledger.t")]:[join(stage,order.startsWith("foreign-")?"foreign.t":"interop.t"),order];
				const settings=order==="bad-ledger"?{...child,PERL5LIB: [lib(route),lib("broken"),lib("runtime"),deps].join(":")}:child;
				const tap=await run(perl,args,dir,settings,240_000);
				orders[order]=await recordTap(route+"-"+abi.key+"-"+order+".tap",tap);
			}
			rows.push({route,...abi,installed,orders});
			t.diagnostic(route+" "+abi.version+" "+(abi.threaded?"threaded":"unthreaded")+": three installed CPAN profiles, both load orders");
		}
		if(!smoke && i===0)
		{
			const built=join(dir,"xs-fallback"),relocated=join(dir,"relocated-xs-fallback");
			for(const route of ["ordinary","counter"]) await installCpanArchive({archive: from.get(route),workingRoot: dir,prefix: join(built,route),perl,mode: "build-xs",environment: {...env,PERL5LIB: [lib("runtime"),deps].join(":")}});
			await rename(built,relocated);
			const code=route=>join(relocated,route,"lib/perl5");
			const child={PATH: "/unavailable",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1",TMPDIR: dir,PERL5LIB: [code("ordinary"),code("counter"),lib("peer"),lib("runtime"),deps].join(":")};
			const installed={};
			for(const route of ["ordinary","counter"])
			{
				const name=names[route],base=join(code(route),arch),r=await json(join(base,"LeanBridge",name,"install-receipt.json"));
				assert.equal(r.operation,"generated-xs-only");
				assert.equal(r.sourceSha256,packages.find(p=>p.route===route).audit.xsSourceSha256);
				assert.equal(r.outputSha256,sha256(await readFile(join(base,"auto/LeanBridge",name,name+".so"))));
				installed[route]=r.outputSha256;
			}
			fallback.push({key: rows[0].key,installed,...await recordTap("fallback-"+rows[0].key+".tap",await run(perl,[join(stage,"interop.t"),"ordinary-first"],dir,child,240_000))});
		}
	}
	if(smoke) return; // A smoke result cannot write or substitute for a complete receipt.
	for(const route of ["ordinary","reviewed"])
		assert.deepEqual(rows.filter(r=>r.route===route).map(r=>r.version+":"+r.threaded).sort(),["5.36.3:0","5.36.3:1","5.38.2:0","5.38.2:1"]);
	const report={schemaVersion: 1,sources,runtime,ledger,packages,rows,fallback};
	if(replay) assert.deepEqual(report,retained);
	else
	{
		for(const [file,data] of pending) await writeFile(join(root,file),data,{flag: "wx"});
		await writeFile(join(root,"acceptance.json"),canonicalJson(report),{flag: "wx"});
	}
});
