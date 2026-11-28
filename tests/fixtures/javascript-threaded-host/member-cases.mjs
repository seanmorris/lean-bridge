/** @file Exercise generated host-member shims on actual Lean pthreads. */
import {installWasmTaskHostMembers} from "../../../src/runtime/wasm-task-host-members.mjs";
import {createWasmTaskNotifications} from "../../../src/runtime/wasm-task-notifications.mjs";
import {componentScalarTypes} from "../../../src/abi/component-scalars.mjs";

/**
 * Run the same assertions on whichever JavaScript agent owns the module.
 *
 * @param inputs - SDK module factory, verified main binary, two separately compiled DSOs and their model.
 * @param inputs.create - Pthread module factory.
 * @param inputs.main - Main Wasm binary.
 * @param inputs.components - Independently compiled side modules.
 * @param inputs.model - Member table generated from the host contract.
 */
export const exerciseThreadedMembers=async ({create,main,components,model})=>{
	let checks=0;
	const eq=(a,b,why)=>{if(!Object.is(a,b)) throw new Error(why+": "+String(a)+" !== "+String(b));checks++;};
	const events=createWasmTaskNotifications();
	const wasm=await create({wasmBinary: main,onLeanTaskReady: events.notify});
	const internal=new Error("injected owner bridge fault");
	let inject=false,ack;
	const fault=new Promise(resolve=>{ack=resolve;});
	const host=installWasmTaskHostMembers(wasm,{assertOpen: ()=>{if(inject) throw internal;},poison: ack});
	const cstr=value=>{
		const bytes=new TextEncoder().encode(value+"\0"),p=wasm._malloc(bytes.length);
		if(!p) throw new Error("out of memory");wasm.HEAP8.set(bytes,p);return p;
	};
	const control=(slot,op,index=0,k=0,t=0,mode=0,notice=0)=>{
		const p=wasm._malloc(32);if(!p) throw new Error("out of memory");
		try
		{
			const words=()=>new Uint32Array(wasm.HEAP8.buffer,p,8);
			words().set([op,index,k,t,mode,notice,0,0]);
			eq(wasm._lb_js_task_call(slot,p),1,"control "+op);
			return {tag: words()[6],out: words()[7]};
		} finally
		{wasm._free(p);}
	};
	const install=(id,bytes)=>{
		const path="/member-"+id+".wasm",p=cstr(path),n=cstr("lb_jst_test_"+id);
		try
		{
			wasm.FS.writeFile(path,bytes);
			const slot=wasm._lb_js_task_load(p,n);if(!slot) throw new Error("cannot load "+id);
			control(slot,0);return slot;
		} finally
		{wasm.FS.unlink(path);wasm._free(p);wasm._free(n);}
	};
	/** The application class exists only on the owner JavaScript agent. */
	class Box
	{
		/**
		 * Record the starting reading.
		 *
		 * @param level - Initial application value.
		 */
		constructor(level){this.level=level;}
		/** Delegate to the currently selected application behavior. */
		read(){return this.behavior?this.behavior():this.level;}
		/** Return the same application object. */
		identity(){return this;}
		/** Return a fresh object anchored to the receiver. */
		child(){return new Box(this.level+1);}
		/**
		 * Return a fresh object anchored to the declared peer.
		 *
		 * @param peer - Explicit anchor.
		 */
		childOf(peer){return new Box(peer.level+1);}
		/** Accept a transferred receiver. */
		consume(){return this.level;}
	}
	const seen=new Set();
	for(const k of componentScalarTypes) Box.prototype["echo_"+k]=v=>{
		seen.add(k);
		if(k==="unit") return undefined;
		if(k==="bool") return !v;
		if(k==="char") return v==="🐝"?"🦋":v;
		if(k==="string") return v+"!";
		if(k==="bytes")
		{v[0]=42;return v;}
		if(k==="nat") return v+7n;
		if(k==="int") return v-7n;
		if(k.startsWith("float")) return -v;
		const one=typeof v==="bigint"?1n:1;
		return k.startsWith("u")?v-one:v+one;
	};
	const pinned=(binding,box,fn)=>{
		binding.enter();try
		{
			const t=binding.pin(0,box);
			try
			{return fn(binding.kind(0),t);} finally
			{binding.release(t);}
		} finally
		{binding.leave();}
	};
	const start=(binding,slot,index,box,mode=0)=>{
		let subscription;
		const ready=new Promise(resolve=>{subscription=events.subscribe(resolve);});
		pinned(binding,box,(k,t)=>control(slot,1,index,k,t,mode,subscription.token));
		return {ready,result: ()=>control(slot,2,index),peek: ()=>control(slot,5,index),detach: subscription.detach};
	};
	try
	{
		const c=install("C",components[0]),d=install("D",components[1]);
		const left=host.bind("c".repeat(64),model,{Box}),right=host.bind("d".repeat(64),model,{Box});
		const x=new Box(10),y=new Box(19);
		const read=async (box,mode=0)=>{
			const task=start(left,c,0,box,mode);await task.ready;return task.result();
		};
		const plain=await read(x,3);eq(plain.tag,0,"plain success");eq(plain.out,21,"constructor, identity, get, set and read");
		eq(x.level,21,"JS alias is original object");eq(host.live(),0,"released host object aliases");
		const rich=await read(x,4);
		if(rich.tag)
		{
			const cause=rich.out?host.takeError(rich.out).error:"Lean oracle rejected a converted value";
			throw new Error("Threaded scalar failure after "+[...seen].join(",")+": "+String(cause));
		}
		eq(rich.out,42,"generated Lean scalar oracle");
		eq(seen.size,componentScalarTypes.length,"every copied carrier crossed the worker boundary");eq(host.live(),0,"released child and receiver anchors");
		x.behavior=()=>pinned(right,y,(k,t)=>control(d,3,0,k,t).out)+1;
		eq((await read(x)).out,20,"member can synchronously reenter another bound component on the owner");
		const first=new Error("same"),second=new Error("same");x.behavior=()=>{throw first;};y.behavior=()=>{throw second;};
		const a=start(left,c,0,x),b=start(right,d,0,y);
		await Promise.all([a.ready,b.ready]);
		eq(host.heldErrors(),2,"overlapping exceptions held independently");
		eq(host.takeError(a.peek().out).error,first,"a second observer can see the same genuine Lean error");
		eq(host.heldErrors(),2,"lifting one observer does not steal another observer's exception");
		for(const [task,expected] of [[b,second],[a,first]])
		{
			const r=task.result();eq(r.tag,1,"failure");
			const f=host.takeError(r.out);eq(f.application,true,"application throw");eq(f.error,expected,"original JS identity in reverse collection order");
		}
		eq(host.heldErrors(),0,"released both exceptions");
		eq((await read(x,1)).out,73,"caught Lean error");eq(host.heldErrors(),0,"caught error released");
		const forged=await read(x,2);eq(forged.tag,1,"replacement error escapes");eq(forged.out,0,"matching text cannot forge a JS exception");eq(host.heldErrors(),0,"replaced error released");
		x.behavior=()=>{throw undefined;};
		const u=host.takeError((await read(x)).out);eq(u.application,true,"undefined throw classified");eq(u.error,undefined,"undefined preserved");
		x.behavior=()=>-1;
		const boundary=host.takeError((await read(x)).out);eq(boundary.application,false,"bad UInt32 is a boundary error");
		x.behavior=()=>{throw boundary.error;};
		const thrown=host.takeError((await read(x)).out);eq(thrown.application,true,"rethrow as application failure");eq(thrown.error,boundary.error,"preserve rethrown object");
		let invoked=0;x.behavior=()=>++invoked;
		const late=start(left,c,0,x);left.close();await late.ready;
		const stale=late.result();
		eq(stale.tag,1,"closed binding fails pending member call");eq(host.takeError(stale.out).application,false,"closed binding is a boundary failure");eq(invoked,0,"closed binding never entered application");
		right.close();control(c,4);control(d,4);
		eq(host.live(),0,"released host objects");eq(host.heldErrors(),0,"released errors");eq(events.pending(),0,"drained notifications");
		eq(wasm._bridge_owned_runtime_can_shutdown(),1,"drained runtime");
		// End on a fresh binding with an injected infrastructure exception.
		// Unlike an application throw, it must unblock the proxy and poison
		// this heap instead of delivering a synthetic Lean result.
		control(c,0);
		const last=host.bind("c".repeat(64),model,{Box});
		const crashed=new Promise(resolve=>{
			for(const w of [...wasm.PThread.unusedWorkers,...Object.values(wasm.PThread.pthreads)])
				w.onerror=event=>{event?.preventDefault?.();resolve(true);};
		});
		inject=true;const dying=start(last,c,0,x);
		try
		{
			const [cause,didCrash]=await Promise.all([fault,crashed]);
			eq(cause,internal,"exact infrastructure fault reaches the owner");eq(didCrash,true,"requesting worker woke and failed");
		} finally
		{dying.detach();}
		let refused=false;try
		{host.bind("d".repeat(64),model,{Box});} catch
		{refused=true;}
		eq(refused,true,"cannot rebind a poisoned heap");eq(host.live(),0,"no stranded JS pins");eq(host.heldErrors(),0,"no stranded tickets");
		return checks;
	} finally
	{wasm.PThread.terminateAllThreads();}
};
