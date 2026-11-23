/**
 * Build authentic CPAN retained-callback packages from the shared Lean corpus.
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
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { retainedArguments } from "../../src/backends/perl/retained-xs.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const env={...process.env,LEAN_NUM_THREADS: "1"}, root=env.LEAN_BRIDGE_PERL_CALLBACK_BUILD;
const json=async p=>JSON.parse(await readFile(p,"utf8"));
test("documented retained Perl task uses the installed client and its real source signature",async()=>{
	const section=(source,heading)=>source.split(heading+"\n")[1].split("\n### ")[0];
	const snippet=(source,lang)=>source.split("\x60\x60\x60"+lang+"\n")[1].split("\x60\x60\x60")[0];
	const consumer=section(await readFile("docs/consume/perl.md","utf8"),"### Pass a callback to a Lean worker");
	assert.equal(snippet(consumer,"perl"),await readFile("tests/fixtures/perl-retained-tasks/example.pl","utf8"));
	const publisher=section(await readFile("docs/publish/cpan.md","utf8"),"### Export a task that calls Perl");
	const cfg=JSON.parse(snippet(publisher,"json")); validateExportConfiguration(cfg);
	assert.deepEqual(cfg.exports,["Retained.repeatCall"]); assert.deepEqual(cfg.exports,cfg.taskExports);
	assert.deepEqual(cfg.taskIOErrors,cfg.taskExports); assert.equal(cfg.targets.cpan.module,"LeanBridge::Retained");
	const lean=await readFile("tests/fixtures/python-retained-tasks/Retained.lean","utf8");
	assert.ok(lean.includes(snippet(publisher,"lean").match(/def repeatCall[^\n]*\n[^\n]+/u)[0]));
	for(const path of ["package.json","config/cli-package.v1.json","nix/perl-engine-source-boundary.json"])
	{
		const p=await json(path),files=p.files??p.includedFiles;
		for(const name of ["retained-registration.pm","retained-task.pm","retained-xs.mjs"])
			assert.ok(files.includes("src/backends/perl/"+name));
	}
});
test("compile real worker callbacks with authenticated Perl lease and exception semantics",{skip: !root,timeout: 7_200_000},async t=>{
	for(const route of env.LEAN_BRIDGE_PERL_CALLBACK_ROUTE?[env.LEAN_BRIDGE_PERL_CALLBACK_ROUTE]:["ordinary","reviewed","peer"])
	{
		assert.ok(["ordinary","reviewed","peer"].includes(route));
		const dir=resolve(root,route),src=join(dir,"source"),out=join(dir,"handoff");
		await mkdir(src,{recursive: true});
		const shared=resolve("tests/fixtures/python-retained-tasks"),ruby=resolve("tests/fixtures/ruby-retained-tasks");
		const peer=route==="peer",name=peer?"Relay":"Retained";
		const cfg=peer ? {schemaVersion: 1,modules: ["Relay"],exports: ["Relay.run","Relay.direct"],taskExports: ["Relay.run","Relay.direct"],taskIOErrors: ["Relay.run"]} : await json(join(shared,"lean-bridge.exports.json"));
		const copy=(from,to)=>copyFile(from,join(src,to),constants.COPYFILE_EXCL);
		await copy(join(shared,"lean-toolchain"),"lean-toolchain");
		await copy(join(peer?ruby:shared,name+".lean"),name+".lean");
		cfg.targets={cpan: {module: "LeanBridge::"+name,version: "0.001"}};
		if(!peer)
		{
			await copy(join(ruby,"Feedback.lean"),"Feedback.lean");
			cfg.modules.push("Feedback");
			for(const key of ["exports","taskExports","taskIOErrors"]) cfg[key].push("Feedback.once","Feedback.early");
		}
		if(route==="reviewed")
		{
			delete cfg.exports;
			await copy(join(resolve(root),"ordinary/handoff/binding-ir.json"),"public.binding-ir.json");
		}
		await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(cfg),{flag: "wx"});
		await writeFile(join(src,"lakefile.toml"),'name="'+name.toLowerCase()+'"\nversion="1.0.0"\n'+cfg.modules.map(m=>'[[lean_lib]]\nname="'+m+'"\n').join(""),{flag: "wx"});
		await buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["cpan"],environment: env})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,"native-perl-task-v1");
		const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
		assert.equal(proof.selection.perlTaskCallbacks,true);
		const call=api.declarations.find(d=>d.name===(peer?"run":"once"));
		assert.deepEqual(call.failure.errors,["error:TaskIO.Error","error:PerlHostException"]);
		const param=call.parameters.find(p=>p.ownership==="lease");
		assert.equal(param.lifetime.scope,"explicit");
		const cb=api.types.find(x=>x.id===param.type.id);
		assert.equal(cb.callable.selfDisposal,"defer"); assert.equal(cb.callable.reentry,"same-agent");
		assert.deepEqual(cb.callable.failure.errors,["error:PerlHostException"]);
		const slot=call.parameters.indexOf(param),copied=t=>t.name;
		const wire={
			name: call.name, delivery: "task"
			, args: call.parameters.map(p=>p===param?"callback":copied(p.type))
			, callbacks: [[slot,copied(cb.callable.parameters[0].type),copied(cb.callable.result.type)]] };
		assert.deepEqual(retainedArguments(api,call,wire,copied),wire.args);
		for(const change of [
			p=>{p.lifetime={scope: "call",anchor: null};}
			, p=>{p.ownership="copy";}
			, p=>{p.lifetime.anchor="invented";}
			, (_,c)=>{c.source.extensions["lean-bridge.dev/callback-scheduler"]="worker";}
			, (_,c)=>{c.callable.failure.errors=["error:IO.Error"];}
			, (_,c)=>{c.callable.result.ownership="transfer";}
			, (_,c)=>{c.callable.selfDisposal="immediate";}
		]){
			const altered=structuredClone(api),decl=altered.declarations.find(d=>d.id===call.id);
			change(decl.parameters[slot],altered.types.find(t=>t.id===cb.id));
			assert.throws(()=>retainedArguments(altered,decl,wire,copied),/Unverified retained Perl/u);
		}
		assert.throws(()=>reconcileHostExports({...proof,component: api.component,ir: null,selection: {...proof.selection,perlTaskCallbacks: false}}),/Unverified retained-callback/u);
		assert.throws(()=>reconcileHostExports({...proof,component: api.component,ir: null,selection: {...proof.selection,rubyTaskCallbacks: true}}),/Ambiguous/u);
		if(route==="reviewed") assert.deepEqual(await json(join(src,"public.binding-ir.json")),api);
		t.diagnostic(route+": authentic "+name+" CPAN callback package");
	}
});
