/**
 * Build source-authenticated CPAN task and cursor distributions in independent producer roots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { verifyPerlIOFiles } from "../../src/backends/perl/sync-io.mjs";
import { perlTaskAssets } from "../../src/backends/perl/task-xs.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const env={...process.env,LEAN_NUM_THREADS: "1"}, root=env.LEAN_BRIDGE_PERL_TASK_BUILD;
const json=async f=>JSON.parse(await readFile(f,"utf8"));
const policy=env.LEAN_BRIDGE_PERL_TASK_POLICY;
test("CPAN task packaging rejects invented delivery, incorrect terminal/step types and resealed source", {skip: !policy,timeout: 1_800_000},async t=>{
	const stage=await mkdtemp(join(tmpdir(),"perl-task-policy-")); t.after(()=>rm(stage,{recursive: true,force: true}));
	const src=join(stage,"source"),out=join(stage,"handoff"),file=join(src,"lean-bridge.exports.json");
	const original=resolve(policy,"ordinary");
	await cp(join(original,"source"),src,{recursive: true});
	const cfg=await json(file);
	const reject=async (config,re)=>{
		await writeFile(file,canonicalJson(config));
		await assert.rejects(buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["cpan"],environment: env}),e=>{
			assert.match([e.message,e.details?.stderr,e.details?.stdout].join("\n"),re); return true;
		});
		await assert.rejects(access(out),{code: "ENOENT"});
	};
	await reject({...cfg,taskExports: [...cfg.taskExports,"Pulse.release"]},/taskExports requires a real Lean Task result/u);
	await reject({...cfg,taskIOErrors: [...cfg.taskIOErrors,"Pulse.checked"]},/taskIOErrors requires Task/u);
	const reviewed=await json(join(original,"handoff/binding-ir.json"));
	reviewed.errors.find(e=>e.id==="error:AsyncStep.Pulse.series").payload.name="uint64";
	delete cfg.exports;
	await writeFile(join(src,"public.binding-ir.json"),canonicalJson(reviewed),{flag: "wx"});
	await reject(cfg,/Reviewed API differs/u);
	const component=join(original,"handoff/packages/component"),{manifest,files}=await readVerifiedCpanPackage(component);
	const base=await readFile("src/backends/perl/Build.pm","utf8"), header=await readFile("src/backends/perl/sync-wire.h"), assets=await perlTaskAssets();
	for(const path of ["LeanBridgeBuild.pm","task-wire.h","Component.xs","lib/LeanBridge/Pulse.pm"])
	{
		const altered=new Map(files); altered.set(path,Buffer.concat([files.get(path),Buffer.from("\n")]));
		assert.throws(()=>verifyPerlIOFiles(manifest,altered,base,header,assets),/differs/u);
	}
	const changed=join(stage,"metadata"); await cp(component,changed,{recursive: true});
	const meta=await json(join(changed,"META.json")); delete meta.prereqs.runtime.requires.Future;
	const bytes=canonicalJson(meta); await writeFile(join(changed,"META.json"),bytes);
	manifest.files["META.json"]=sha256(bytes); await writeFile(join(changed,"lean-bridge-package.json"),canonicalJson(manifest));
	await assert.rejects(readVerifiedCpanPackage(changed),/lacks its event-loop dependencies/u);
});
test("documented CPAN task consumer and producer use shipped sources and real delivery selections",async()=>{
	const snippet=async(f,h)=>(await readFile(f,"utf8")).split(h+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/consume/perl.md","### Wait for a task or read a stream"),await readFile("tests/fixtures/perl-tasks/example.pl","utf8"));
	const cfg=JSON.parse(await snippet("docs/publish/cpan.md","### Export tasks and streams"));
	validateExportConfiguration(cfg); await assertJsonSchema("lean-export-configuration",cfg);
	const compiled=await json("tests/fixtures/c-lean-tasks/lean-bridge.exports.json");
	assert.ok(cfg.exports.every(n=>compiled.exports.includes(n)));
	assert.ok(cfg.taskExports.every(n=>compiled.taskExports.includes(n)));
	assert.deepEqual(cfg.asyncIterators,compiled.asyncIterators);
	for(const f of ["package.json","config/cli-package.v1.json","nix/perl-engine-source-boundary.json"])
	{
		const m=await json(f);
		for(const name of ["task-wire.h","task-driver.pm","task-xs.mjs"])
			assert.ok((m.files??m.includedFiles).includes("src/backends/perl/"+name));
	}
});
test("build source, reviewed and independent cursor-only CPAN task packages", {skip: !root,timeout: 7_200_000},async t=>{
	for(const route of env.LEAN_BRIDGE_PERL_TASK_ROUTE ? [env.LEAN_BRIDGE_PERL_TASK_ROUTE] : ["ordinary","reviewed","peer"])
	{
		assert.ok(["ordinary","reviewed","peer"].includes(route));
		const dir=resolve(root,route), src=join(dir,"source"), out=join(dir,"handoff"); await mkdir(src,{recursive: true});
		const peer=route==="peer", fixture=resolve("tests/fixtures",peer?"python-lean-stream-only":"c-lean-tasks"), mod=peer?"Signals":"Pulse";
		const cfg=await json(join(fixture,"lean-bridge.exports.json"));
		for(const f of [mod+".lean","lean-toolchain"]) await copyFile(join(fixture,f),join(src,f),constants.COPYFILE_EXCL);
		if(!peer)
		{
			const scalar=(await readFile("tests/fixtures/ruby-task-lab/RubyTasks.lean","utf8")).replaceAll("RubyTasks","PerlTasks");
			await writeFile(join(src,"PerlTasks.lean"),scalar,{flag: "wx"});
			cfg.modules.push("PerlTasks");
			const extra=[...scalar.matchAll(/^def (\w+)/gmu)].map(m=>"PerlTasks."+m[1]);
			cfg.exports.push(...extra); cfg.taskExports.push(...extra.filter(n=>!["PerlTasks.base","PerlTasks.identity","PerlTasks.direct"].includes(n)));
			cfg.taskIOErrors=["PerlTasks.terminal"];
			await copyFile("tests/fixtures/perl-tasks/Extra.lean",join(src,"Extra.lean"),constants.COPYFILE_EXCL);
			cfg.modules.push("Extra"); cfg.exports.push("Extra.delayedInt"); cfg.taskExports.push("Extra.delayedInt");
		}
		else
{
			await copyFile("tests/fixtures/python-lean-tasks/Timers.lean",join(src,"Timers.lean"),constants.COPYFILE_EXCL);
			cfg.modules.push("Timers"); cfg.asyncIterators.push({open: "Timers.units",next: "Timers.nextUnit",close: "Timers.closeUnits"});
}
		cfg.targets={cpan: {module: "LeanBridge::"+mod,version: "0.001"}};
		if(route==="reviewed")
{ delete cfg.exports; await copyFile(resolve(root,"ordinary/handoff/binding-ir.json"),join(src,"public.binding-ir.json"),constants.COPYFILE_EXCL); }
		await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(cfg),{flag: "wx"});
		await writeFile(join(src,"lakefile.toml"),'name="'+mod.toLowerCase()+'"\nversion="1.0.0"\n'+cfg.modules.map(m=>'[[lean_lib]]\nname="'+m+'"\n').join(""),{flag: "wx"});
		await buildCanonicalProject({projectRoot: src, outputRoot: out, targets: ["cpan"], environment: env})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		const receipt=await json(join(out,"package-set-receipt.json")); await assertJsonSchema("package-set-receipt",receipt);
		assert.equal(receipt.profiles[0].id,"native-perl-task-v1");
		if(route==="reviewed") assert.deepEqual(await json(join(src,"public.binding-ir.json")),await json(join(out,"binding-ir.json")));
		t.diagnostic("Built "+route+" original CPAN task distribution");
	}
});
