/** @file Verify compiler evidence and private worker entries without claiming an installed NuGet client. */
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { dotnetWorkerKinds } from "../../src/backends/dotnet/host-members.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareDotnetWorkerProject } from "./dotnet-worker-project.mjs";

const run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
test("CLR worker declarations and adapters compile from ordinary and reviewed Lean source", {timeout: 600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"clr-worker-source-")); t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"source"), config=await prepareDotnetWorkerProject(project);
	const leanPrefix=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX??".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const build=async()=>{
		const inventory=await inspectLeanProject(project), component=elaboratedComponent(inventory.project);
		const source=await openHostProjectSource({project,inventory,component,targets: ["nuget"],leanPrefix});
		try
		{
			const app=await mkdtemp(join(root,"compiled-")), {ir}=source.projectContract;
			const o={...source,ir,app,target: "nuget",environment: process.env,run};
			const altered={...source.projectContract,hostImportsSource: source.projectContract.hostImportsSource+" "};
			await assert.rejects(compileHostSources({...o,projectContract: altered,run: ()=>assert.fail("invalid capture invoked Lean")}),/captured host source/u);
			const checked=await compileHostSources(o);
			const entries=checked.entries.filter(e=>e.delivery);
			const gen=generateCTaskExports({name: "clr-probe",modules: config.modules,entries,dotnetDelivery: true,integerMode: "words",dotnetHostKinds: dotnetWorkerKinds(ir),componentIdentity: sha256(canonicalJson(checked.api))});
			await writeFile(join(app,"BridgeCAsync.lean"),gen.entryLean,{flag: "wx"});
			await run(join(leanPrefix,"bin/lean"),["-j1","-c","async.c","BridgeCAsync.lean"],app,checked.env);
			assert.match(await readFile(join(app,"async.c"),"utf8"),/lean_object/u);
			await source.verify(); return checked;
		} finally
		{ await source.dispose(); }
	};
	const first=await build().catch(e=>{throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e});});
	assert.equal(first.evidence.selection.dotnetTaskObjects,true);
	assert.equal(first.evidence.selection.hostModule,"LeanBridge.Host.Dotnet");
	const fn=n=>first.api.declarations.find(d=>d.source.declaration==="Workers."+n);
	assert.equal(fn("echo").result.ownership,"lease");assert.equal(fn("relay").resultMode,"promise");
	assert.equal(fn("series").resultMode,"async-iterator");assert.equal(fn("identityBase").resultMode,"value");
	assert.ok(first.api.errors.some(e=>e.id==="error:DotNetCallbackException"));
	const cfg=join(project,"lean-bridge.exports.json"), review=join(project,"public.binding-ir.json");
	await writeFile(review,canonicalJson(first.api));delete config.exports;await writeFile(cfg,canonicalJson(config));
	assert.deepEqual((await build()).api,first.api);
	await rm(review);
	config.exports=["Workers.forbidden"];config.taskExports=config.exports;delete config.asyncIterators;delete config.taskIOErrors;
	await writeFile(cfg,canonicalJson(config));
	await appendFile(join(project,"Workers.lean"),"\nprivate def onWorker (b : LeanBridge.Host.Dotnet.Box) := b.read\ndef Workers.forbidden (b : LeanBridge.Host.Dotnet.Box) := IO.asTask (onWorker b)\n");
	await assert.rejects(build(),/CLR task calls a CLR member outside its owner: Workers\.forbidden/u);
	t.diagnostic("CLR nominal worker and cursor entries compiled; reviewed IR "+sha256(canonicalJson(first.api))+"; indirect worker member rejected");
});
