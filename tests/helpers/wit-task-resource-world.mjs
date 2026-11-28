/** @file Check real Lean task signatures and their public binary WIT resource identities. */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { compileWitTaskResources } from "../../src/backends/wit/task-model.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { exerciseWitTaskHost } from "./wit-task-native-host.mjs";

const { LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_WASM_TOOLS: tools } = process.env;
const host=process.env.LEAN_BRIDGE_WIT_TASK_HOST==="1";
const wasmtimeRoot=process.env.LEAN_BRIDGE_WASMTIME_C_API;
if(host && (!leanPrefix || !tools || !wasmtimeRoot))
	throw new Error("WIT task execution requires a Lean prefix, wasm-tools and the Wasmtime C API");
if(process.env.LEAN_BRIDGE_WIT_TASK_WORLD==="1" && (!leanPrefix || !tools))
	throw new Error("Set LEAN_BRIDGE_LEAN_PREFIX and LEAN_BRIDGE_WASM_TOOLS for the WIT task world check");
test("compiled Lean tasks project to distinct owned WIT resources with borrowed typed poll and cancel", {
	skip: !leanPrefix || !tools, timeout: 300000
}, async t => {
	const work = await mkdtemp(join(tmpdir(), "wit-task-world-"));
	t.after(() => rm(work, {recursive: true,force: true}));
	const runtimeRoot=process.env.LEAN_BRIDGE_WIT_TASK_RUNTIME ?? join(work,"runtime");
	if(host && !process.env.LEAN_BRIDGE_WIT_TASK_RUNTIME) await buildNativeSharedRuntime({leanPrefix,outputRoot: runtimeRoot});
	const archive=process.env.LEAN_BRIDGE_WIT_TASK_WORLD_EVIDENCE;
	if(archive) await mkdir(archive);
	const project = join(work,"project"); await cp(resolve("tests/fixtures/wit-tasks"),project,{recursive: true});
	const run = async (command,args,cwd=work,env=process.env) => {
		try
{return await processBuildRunner.capture({command,args,cwd,env});}
		catch(error)
{t.diagnostic(error.details?.stderr ?? error.message);throw error;}
	};
	assert.match((await run(tools,["--version"])).stdout,/^wasm-tools 1\.245\.1\b/u);
	let ordinary;
	for(const mode of ["ordinary","reviewed"])
	{
		const app = join(work,mode); await mkdir(app);
		if(mode==="reviewed")
		{
			const path=join(project,"lean-bridge.exports.json"), config=JSON.parse(await readFile(path));
			delete config.exports; await writeFile(path,canonicalJson(config));
			await writeFile(join(project,"author.binding-ir.json"),canonicalJson(ordinary.api));
		}
		const inventory=await inspectLeanProject(project), settings=inventory.configurationRecord.configuration.targets["wit-wasi"];
		const source=await openHostProjectSource({project,inventory,component: elaboratedComponent(inventory.project),leanPrefix});
		let built;
		try
		{
			built=await compileHostSources({app,ir: source.projectContract.ir
				, sources: source.sources
				, projectContract: source.projectContract
				, leanPrefix
				, run
				, environment: process.env
				, target: "wit-wasi"});
			await source.verify();
		}
		finally
{await source.dispose();}
		const {api,evidence}=built;
		const input = {api,evidence,settings,bindingIrSha256: hashBindingIr(api)};
		const model = compileWitTaskResources(input);
		if(mode==="reviewed")
{assert.deepEqual(api,ordinary.api);assert.equal(model.wit,ordinary.wit);}
		else ordinary = {api,wit: model.wit};
		assert.equal(model.methods.length,3);
		assert.equal(new Set(model.methods.map(m=>m.resource)).size,3);
		await writeFile(join(app,"world.wit"),model.wit);
		await writeFile(join(app,"component.wat"),model.wat);
		await run(tools,["parse","component.wat","-o","component.wasm"],app);
		await run(tools,["validate","--features","component-model","component.wasm"],app);
		await run(tools,["component","targets","world.wit","component.wasm"],app);
		const decoded=(await run(tools,["component","wit","component.wasm"],app)).stdout;
		for(const m of model.methods) assert.ok(decoded.includes("resource "+m.resource+";"));
		// Distinct nominal identities must survive serialization, even for identical carrier widths.
		const wrong = model.wit.replaceAll("poll-parked: func(%task: borrow<parked-task>)",
			"poll-parked: func(%task: borrow<immediate-task>)");
		assert.notEqual(wrong,model.wit);
		await writeFile(join(app,"wrong.wit"),wrong);
		await assert.rejects(processBuildRunner.capture({command: tools,cwd: app,args: ["component","targets","wrong.wit","component.wasm"]}));
		const tampered=structuredClone(api);tampered.declarations[0].result.type={kind: "primitive",name: "int32"};
		const differentHash=hashBindingIr(tampered);assert.notEqual(differentHash,input.bindingIrSha256);
		assert.throws(()=>compileWitTaskResources({...input,api: tampered,bindingIrSha256: differentHash}),/Reviewed API differs/u);
		const capabilities=structuredClone(evidence);capabilities.selection.nativeEffects=["filesystem"];
		assert.throws(()=>compileWitTaskResources({...input,evidence: capabilities}),/compiler evidence/u);
		const result={mode,methods: model.methods.map(m=>m.declaration)
			, bindingIrSha256: model.bindingIrSha256
			, world: sha256(model.wit)
			, component: sha256(await readFile(join(app,"component.wasm")))};
		if(host) result.native=await exerciseWitTaskHost({app,built,model,leanPrefix,runtimeRoot,wasmtimeRoot,run});
		if(archive)
		{
			const dir=join(archive,mode);await mkdir(dir);
			for(const file of ["world.wit","component.wat","component.wasm","Meter.lean","Meter.olean",...built.objects])
				await cp(join(app,file),join(dir,file),{errorOnExist: true,force: false});
			if(host) for(const file of ["consumer","consumer.c","wasmtime-lab.h","task-host.h","BridgeCAsync.lean","adapter.c","wire.c"])
				await cp(join(app,file),join(dir,file),{errorOnExist: true,force: false});
			for(const [file,obj] of [["binding-ir.json",api],["evidence.json",evidence],["acceptance.json",result]])
				await writeFile(join(dir,file),canonicalJson(obj),{flag: "wx"});
		}
		t.diagnostic(JSON.stringify(result));
	}
});
