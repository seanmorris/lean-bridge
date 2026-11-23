/** @file Compile synchronous Lean interfaces, then check their binary Component Model projection. */
import assert from "node:assert/strict";
import test from "node:test";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileWitSyncIO } from "../../src/backends/wit/sync-io-model.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { linkWitSyncHost } from "../../src/build/wit-sync-io-host.mjs";
import { testWitIOFailures } from "./wit-sync-io-failures.mjs";
import { testRelocatedWitIO } from "./wit-sync-io-install.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const { LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_WASM_TOOLS: tools } = process.env;
const requireHost = process.env.LEAN_BRIDGE_WIT_IO_HOST_TEST==="1";
if(requireHost && (!leanPrefix || !tools || !process.env.LEAN_BRIDGE_WIT_IO_RUNTIME || !process.env.LEAN_BRIDGE_WASMTIME_C_API))
	throw new Error("WIT IO host acceptance requires LEAN_BRIDGE_LEAN_PREFIX, LEAN_BRIDGE_WASM_TOOLS, LEAN_BRIDGE_WIT_IO_RUNTIME and LEAN_BRIDGE_WASMTIME_C_API");
for(const [fixture,module,wide] of [["native-sync-io","Journal"],["php-wasm-sync-io","Ledger"],["native-sync-io","Journal",true]])
test("binary WIT IO world agrees with checked "+module+(wide ? " and 19 scalar exports" : "")+" results and effects", {skip: !leanPrefix || !tools}, async t=>{
	const work = await mkdtemp(join(tmpdir(),"wit-sync-io-")); t.after(()=>rm(work,{recursive: true,force: true}));
	const project = join(work,"project"), app = join(work,"compile");
	await mkdir(app);
	await cp(resolve("tests/fixtures",fixture),project,{recursive: true});
	if(wide)
	{
		await copyFile(resolve("tests/fixtures/ruby-sync-io/RubyIO.lean"),join(project,"RubyIO.lean"));
		const configPath = join(project,"lean-bridge.exports.json"), c = JSON.parse(await readFile(configPath));
		const scalars = [...(await readFile(join(project,"RubyIO.lean"),"utf8")).matchAll(/^def (rt_\w+) /gmu)].map(m=>"RubyIO."+m[1]);
		assert.equal(scalars.length,19);
		c.modules.push("RubyIO"); c.exports.push(...scalars,"RubyIO.nested"); await writeFile(configPath,canonicalJson(c));
	}
	const {configurationRecord,inputs,project: facts,sourceTreeSha256} = await inspectLeanProject(project);
	const sources = [];
	for(const name of configurationRecord.configuration.modules)
	{
		const file = name+".lean", source = await readFile(join(project,file),"utf8");
		assert.equal(sha256(source),inputs.find(f=>f.path===file).sha256);
		sources.push({module: name,source});
	}
	const run = async (command,args,cwd=work,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd,env}); }
		catch(error)
		{ t.diagnostic(error.details?.stderr ?? error.message); throw error; }
	};
	assert.match((await run(tools,["--version"])).stdout,/^wasm-tools 1\.245\.1\b/u);
	const contract = { ...configurationRecord.configuration, synchronousIO: true
		, component: elaboratedComponent(facts), sourceTreeSha256
		, configurationSha256: configurationRecord.sha256
		, hostImportsSourceSha256: null };
	const built = await compileHostSources({app,ir: null,sources
		, projectContract: contract, leanPrefix,run,environment: process.env
		, target: "wit-wasi"});
	const {api,evidence} = built;
	const input = {api,evidence,bindingIrSha256: hashBindingIr(api)}, model = compileWitSyncIO(input);
	assert.equal(model.bindingIrSha256,hashBindingIr(api));
	assert.deepEqual(model.methods.map(m=>m.declaration),api.declarations.map(d=>d.source.declaration));
	const index = model.methods.findIndex(m=>m.witName==="choose");
	assert.equal(model.methods[index].failure,"error:EIO."+module+".choose");
	const envelope = model.layout.functions[index].declaration.result.type;
	assert.equal(envelope.constructor,"result");
	assert.deepEqual(envelope.arguments,[api.declarations[index].result.type,api.errors.find(e=>e.id===model.methods[index].failure).payload]);
	assert.equal(envelope.arguments[0].constructor,"result");
	if(module==="Journal") assert.deepEqual(model.methods.find(m=>m.witName==="store").capabilities,["capability:native.filesystem"]);
	if(wide) assert.equal(model.methods.filter(m=>m.witName.startsWith("rt-")).length,19);
	await writeFile(join(work,"surface.wit"),model.wit);
	await writeFile(join(work,"component.wat"),model.wat);
	await run(tools,["parse","component.wat","-o","component.wasm"]);
	await run(tools,["validate","--features","component-model","component.wasm"]);
	await run(tools,["component","targets","surface.wit","component.wasm"]);
	const wrong = model.wit.replace(/(choose: func\([^)]*\) -> )[^;]+;/gu,"$1bool;");
	assert.notEqual(wrong,model.wit); await writeFile(join(work,"flattened.wit"),wrong);
	await assert.rejects(processBuildRunner.capture({command: tools,args: ["component","targets","flattened.wit","component.wasm"],cwd: work}),/exited with status 1/u);
	const flattened = structuredClone(api); flattened.declarations[index].result.type = {kind: "primitive",name: "string"};
	assert.throws(()=>compileWitSyncIO({...input,api: flattened,bindingIrSha256: hashBindingIr(flattened)}),/differs from compiled/u);
	const task = structuredClone(evidence); task.selection.taskExports = [module+".choose"];
	assert.throws(()=>compileWitSyncIO({...input,evidence: task}),/standalone synchronous/u);
	assert.throws(()=>compileWitSyncIO({...input,bindingIrSha256: "0".repeat(64)}),/digest/u);
	t.diagnostic(model.methods.length+" source-checked exports; WIT world matched binary; component SHA-256 "+sha256(await readFile(join(work,"component.wasm"))));
	const runtimeRoot = process.env.LEAN_BRIDGE_WIT_IO_RUNTIME;
	if(runtimeRoot)
	{
		const componentBytes = await readFile(join(work,"component.wasm"));
		const wasmtimeRoot = process.env.LEAN_BRIDGE_WASMTIME_C_API;
		const host = await linkWitSyncHost({app,built,runtimeRoot,leanPrefix,run,wasmtimeRoot,wasmTools: tools});
		assert.equal(host.componentSha256,sha256(componentBytes));
		const sdk = join(app,"wasmtime"), cc = process.env.CC ?? "cc";
		const env = {...process.env,LD_LIBRARY_PATH: [app,join(runtimeRoot,"lib"),join(sdk,"lib")].join(":"),RAYON_NUM_THREADS: "1"};
		if(wide) await testWitIOFailures({model,app,work,objects: built.objects,tools,run,cc,runtimeRoot,env,t,dependencies: host.dependencies});
		await testRelocatedWitIO({work,app,runtimeRoot,host,cc,run,t,module,wide});
	}
});
