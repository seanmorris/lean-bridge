/** @file Recompile independent Lean applications and validate WIT heap-resource identity. */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { compileWitTaskResources } from "../../src/backends/wit/task-model.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { exerciseWitTaskHost } from "./wit-task-native-host.mjs";
import { writeWitLeaseProject } from "./wit-task-lease-project.mjs";

const host=process.env.LEAN_BRIDGE_WIT_TASK_LEASE_HOST==="1",requested=host || process.env.LEAN_BRIDGE_WIT_TASK_LEASE_WORLD==="1";
test("WIT task, pull and failure resources bind to the declaring Lean module", {skip: !requested},async t=>{
	const leanPrefix=process.env.LEAN_BRIDGE_LEAN_PREFIX, wasm=process.env.LEAN_BRIDGE_WASM_TOOLS;
	assert.ok(leanPrefix && wasm,"Set LEAN_BRIDGE_LEAN_PREFIX and LEAN_BRIDGE_WASM_TOOLS");
	const work=await mkdtemp(join(tmpdir(),"wit-lease-world-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const evidenceDir=process.env.LEAN_BRIDGE_WIT_TASK_LEASE_EVIDENCE;
	if(evidenceDir) await mkdir(evidenceDir);
	const runtimeRoot=process.env.LEAN_BRIDGE_WIT_TASK_RUNTIME??join(work,"runtime"),wasmtimeRoot=process.env.LEAN_BRIDGE_WASMTIME_C_API;
	if(host)
	{
		assert.ok(wasmtimeRoot,"Set LEAN_BRIDGE_WASMTIME_C_API");
		if(!process.env.LEAN_BRIDGE_WIT_TASK_RUNTIME) await buildNativeSharedRuntime({leanPrefix,outputRoot: runtimeRoot});
	}
	const run=async(command,args,cwd=work,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd,env}); }
		catch(error)
		{ t.diagnostic(error.details?.stderr??error.message);throw error; }
	};
	assert.match((await run(wasm,["--version"])).stdout,/^wasm-tools 1\.245\.1\b/u);
	const captured={};
	for(const route of ["ordinary","reviewed","peer","changed"])
	{
		const depot=route==="ordinary" || route==="reviewed", module=depot?"Depot":"Peer";
		const dir=join(work,route),app=join(dir,"build"),project=join(dir,"source");
		await mkdir(app,{recursive: true});
		const settings=await writeWitLeaseProject(project,module,route==="reviewed"?captured.ordinary.api:null,route==="changed");
		const inventory=await inspectLeanProject(project);
		const src=await openHostProjectSource({project,inventory,component: elaboratedComponent(inventory.project),leanPrefix});
		let built;
		try
		{
			built=await compileHostSources({app,ir: null,sources: src.sources
				, projectContract: src.projectContract
				, leanPrefix,run,environment: process.env,target: "wit-wasi"});
			await src.verify();
		}
		finally
		{ await src.dispose(); }
		const {api,evidence}=built, input={api,evidence,settings,bindingIrSha256: hashBindingIr(api)};
		const model=compileWitTaskResources(input);
		const resource=id=>model.heap.find(r=>r.id==="lean:Shared."+id);
		const ticket=resource("Ticket");assert.ok(ticket);assert.deepEqual(evidence.resourceImports.Shared,[]);
		assert.deepEqual(evidence.resourceImports[module],["Shared"]);
		assert.equal(model.wire.leases.find(r=>r.name==="Ticket").hash,ticket.hash);
		assert.ok(model.wit.includes("same-lease-ticket: func(%left: borrow<lease-ticket>, %right: borrow<lease-ticket>) -> bool;"));
		if(depot)
		{
			assert.notEqual(resource("Badge").hash,ticket.hash);
			assert.ok(model.wit.includes("result<own<checked-task>, own<lease-ticket>>"));
			assert.ok(model.wit.includes("item(own<"+ticket.nativeName+">)"));
			assert.ok(model.wit.includes("failed(own<"+ticket.nativeName+">)"));
			const stale=structuredClone(evidence);delete stale.resourceImports;
			assert.throws(()=>compileWitTaskResources({...input,evidence: stale}),/resource provenance/u);
			const forged=structuredClone(api);forged.types.find(r=>r.id===ticket.id).source.extensions["lean-bridge.dev/resource-identity"]="0".repeat(64);
			assert.throws(()=>compileWitTaskResources({...input,api: forged,bindingIrSha256: hashBindingIr(forged)}));
		}
		await writeFile(join(app,"world.wit"),model.wit);await writeFile(join(app,"component.wat"),model.wat);
		await run(wasm,["parse","component.wat","-o","component.wasm"],app);
		await run(wasm,["validate","--features","component-model","component.wasm"],app);
		await run(wasm,["component","targets","world.wit","component.wasm"],app);
		const wasmHash=sha256(await readFile(join(app,"component.wasm")));
		captured[route]={api,hash: ticket.hash,wasmHash};
		const native=host && depot && await exerciseWitTaskHost({app,built,model,leanPrefix,runtimeRoot,wasmtimeRoot,run});
		if(native) t.diagnostic(JSON.stringify(native));
		if(evidenceDir)
		{
			const dst=join(evidenceDir,route);await cp(app,dst,{recursive: true,errorOnExist: true,force: false});
			for(const [file,value] of [["api",api],["evidence",evidence],["entries",built.entries]])
				await writeFile(join(dst,file+".json"),canonicalJson(value));
			if(native) await writeFile(join(dst,"execution.json"),canonicalJson(native));
		}
		t.diagnostic(route+": "+ticket.hash+" / "+wasmHash);
	}
	assert.deepEqual(captured.reviewed,captured.ordinary);
	assert.equal(captured.peer.hash,captured.ordinary.hash);
	assert.notEqual(captured.changed.hash,captured.peer.hash);
	assert.notEqual(captured.changed.wasmHash,captured.peer.wasmHash);
	await assert.rejects(run(wasm,["component","targets",join(work,"peer/build/world.wit"),join(work,"changed/build/component.wasm")]),
		e=>e.code==="build-command-failed" && /lease-ticket/u.test(e.details?.stderr));
});
