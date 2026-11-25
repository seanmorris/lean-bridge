/** @file Exercise a compiled Lean worker with objects owned by a real guest component. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildWitApplicationConsumer } from "./wit-application-consumer.mjs";
import { witApplicationOperations } from "../../src/backends/wit/application-operations.mjs";
import { witObjectFutureFiles } from "../../src/backends/wit/application-future.mjs";
import { witObjectCallbackFiles } from "../../src/backends/wit/application-callback.mjs";

/**
 * Compile and run the fixture against the actual generated interface and native provider.
 *
 * @param root0 - Captured build under test.
 * @param root0.app - Private directory containing the generated headers and shared object.
 * @param root0.runtimeRoot - Verified native Lean runtime for this build.
 * @param root0.b - Compiled WIT provider and its source-derived import contract.
 * @param root0.ir - Original application object contract.
 */
export const exerciseWitApplicationObjects = async ({app,runtimeRoot,b,ir}) => {
	const {wit,interfaceName}=b.witImports;
	const entries=b.entries.filter(e=>!e.delivery);
	const altered=structuredClone(b.api);
	altered.errors.find(e=>e.id==="error:EIO.Workshop.mapped").payload={kind: "primitive",name: "uint32"};
	const options={descriptor: b.witImports,entries,name: "workshop",version: "1.0.0"};
	for(const alter of [
		t=>{t.source.extensions["lean-bridge.dev/callback-scheduler"]="worker";}
		, t=>{t.callable.selfDisposal="immediate";}
		, t=>{t.callable.result.ownership="copy";}
		, t=>{t.callable.failure.errors=["error:TaskIO.Error"];}
	]){
		const api=structuredClone(b.api);alter(api.types.find(t=>t.kind==="callback"));
		assert.throws(()=>witObjectCallbackFiles({...options,ir,api,entries: b.entries.filter(e=>e.delivery)}),/Invalid retained WIT object callback/u);
	}
	assert.throws(()=>witApplicationOperations({...options,api: altered}),/failure payload differs/u);
	const invented=structuredClone(b.api);
	invented.declarations.find(d=>d.source.declaration==="Workshop.choose").failure.errors.push("error:IO.Error");
	assert.throws(()=>witApplicationOperations({...options,api: invented}),/unrecognized failure channels/u);
	for(const [name,alter] of [
		["series",d=>{d.parameters[0].mutability="read";}]
		, ["series",d=>{d.source.extensions["lean-bridge.dev/step-error-payload-site"].ownership="copy";}]
		, ["series",d=>{d.source.extensions["lean-bridge.dev/pull-protocol"].close="Jobs.next";}]
		, ["series",d=>{d.source.extensions["lean-bridge.dev/step-failure"]="IO.Error";}]
		, ["series",d=>{d.failure.errors=[];}]
		, ["series",(d,api)=>{api.errors.find(v=>v.id===d.failure.errors[0]).payload={kind: "primitive",name: "uint32"};}]
		, ["finite",d=>{d.source.extensions["lean-bridge.dev/step-error-payload-site"]=d.result;}]
		, ["finite",d=>{d.failure={mode: "declared",errors: ["error:AsyncStep.Jobs.series"],unexpected: "poison-runtime"};}]
	]){
		const api=structuredClone(b.api);alter(api.declarations.find(d=>d.name===name),api);
		assert.throws(()=>witObjectFutureFiles({...options,ir,model: b.model,api,entries: b.entries.filter(e=>e.delivery)}),/inconsistent nominal cursor contract/u);
	}
	for(const alter of [
		d=>{d.parameters[0].ownership="transfer";}
		, d=>{d.parameters[1].optional=true;}
		, d=>{d.result.ownership="copy";}
		, d=>{d.failure.errors=["error:WitCallbackError"];}
		, d=>{d.source.extensions["lean-bridge.dev/task-failure"]="EIO";}
	]){
		const api=structuredClone(b.api);alter(api.declarations.find(d=>d.source.declaration==="Jobs.relay"));
		assert.throws(()=>witObjectFutureFiles({...options,ir,model: b.model,api,entries: b.entries.filter(e=>e.delivery)}),/inconsistent callback Task/u);
	}
	for(const [edit,reason] of [
		[d=>{d.result.ownership="copy";},/inconsistent nominal Task/u]
		, [d=>{d.source.extensions["lean-bridge.dev/host-imports-sha256"]="0".repeat(64);},/source mismatch/u]
	]){
		const api=structuredClone(b.api);edit(api.declarations.find(d=>d.source.declaration==="Jobs.echo"));
		assert.throws(()=>witObjectFutureFiles({...options,ir,model: b.model,api,entries: b.entries.filter(e=>e.delivery)}),reason);
	}
	for(const mutate of [
		(api,d)=>{d.failure.errors=["error:IO.Error"];}
		, (api,d)=>{d.source.extensions["lean-bridge.dev/error-payload-site"].ownership="copy";}
		, (api,d)=>{api.errors.find(e=>e.id===d.failure.errors[0]).payload={kind: "primitive",name: "uint32"};}
		, (api,d)=>{d.source.extensions["lean-bridge.dev/task-failure"]="IO.Error";}
	]){
		const api=structuredClone(b.api);mutate(api,api.declarations.find(d=>d.name==="reject"));
		assert.throws(()=>witObjectFutureFiles({...options,ir,model: b.model,api,entries: b.entries.filter(e=>e.delivery)}),/inconsistent nominal Task contract/u);
	}
	const run=async(command,args,env=process.env)=>{
		try
		{ return await processBuildRunner.capture({command,args,cwd: app,env}); }
		catch(e)
		{throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e});}
	};
	const wasm=process.env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	const sdk=resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API??".toolchains/wasmtime42");
	const fixture=resolve("tests/fixtures/static-host-workers");
	const data=await readFile(join(fixture,"guest-box.wat.in"),"utf8");
	// The counter is a fixture-owned export, not part of the import contract.
	const diagnostic="world instrumented { export objects; export drops: func() -> u32; export arm-drop: func(); }";
	const peer="world peer { import objects; use objects.{box}; export relay-box: func(value: borrow<box>) -> own<box>; }";
	await writeFile(join(app,"objects.wit"),wit+"\n"+diagnostic+"\n"+peer+"\n");
	const abi=interfaceName.replace(/@1\.0\.0$/u,"@1");
	await writeFile(join(app,"guest.wat"),data.replaceAll("@IFACE@",abi));
	await run(wasm,["component","embed","objects.wit","--world","instrumented","guest.wat","-o","guest.core"]);
	await run(wasm,["component","new","guest.core","-o","guest.wasm"]);
	await run(wasm,["validate","guest.wasm"]);
	const result=await run(wasm,["component","wit","guest.wasm"]);
	assert.ok(result.stdout.includes(interfaceName));
	const peerModule=await readFile(join(fixture,"guest-peer.wat.in"),"utf8");
	await writeFile(join(app,"peer.wat"),peerModule.replaceAll("@IFACE@",abi));
	await run(wasm,["component","embed","objects.wit","--world","peer","peer.wat","-o","peer.core"]);
	await run(wasm,["component","new","peer.core","-o","peer.wasm"]);
	const ownerText=(await run(wasm,["print","guest.wasm"])).stdout;
	const peerText=(await run(wasm,["print","peer.wasm"])).stdout;
	const composed=[
		"(component"
		, ownerText.replace("(component","(component $owner")
		, peerText.replace("(component","(component $peer")
		, "(instance $o (instantiate $owner))"
		, `(alias export $o "${interfaceName}" (instance $objects))`
		, `(export "${interfaceName}" (instance $objects))`
		, '(alias export $objects "box" (type $box))'
		, `(instance $p (instantiate $peer (with "${interfaceName}" (instance $objects)) (with "box" (type $box))))`
		, '(export "relay-box" (func $p "relay-box"))'
		, '(export "drops" (func $o "drops"))'
		, '(export "arm-drop" (func $o "arm-drop"))'
		, ")"
	].join("\n");
	await writeFile(join(app,"composed.wat"),composed);
	await run(wasm,["parse","composed.wat","-o","composed.wasm"]);
	await run(wasm,["validate","composed.wasm"]);
	await buildWitApplicationConsumer({app,fixture,descriptor: b.witImports,wasm,run});
	const mismatches=[
		["signed","%get-level: func() -> result<u32","%get-level: func() -> result<s32"]
		, ["nominal","%identity: func() -> result<own<%box>","%identity: func() -> result<own<%member-error>"]
		, ["failure","%read: func() -> result<u32, own<%member-error>>","%read: func() -> result<u32, own<%box>>"]
	];
	for(const [name,expected,replacement] of mismatches)
	{
		assert.ok(wit.includes(expected));
		await writeFile(join(app,name+".wit"),wit.replace(expected,replacement));
		await run(wasm,["component","embed",name+".wit","--world","owner","--dummy","-o",name+".core"]);
		await run(wasm,["component","new",name+".core","-o",name+".wasm"]);
		await run(wasm,["validate",name+".wasm"]);
	}
	const probe=async(kit,exe,extra=[])=>{
		const flags=["-std=gnu11","-g0","-Wall","-Wextra","-Werror","-I.","-I"+join(kit,"include"),...extra];
		const libs=["-L.","-l:"+b.component,"-L"+join(kit,"lib"),"-lwasmtime","-Wl,-rpath-link,"+join(runtimeRoot,"lib"),"-Wl,-rpath-link,."];
		await run(process.env.CC??"cc",[...flags,join(fixture,"guest-box.c"),...libs,"-o",exe]);
		return run(join(app,exe),["composed.wasm",interfaceName,...mismatches.map(([name])=>name+".wasm")],{
			PATH: "/no-tools"
			, LD_LIBRARY_PATH: [app,join(kit,"lib"),join(runtimeRoot,"lib")].join(":")
			, LEAN_NUM_THREADS: "1"
			, RAYON_NUM_THREADS: "1"
		});
	};
	const executed=await probe(sdk,"guest-probe");
	assert.match(executed.stdout,/guest-owned object survived a compiled Lean worker/u);
	assert.match(executed.stdout,/independent Wasm consumer called Lean and ran original guest destructors/u);
	const asyncSdk=process.env.LEAN_BRIDGE_ASYNC_WASMTIME_C_API;
	assert.ok(asyncSdk,"Object futures require LEAN_BRIDGE_ASYNC_WASMTIME_C_API (Wasmtime 51 C SDK)");
	const asynchronous=await probe(resolve(asyncSdk),"guest-future-probe",["-DLB_TEST_OBJECT_FUTURE"]);
	assert.match(asynchronous.stdout,/compiled Lean canonical object future: both delivery orders, both reader drops, blocked writer shutdown/u);
	assert.match(asynchronous.stdout,/native object future shutdown before take/u);
	assert.match(asynchronous.stdout,/compiled relay retained a guest callback, reentered Lean, propagated its original exception and deferred self-disposal/u);
	assert.match(asynchronous.stdout,/guest distinguished immediate EIO errors from delivered Except values and released each selected branch/u);
	assert.match(asynchronous.stdout,/Wasm started compiled Lean relays: box, original callback exception, terminal IO text; delivered, discarded and cancelled/u);
	assert.match(asynchronous.stdout,/trapped Wasm callback poisoned its session; shutdown did not call guest destructors/u);
	assert.match(asynchronous.stdout,/Wasm pulled its original boxes, distinguished a typed final error from EOF, and closed parked or abandoned Lean cursors once/u);
};
