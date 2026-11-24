/** @file Compile both Python nominal worker author routes and check the owner/worker boundary. */
import assert from "node:assert/strict";
import {appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {reconcileHostExports,taskWorkerInterface} from "../../src/analyze/host-export-model.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {compileHostSources} from "../../src/build/host-elaboration.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {exercisePythonWorkerWheels} from "./python-worker-installed.mjs";

const diagnostic=e=>[e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n");
const json=async file=>JSON.parse(await readFile(file));
const cli=resolve("scripts/lean-bridge.mjs");
const handoff=async (author,out,python)=>{
	const env={...process.env,LEAN_BRIDGE_PYTHON: python};
	const invoke=async (...args)=>{
		const req={command: process.execPath,args: [cli,...args,"--format","json"],cwd: author,env};
		return JSON.parse((await processBuildRunner.capture(req)).stdout).result;
	};
	await invoke("build","--project",author,"--target","pypi","--output",out);
	const file=join(out,"package-set-receipt.json"),verified=await invoke("verify","--receipt",file);
	assert.equal(verified.verified,true);assert.equal(verified.archives,2);
	const receipt=await json(file),artifact=role=>receipt.packages.find(p=>p.role===role).artifacts[0];
	assert.equal(receipt.profiles[0].id,"native-python-task-v1");
	const runtime=artifact("runtime"),component=artifact("component");
	return {api: await json(join(out,"binding-ir.json"))
		, evidence: await json(join(out,"host-export-evidence.json"))
		, runtime: {...runtime,file: join(out,runtime.path)}
		, sha256: component.sha256,file: join(out,component.path)
		, runtimeIdentity: receipt.profiles[0].runtimeIdentity};
};
test("Python workers carry captured nominal objects but cannot dispatch Python members",async t=>{
	const root=await mkdtemp(join(process.env.LEAN_BRIDGE_PYTHON_HOST_TASK_OUTPUT??tmpdir(),"python-host-workers-"));
	if(!process.env.LEAN_BRIDGE_PYTHON_HOST_TASK_OUTPUT) t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"author"),file=join(project,"lean-bridge.exports.json"),main=join(project,"Workers.lean");
	await cp("tests/fixtures/python-host-meter",project,{recursive: true});
	await copyFile("tests/fixtures/python-host-tasks/Workers.lean",main);
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Workers"\n');
	const cfg=JSON.parse(await readFile(file));
	const names=list=>list.map(n=>"Workers."+n);
	cfg.modules.push("Workers");cfg.taskExports=names(["relay","project","choose","fallback","outcome","reject"]);
	cfg.taskIOErrors=names(["relay","project","choose","fallback"]);
	cfg.asyncIterators=[{open: "Workers.openCursor",next: "Workers.pull",close: "Workers.close"}];
	cfg.asyncIterators.push({open: "Workers.openErrorCursor",next: "Workers.pullIO",close: "Workers.closeIO"});
	cfg.exports.push(...cfg.taskExports,"Workers.openCursor","Workers.openErrorCursor");
	await writeFile(file,canonicalJson(cfg));
	const installed=process.env.LEAN_BRIDGE_HOST_OBJECT_TEST==="1";
	const python=process.env.LEAN_BRIDGE_PYTHON??"python3",wheels=[];let runtime;
	const compile=async (label,author=project)=>{
		const inventory=await inspectLeanProject(author),component=elaboratedComponent(inventory.project);
		const src=await openHostProjectSource({project: author,inventory,component,targets: ["pypi"]});
		try
		{
			const app=join(root,label);await mkdir(app);
			const run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
			const ir=src.projectContract.ir;
			const opts={...src,app,ir,run,target: "pypi",python,environment: process.env};
			const wheel=installed && ["ordinary","reviewed","peer"].includes(label);
			const result=wheel?await handoff(author,join(root,"handoff-"+label),python):await compileHostSources(opts);
			if(wheel)
			{
				if(runtime) assert.equal(result.runtime.sha256,runtime.sha256);
				else runtime=result.runtime;
			}
			if(wheel && label!=="peer") wheels.push([label,result]);
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
		assert.equal(get("Workers.openErrorCursor").source.extensions["lean-bridge.dev/step-failure"],"IO.Error");
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
		await writeFile(main,source);
		await rm(join(project,"api.binding-ir.json"));
		const scalar={...cfg,exports: ["Workshop.readLevel","Workers.scalar"],taskExports: ["Workers.scalar"]};
		delete scalar.taskIOErrors;delete scalar.asyncIterators;
		await writeFile(file,canonicalJson(scalar));
		const adjacent=await compile("scalar-neighbor");
		assert.equal(adjacent.evidence.selection.pythonTaskObjects,undefined);
		assert.equal(adjacent.api.declarations.find(e=>e.id==="lean:Workers.scalar").resultMode,"promise");
		if(runtime)
		{
			const peer=join(root,"peer-author");
			await cp("tests/fixtures/python-host-meter",peer,{recursive: true});
			await copyFile("tests/fixtures/python-host-tasks/Peer.lean",join(peer,"Peer.lean"));
			await copyFile("tests/fixtures/python-host-tasks/Strong.lean",join(peer,"Strong.lean"));
			const lake=join(peer,"lakefile.toml");
			await writeFile(lake,(await readFile(lake,"utf8")).replace('name = "workshop"','name = "workshop_peer"')+'\n[[lean_lib]]\nname = "Peer"\n\n[[lean_lib]]\nname = "Strong"\n');
			const pfile=join(peer,"lean-bridge.exports.json"),settings=JSON.parse(await readFile(pfile));
			const imports=join(peer,settings.hostImports),kinds=await json(imports),pinned=structuredClone(kinds.types[0]);
			pinned.id="host:meter.Pinned";pinned.name="Pinned";pinned.source.declaration="Pinned";
			pinned.host.identity="strong-canonical";pinned.resource.kindId="resource:meter.Pinned";
			const read=structuredClone(kinds.declarations[0]);
			read.id=pinned.id+".read";read.owner=pinned.id;read.receiver.type.id=pinned.id;
			read.overloadKey="Pinned.read()";read.source.declaration="Pinned.read";
			kinds.types.push(pinned);kinds.declarations.push(read);await writeFile(imports,canonicalJson(kinds));
			settings.targets.pypi.name="lean-meter-peer";settings.modules.push("Peer","Strong");
			settings.taskExports=["Peer.exchange","Strong.pinned"];settings.taskIOErrors=[...settings.taskExports];
			settings.exports.push(...settings.taskExports);
			await writeFile(pfile,canonicalJson(settings));
			const other=await compile("peer",peer);
			assert.notEqual(other.component.id,component.id);assert.equal(other.runtimeIdentity,wheels[0][1].runtimeIdentity);
			await rm(peer,{recursive: true});
			await rm(project,{recursive: true});
			await exercisePythonWorkerWheels({root,python,runtime: runtime.file,wheels,peer: other.file,diagnostic: msg=>t.diagnostic(msg)});
		}
		t.diagnostic("Ordinary and reviewed Python nominal workers: "+sha256(review));
	} catch(e)
	{t.diagnostic(diagnostic(e).slice(-4200));throw e;}
});
