/** @file Test binding-owned Perl coderefs in installed ordinary, reviewed and worker CPAN releases. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {checkHostFunctionReleases} from "./host-function-releases.mjs";

const exec=promisify(execFile);
test("installed CPAN packages return lexical Perl coderefs over application objects",{timeout: 7200000},async t=>{
	const env=process.env,perls=JSON.parse(env.LEAN_BRIDGE_PERLS??'["perl"]'),fixture="tests/fixtures/perl-host-closures/";
	const modes=["prebuilt-only","build-xs"];
	const addWorkers=async(src,cfg)=>{
		await appendFile(join(src,"Closures.lean"),'\nnamespace Closures\nopen LeanBridge.Host.Perl\ndef relay (x : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) := IO.asTask (f x)\nend Closures\n');
		cfg.exports.push("Closures.relay");cfg.taskExports.push("Closures.relay");cfg.taskIOErrors=["Closures.relay"];
	};
	const consume=async({root,out,route,worker,receipt,src,cli})=>{
		const store=await mkdtemp(join(root,"verified-")),packs=new Map();
		try
		{
			const retain=async(dir,r)=>{
				for(const p of r.packages)
				{
					const [a]=p.artifacts,name=p.name,archive=join(store,basename(a.path));
					if(packs.has(name))
					{assert.equal(p.role,"runtime");assert.equal(packs.get(name).sha256,a.sha256);continue;}
					await rename(join(dir,a.path),archive);packs.set(name,{archive,sha256: a.sha256,role: p.role});
				}
				await rm(dir,{recursive: true});
			};
			await retain(out,receipt);
			if(worker)
			{
				const peer=join(root,"peer"),dir=join(root,"peer-worker");await cp(src,peer,{recursive: true});
				const c=join(peer,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(c));cfg.targets.cpan.module="LeanBridge::Peer";await writeFile(c,canonicalJson(cfg));
				const lake=join(peer,"lakefile.toml");await writeFile(lake,(await readFile(lake,"utf8")).replace('name = "workshop"','name = "workshop-peer"'));
				await run(process.execPath,[cli,"build","--project",peer,"--target","cpan","--output",dir,"--json","--progress","none"],root,env,900000);
				const r=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
				assert.equal(r.receipt.packages.find(p=>p.role==="component").name,"LeanBridge-Peer");await retain(dir,r.receipt);
				t.diagnostic("independent worker peer "+r.result.receiptSha256);
			}
			assert.equal(packs.size,worker?3:2);
			const ordered=[...packs.values()].sort((a,b)=>Number(a.role!=="runtime")-Number(b.role!=="runtime"));
			for(const p of ordered)assert.equal(sha256(await readFile(p.archive)),p.sha256);
			for(const interpreter of perls)for(const mode of modes)
			{
				const client=await mkdtemp(join(root,"client-")),prefix=join(client,"prefix"),dest=join(client,"deployed");
				try
				{
					const perl=await run(interpreter,["-e","print $^X"],client,env);
					for(const pack of ordered)await installCpanArchive({archive: pack.archive,workingRoot: client,prefix,perl,mode: pack.role==="runtime"?"prebuilt-only":mode,environment: env});
					await rename(prefix,dest);
					const lib=join(dest,"lib/perl5"),arch=await run(perl,["-MConfig","-e","print $Config{archname}"],client,env);
					for(const name of packs.keys())
					{
						assert.match(name,/^LeanBridge-(?:Runtime|Workshop|Peer)$/u);
						const part=name.slice("LeanBridge-".length),r=JSON.parse(await readFile(join(lib,arch,"LeanBridge",part,"install-receipt.json")));
						assert.equal(r.operation,part!=="Runtime" && mode==="build-xs"?"generated-xs-only":"prebuilt-xs");
						assert.equal(sha256(await readFile(join(lib,arch,"auto/LeanBridge",part,part+".so"))),r.outputSha256);
					}
					const isolated={PATH: "/no-tools",LD_BIND_NOW: "1",LEAN_NUM_THREADS: "1",...worker?{PERL5LIB: env.LEAN_BRIDGE_PERL_TASK_DEPS??env.PERL5LIB}:{}};
					const observer=join(store,"observer-"+perls.indexOf(interpreter));
					if(mode===modes[0])
					{
						await mkdir(observer);await run(perl,["-I"+lib,resolve("tests/fixtures/perl-sync-io/build-observer.pl"),resolve("tests/fixtures/perl-sync-io/Observe.xs")],observer,env);
					}
					for(const file of ["installed.pl","retired.pl",...worker?["worker.pl"]:[]])
					{
						const dir=join(client,file+".cwd");await mkdir(dir);await copyFile(fixture+file,join(dir,"app.pl"));
						const {stdout,stderr}=await exec(perl,["-I"+lib,...file==="retired.pl"?["-I"+observer]:[],"app.pl"],{cwd: dir,env: isolated,timeout: 120000});
						assert.equal(stderr,"");assert.match(stdout,file==="worker.pl"?/independent binding cancellation passed/u:file==="retired.pl"?/without further member dispatch/u:/scoped cleanup passed/u);
					}
					t.diagnostic([route,perl,mode].join(" / "));
				}
				finally
				{await rm(client,{recursive: true,force: true});}
			}
		} finally
		{await rm(store,{recursive: true,force: true});}
	};
	await checkHostFunctionReleases(t,{backend: "perl",module: "Perl"
		, target: "cpan",error: "error:PerlHostException"
		, profiles: ["native-perl-host-v1","native-perl-task-v1"]
		, archives: 2,addWorkers,consume});
});
