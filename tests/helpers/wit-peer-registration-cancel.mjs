/** @file Count each Wasm registration owner during a real overlapping-future cancellation. */
import assert from "node:assert/strict";
import {cp,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";

/**
 * The downstream guest owns its interface and adds a read-only observer. No
 * scheduler operation or native handle is exported by either Lean package.
 *
 * @param dir - Independent client's sources and previously checked provider.
 * @param run - Pinned wasm-tools command in the client's directory.
 */
export const buildRegistrationCancellation=async(dir,run)=>{
	const world=join(dir,"registration-audit-world");
	await cp(join(dir,"combined-world"),world,{recursive: true});
	const file=join(world,"deps/workshop/callbacks.wit"),wit=await readFile(file,"utf8");
	assert.equal(wit.split("interface callbacks {").length,2);
	await writeFile(file,wit.replace("interface callbacks {","interface callbacks {\n  audit: func(field: u32) -> u32;"));
	const api=witCoreInterface("lean-bridge:workshop/callbacks@1.0.0");
	let provider=await readFile(join(dir,"peer-provider.wat"),"utf8");
	assert.equal(provider.split("(call $new ").length,3);
	provider=provider.replaceAll("(call $new ","(call $counted-new ");
	// In this consumer mode 2 marks the victim for counting, not for the
	// separate trap test. An erroneous visit must reach the final assertion.
	const trap="(if (i32.and (local.get $self) (i32.const 2)) (then unreachable))";
	assert.equal(provider.split(trap).length,2);provider=provider.replace(trap,"(nop)");
	const add=(marker,body)=>{
		assert.equal(provider.split(marker).length,2,marker);
		provider=provider.replace(marker,()=>body+"\n    "+marker);
	};
	// These 32 bytes are outside the existing provider's canonical scratch and
	// below its realloc arena. Each registration has a distinct mode/identity.
	add("(global $next",`(func $slot (param $rep i32) (result i32)
      (i32.add (i32.const 128) (i32.shl (i32.and (local.get $rep) (i32.const 2)) (i32.const 3))))
    (func $inc (param $p i32)
      (i32.store (local.get $p) (i32.add (i32.load (local.get $p)) (i32.const 1))))
    (func $counted-new (param $r i32) (result i32)
      (call $inc (call $slot (local.get $r))) (call $inc (i32.add (call $slot (local.get $r)) (i32.const 4)))
      (call $new (local.get $r)))
    (func $counted-drop (param $p i32)
      (if (i32.eqz (i32.load (local.get $p))) (then unreachable))
      (i32.store (local.get $p) (i32.sub (i32.load (local.get $p)) (i32.const 1)))
      (call $inc (i32.add (local.get $p) (i32.const 12))))
    (func (export "cm32p2|${api}|audit") (param $field i32) (result i32)
      (if (i32.ge_u (local.get $field) (i32.const 8)) (then unreachable))
      (i32.load (i32.add (i32.const 128) (i32.shl (local.get $field) (i32.const 2)))))`);
	add("(global.set $drops","(call $counted-drop (call $slot (local.get 0)))");
	add(";; @test-callback-visit@","(call $inc (i32.add (call $slot (local.get $self)) (i32.const 8)))");
	await writeFile(join(dir,"registration-provider.wat"),provider);
	await run("component","embed",world,"--world","registrations","registration-provider.wat","-o","registration-provider.core");
	await run("component","new","registration-provider.core","-o","registration-provider.wasm");
	await run("component","targets",world,"--world","registrations","registration-provider.wasm");
	const contract=await readFile(join(world,"deps/objects.wit"),"utf8"),[,name]=/^package ([^;]+)@1\.0\.0;/u.exec(contract);
	const src=await readFile("tests/fixtures/static-host-workers/peer-registration-cancel.wat.in","utf8");
	for(const i of [0,1])
	{
		const file="cancel-registration-"+i;
		await writeFile(join(dir,file+".wat"),src.replaceAll("@OBJECTS@",name+"/objects@1.0.0").replaceAll("@VICTIM_FIRST@",String(i)));
		await run("parse",file+".wat","-o",file+".wasm");
		await run("component","targets",world,"--world","instruments",file+".wasm");
	}
};

/**
 * Decode the defining guest's live, acquired, invoked and destroyed counters
 * for each original registration. A canceled read alone proves none of them.
 *
 * @param output - Numeric result of the installed launcher.
 */
export const checkRegistrationCounts=output=>{
	assert.match(output,/^\d+\n$/u);
	const report=BigInt(output);
	for(const [i,visits] of [[0,1],[1,0]])
	{
		const fields=Array.from({length: 4},(_,k)=>Number(report >> BigInt((i*4+k)*8) & 255n));
		const [live,created,invoked,destroyed]=fields,label=i?"canceled":"surviving";
		assert.ok(created>0,label+" registration was never produced");
		assert.deepEqual([live,invoked,destroyed],[0,visits,created],label+" registration: "+fields);
	}
};
