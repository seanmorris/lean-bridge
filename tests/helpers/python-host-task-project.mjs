/** @file Compile both Python nominal worker author routes and check the owner/worker boundary. */
import assert from "node:assert/strict";
import {appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {reconcileHostExports,taskWorkerInterface} from "../../src/analyze/host-export-model.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {compileHostSources} from "../../src/build/host-elaboration.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";

const diagnostic=e=>[e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n");
test("Python workers carry captured nominal objects but cannot dispatch Python members",async t=>{
	const root=await mkdtemp(join(process.env.LEAN_BRIDGE_PYTHON_HOST_TASK_OUTPUT??tmpdir(),"python-host-workers-"));
	if(!process.env.LEAN_BRIDGE_PYTHON_HOST_TASK_OUTPUT) t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"author"),file=join(project,"lean-bridge.exports.json"),main=join(project,"Workers.lean");
	await cp("tests/fixtures/python-host-meter",project,{recursive: true});
	await copyFile("tests/fixtures/python-host-tasks/Workers.lean",main);
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Workers"\n');
	const cfg=JSON.parse(await readFile(file));
	const names=list=>list.map(n=>"Workers."+n);
	cfg.modules.push("Workers");cfg.taskExports=names(["relay","project","choose","outcome","reject"]);
	cfg.taskIOErrors=names(["relay","project","choose"]);
	cfg.asyncIterators=[{open: "Workers.openCursor",next: "Workers.pull",close: "Workers.close"}];
	cfg.exports.push(...cfg.taskExports,"Workers.openCursor");
	await writeFile(file,canonicalJson(cfg));
	const compile=async label=>{
		const inventory=await inspectLeanProject(project),component=elaboratedComponent(inventory.project);
		const src=await openHostProjectSource({project,inventory,component,targets: ["pypi"]});
		try
		{
			const app=join(root,label);await mkdir(app);
			const run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
			const ir=src.projectContract.ir;
			const result=await compileHostSources({...src,app,ir,run,target: "pypi",python: process.env.LEAN_BRIDGE_PYTHON??"python3",pythonTaskObjects: true,environment: process.env});
			await src.verify();return {...result,ir,component};
		} finally
		{await src.dispose();}
	};
	try
	{
		const {api,evidence,ir,component}=await compile("ordinary");
		const get=name=>api.declarations.find(d=>d.id==="lean:"+name);
		const type={kind: "named",id: ir.types[0].id},lease={type,ownership: "lease",lifetime: {scope: "explicit",anchor: null}};
		const cb=name=>api.types.find(t=>t.id===get("Workers."+name).parameters[1].type.id).callable;
		assert.equal(evidence.selection.pythonTaskObjects,true);assert.equal(evidence.selection.pythonTaskCallbacks,true);
		assert.equal(get("Workshop.readLevel").resultMode,"value");assert.deepEqual(get("Workshop.readLevel").failure.errors,["error:IO.Error","error:PythonHostException"]);
		assert.equal(get("Workers.relay").resultMode,"promise");assert.deepEqual(get("Workers.relay").result,lease);
		assert.deepEqual(get("Workers.relay").failure.errors,["error:TaskIO.Error","error:PythonCallbackException"]);
		assert.deepEqual(cb("relay").result,lease);assert.equal(cb("project").parameters[0].ownership,"lease");assert.deepEqual(cb("choose").result,lease);
		assert.equal(cb("relay").resultMode,"value");assert.deepEqual(cb("relay").failure.errors,["error:PythonCallbackException"]);
		assert.equal(get("Workers.outcome").result.type.constructor,"result");assert.deepEqual(get("Workers.reject").source.extensions["lean-bridge.dev/error-payload-site"],lease);
		assert.deepEqual(get("Workers.openCursor").source.extensions["lean-bridge.dev/step-error-payload-site"],lease);
		assert.deepEqual(get("Workers.openCursor").source.extensions["lean-bridge.dev/host-member-phases"],{call: [],pull: [],close: []});
		assert.throws(()=>taskWorkerInterface(api,evidence),/cannot use the JavaScript worker/u);
		assert.throws(()=>reconcileHostExports({ir,component,metadata: evidence.metadata,selection: {...evidence.selection,javascriptTaskCallbacks: true}}),/Ambiguous/u);
		const unmarked={...evidence.selection};delete unmarked.pythonTaskObjects;
		assert.throws(()=>reconcileHostExports({ir,component,metadata: evidence.metadata,selection: unmarked}),/Unexpected cursor host member phases|authenticated owner|Unauthenticated retained callback carrier/u);
		const tampered=structuredClone(evidence.metadata);
		tampered.entries.find(e=>e.declaration==="Workers.relay").parameters[1].type.reply.id="host:unregistered.Box";
		assert.throws(()=>reconcileHostExports({ir,component,metadata: tampered,selection: evidence.selection}),/Unauthenticated retained callback carrier/u);
		const review=canonicalJson(api);
		delete cfg.exports;await writeFile(file,canonicalJson(cfg));await writeFile(join(project,"api.binding-ir.json"),review);
		const checked=await compile("reviewed");
		assert.deepEqual(checked.api,api);assert.equal(checked.evidence.reviewedSourceSha256,sha256(review));
		const source=await readFile(main,"utf8");
		const changed=structuredClone(api);
		changed.declarations.find(d=>d.id==="lean:Workers.reject").source.extensions["lean-bridge.dev/error-payload-site"].ownership="copy";
		await writeFile(join(project,"api.binding-ir.json"),canonicalJson(changed));
		await assert.rejects(compile("stale-review"),e=>/Reviewed API differs/u.test(diagnostic(e)));
		await writeFile(join(project,"api.binding-ir.json"),review);
		await writeFile(main,source.replace("IO.asTask (f box)","IO.asTask do\n    let _ ← Workshop.readLevel box\n    f box"));
		await assert.rejects(compile("direct-member"),e=>/Python task calls a Python member outside its owner: Workers.relay/u.test(diagnostic(e)));
		t.diagnostic("Ordinary and reviewed Python nominal workers: "+sha256(review));
	} catch(e)
	{t.diagnostic(diagnostic(e).slice(-4200));throw e;}
});
