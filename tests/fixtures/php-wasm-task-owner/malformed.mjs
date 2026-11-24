/** @file Corrupt the private host reply after an installed Lean worker has requested a PHP callback. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {waitTaskRuntimeIdle,closeTaskRuntime,taskRuntimeStats} from "@lean-bridge/runtime";

const name=process.argv[2],entry=import.meta.resolve(name);
const {default: descriptor}=await import(name),host={shared: {}};
descriptor.getFiles(host);
const {leanBridge}=JSON.parse(await readFile(new URL("package.json",entry)));
const api=JSON.parse(await readFile(new URL("metadata/binding-ir.json",entry)));
const slot=api.declarations.findIndex(d=>d.source.declaration==="Relay.worker");assert.notEqual(slot,-1);
const start=host.shared["lb_task_"+leanBridge.componentIdentitySha256+"_"+slot];
assert.equal(typeof start,"function");
try
{
	for(const ok of [true,false])
	{
		const owner=start("AQAAAAAAAAA=",""),[tag,,ticket]=JSON.parse(await owner.result());
		assert.equal(tag,"call");assert.equal(owner.answer(ticket,ok,"!"),false);
		assert.equal(await owner.result(),'["fault"]');
		assert.equal(await owner.cleanup().result(),'["end"]');
		await waitTaskRuntimeIdle();
		const {state,frames,pending,allocations,notifications,nativeOwners}=taskRuntimeStats();
		assert.equal(state,"open");assert.deepEqual([frames,pending,allocations,notifications,nativeOwners],[0,0,0,0,0]);
	}
	const valid=start("AQAAAAAAAAA=",""),[,,ticket]=JSON.parse(await valid.result());
	assert.equal(valid.answer(ticket,true,"AgAAAAAAAAA="),true);
	assert.deepEqual(JSON.parse(await valid.result()),["value","","AgAAAAAAAAA="]);
	console.log("invalid return and exception packets drained; subsequent Lean worker delivered 2");
} finally
{ await closeTaskRuntime(); }
