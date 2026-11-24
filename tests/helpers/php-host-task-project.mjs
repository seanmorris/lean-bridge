/** @file Check native PHP worker carriers against compiled Lean, independently of runtime delivery. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { reconcileHostExports, taskWorkerInterface } from "../../src/analyze/host-export-model.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { compilePhpHostTaskComponent } from "../../src/build/php-host-component.mjs";
import { phpHostMembers } from "../../src/backends/php/host-members.mjs";
import { copiedPhpValues,phpConversionBudget } from "../../src/backends/php/copied-support.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";

const diagnostic=e=>[e.message,e.details?.stderr,e.details?.stdout].join("\n");
test("native PHP workers carry declared classes through checked tasks and cursors without acquiring PHP member dispatch",async t=>{
	const sdk=process.env.LEAN_BRIDGE_PHP_HOST_TASK_SDK;
	if(process.env.LEAN_BRIDGE_PHP_REQUIRE_TASK_KERNEL==="1" && !sdk) throw new Error("Set LEAN_BRIDGE_PHP_HOST_TASK_SDK to a verified native runtime SDK");
	const keep=process.env.LEAN_BRIDGE_PHP_HOST_TASK_OUTPUT,root=await mkdtemp(join(keep ?? tmpdir(),"php-task-objects-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"project"),sample="tests/fixtures/php-host-tasks";
	await prepareNativeHostFixture(project,"php"); await copyFile("LICENSE",join(project,"LICENSE"));
	for(const f of ["Workshop.lean","lean-bridge.exports.json"]) await copyFile(join(sample,f),join(project,f));
	const compile=async label=>{
		const inventory=await inspectLeanProject(project),component=elaboratedComponent(inventory.project);
		const src=await openHostProjectSource({project,inventory,component,targets: ["php-native"]});
		try
		{
			const app=join(root,label); await mkdir(app);
			const run=(command,args,cwd,env)=>processBuildRunner.capture({command,args,cwd,env});
			const ir=src.projectContract.ir;
			const opts={...src,app,ir,run,target: "php-native",environment: process.env};
			const built=label!=="direct-member" && sdk ? await compilePhpHostTaskComponent({...opts,runtimeRoot: sdk,name: "lean-bridge/workshop",version: "1.0.0"}) : await compileHostSources(opts);
			await src.verify();
			return {...built,ir,component,library: built.task?built.component:null};
		} finally
		{await src.dispose();}
	};
	const execute=async(built,route)=>{
		if(!built.task) return;
		const at=join(root,route);
		const {stdout: symbols}=await processBuildRunner.capture({command: "nm",args: ["-D","--defined-only",built.library],cwd: at,env: process.env});
		const exported=symbols.trim().split("\n").map(l=>l.trim().split(/\s+/u).at(-1)).sort();
		assert.deepEqual(exported,[built.prefix+"_call",built.prefix+"_clear",...built.task.port.symbols].sort(),"the dynamic library must not expose raw Lean or ledger entry points");
		await writeFile(join(at,"kernel.json"),canonicalJson({component: built.library,prefix: built.prefix,domain: built.domain,task: built.task,hosts: phpHostMembers(built.ir)}));
		await writeFile(join(at,"support.php"),"<?php\nnamespace __LB_PUBLIC__;\n"+copiedPhpValues+"\nnamespace __LB_PUBLIC__\\Internal;\n"+phpConversionBudget+"\n");
		const results=[];
		for(const command of (process.env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(","))
		{
			const env={PATH: "/no-tools",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1",LD_LIBRARY_PATH: at+":"+join(sdk,"lib")};
			const run=args=>processBuildRunner.capture({command: resolve(command),args,cwd: at,env});
			const flags=(await run(["-n","-r","echo (int)extension_loaded('ffi');"])).stdout.trim()==="1"?["-n"]:["-n","-d","extension=ffi"];
			const {stdout}=await run([...flags,"-d","ffi.enable=1",resolve(sample,"kernel.php"),at,resolve("src/backends/php")]);
			const result=JSON.parse(stdout); assert.ok(result.checks>=47); assert.equal(result.livePhpReferences,0);
			results.push(result); t.diagnostic(route+" / PHP "+result.php+": "+result.checks+" worker checks, zero live PHP reference tokens");
		}
		await writeFile(join(at,"execution.json"),canonicalJson({api: sha256(canonicalJson(built.api)),identity: built.identity,binaries: built.binaries,runtime: built.runtimeIdentity,results}));
	};
	try
	{
		const ordinary=await compile("ordinary"),{api,evidence,ir,component}=ordinary;
		assert.throws(()=>taskWorkerInterface(api,evidence),/cannot use the JavaScript worker/u);
		await execute(ordinary,"ordinary");
		const fn=name=>api.declarations.find(d=>d.source.declaration==="Workshop."+name);
		const phase="lean-bridge.dev/host-members",box={kind: "named",id: ir.types[0].id};
		const lease={type: box,ownership: "lease",lifetime: {scope: "explicit",anchor: null}};
		assert.equal(evidence.selection.phpNativeTaskObjects,true); assert.equal(evidence.selection.javascriptThreadedHostMembers,undefined);
		assert.equal(fn("read").resultMode,"value"); assert.deepEqual(fn("read").source.extensions[phase],["LeanBridge.Host.Php.Box.read"]);
		assert.deepEqual(fn("read").failure.errors,["error:IO.Error","error:PhpHostException"]);
		assert.equal(fn("relay").resultMode,"promise"); assert.deepEqual(fn("relay").result,lease);
		assert.deepEqual(fn("relay").source.extensions[phase],[]);
		assert.deepEqual(fn("relay").failure.errors,["error:TaskIO.Error","error:PhpCallbackException"]);
		for(const name of ["relay","project","select"])
		{
			const callback=api.types.find(t=>t.id===fn(name).parameters.at(-1).type.id).callable;
			assert.equal(callback.resultMode,"value"); assert.equal(callback.reentry,"same-agent");
			assert.deepEqual(callback.failure.errors,["error:PhpCallbackException"]);
			if(name!=="select") assert.equal(callback.parameters[0].ownership,"lease");
			if(name!=="project") assert.deepEqual(callback.result,lease);
		}
		assert.equal(fn("either").result.type.constructor,"result"); assert.equal(fn("either").result.ownership,"lease");
		assert.deepEqual(fn("checked").source.extensions["lean-bridge.dev/error-payload-site"],lease);
		assert.equal(fn("openCursor").resultMode,"async-iterator");
		assert.deepEqual(fn("openCursor").source.extensions["lean-bridge.dev/step-error-payload-site"],lease);
		const deny=(change,re)=>{
			const {selection,metadata}=structuredClone(evidence);
			change(selection,metadata);
			assert.throws(()=>reconcileHostExports({ir,component,selection,metadata}),re);
		};
		deny(s=>{delete s.phpNativeTaskObjects;},/synchronous owner/u);
		deny(s=>{s.javascriptTaskCallbacks=true;},/Ambiguous/u);
		deny((s,m)=>{m.entries.find(e=>e.declaration==="Workshop.relay").parameters[1].type.reply.id="host:unknown";},/Unauthenticated retained callback carrier/u);
		deny((s,m)=>{m.nativeEffectAudit.roots.find(r=>r.declaration==="Workshop.pull").leaves.push({module: s.hostModule,name: s.members.find(n=>n.endsWith(".read")),symbol: "lean_bridge_host_php_box_read"});},/outside its owner/u);
		const review=canonicalJson(api),reviewPath=join(project,"workshop.binding-ir.json");
		await writeFile(reviewPath,review);
		const configPath=join(project,"lean-bridge.exports.json"),config=JSON.parse(await readFile(configPath,"utf8"));
		delete config.exports; await writeFile(configPath,canonicalJson(config));
		const checked=await compile("reviewed");
		await execute(checked,"reviewed");
		assert.deepEqual(checked.api,api); assert.deepEqual(checked.evidence.metadata,evidence.metadata);
		assert.equal(checked.evidence.reviewedSourceSha256,sha256(review));
		const main=join(project,"Workshop.lean"),source=await readFile(main,"utf8");
		await writeFile(main,source.replace("IO.asTask (f box)","IO.asTask do\n    let _ ← box.read\n    f box"));
		await assert.rejects(compile("direct-member"),e=>/native PHP task calls a PHP member outside its owner/u.test(diagnostic(e)));
		t.diagnostic("Ordinary + reviewed task, callback, cursor and error sites: "+sha256(review)+"; "+root);
	}
	catch(e)
	{t.diagnostic(diagnostic(e).slice(-4000));throw e;}
});
