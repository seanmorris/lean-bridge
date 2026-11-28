/** @file Run real XS against the compiled object-worker library, independently of CPAN packaging. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { perlEffectClasses } from "../../src/backends/perl/sync-io.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { compilePerlHostComponent } from "../../src/build/perl-host-component.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { preparePerlWorkerProject } from "./perl-worker-project.mjs";

const exec=promisify(execFile);
test("the Perl interpreter, not the Lean worker, owns application objects and scoped leases",{timeout: 900000},async t=>{
	const paths=process.env.LEAN_BRIDGE_PERLS?JSON.parse(process.env.LEAN_BRIDGE_PERLS):[process.env.LEAN_BRIDGE_PERL??"perl"];
	assert.ok(Array.isArray(paths) && paths.length);
	const deps=process.env.LEAN_BRIDGE_PERL_TASK_DEPS, localDeps=deps?{PERL5LIB: deps}:{};
	for(const perl of paths)
	{
		try
		{ await exec(perl,["-e",'use Future 0.54; use IO::Async::Loop 0.805;'],{env: {PATH: "/unavailable",...localDeps}}); }
		catch(e)
		{ throw new Error(perl+": set LEAN_BRIDGE_PERL_TASK_DEPS to the offline worker dependencies.\n"+e.stderr,{cause: e}); }
	}
	const root=await mkdtemp(join(tmpdir(),"perl-worker-transport-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"source"), cfg=await preparePerlWorkerProject(project), name=cfg.targets.cpan.module;
	const leanPrefix=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const sdk=process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME??join(root,"runtime"), cc=process.env.CC??"cc";
	if(!process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME) await buildNativeSharedRuntime({outputRoot: sdk,leanPrefix,cc});
	const inventory=await inspectLeanProject(project), component=elaboratedComponent(inventory.project);
	const source=await openHostProjectSource({project,inventory,component,targets: ["cpan"],leanPrefix});
	t.after(()=>source.dispose());
	const built=await compilePerlHostComponent({...source, ir: source.projectContract.ir
		, name
		, version: cfg.targets.cpan.version
		, workRoot: root,runtimeRoot: sdk,environment: process.env}).catch(e=>{
		if(e.details?.stderr || e.details?.stdout) t.diagnostic([e.details.stderr,e.details.stdout].filter(Boolean).join("\n"));
		throw e;
		});
	await source.verify();
	const {kernel,generated}=built, {wire}=kernel, probe=resolve("tests/fixtures/perl-host-workers");
	assert.equal(built.evidence.selection.perlTaskObjects,true);
	assert.equal(kernel.kinds.length,1);
	assert.equal(wire.methods.find(m=>m.name==="echo").result,"host:"+kernel.kinds[0].hash);
	assert.deepEqual(wire.methods.find(m=>m.name==="relay").callbacks,[[1,"host:"+kernel.kinds[0].hash,"host:"+kernel.kinds[0].hash]]);
	await writeFile(join(root,built.library),built.bytes); await writeFile(join(root,kernel.ledger.name),built.ledgerBytes);
	const headers=[`extern void ${wire.clear}(uint64_t *);\n#define TEST_CLEAR ${wire.clear}`];
	for(const method of ["echo","refuse","outcome"])
	{
		const {names}=wire.methods.find(m=>m.name===method);
		for(const [op,args] of Object.entries({start: "const uint64_t *,uint64_t *,uint64_t *,uint8_t *"
			, poll: "uint64_t *,int *"
			, take: "uint64_t *,uint64_t *,uint8_t *"
			, close: "uint64_t *"}))
			headers.push(`extern int ${names[op]}(${args});\n#define TEST_${method.toUpperCase()}_${op.toUpperCase()} ${names[op]}`);
	}
	const hook='#include "host-scope.h"'; assert.equal(generated.xsSource.split(hook).length,2);
	const xs=generated.xsSource.replace(hook,hook+"\n"+headers.join("\n")+'\n#include "probe.h"')+await readFile(join(probe,"probe.xs.inc"),"utf8");
	const backend=resolve("src/backends/perl");
	for(const [i,perl] of paths.entries())
	{
		const app=join(root,"abi"+i), pkg=join(app,"LeanBridge"); await mkdir(pkg,{recursive: true});
		const run=async (cmd,args,options={})=>{
			try
			{ return await exec(cmd,args,{cwd: app,...options}); }
			catch(e)
			{ throw new Error([e.message,e.stderr,e.stdout].join("\n"),{cause: e}); }
		};
		const [core,flags,arch]=(await run(perl,["-MConfig","-e","print join qq(\\n),$Config{archlibexp}.'/CORE',$Config{ccflags},$Config{archname}"])).stdout.split("\n");
		await writeFile(join(app,"Workshop.xs"),xs); await writeFile(join(app,"ph-interface.h"),generated.interfaceHeader);
		for(const [file,data] of Object.entries(built.headers)) await writeFile(join(app,file),data);
		await writeFile(join(pkg,"Runtime.pm"),"package LeanBridge::Runtime; require XSLoader; XSLoader::load(__PACKAGE__); 1;\n");
		await writeFile(join(pkg,"Workshop.pm"),generated.implementation+"\n"+perlEffectClasses(name,built.entries)+"\npackage "+name+"; use LeanBridge::Runtime; require XSLoader; XSLoader::load(__PACKAGE__); 1;\n");
		for(const unit of ["Runtime","Workshop"])
		{
			const dest=join(app,"auto/LeanBridge",unit); await mkdir(dest,{recursive: true});
			await run(perl,["-MExtUtils::ParseXS"
				, "-e"
				, "ExtUtils::ParseXS::process_file(filename=>$ARGV[0],output=>$ARGV[1],prototypes=>0)"
				, join(unit==="Runtime"?backend:app,unit+".xs"),join(app,unit+".c")]);
			const deps=unit==="Runtime"?[]:["-L"+join(app,"auto/LeanBridge/Runtime"),"-l:Runtime.so","-Wl,-rpath,$ORIGIN/../Runtime","-L"+root,"-l:"+built.library];
			await run(cc,[...flags.split(/\s+/u).filter(Boolean)
				, "-shared"
				, "-fPIC"
				, "-O1"
				, "-g0"
				, "-pthread"
				, "-Werror=implicit-function-declaration"
				, "-I"+app
				, "-I"+backend
				, "-I"+core
				, "-I"+probe
				, "-I"+join(sdk,"include")
				, unit+".c"
				, ...deps
				, "-L"+join(sdk,"lib")
				, "-llean_bridge_native"
				, "-lleanshared"
				, "-ldl"
				, "-Wl,-soname,"+unit+".so"
				, "-o"
				, join(dest,unit+".so")]);
		}
		const {stdout,stderr}=await run(perl,["-I"+app,join(probe,"private.pl")],{timeout: 90000
			, env: {
				PATH: "/unavailable"
				, LANG: "C"
				, LD_BIND_NOW: "1"
				, LEAN_NUM_THREADS: "1"
				, LD_LIBRARY_PATH: root+":"+join(sdk,"lib")
			}
		});
		assert.equal(stderr,""); assert.match(stdout,/returned original objects, rejected wrong-class input, and retired leases on return and die/u);
		t.diagnostic(perl+" ("+arch+"): "+stdout.trim());
		const live=await run(perl,["-I"+app,join(probe,"public.pl")],{timeout: 90000
			, env: {
				PATH: "/unavailable"
				, LANG: "C"
				, ...localDeps
				, LD_BIND_NOW: "1"
				, LEAN_NUM_THREADS: "1"
				, LD_LIBRARY_PATH: root+":"+join(sdk,"lib")
			}
		});
		assert.equal(live.stderr,""); assert.match(live.stdout,/demand, reentry and scoped cancellation/u);
		t.diagnostic(perl+" ("+arch+"): "+live.stdout.trim());
	}
	t.diagnostic("One Lean component "+sha256(built.bytes)+" and ledger "+sha256(built.ledgerBytes)+" for "+paths.length+" Perl ABI(s)");
});
