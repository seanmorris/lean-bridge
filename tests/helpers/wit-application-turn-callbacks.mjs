/** @file Link genuine downstream consumers to the generated turn-based callback ports. */
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
	const {app,b,fixture,wasm,run,owner,update,programs}=o;
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
	const callbackGraph=graphParts.join("\n");
	await writeFile(join(app,"turn-callback.wat"),callbackGraph);
	await run(wasm,["parse","turn-callback.wat","-o","turn-callback.wasm"]);
	await run(wasm,["validate","--features","cm-async,cm-async-builtins","turn-callback.wasm"]);
	const series=programs[0].replace("(component","(component $series");
	const labels=["relay","relay-late"],futures=await Promise.all(labels.map(async n=>
		(await readFile(join(app,n+"-turn-future.wat"),"utf8")).replace("(component","(component $code-"+n)));
	const taskName=JSON.parse(await readFile(join(app,"object-delivery.json"),"utf8")).publicName;
	const application=(await readFile(join(fixture,"installed-application.wat.in"),"utf8")).replace("(component","(component $app-code")
		.replaceAll("@OBJECTS@",b.witImports.interfaceName).replaceAll("@CALLBACKS@",callbacks.interfaceName).replaceAll("@TASKS@",taskName);
	const reader=(await readFile(join(fixture,"lean-relay-consumer.wat.in"),"utf8")).replace("(component","(component $reader-code");
	const readerGraph=(await readFile(join(fixture,"turn-callback-reader.wat.in"),"utf8")).replace("@READER@",()=>reader).replaceAll("@TASKS@",taskName);
	const channel=['(import "turn-series" (func $series-turn (param "op" u32) (param "key" u32) (param "value" u64) (result (tuple u32 u32 u64 u64))))'];
	for(const n of labels)channel.push(`(import "turn-${n}" (func $turn-${n} (param "op" u32) (param "key" u32) (param "left" u64) (param "right" u64) (result (tuple u32 u32 u64 u64))))`);
	const mixed=[callbackGraph.trimEnd().slice(0,-1).replace(send,()=>[send,...channel].join("\n"))];
	mixed.push(series,...futures,'(type $failure (variant (case "callback" (own $err)) (case "io" string)))');
	mixed.push('(instance $stream (instantiate $series (with "r0" (type $box)) (with "leases" (instance $ext)) (with "turn" (func $series-turn))))');
	for(const n of ["pump","drain","retire"])mixed.push(`(export "series-${n}" (func $stream "${n}"))`);
	for(const n of labels)
	{
		mixed.push(`(instance $${n} (instantiate $code-${n} (with "r0" (type $box)) (with "r1" (type $err)) (with "r2" (type $registration)) (with "failure" (type $failure))`);
		mixed.push(`(with "leases" (instance $ext)) (with "invoke" (func $i "invoke")) (with "turn" (func $turn-${n}))))`);
		for(const f of ["poll","deliver","reap","retire","close","drain"])mixed.push(`(export "${n}-${f}" (func $${n} "${f}"))`);
	}
	mixed.push('(instance $jobs (export "box" (type $box)) (export "member-error" (type $err)) (export "call-box-to-box" (type $registration))');
	mixed.push('(export "callback-failure" (type $failure)) (export "series" (func $stream "start")) (export "relay" (func $relay "start")) (export "relay-late" (func $relay-late "start")))');
	mixed.push(readerGraph,application);
	mixed.push(`(instance $app (instantiate $app-code (with "${b.witImports.interfaceName}" (instance $obj)) (with "${callbacks.interfaceName}" (instance $cb)) (with "${taskName}" (instance $jobs))))`,canonicalSupervisor,")");
	await writeFile(join(app,"turn-application.wat"),mixed.join("\n"));
	await run(wasm,["parse","turn-application.wat","-o","turn-application.wasm"]);
	await run(wasm,["validate","--features","cm-async,cm-async-builtins","turn-application.wasm"]);
};
