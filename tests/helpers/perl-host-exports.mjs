/** @file Run generated application-facing Perl calls against a single precompiled Lean library. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {perlEffectClasses} from "../../src/backends/perl/sync-io.mjs";
import {compilePerlHostComponent} from "../../src/build/perl-host-component.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {buildNativeSharedRuntime} from "../../src/build/native-component.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";

const exec=promisify(execFile);
test("compiler-selected public Perl operations share one non-Perl Lean ELF across the selected XS ABIs",{timeout: 480_000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"public-perl-host-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"project"), app=join(root,"xs"), cc=process.env.CC??"cc";
	const lean=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const sdk=process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME??join(root,"runtime");
	if(!process.env.LEAN_BRIDGE_TEST_NATIVE_RUNTIME) await buildNativeSharedRuntime({outputRoot: sdk,leanPrefix: lean,cc});
	const call=async(cmd,args,cwd=app,env=process.env)=>{
		try
		{ return (await exec(cmd,args,{cwd,env})).stdout.trim(); }
		catch(e)
		{ throw new Error([e.message,e.stdout,e.stderr].join("\n"),{cause: e}); }
	};
	await mkdir(app); await prepareNativeHostFixture(project,"perl");
	await copyFile(resolve("LICENSE"),join(project,"LICENSE"));
	const extra=await readFile("tests/fixtures/perl-host-meter/Public.lean.inc","utf8");
	const sourceFile=join(project,"Workshop.lean"), cfgFile=join(project,"lean-bridge.exports.json");
	await writeFile(sourceFile,(await readFile(sourceFile,"utf8"))+extra);
	const cfg=JSON.parse(await readFile(cfgFile,"utf8")); cfg.exports.push(...["reply","replaced","plain","chooseObject","rejectObject","exhaust"].map(n=>"Workshop."+n));
	await writeFile(cfgFile,canonicalJson(cfg));
	const inventory=await inspectLeanProject(project);
	const source=await openHostProjectSource({project,inventory,targets: ["cpan"],component: elaboratedComponent(inventory.project),leanPrefix: lean});
	t.after(()=>source.dispose());
	const name=cfg.targets.cpan.module, built=await compilePerlHostComponent({...source
		, ir: source.projectContract.ir,name,version: cfg.targets.cpan.version
		, workRoot: root,runtimeRoot: sdk,environment: process.env});
	await source.verify();
	const choose=built.api.declarations.find(d=>d.name==="choose_object"), reject=built.api.declarations.find(d=>d.name==="reject_object");
	assert.equal(choose.result.ownership,"lease");
	assert.deepEqual(reject.source.extensions["lean-bridge.dev/error-payload-site"].lifetime,{scope: "explicit",anchor: null});
	const model=built.generated, lib=join(root,built.library);
	await writeFile(lib,built.bytes); await writeFile(join(app,"ph-interface.h"),model.interfaceHeader);
	await writeFile(join(app,"Workshop.xs"),model.xsSource);
	for(const [path,bytes] of Object.entries(built.headers)) await writeFile(join(app,path),bytes);
	const libs=["-L"+join(sdk,"lib"),"-Wl,-rpath,"+join(sdk,"lib"),"-llean_bridge_native","-lleanshared"];
	const common=["-shared","-fPIC","-O1","-g0","-pthread","-Werror=implicit-function-declaration","-I"+join(sdk,"include")];
	const syms=await call("nm",["-D","--defined-only",lib]); assert.deepEqual(syms.split("\n").map(l=>l.split(/\s+/u).at(-1)).sort(),[...model.symbols].sort());
	assert.doesNotMatch(await call("readelf",["-d",lib]),/\(NEEDED\)[^\n]*(?:perl|Runtime\.so)|\((?:RUNPATH|RPATH)\)/iu);
	const backend=resolve("src/backends/perl"), consumer=join(root,"consumer.pl");
	await copyFile(resolve("tests/fixtures/perl-host-meter/public-host.pl"),consumer);
	const perls=process.env.LEAN_BRIDGE_PERLS ? JSON.parse(process.env.LEAN_BRIDGE_PERLS) : [process.env.LEAN_BRIDGE_PERL??"perl"];
	assert.ok(Array.isArray(perls) && perls.length && perls.every(p=>typeof p==="string" && p));
	for(const [i,perl] of perls.entries())
	{
		const prefix=join(root,"abi"+i), pkg=join(prefix,"LeanBridge");
		await mkdir(pkg,{recursive: true});
		const abi=await call(perl,["-MConfig","-e","print join qq(\\n),$Config{archlibexp}.'/CORE',$Config{ccflags},$Config{archname}"]);
		const [core,flags,arch]=abi.split("\n");
		await writeFile(join(pkg,"Runtime.pm"),"package LeanBridge::Runtime; require XSLoader; XSLoader::load(__PACKAGE__); 1;\n");
		await writeFile(join(pkg,"Workshop.pm"),model.implementation+"\n"+perlEffectClasses(name,built.entries)+"\npackage "+name+"; use LeanBridge::Runtime; require XSLoader; XSLoader::load(__PACKAGE__); 1;\n");
		for(const unit of ["Runtime","Workshop"])
		{
			const dest=join(prefix,"auto","LeanBridge",unit); await mkdir(dest,{recursive: true});
			await call(perl,["-MExtUtils::ParseXS","-e","ExtUtils::ParseXS::process_file(filename=>$ARGV[0],output=>$ARGV[1],prototypes=>0)",join(unit==="Runtime"?backend:app,unit+".xs"),join(app,unit+".c")]);
			const deps=unit==="Runtime"?[]:["-L"+join(prefix,"auto/LeanBridge/Runtime"),"-l:Runtime.so","-Wl,-rpath,$ORIGIN/../Runtime","-L"+root,"-l:"+built.library,"-Wl,-rpath,"+root];
			await call(cc,[...flags.split(/\s+/u),...common,"-I"+core,"-I"+app,"-I"+backend,unit+".c",...deps,...libs,"-ldl","-Wl,-soname,"+unit+".so","-o",join(dest,unit+".so")]);
			if(unit==="Workshop") assert.doesNotMatch(await call("nm",["-D","--defined-only",join(dest,"Workshop.so")]),/\b(?:ph_impl_|lean_bridge_host_perl_)/u);
		}
		const result=await exec(perl,["-I"+prefix,consumer],{cwd: root,env: {...process.env,LD_BIND_NOW: "1"}});
		assert.equal(result.stderr,""); assert.match(result.stdout,/public host checks passed/u); t.diagnostic(perl+" ("+arch+"): "+result.stdout.trim());
		const exampleFile=resolve("tests/fixtures/perl-host-meter/meter.pl");
		const exampleEnv={PATH: "/unavailable",LD_BIND_NOW: "1",LEAN_NUM_THREADS: "1"};
		const example=await exec(perl,["-I"+prefix,exampleFile],{cwd: root,env: exampleEnv});
		assert.equal(example.stderr,""); assert.equal(example.stdout,"42\n");
	}
	t.diagnostic("Single compiled component SHA-256: "+sha256(await readFile(lib)));
});
