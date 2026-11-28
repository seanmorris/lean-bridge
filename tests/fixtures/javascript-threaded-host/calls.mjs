/** @file Exercise two installed components through their public package names only. */
import {withHosts, JavaScriptCallbackError, EIO_Workshop_checked, IOError, TaskIOError, AsyncStep_Workshop_openCursor} from "@lean-bridge/workshop-host-example";
import {withHosts as withPeer} from "@example/threaded-host-peer";
import {closeTaskRuntime, taskRuntimeStats, waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/** A meter owned by the application, not by the bridge. */
export class ExampleBox
{
	/**
	 * Create a meter.
	 *
	 * @param n - Initial reading.
	 */
	constructor(n){this.level=n;}
	/** Read the current meter value. */
	read(){return this.level;}
	/** Return the original application instance. */
	identity(){return this;}
}

/**
 * Exercise public values, failures and lifecycle on this heap.
 *
 * @param progress - Optional progress reporting from the browser's independent heap.
 */
export async function exercise(progress=()=>{})
{
	let checks=0;
	const check=(condition,label)=>{if(!condition) throw new Error(label);checks++;};
	const failure=async (fn,verify,label)=>{
		try
		{await fn();} catch(error)
		{check(verify(error),label+": incorrect failure");return;}
		throw new Error(label+": did not fail");
	};
	let onCreate;
	/** A constructor that can deliberately fail inside an IO factory. */
	class Box extends ExampleBox
	{
		/**
		 * Invoke the current fixture hook before creating the meter.
		 *
		 * @param n - Initial reading.
		 */
		constructor(n){onCreate?.();super(n);}
	}
	let w;
	try
	{
		const reentrant=Object.defineProperty({},"Box",{get: ()=>{w=withHosts({Box});return Box;}});
		await failure(()=>withHosts(reentrant),e=>/duplicate threaded host component/iu.test(e.message),"reentrant bind cannot replace its peer");
		await failure(()=>withPeer({Box: ExampleBox}),e=>/incompatible binding/u.test(e.message),"cross-package class conflict");
		const peer=withPeer({Box}),b=await w.start(7);
		check(b instanceof Box && b.level===7,"constructor on application owner");
		check(w.identity(b)===b && peer.identity(b)===b,"identity across components");
		check((await peer.either(b)).error===b,"returned Except is not a rejection");
		await failure(()=>w.checked(b),e=>e instanceof EIO_Workshop_checked && e.payload===b && e.phase==="factory","typed EIO lease");
		await failure(()=>w.identity({}),e=>e instanceof TypeError,"foreign class");
		const invalid=new Box(1);invalid.read=()=>"not a UInt32";
		await failure(()=>w.work(invalid,n=>n),e=>e instanceof TypeError && !("phase" in e),"invalid member result is a boundary error");
		check(await w.work(b,async n=>n+peer.identity(b).level)===14,"reentrant retained callback");
		const raw=Object.defineProperty({},"code",{get: ()=>{throw new Error("host error was inspected");}});
		onCreate=()=>{throw raw;};await failure(()=>w.start(1),e=>e===raw,"original host constructor failure");onCreate=undefined;
		b.identity=()=>{throw undefined;};
		await failure(()=>w.identity(b),e=>e===undefined,"sync thrown undefined");
		await failure(()=>w.open_cursor(b).next(),e=>e===undefined,"cursor thrown undefined");
		delete b.identity;
		const left=new Box(2),right=new Box(3),a=new Error("same"),z=new Error("same");
		left.read=()=>{throw a;};right.read=()=>{throw z;};
		const p=w.work(left,n=>n).catch(e=>e),q=w.work(right,n=>n).catch(e=>e);
		check(await q===z && await p===a,"separate error tickets in reverse observation order");
		const cause={why: "retained callback rejected"};
		await failure(()=>w.work(b,async()=>{throw cause;}),e=>e instanceof JavaScriptCallbackError && e.cause===cause && e.phase==="task","callback category");
		await failure(()=>w.start(99),e=>e instanceof IOError && e.phase==="factory" && e.message.includes("factory rejected 99"),"Lean factory IO.Error");
		await failure(()=>w.work(new Box(99),n=>n),e=>e instanceof TaskIOError && e.phase==="task" && e.message.includes("worker rejected 99"),"Lean task IO.Error");
		await failure(()=>w.open_cursor(new Box(99)).next(),e=>e instanceof AsyncStep_Workshop_openCursor && e.phase==="step" && e.message.includes("cursor rejected 99"),"Lean cursor IO.Error");
		const it=w.open_cursor(b);
		check((await it.next()).value===b,"cursor round trip");
		check((await it.next()).done && b.level===0,"exhaustion runs Lean close");
		b.level=6;const early=w.open_cursor(b);
		check((await early.return()).done && b.level===0,"early return runs Lean close");
		progress("draining an unfinished callback and its binding");
		const ready=Promise.withResolvers(),release=Promise.withResolvers();
		const stopped=w.work(b,()=>{ready.resolve();return release.promise;});
		const rejected=failure(()=>stopped,e=>e.code==="operation-cancelled","explicit task cancellation");
		await ready.promise;check(stopped.cancel() && !stopped.cancel(),"cancel wins only once");await rejected;release.resolve(77);
		const entered=Promise.withResolvers(),late=Promise.withResolvers();
		const task=w.work(b,()=>{entered.resolve();return late.promise;});
		const cancelled=failure(()=>task,e=>e.code==="operation-cancelled","binding cancellation");await entered.promise;
		const closing=w.dispose();check(closing===w.dispose(),"dispose is idempotent");
		await failure(()=>w.identity(b),e=>/closed/u.test(e.message),"closed scope rejects admission");
		await cancelled;await closing;late.reject(raw);
		check(peer.identity(b)===b,"peer binding survived drain");
		const again=withHosts({Box});check(again.identity(b)===b,"same component can rebind");await again.dispose();await peer.dispose();
		await waitTaskRuntimeIdle();
		const stats=taskRuntimeStats();
		for(const key of ["frames","allocations","pending","nativeOwners","notifications","hostPins","hostErrors"]) check(stats[key]===0,"leaked "+key+": "+stats[key]);
		const retiring=withHosts({Box}),waiting=Promise.withResolvers(),reply=Promise.withResolvers();
		const last=retiring.work(b,()=>{waiting.resolve();return reply.promise;});
		const shutdown=failure(()=>last,e=>e.code==="operation-cancelled","runtime shutdown cancels its active scope");
		await waiting.promise;await closeTaskRuntime();await shutdown;reply.reject(raw);
		const after=taskRuntimeStats();check(after.state==="closed" && after.nativeOwners===0 && after.hostErrors===0 && after.hostPins===0,"heap shut down cleanly");
		return {checks};
	} finally
	{await closeTaskRuntime();}
}
