/** @file Check C, C++ and Rust worker object contracts against fresh Lean compilation. */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { reconcileHostExports, taskWorkerInterface } from "../../src/analyze/host-export-model.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareStaticWorkerProject, staticOwners } from "./static-worker-project.mjs";

const run = (command,args,cwd,env) => processBuildRunner.capture({command,args,cwd,env});
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
for(const [owner,[module,target,callbackError]] of Object.entries(staticOwners)) test(owner + " workers carry nominal objects without direct worker member access", {timeout: 600000}, async t => {
	const root = await mkdtemp(join(tmpdir(),"static-worker-")); t.after(() => rm(root,{recursive: true,force: true}));
	const project = join(root,"source"), review = join(project,"review.binding-ir.json");
	const {cfg,declared,save}=await prepareStaticWorkerProject(project,owner);
	const build = async () => {
		const inventory = await inspectLeanProject(project), component = elaboratedComponent(inventory.project);
		const source = await openHostProjectSource({project,inventory,component,targets: [target],leanPrefix});
		try
		{
			const app = await mkdtemp(join(root,"objects-")), ir = source.projectContract.ir;
			const checked = await compileHostSources({...source,app,ir,target,environment: process.env,run});
			await source.verify(); return {...checked,ir};
		} finally
{ await source.dispose(); }
	};
	const first = await build().catch(e => { throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e}); });
	const {api,evidence,ir} = first, selection=evidence.selection, meta=evidence.metadata, item=api.types.find(t=>t.host?.targets.includes(owner));
	assert.equal(selection.staticTaskOwner,owner); assert.equal(selection.hostModule,"LeanBridge.Host."+module); assert.ok(item);
	const fn = n => api.declarations.find(d=>d.source.declaration===n), cb=api.types.find(t=>t.kind==="callback").callable;
	assert.equal(fn("Jobs.echo").result.type.id,item.id); assert.equal(fn("Jobs.echo").result.ownership,"lease");
	assert.equal(fn("Jobs.relay").resultMode,"promise"); assert.equal(cb.resultMode,"value");
	assert.equal(cb.parameters[0].type.id,item.id); assert.equal(cb.result.type.id,item.id);
	assert.ok(fn("Jobs.relay").failure.errors.includes("error:"+callbackError)); assert.equal(fn("Jobs.series").resultMode,"async-iterator");
	assert.equal(fn("Jobs.reject").source.extensions["lean-bridge.dev/error-payload-site"].type.id,item.id);
	assert.equal(fn("Jobs.series").source.extensions["lean-bridge.dev/step-error-payload-site"].type.id,item.id);
	assert.deepEqual(fn("Jobs.series").source.extensions["lean-bridge.dev/host-member-phases"],{call: [],pull: [],close: []});
	const reconcile = s => reconcileHostExports({ir,component: api.component,metadata: meta,selection: s});
	const other = owner==="cpp"?"rust":"cpp";
	assert.throws(()=>reconcile({...selection,staticTaskOwner: other}),/Unauthenticated static worker/u);
	assert.throws(()=>reconcile({...selection,[other+"TaskCallbacks"]: true}),/Unauthenticated static worker/u);
	const absent={...selection}; delete absent.staticTaskOwner; assert.throws(()=>reconcile(absent),/synchronous owner/u);
	assert.throws(()=>taskWorkerInterface(api,evidence),/cannot use the JavaScript worker/u);
	await writeFile(review,canonicalJson(api)); delete cfg.exports; await save();
	const second=await build(); assert.deepEqual(second.api,api); assert.equal(second.evidence.reviewedSourceSha256,sha256(canonicalJson(api)));
	await rm(review);delete cfg.taskIOErrors;delete cfg.asyncIterators;cfg.exports=cfg.taskExports=["Jobs.forbidden"]; await save();
	await assert.rejects(build(),{code: "invalid-task-export",message: (owner==="cpp"?"C++":module)+" task calls a "+(owner==="cpp"?"C++":module)+" member outside its owner: Jobs.forbidden"});
	delete cfg.taskExports;cfg.exports=[declared.open];cfg.asyncIterators=[{...declared,next: "Jobs.forbiddenPull"}];await save();
	await assert.rejects(build(),e=>e.code==="invalid-task-export" && e.message.endsWith("outside its owner: Jobs.forbiddenPull"));
	t.diagnostic(owner+" ordinary and reviewed worker IR: "+sha256(canonicalJson(api)));
});
