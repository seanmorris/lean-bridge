/** @file Inject faults at the private Wasm boundary; real scheduler coverage lives in the installed-package test. */
import assert from "node:assert/strict";
import test from "node:test";
import {taskFrame as op} from "../src/abi/wasm-task-frame.mjs";
import {createWasmTaskNotifications} from "../src/runtime/wasm-task-notifications.mjs";
import {createWasmTaskSession} from "../src/runtime/wasm-task-bindings.mjs";
import {observeTaskWorkerFailures} from "../src/runtime/wasm-task-loader.mjs";

const method=(id,result,delivery=null,args=[]) => ({id,args,result,delivery,tagBytes: 1,startId: null,terminalId: null});
const harness=(methods,control,leases=[],capacity) => {
	const notifications=createWasmTaskNotifications(capacity), events=[], tokens=[], heap=new Uint8Array(4096), d=new DataView(heap.buffer);
	let top=16, failAt=0, allocations=0, stops=0;
	const allocate=n => {
		events.push("alloc"); if(++allocations===failAt) return 0;
		const p=top; top+=Math.ceil(n/8)*8; return p;
	};
	const module={HEAP8: heap,_malloc: allocate,_free: p => events.push("free:"+p)};
	const session=createWasmTaskSession({module,notifications,terminate: () => {stops++;}});
	const api=session.bind({methods,leases},f => {
		const code=d.getUint32(f+12,true); events.push("call:"+code);
		if(code===op.listen) tokens.push(d.getUint32(f+16,true));
		return control({code,f,d,index: d.getUint32(f+8,true)});
	});
	return {api,session,events,tokens,notifications,failAllocationAt: n => {failAt=n;},stops: () => stops};
};

test("JS rejects its promise and PHP throws before returning an owner for the same failed Lean factory",async () => {
	const m={...method("factory","uint32","task"),startId: "error:EIO.factory",error: "uint32"};
	const h=harness([m],({code,d,f})=>{
		if(code===op.start)
{d.setBigUint64(f+op.out,413n,true);return 3;}
		if(code===op.clear) d.setBigUint64(f+op.out,0n,true);
		return 0;
	});
	const typed=new Error("factory"), calls=[];
	const translate=e=>{calls.push(e.details.payload);return typed;};
	const pending=h.api.invoke("factory",[],translate);
	assert.ok(pending instanceof Promise);await assert.rejects(pending,e=>e===typed);
	assert.throws(()=>h.api.invokeWithSynchronousStart("factory",[],translate),e=>e===typed);
	assert.deepEqual(calls,[413,413]);
	assert.deepEqual(h.session.snapshot(),{state: "open",frames: 0,allocations: 0,pending: 0});await h.session.close();
});

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

const retained={...method("relay","uint32","task",["callback"]),callbacks: [[0,"uint32","uint32"]]};
test("lost pthreads reject public work and terminate their heap, including workers added by Node",async () => {
	const warm={}, running={}, later={};
	const loadWasmModuleToWorker=worker => {
		worker.onerror=() => { throw new Error("Uncaught Emscripten event"); }; return "loaded";
	};
	const pool={unusedWorkers: [warm],pthreads: {1: running},loadWasmModuleToWorker};
	const h=harness([retained],({code,f,d}) => {
		if(code===op.start)
{ d.setBigUint64(f+24,7n,true); d.setBigUint64(f+32,1n,true); } return 0;
	});
	const failure=Promise.allSettled([h.api.invoke("relay",[() => 1]),h.api.invoke("relay",[() => 1])]);
	observeTaskWorkerFailures(pool,e => { try
{ h.session.retire(e); } catch { /* Public operations receive e. */ } });
	assert.equal(pool.loadWasmModuleToWorker(later),"loaded");
	assert.equal(typeof running.onerror,"function"); assert.equal(typeof warm.onerror,"function");
	const trap=new Error("test pthread stopped"); let handled=false;
	later.onerror({message: trap.message,error: trap,preventDefault: () => { handled=true; }});
	const [first,second]=await failure;
	assert.equal(handled,true); assert.equal(first.reason,second.reason); assert.equal(first.reason.cause,trap);
	assert.equal(h.notifications.pending(),0); assert.equal(h.stops(),1);
	assert.equal(h.events.some(x => x.startsWith("free:") || x==="call:"+op.close),false);
	await assert.rejects(h.session.close(),e => e===first.reason);
});
test("both callback subscriptions must fit before native admission",async () => {
	const h=harness([retained],() => { throw new Error("Must not reach native"); },[],1);
	assert.throws(() => h.api.invoke("relay",[() => 1]),/notification capacity/u);
	assert.equal(h.notifications.pending(),0);
	assert.deepEqual(h.session.snapshot(),{state: "open",allocations: 0,frames: 0,pending: 0});
	await h.session.close();
});

