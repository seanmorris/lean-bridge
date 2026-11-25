/** @file Exercise the owner-thread scheduling boundary from an async Wasm guest. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {witTurnOwners} from "../../src/backends/wit/application-turn-owners.mjs";
import {canonicalSupervisor} from "../../src/backends/wit/canonical-supervisor.mjs";
import {buildTurnCallbackGuests} from "./wit-application-turn-callbacks.mjs";

/**
 * Use the real source-compiled Workshop.update and the separately compiled
 * owner with its own destructor counter. Both are built by the worker test.
 *
 * @param o - Checked paths, native artifact and runner for this fixture.
 */
export const exerciseWitApplicationTurn=async o=>{
	const {app,b,fixture,kit,wasm,runtimeRoot,run}=o;
	const owner=(await run(wasm,["print","guest.wasm"])).stdout;
	const template=await readFile(join(fixture,"guest-turn.wat.in"),"utf8");
	const members=await readFile(join(app,"turn-members.wat"),"utf8");
	const method=name=>"invoke-m"+b.witImports.contract.methods.findIndex(m=>m.name===name);
	const update=(await readFile(join(fixture,"turn-update-driver.wat.in"),"utf8")).replace("@MEMBERS@",()=>members.replace("(component","(component $member-code"))
		.replaceAll("@OBJECTS@",b.witImports.interfaceName).replace("@SET@",method("set-level")).replace("@GET@",method("get-level"));
	const audit=await readFile(join(fixture,"guest-lease-audit.wat.in"),"utf8");
	const graph=template.replace("@OWNER@",()=>owner.replace("(component","(component $owner"))
		.replace("@TABLE@",()=>witTurnOwners(b.witImports,null).replace("(component","(component $table"))
		.replace("@AUDIT@",()=>audit)
		.replace("@UPDATE@",()=>update)
		.replaceAll("@OBJECTS@",b.witImports.interfaceName);
	assert.ok(graph.includes(";; @inject-guest-trap@"));
	for(const [id,code] of [["guest-turn",graph],["guest-turn-trap",graph.replace(";; @inject-guest-trap@","unreachable")]])
	{
		await writeFile(join(app,id+".wat"),code);await run(wasm,["parse",id+".wat","-o",id+".wasm"]);
		await run(wasm,["validate","--features","cm-async,cm-async-builtins",id+".wasm"]);
	}
	const names=["series","finite"],client=await readFile(join(fixture,"turn-cursor-client.wat.in"),"utf8");
	const programs=await Promise.all(names.map(n=>readFile(join(app,n+"-turn-cursor.wat"),"utf8")));
	const cursor=["(component"];
	for(const n of names)cursor.push(`(import "turn-${n}" (func $${n} (param "op" u32) (param "key" u32) (param "value" u64) (result (tuple u32 u32 u64 u64))))`);
	cursor.push(owner.replace("(component","(component $owner"),"(instance $o (instantiate $owner))");
	cursor.push(`(alias export $o "${b.witImports.interfaceName}" (instance $obj)) (alias export $obj "box" (type $r0))`);
	cursor.push(witTurnOwners(b.witImports,null).replace("(component","(component $table"));
	cursor.push(`(instance $v (instantiate $table (with "${b.witImports.interfaceName}" (instance $obj))))`);
	cursor.push('(export "bind-owners" (func $v "bind")) (export "close-owners" (func $v "close")) (export "live-owners" (func $v "count"))');
	for(const [i,n] of names.entries())
	{
		cursor.push(programs[i].replace("(component","(component $code"+i));
		cursor.push(`(instance $s${i} (instantiate $code${i} (with "r0" (type $r0)) (with "leases" (instance $v)) (with "turn" (func $${n}))))`);
		cursor.push(`(export "${n}-pump" (func $s${i} "pump")) (export "${n}-retire" (func $s${i} "retire"))`);
		cursor.push(`(export "${n}-drain" (func $s${i} "drain"))`);
	}
	const start='(instance $app (instantiate $client (with "objects" (instance $obj)) (with "series" (func $s0 "start")) (with "finite" (func $s1 "start"))))';
	const cancelled=client.replace(";; @cancel-parked@",`(if (i32.eqz (local.get $phase)) (then
        (call $eq (call $cancel-f (global.get $f)) (i32.const 2)) (call $end-f (global.get $f))))`)
		.replace(";; @finish-cancel@",`(if (i32.eq (local.get $phase) (i32.const 3)) (then
        (call $drop (global.get $a)) (call $drop (global.get $b)) (call $del (global.get $set))
        (call $ret (i64.const 73)) (return (i32.const 0))))`);
	for(const [id,guest] of [["guest-turn-cursors",client],["guest-turn-cancel",cancelled]])
	{
		await writeFile(join(app,id+".wat"),[...cursor,guest,start,canonicalSupervisor,")"].join("\n"));
		await run(wasm,["parse",id+".wat","-o",id+".wasm"]);
		await run(wasm,["validate","--features","cm-async,cm-async-builtins",id+".wasm"]);
	}
	await buildTurnCallbackGuests({...o,owner,update});
	const flags=["-std=gnu11","-O1","-g0","-Wall","-Wextra","-Werror","-pthread","-I."];
	const includes=["-I"+resolve("src/backends/wit"),"-I"+join(kit,"include")];
	const libs=["-L.","-l:"+b.component,"-L"+join(kit,"lib"),"-lwasmtime"];
	const paths=["-Wl,-rpath-link,"+join(runtimeRoot,"lib"),"-Wl,-rpath-link,."];
	await run(process.env.CC??"cc",[...flags,...includes,join(fixture,"guest-turn.c"),...libs,...paths,"-o","guest-turn"]);
	const env={PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LD_LIBRARY_PATH: [app,join(kit,"lib"),join(runtimeRoot,"lib")].join(":")};
	const guests=["guest-turn.wasm","guest-turn-trap.wasm","guest-turn-cursors.wasm","guest-turn-cancel.wasm","turn-callback.wasm","turn-application.wasm"];
	const r=await run(join(app,"guest-turn"),guests,env);
	assert.match(r.stdout,/async guest: original box 42 -> 73; original getter error; two Lean frames disposed/u);
	assert.match(r.stdout,/trapped async guest: parked Lean call unwound once on its owner before store destruction/u);
	assert.match(r.stdout,/canonical guest-owned cursors: four open, six pulls, one abandoned before demand, four closed/u);
	assert.match(r.stdout,/parked read cancelled before Lean resolved; no late item or second close/u);
	assert.match(r.stdout,/reentrant cursor open during owner comparison: three independent cursors, three releases/u);
	assert.match(r.stdout,/retained native tasks: reentrant original object, owned callback exception, caught exception then independent IO error, cancelled pending callback/u);
	assert.match(r.stdout,/unchanged downstream application: series to retained relay to nested Lean update to canonical future: 73/u);
	assert.match(r.stdout,/canonical object tasks: 65 immediate factory rejections, returned errors, both u32 bounds, independent readers and early drops/u);
	assert.match(r.stdout,/eleven generated defining-member adapters: identity, transfers, mutation, copied buffers, wide limbs and original exceptions/u);
	assert.match(r.stdout,/canonical callback futures: sixteen scheduling\/error combinations and native teardown on a guest trap/u);
};
