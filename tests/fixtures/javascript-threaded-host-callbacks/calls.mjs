/** @file Check application-owned values across a retained callback invocation and asynchronous reply. */
import {withHosts,JavaScriptCallbackError as CallbackError} from "@lean-bridge/workshop-host-example";
import {withHosts as withPeer} from "@example/threaded-host-peer";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/** The same nominal class is supplied to both packages in this realm. */
export class ExampleBox
{
	/**
	 * Construct an application-owned meter.
	 *
	 * @param n - Initial value.
	 */
	constructor(n){this.level=n;}
	/** Read the stored value. */
	read(){return this.level;}
	/** Return the underlying JavaScript object. */
	identity(){return this;}
}

/** Run the nominal port cases with the exact offline-installed npm component APIs. */
export async function exercise()
{
	let checks=0;
	const check=(v,label)=>{if(!v) throw new Error(label);checks++;};
	const failure=async (fn,verify,label)=>{try
	{await fn();}catch(error)
	{check(verify(error),label);return;}throw new Error(label+": unexpectedly succeeded");};
	const Box=ExampleBox;
	try
	{
		const unused=withHosts({Box});await unused.dispose();
		check(taskRuntimeStats().hostPins===0,"unused binding drains on a cold heap");
		const w=withHosts({Box}),peer=withPeer({Box});
		await checkObjectCallbacks({w,peer,Box,CallbackError,check,failure});
		await w.dispose();await peer.dispose();await waitTaskRuntimeIdle();
		const s=taskRuntimeStats();
		for(const key of ["frames","allocations","pending","nativeOwners","notifications","hostPins","hostErrors"]) check(s[key]===0,"leaked "+key);
	} catch(error)
	{
		try
		{await closeTaskRuntime();}
		catch(cleanup)
		{throw new AggregateError([error,cleanup],"callback exercise and cleanup failed after "+checks+" checks",{cause: cleanup});}
		throw error;
	}
	await closeTaskRuntime();return {checks};
}

/**
 * Use a distinct peer on the same heap while the first component waits on JS.
 *
 * @param options - The two installed bindings, application class and assertions.
 * @param options.w - Workshop binding under test.
 * @param options.peer - Independently built component in the same runtime.
 * @param options.Box - Class supplied to both components.
 * @param options.CallbackError - Generated exception for a failed callback.
 * @param options.check - Record a successful assertion.
 * @param options.failure - Check an expected synchronous or asynchronous failure.
 */
async function checkObjectCallbacks({w,peer,Box,CallbackError,check,failure})
{
	const input=new Box(13),replacement=new Box(31);
	let reads=0;
	const spoof=Object.defineProperty({},"code",{get: ()=>{reads++;return "declared-error";}});
	await failure(()=>w.identity(new Proxy(input,{getPrototypeOf: ()=>{throw spoof;}})),e=>e===spoof && !reads,"initial class validation preserves even a lookalike declared error");
	let visits=0;
	const translated=await w.map_box(input,async value=>{
		check(value===input && peer.identity(value)===input,"callback received the original application object");
		visits++;await Promise.resolve();return replacement;
	});
	check(visits===1 && translated===replacement,"worker captured the asynchronously returned replacement");
	check(await w.project_box(input,b=>b.level)===13,"host argument and scalar reply");
	check(await w.select_box(31,n=>n===31?replacement:input)===replacement,"scalar argument and host reply");
	const twice=await w.relay_box(input,value=>peer.identity(value),value=>{value.level++;return value;});
	check(twice===input && input.level===14,"two retained ports agree on application identity");
	await failure(()=>w.map_box(input,()=>({})),e=>e instanceof CallbackError && e.cause instanceof TypeError && e.phase==="task","wrong callback result class");
	const thrown={why: "callback failure"};
	await failure(()=>w.map_box(input,async()=>{throw thrown;}),e=>e instanceof CallbackError && e.cause===thrown,"original nominal callback rejection");
	const busy=Promise.withResolvers(),release=Promise.withResolvers();let inspected=0;
	const pending=w.map_box(input,()=>{busy.resolve();return release.promise;});
	const cancelled=failure(()=>pending,e=>e.code==="operation-cancelled","cancel pending nominal callback");
	await busy.promise;check(pending.cancel(),"pending callback accepted cancellation");await cancelled;
	release.resolve(new Proxy(input,{getPrototypeOf: t=>{inspected++;return Reflect.getPrototypeOf(t);}}));
	await Promise.resolve();await Promise.resolve();
	check(inspected===0,"late callback result was not converted or pinned");
	let task;
	const reply=new Proxy(replacement,{getPrototypeOf: t=>{task.cancel();return Reflect.getPrototypeOf(t);}});
	task=w.map_box(input,()=>reply);
	await failure(()=>task,e=>e.code==="operation-cancelled","cancellation during reply validation");
	let waiting,called=0;
	const arg=new Proxy(input,{getPrototypeOf: t=>{waiting?.cancel();return Reflect.getPrototypeOf(t);}});
	waiting=w.map_box(arg,value=>{called++;return value;});
	await failure(()=>waiting,e=>e.code==="operation-cancelled","cancellation during argument validation");
	check(called===0 && w.identity(input)===input,"cancelled callback did not execute; owner still usable");
	let queued,visited=0;
	const revoked=new Proxy(input,{getPrototypeOf: t=>{if(queued) throw thrown;return Reflect.getPrototypeOf(t);}});
	queued=w.map_box(revoked,v=>{visited++;return v;});
	await failure(()=>queued,e=>e===thrown,"argument validation preserves the application's own exception");
	check(visited===0 && w.identity(input)===input,"failed argument conversion did not poison the heap");
	let terminal,seen=0,cancelledAtDelivery;
	const result=new Proxy(replacement,{getPrototypeOf: t=>{
		if(++seen===2) cancelledAtDelivery=terminal.cancel();
		return Reflect.getPrototypeOf(t);
	}});
	terminal=w.map_box(input,()=>result);
	check(await terminal===result && seen===2 && cancelledAtDelivery===false,"taken result wins over reentrant cancellation");
}