test("an exhausted callback failure ledger rejects and drains one task without poisoning siblings",async () => {
	let token=0;
	const h=harness([retained,method("read","uint32")],({code,index,f,d}) => {
		if(code===op.start && !index)
{ d.setBigUint64(f+24,2n,true); d.setBigUint64(f+32,1n,true); }
		if(code===op.start && index) d.setBigUint64(f+40,91n,true);
		if(code===op.arm) token=d.getUint32(f+16,true);
		if(code===op.fail) return 12;
		if(code===op.take) d.setBigUint64(f+24,0n,true);
		if(code===op.clear) d.setBigUint64(f+40,0n,true);
		return 0;
	});
	const task=h.api.invoke("relay",[() => { throw new Error("application"); }]);
	const caught=assert.rejects(task,/retention limit/u);
	assert.equal(h.notifications.notify(token),true); await caught;
	assert.equal(h.notifications.pending(),1); assert.equal(h.session.snapshot().frames,1);
	assert.equal(h.notifications.notify(token),false); assert.equal(h.notifications.notify(h.tokens[0]),true);
	assert.equal(h.api.invoke("read",[]),91);
	assert.deepEqual(h.session.snapshot(),{state: "open",allocations: 0,frames: 0,pending: 0});
	await h.session.close();
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

test("leases from separate heaps never authenticate each other, even when both native token words match",async () => {
	const type="lease:"+"a".repeat(64), contract=[{type,name: "Ticket",tag: 3}];
	const control=({code,f,d}) => {
		if(code===op.start)
		{d.setBigUint64(f+40,19n,true); d.setBigUint64(f+48,23n,true); d.setBigUint64(f+64,3n,true);}
		if(code===op.leaseSame) d.setBigUint64(f+40,1n,true);
		if(code===op.leaseClose)
		{d.setBigUint64(f+72,0n,true); d.setBigUint64(f+80,0n,true);}
		return 0;
	};
	const methods=[method("make",type),method("use","unit",null,[type])];
	const a=harness(methods,control,contract), b=harness(methods,control,contract);
	const first=a.api.invoke("make",[]), second=b.api.invoke("make",[]);
	const seen=b.events.length;
	assert.equal(first instanceof b.api.resourceClass(type),false); assert.equal(second instanceof b.api.resourceClass(type),true);
	assert.throws(() => b.api.invoke("use",[first]),TypeError); assert.throws(() => second.same(first),TypeError);
	assert.equal(b.events.length,seen);
	assert.throws(() => a.api.invoke("make",[]),/Malformed Lean resource lease/u);
	assert.equal(a.session.snapshot().state,"poisoned"); assert.equal(first.disposed,true);
	assert.ok(!a.events.includes("call:"+op.leaseClose)); assert.equal(first.dispose(),false);
	assert.equal(second.same(second),true); await b.session.close(); assert.equal(second.disposed,true);
	assert.equal(b.events.filter(x => x==="call:"+op.leaseClose).length,1);
});
