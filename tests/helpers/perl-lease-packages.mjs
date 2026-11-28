/**
 * Build independent CPAN packages around the same source-defined Lean heap types.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const env={...process.env,LEAN_NUM_THREADS: "1"}, root=env.LEAN_BRIDGE_PERL_LEASE_BUILD;
const json=async p=>JSON.parse(await readFile(p,"utf8"));
const fixtures=resolve("tests/fixtures"), shared=join(fixtures,"resource-tasks");
const profiles={ordinary: "native-perl-task-v1",reviewed: "native-perl-task-v1",counter: "native-perl-io-v1",peer: "native-library-v1",foreign: "native-library-v1"};
test("the documented resource example is the installed consumer and selects the actual Lean signatures",async()=>{
	const snippet=async(path,title,lang)=>(await readFile(path,"utf8")).split("### "+title+"\n")[1].split("\n### ")[0].split("\x60\x60\x60"+lang+"\n")[1].split("\x60\x60\x60")[0];
	assert.equal(await snippet("docs/consume/perl.md","Receive a resource from a task or stream","perl"),await readFile(join(fixtures,"perl-task-resources/example.pl"),"utf8"));
	const cfg=JSON.parse(await snippet("docs/publish/cpan.md","Export resource-bearing tasks and streams","json"));
	validateExportConfiguration(cfg); const src=await readFile(join(shared,"Depot.lean"),"utf8");
	assert.deepEqual(cfg.resources,["Shared.Ticket"]); assert.deepEqual(cfg.taskExports,["Depot.checked"]);
	for(const name of [...cfg.exports,...Object.values(cfg.asyncIterators[0])]) assert.ok(src.includes("def "+name.split(".")[1]+" "));
	assert.match(src,/def checked .*: EIO Ticket \(Task Ticket\)/u);
});
test("compile independent Perl sync, task and ordinary components sharing real Lean resources",{skip: !root,timeout: 7_200_000},async t=>{
	for(const route of env.LEAN_BRIDGE_PERL_LEASE_ROUTE?[env.LEAN_BRIDGE_PERL_LEASE_ROUTE]:Object.keys(profiles))
	{
		assert.ok(Object.hasOwn(profiles,route));
		const task=route==="ordinary"||route==="reviewed", plain=route==="peer"||route==="foreign";
		const name=task?"Depot":route==="counter"?"Counter":route==="foreign"?"ForeignPeer":"ResourcePeer";
		const at=resolve(root,route), src=join(at,"source"), out=join(at,"handoff"); await mkdir(src,{recursive: true});
		const copy=(from,to)=>copyFile(from,join(src,to),constants.COPYFILE_EXCL);
		await copy(join(shared,"lean-toolchain"),"lean-toolchain");
		if(route==="foreign")
		{
			const original=await readFile(join(shared,"Shared.lean"),"utf8");
			const field="  descriptor : IO.FS.Handle"; assert.equal(original.split(field).length,2);
			await writeFile(join(src,"Shared.lean"),original.replace(field,"  extra : String\n"+field),{flag: "wx"});
		} else await copy(join(shared,"Shared.lean"),"Shared.lean");
		const cfg=await json(join(shared,"lean-bridge.exports.json"));
		cfg.targets={cpan: {module: "LeanBridge::"+name,version: "0.001"}};
		if(task)
		{
			await copy(join(shared,"Depot.lean"),"Depot.lean");
			await copy(join(fixtures,"ruby-task-resources/Exchange.lean"),"Exchange.lean");
			cfg.modules.push("Exchange"); cfg.exports.push("Exchange.revisit"); cfg.taskExports.push("Exchange.revisit"); cfg.taskIOErrors=["Exchange.revisit"];
			if(route==="reviewed")
			{
				delete cfg.exports;
				await copy(resolve(root,"ordinary/handoff/binding-ir.json"),"public.binding-ir.json");
			}
		} else
{
			delete cfg.taskExports; delete cfg.asyncIterators;
			cfg.modules=[name];
			cfg.exports=(route==="counter"?["bump","issue","readBadge"]:["aliasBadge","aliasTicket","label"]).map(n=>name+"."+n);
			if(plain) delete cfg.nativeEffects;
			const f=name+".lean";
			if(route==="foreign")
			{
				const original=await readFile(join(fixtures,"perl-task-resources/ResourcePeer.lean"),"utf8");
				await writeFile(join(src,f),original.replaceAll("ResourcePeer",name),{flag: "wx"});
			} else await copy(join(fixtures,route==="counter"?"jvm-sync-resources":"perl-task-resources",f),f);
}
		await writeFile(join(src,"lakefile.toml"),'name="'+name.toLowerCase()+'"\nversion="1.0.0"\n'+["Shared",...cfg.modules].map(m=>'[[lean_lib]]\nname="'+m+'"\n').join(""),{flag: "wx"});
		await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(cfg),{flag: "wx"});
		await buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["cpan"],environment: env})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,profiles[route]);
		const manifest=await json(join(out,"packages/component/lean-bridge-package.json"));
		assert.equal(manifest.module,cfg.targets.cpan.module);
		if(!plain)
		{
			const contract=manifest.taskDelivery??manifest.syncIO;
			assert.match(contract.resourceLedger.id,/^[0-9a-f]{64}$/u);
			assert.equal(contract.resourceLedger.library,"liblb_task_resources_"+contract.resourceLedger.id+".so");
			assert.equal(manifest.files["lib/"+manifest.module.replaceAll("::","/")+"/native/"+contract.resourceLedger.library],contract.resourceLedger.sha256);
		}
		if(route==="reviewed") assert.deepEqual(await json(join(src,"public.binding-ir.json")),await json(join(out,"binding-ir.json")));
		t.diagnostic(route+": "+name+" "+profiles[route]);
	}
});
