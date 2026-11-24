/** @file Private SDK integration test; only the native fixture sees Lean object pointers. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {createWasmHostDomain} from "../../../src/runtime/wasm-host-domain.mjs";
import {createWasmTaskNotifications} from "../../../src/runtime/wasm-task-notifications.mjs";

const [kit,bin]=process.argv.slice(2);
const {default: create}=await import(pathToFileURL(join(kit,"task.mjs")));
const events=createWasmTaskNotifications();
const wasm=await create({wasmBinary: await readFile(join(kit,"task.wasm")),onLeanTaskReady: events.notify});
const domain=createWasmHostDomain(k=>assert.equal(wasm._lb_jst_retire_v1(k),1));
wasm.lbJshDomainV1=domain;
const frame=wasm._malloc(24);
assert.ok(frame);
new Uint8Array(wasm.HEAP8.buffer,frame,24).fill(0);
const control=(slot,op,k=0,t=0,entered=0,finished=0)=>{
	new Uint32Array(wasm.HEAP8.buffer,frame,5).set([op,k,t,entered,finished]);
	assert.equal(wasm._lb_js_task_call(slot,frame),1,"component "+slot+" control "+op);
};
const cstr=value=>{
	const bytes=new TextEncoder().encode(value+"\0"),p=wasm._malloc(bytes.length);
	assert.ok(p);wasm.HEAP8.set(bytes,p);return p;
};
/**
 * Link a separately compiled component into the owner heap.
 *
 * @param id - Test component suffix.
 */
const load=async id=>{
	const path="/host-"+id+".wasm",p=cstr(path),name=cstr("lb_jst_test_"+id);
	try
	{
		wasm.FS.writeFile(path,await readFile(join(bin,id+".wasm")));
		const slot=wasm._lb_js_task_load(p,name);assert.ok(slot,"load "+id);return slot;
	} finally
	{wasm._free(p);wasm._free(name);}
};
const notice=()=>{
	let subscription;
	const ready=new Promise(resolve=>{subscription=events.subscribe(resolve);});
	return {ready,token: subscription.token};
};
/**
 * Run one boundary call with an application object temporarily pinned.
 *
 * @param session - Active component binding.
 * @param i - Nominal kind index in the binding.
 * @param value - Application object.
 * @param action - Private test control to exercise.
 */
const pinned=(session,i,value,action)=>{
	session.enter();
	try
	{
		const token=session.pin(i,value);
		try
		{assert.equal(session.resolve(i,token),value);action(session.kind(i),token);}
		finally
		{session.release(token);}
	} finally
	{session.leave();}
};
/** Application object with weak-canonical ownership. */
class Box {}
/** Application object with strong-canonical ownership. */
class Token {}
const model={kinds: [{name: "Box",key: "a".repeat(64),policy: "weak-canonical"},{name: "Token",key: "b".repeat(64),policy: "strong-canonical"}]};
const bind=()=>domain.bind(model,{Box,Token});
try
{
	const a=await load("A"),b=await load("B");assert.notEqual(a,b);
	control(a,0);control(b,0);assert.equal(wasm._bridge_owned_runtime_components(),2);
	const left=bind(),right=bind();
	for(let round=0;round<=64;round++)
	{
		const retire=round===64;
		const box=new Box(),entered=notice(),finished=notice();
		let kind,token;
		pinned(left,0,box,(k,t)=>{kind=k;token=t;control(a,1,k,t,entered.token,finished.token);});
		await entered.ready; // Worker has inspected the wrapper. Only the owner may access JS.
		if(round%2===1 || retire) control(a,7); // Lean cancellation is cooperative: the worker still owns the value.
		pinned(right,0,box,(k,t)=>{assert.equal(k,kind);assert.equal(t,token);control(b,2,k,t);});
		assert.equal(domain.live(),1);
		if(retire)
		{
			for(let i=0;i<128;i++) pinned(right,0,new Box(),(k,t)=>control(b,3,k,t));
			assert.equal(domain.live(),1,"unused weak wrappers released");
			pinned(right,1,new Token(),(k,t)=>control(b,3,k,t));
			wasm._lb_jst_collect_v1();assert.equal(domain.live(),2,"admitted strong wrapper retained");
			left.close();assert.equal(domain.live(),2,"remaining binding keeps both kinds valid");
			right.close();assert.equal(domain.live(),0,"last binding invalidates the parked and strong wrappers");
			const fresh=bind();
			pinned(fresh,0,box,(k,t)=>{assert.notEqual(k,kind);assert.notEqual(t,token);control(b,3,k,t);});
			fresh.close();
		}
		control(a,4);
		await finished.ready;
		control(a,5,kind,retire ? 0 : token);
		assert.equal(domain.live(),0,"no remaining host ownership after the worker result is dropped");
	}
	control(a,6);control(b,6);
	assert.equal(wasm._bridge_owned_runtime_can_shutdown(),1);
	assert.equal(events.pending(),0);
	console.log("worker identity and retirement verified");
} finally
{wasm._free(frame);wasm.PThread.terminateAllThreads();}
