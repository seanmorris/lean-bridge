/** @file Count each Wasm registration owner during a real overlapping-future cancellation. */
import assert from "node:assert/strict";
import {cp,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {registrationGuest} from "./wit-registration-guest.mjs";

/**
 * The downstream guest owns its interface and adds a read-only observer. No
 * scheduler operation or native handle is exported by either Lean package.
 *
 * @param dir - Independent client's sources and previously checked provider.
 * @param run - Pinned wasm-tools command in the client's directory.
 * @param dual - Both releases provide retained callbacks through separate guest instances.
 * @param [functions] - Each registration owns a returned function until its last canonical drop.
 */
export const buildRegistrationCancellation=async(dir,run,dual=false,functions=false)=>{
	if(functions && !dual)throw new TypeError("The capture test needs independent registration owners");
	const world=join(dir,"registration-audit-world");
	await cp(join(dir,"combined-world"),world,{recursive: true});
	const file=join(world,"deps/workshop/callbacks.wit"),wit=await readFile(file,"utf8");
	assert.equal(wit.split("interface callbacks {").length,2);
	const audit=src=>{
		const observed=src.replace("interface callbacks {","interface callbacks {\n  audit: func(field: u32) -> u32;");
		return functions?observed.replace("resource %call-box-to-box {","resource %call-box-to-box { make-capturing: static func(mode: u32, box: borrow<%box>) -> own<%call-box-to-box>;"):observed;
	};
	await writeFile(file,audit(wit));
	if(dual)
	{
		const path=join(world,"deps/gauge/callbacks.wit"),guest=await readFile(path,"utf8");
		assert.equal(guest.split("resource %call-box-to-box {").length,2);
		await writeFile(path,audit(guest.replace("resource %call-box-to-box {","resource %call-box-to-box { make: static func(mode: u32) -> own<%call-box-to-box>;")));
	}
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
	const contract=await readFile(join(world,"deps/objects.wit"),"utf8"),[,name]=/^package ([^;]+)@1\.0\.0;/u.exec(contract);
	if(functions)
	{
		const template=await readFile("tests/fixtures/static-host-workers/registration-functions.wat.in","utf8");
		const [imports,code]=template.replaceAll("@HOST@",witCoreInterface(name+"/objects@1.0.0")).replaceAll("@CALLS@",api).split(";; @capture-code@");
		assert.ok(code);add("(memory (export",imports);add("(global $next",code);
		add("(global.set $drops","(call $release-last (call $slot (local.get 0)))");
		add(";; @test-callback-visit@","(call $invoke-held (call $slot (local.get $self)) (local.get $box))");
		add("(if (i32.ge_u (local.get $field)","(call $check-held (i32.const 128)) (call $check-held (i32.const 144))");
	}
	const owned=(source,pkg)=>source.replaceAll("@FACTORY@",witCoreInterface("lean-bridge:"+pkg+"/api@1.0.0"));
	await writeFile(join(dir,"registration-provider.wat"),owned(provider,"workshop"));
	await run("component","embed",world,"--world","registrations","registration-provider.wat","-o","registration-provider.core");
	await run("component","new","registration-provider.core","-o","registration-provider.wasm");
	await run("component","targets",world,"--world","registrations","registration-provider.wasm");
	if(dual)
	{
		const gauge=witCoreInterface("lean-bridge:gauge/callbacks@1.0.0");
		await writeFile(join(dir,"gauge-provider.wat"),owned(provider.replaceAll(api,gauge),"gauge"));
		await run("component","embed",world,"--world","gauge-registrations","gauge-provider.wat","-o","gauge-provider.core");
		await run("component","new","gauge-provider.core","-o","gauge-provider.wasm");
		await run("component","targets",world,"--world","gauge-registrations","gauge-provider.wasm");
	}
	const src=await readFile("tests/fixtures/static-host-workers/peer-registration-cancel.wat.in","utf8");
	const assignments=dual?[["workshop","gauge"],["gauge","workshop"]]:[["workshop","workshop"]];
	for(const owners of assignments)for(const same of dual?[0,1]:[0])for(const createOrder of same?[1]:[0,1])for(const readOrder of same?[0]:[0,1])
	{
		const file="cancel-registration-"+(dual?owners[1]+"-":"")+(same?"shared-":"")+createOrder+readOrder;
		const client=registrationGuest(src,name+"/objects@1.0.0",owners,functions);
		await writeFile(join(dir,file+".wat"),client.replaceAll("@SAME_BOX@",String(same)).replaceAll("@VICTIM_FIRST@",String(createOrder)).replaceAll("@READ_VICTIM_FIRST@",String(readOrder)));
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
