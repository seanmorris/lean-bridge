/** @file Link genuine downstream consumers to the generated turn-based callback ports. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {witTurnOwners} from "../../src/backends/wit/application-turn-owners.mjs";
import {canonicalSupervisor} from "../../src/backends/wit/canonical-supervisor.mjs";

/**
 * Build a private protocol probe and the independent public stream-to-future client.
 *
 * @param o - Existing worker paths, validated owner component and inspected cursor adapter.
 */
export const buildTurnCallbackGuests=async o=>{
	const {app,b,fixture,wasm,run,owner,update}=o;
	const callbacks=JSON.parse(await readFile(join(app,"object-callbacks.json"),"utf8"));
	const ops=JSON.parse(await readFile(join(app,"operations-layout.json"),"utf8"));
	const provider=(await run(wasm,["print","callback-fixture.wasm"])).stdout;
	const responder=await readFile(join(app,"call-box-to-box-turn-invoke.wat"),"utf8");
	const reg=(await readFile(join(fixture,"turn-callback-graph.wat.in"),"utf8"))
		.replace("@PROVIDER@",()=>provider.replace("(component","(component $provider"))
		.replace("@EXTENSION@",()=>witTurnOwners(b.witImports,callbacks).replace("(component","(component $extension"))
		.replace("@RESPONDER@",()=>responder.replace("(component","(component $responder"))
		.replaceAll("@OBJECTS@",b.witImports.interfaceName).replaceAll("@CALLBACKS@",callbacks.interfaceName).replaceAll("@API@",ops.publicName);
	const send='(import "turn" (func $turn (param "frame" u64) (param "owner" u64) (result (tuple u64 u64))))';
	const graphParts=["(component",send,owner.replace("(component","(component $owner"),"(instance $o (instantiate $owner))"];
	graphParts.push(`(alias export $o "${b.witImports.interfaceName}" (instance $obj))`,witTurnOwners(b.witImports,null).replace("(component","(component $base"));
	graphParts.push(`(instance $vault (instantiate $base (with "${b.witImports.interfaceName}" (instance $obj))))`,update,reg);
	const invokers=b.witImports.contract.methods.map((m,i)=>`(export "${m.name}" (func $mi "invoke-m${i}"))`);
	const callbackGraph=graphParts.join("\n").trimEnd().slice(0,-1)+'(instance $members '+invokers.join(" ")+') (export "members" (instance $members)))';
	await writeFile(join(app,"turn-callback.wat"),callbackGraph);
	await run(wasm,["parse","turn-callback.wat","-o","turn-callback.wasm"]);
	await run(wasm,["validate","--features","cm-async,cm-async-builtins","turn-callback.wasm"]);
	const {publicName: taskName,supported,remaining}=JSON.parse(await readFile(join(app,"object-delivery.json"),"utf8"));
	assert.deepEqual(remaining,[]);
	assert.deepEqual(supported.map(m=>m.name),["accept","completed","echo","finite","outcome","reject","relay","relay-late","series"]);
	const application=(await readFile(join(fixture,"installed-application.wat.in"),"utf8")).replace("(component","(component $app-code")
		.replaceAll("@OBJECTS@",b.witImports.interfaceName).replaceAll("@CALLBACKS@",callbacks.interfaceName).replaceAll("@TASKS@",taskName);
	const reader=(await readFile(join(fixture,"lean-relay-consumer.wat.in"),"utf8")).replace("(component","(component $reader-code");
	const readerGraph=(await readFile(join(fixture,"turn-callback-reader.wat.in"),"utf8")).replace("@READER@",()=>reader).replaceAll("@TASKS@",taskName);
	const assembly=(await readFile(join(app,"object-turn-tasks.wat"),"utf8")).replace("(component","(component $all-code");
	const channel=[],bindings=[];
	for(const {name,shape} of supported)
	{
		const input=shape==="stream"?'(param "value" u64)':'(param "left" u64) (param "right" u64)';
		channel.push(`(import "turn-${name}" (func $turn-${name} (param "op" u32) (param "key" u32) ${input} (result (tuple u32 u32 u64 u64))))`);
		bindings.push(`(with "turn-${name}" (func $turn-${name}))`);
	}
	const mixed=[callbackGraph.trimEnd().slice(0,-1).replace(send,()=>[send,...channel].join("\n")),assembly];
	mixed.push(`(instance $all (instantiate $all-code (with "${b.witImports.interfaceName}" (instance $obj)) (with "${callbacks.interfaceName}" (instance $cb))`);
	mixed.push(`(with "leases" (instance $ext)) ${bindings.join(" ")})) (alias export $all "${taskName}" (instance $jobs))`);
	for(const {name,shape} of supported)
	{
		const ports=shape==="stream"?["pump","retire","drain"]:["poll","deliver","reap","retire","close","drain"];
		for(const port of ports)mixed.push(`(export "${name}-${port}" (func $all "${name}-${port}"))`);
	}
	mixed.push(readerGraph,application);
	for(const [fixtureName,id,ports] of [["future","echo",["start","request","collect","receive","discard","release-original"]],["failure","case",["reject","start-case","receive-case","discard-case"]]])
	{
		const source=await readFile(join(fixture,`lean-${fixtureName}-consumer.wat.in`),"utf8");
		mixed.push(source.replace("(component","(component $"+id+"-client").replaceAll("@TASKS@",taskName));
		for(const tag of [id,id+"-other"])
		{
			mixed.push(`(instance $${tag} (instantiate $${id}-client (with "${taskName}" (instance $jobs)) (with "source" (func $src "run")) (with "same" (func $obj "same-box"))))`);
			for(const port of ports)mixed.push(`(export "${tag}-${port}" (func $${tag} "${port}"))`);
		}
	}
	mixed.push(`(instance $app (instantiate $app-code (with "${b.witImports.interfaceName}" (instance $obj)) (with "${callbacks.interfaceName}" (instance $cb)) (with "${taskName}" (instance $jobs))))`,canonicalSupervisor,")");
	await writeFile(join(app,"turn-application.wat"),mixed.join("\n"));
	await run(wasm,["parse","turn-application.wat","-o","turn-application.wasm"]);
	await run(wasm,["validate","--features","cm-async,cm-async-builtins","turn-application.wasm"]);
};
