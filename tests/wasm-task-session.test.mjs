/** @file Inject faults at the private Wasm boundary; real scheduler coverage lives in the installed-package test. */
import assert from "node:assert/strict";
import test from "node:test";
import {taskFrame as op} from "../src/abi/wasm-task-frame.mjs";
import {createWasmTaskNotifications} from "../src/runtime/wasm-task-notifications.mjs";
import {createWasmTaskSession} from "../src/runtime/wasm-task-bindings.mjs";

const method=(id,result,delivery=null,args=[]) => ({id,args,result,delivery,tagBytes: 1,startId: null,terminalId: null});
const harness=(methods,control) => {
	const notifications=createWasmTaskNotifications(), events=[], tokens=[], heap=new Uint8Array(4096), d=new DataView(heap.buffer);
	let top=16, failAt=0, allocations=0, stops=0;
	const allocate=n => {
		events.push("alloc"); if(++allocations===failAt) return 0;
		const p=top; top+=Math.ceil(n/8)*8; return p;
	};
	const module={HEAP8: heap,_malloc: allocate,_free: p => events.push("free:"+p)};
	const session=createWasmTaskSession({module,notifications,terminate: () => {stops++;}});
	const api=session.bind({methods},f => {
		const code=d.getUint32(f+12,true); events.push("call:"+code);
		if(code===op.listen) tokens.push(d.getUint32(f+16,true));
		return control({code,f,d,index: d.getUint32(f+8,true)});
	});
	return {api,session,events,tokens,notifications,failAllocationAt: n => {failAt=n;},stops: () => stops};
};

test("a malformed owned result retires the shared heap and all pending siblings without freeing through it",async () => {
	const h=harness([method("a","string","task"),method("b","uint32","task")],({code,f,d}) => {
		if(code===op.start)
{ d.setBigUint64(f+24,BigInt(f),true); d.setBigUint64(f+32,1n,true); }
		if(code===op.take)
{
			d.setBigUint64(f+24,0n,true);
			d.setBigUint64(f+40,BigInt(f),true); // A JS-owned frame cannot be returned as a guest allocation.
			d.setBigUint64(f+48,1n,true); d.setBigUint64(f+64,1n,true);
}
		return 0;
	});
	const a=h.api.invoke("a",[]), b=h.api.invoke("b",[]), rejected=Promise.allSettled([a,b]);
	h.notifications.notify(h.tokens[0]);
	const result=await rejected;
	assert.equal(result[0].status,"rejected"); assert.equal(result[1].reason,result[0].reason);
	assert.equal(h.notifications.notify(h.tokens[1]),false);
	assert.deepEqual(h.session.snapshot(),{state: "poisoned",frames: 0,allocations: 0,pending: 0});
	assert.equal(h.events.some(e => e.startsWith("free:") || e==="call:"+op.clear || e==="call:"+op.close),false);
	assert.throws(() => h.api.invoke("a",[]),e => e===result[0].reason);
	await assert.rejects(h.session.close(),e => e===result[0].reason); assert.equal(h.stops(),1);
});

test("a null input allocation frees the partially encoded frame and leaves unrelated calls usable",async () => {
	const h=harness([method("write","unit",null,["string"]),method("read","uint32")],({code,f,d}) => {
		if(code===op.start) d.setBigUint64(f+40,23n,true);
		if(code===op.clear) d.setBigUint64(f+40,0n,true);
		return 0;
	});
	h.failAllocationAt(2);
	assert.throws(() => h.api.invoke("write",["hello"]),/allocation failed/);
	assert.equal(h.events.filter(x => x.startsWith("free:")).length,1);
	assert.equal(h.events.some(x => x.startsWith("call:")),false);
	assert.equal(h.api.invoke("read",[]),23);
	assert.equal(h.session.snapshot().allocations,0);
	await h.session.close(); assert.equal(h.stops(),1);
});

test("an iterator return waiting for drain reports a trap instead of claiming successful cleanup",async () => {
	const trap=new WebAssembly.RuntimeError("failed drain");
	const h=harness([method("items","uint32","async-iterator")],({code,f,d}) => {
		if(code===op.start)
{ d.setBigUint64(f+24,7n,true); d.setBigUint64(f+32,9n,true); }
		if(code===op.take) throw trap;
		return 0;
	});
	const it=h.api.invoke("items",[]), pull=it.next(), done=it.return();
	const rejected=assert.rejects(pull,e => e.code==="operation-cancelled"), failed=assert.rejects(done,e => e===trap);
	h.notifications.notify(h.tokens[0]); await Promise.all([rejected,failed]);
	assert.equal(h.notifications.notify(h.tokens[0]),false);
	assert.equal(h.session.snapshot().state,"poisoned"); assert.equal(h.stops(),1);
});

test("closing with an empty JS registry still checks the native ownership broker",async () => {
	let stops=0, reads=0;
	const session=createWasmTaskSession({module: {},notifications: createWasmTaskNotifications(),terminate: () => {stops++;},nativeOwners: () => {reads++; return 1;}});
	const closing=session.close(); assert.equal(session.close(),closing);
	await assert.rejects(closing,/did not drain/u);
	assert.equal(session.snapshot().state,"poisoned"); assert.equal(reads,1); assert.equal(stops,1);
});
