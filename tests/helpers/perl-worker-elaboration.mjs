/** @file Verify which parts of a CPAN worker can carry an object and which can call Perl. */
import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { taskWorkerInterface } from "../../src/analyze/host-export-model.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { preparePerlWorkerProject } from "./perl-worker-project.mjs";

test("a CPAN worker can carry a Perl object but cannot call its members on a Lean thread", {timeout: 1200000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"perl-worker-source-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"source"), cfg=await preparePerlWorkerProject(project);
	const leanPrefix=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const build=async ()=>{
		const inventory=await inspectLeanProject(project), component=elaboratedComponent(inventory.project);
		const source=await openHostProjectSource({project,inventory,component,targets: ["cpan"],leanPrefix});
		try
		{
			const {projectContract}=source, app=await mkdtemp(join(root,"compile-"));
			const options={...source,app,ir: projectContract.ir,target: "cpan",environment: process.env};
			await assert.rejects(compileHostSources({...options,projectContract: {...projectContract,hostImportsSource: projectContract.hostImportsSource+" "}
				, run: ()=>assert.fail("tampered Perl source reached the compiler")}),/captured host source/u);
			const run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
			return await compileHostSources({...options,run});
		} finally
		{ await source.dispose(); }
	};
	const {api,evidence}=await build(), lookup=n=>api.declarations.find(d=>d.source.declaration===n);
	assert.equal(evidence.selection.perlTaskObjects,true);
	assert.throws(()=>taskWorkerInterface(api,evidence),/Perl task object carriers/u);
	assert.equal(lookup("Workshop.read").resultMode,"value");
	assert.equal(lookup("Jobs.echo").resultMode,"promise");
	const callback=api.types.find(t=>t.id===lookup("Jobs.relay").parameters[1].type.id);
	assert.equal(callback.source.extensions["lean-bridge.dev/callback-scheduler"],"owner-event-loop");
	assert.deepEqual(callback.callable.failure.errors,["error:PerlCallbackException"]);
	for(const site of [lookup("Jobs.echo").result
		, callback.callable.parameters[0]
		, callback.callable.result
		, lookup("Jobs.refuse").source.extensions["lean-bridge.dev/error-payload-site"]
		, lookup("Jobs.boxes").source.extensions["lean-bridge.dev/step-error-payload-site"]
	]){
		assert.equal(site.type.id,"host:meter.Box"); assert.equal(site.ownership,"lease");
		assert.deepEqual(site.lifetime,{scope: "explicit",anchor: null});
	}
	assert.equal(lookup("Jobs.outcome").result.ownership,"lease");
	assert.equal(lookup("Jobs.ioBoxes").source.extensions["lean-bridge.dev/step-failure"],"IO.Error");
	const review=join(project,"public.binding-ir.json"), config=join(project,"lean-bridge.exports.json");
	await writeFile(review,canonicalJson(api)); delete cfg.exports; await writeFile(config,canonicalJson(cfg));
	assert.deepEqual((await build()).api,api);
	await rm(review);
	await appendFile(join(project,"Jobs.lean"),`
namespace Jobs
private def readHidden (box : LeanBridge.Host.Perl.Box) := box.read
def badTask (box : LeanBridge.Host.Perl.Box) := IO.asTask (readHidden box)
def badOpen (box : LeanBridge.Host.Perl.Box) : IO Cursor := do
  let _ ← readHidden box
  boxes box false
def badPull (c : Cursor) : BaseIO (Task (Except IO.Error (Option LeanBridge.Host.Perl.Box))) :=
  IO.asTask do let _ ← readHidden c.box; return none
def badClose (c : Cursor) : BaseIO Unit := do let _ ← (readHidden c.box).toBaseIO; pure ()
end Jobs
`);
	delete cfg.taskIOErrors;
	for(const [name,field] of [["badTask",null],["badOpen","open"],["badPull","next"],["badClose","close"]])
	{
		const entry="Jobs."+name, protocol={open: "Jobs.ioBoxes",next: "Jobs.ioNext",close: "Jobs.ioClose"};
		if(field) protocol[field]=entry;
		cfg.exports=[field?protocol.open:entry];
		delete cfg.taskExports; delete cfg.asyncIterators;
		if(field) cfg.asyncIterators=[protocol]; else cfg.taskExports=[entry];
		await writeFile(config,canonicalJson(cfg));
		await t.test("refuse the transitive Perl member in "+entry,async ()=>{
			await assert.rejects(build(),{code: "invalid-task-export",message: "Perl task calls a Perl member outside its owner: "+entry});
		});
	}
});
