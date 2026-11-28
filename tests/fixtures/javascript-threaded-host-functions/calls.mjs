/** @file Downstream worker functions retain application objects but not closed bindings. */
import {withHosts,IOError,JavaScriptCallbackError} from "@lean-bridge/workshop-host-example";
import {withHosts as withPeer} from "@example/threaded-host-peer";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";
/** Application class shared by two independently built packages. */
export class ExampleBox
{
	/**
	 * Keep a reading on the application-owned instance.
	 *
	 * @param n - Initial reading.
	 */
	constructor(n){this.level=n;}
	/** Read this instance's own value. */
	read(){return this.level;}
	/** Preserve reference identity across packages. */
	identity(){return this;}
}
/** Check synchronous call, task delivery, and cancellation in this owner realm. */
export async function exercise()
{
	let checks=0;
	const check=(ok,label)=>{if(!ok)throw new Error(label);checks++;};
	const fails=async(f,verify,label)=>{try
	{await f();} catch(e)
	{check(verify(e),label);return;}throw new Error("Expected "+label);};
	const Box=ExampleBox,a=withHosts({Box}),b=withPeer({Box});
	try
	{
		const x=new Box(6),y=new Box(6),f=a.remember(x),g=b.remember(y),read=a.reader(x);
		check(f(y)===x && g(x)===y,"same value, distinct captures");
		check(await a.map_box(y,f)===x && await b.map_box(x,g)===y,"returned callables passed directly to retained ports");
		check(read(5)===11,"scalar application");
		const once=a.remember(x);let checked=false;
		const proxy=new Proxy(y,{getPrototypeOf: v=>{if(!checked)
		{ checked=true;once.dispose(); }return Reflect.getPrototypeOf(v);}});
		check(once(proxy)===x && checked && !once.dispose(),"reentrant class check kept the native lease until return");
		await fails(()=>read(0),e=>e instanceof IOError && e.message.includes("zero refused"),"inner Lean IO.Error");
		await fails(()=>f({}),e=>e instanceof TypeError,"wrong host class");
		const original=Object.freeze({toString: ()=>{throw new Error("inspected original");}});
		y.read=()=>{throw original;};
		await fails(()=>a.remember(y),e=>e===original,"original factory exception");
		await fails(()=>f(y),e=>e===original,"original inner exception");
		await fails(()=>a.map_box(y,f),e=>e instanceof JavaScriptCallbackError && e.cause===original,"original callback cause");
		const active=a.remember(x);
		y.read=()=>{check(read(2)===8 && active.dispose() && !active.dispose(),"reentry and self-disposal");return 6;};
		check(active(y)===x,"already active application finishes");
		await fails(()=>active(x),e=>/closed/i.test(e.message),"self-disposed function");
		y.read=()=>6;
		const waiting=Promise.withResolvers(),late=Promise.withResolvers(),ready=Promise.withResolvers(),resume=Promise.withResolvers();
		let delivered=0,inspected=0;
		const victim=b.map_box(y,()=>{waiting.resolve();return late.promise;});
		const survivor=a.map_box(y,async v=>{ready.resolve();await resume.promise;delivered++;return f(v);});
		const cancellation=fails(()=>victim,e=>e.code==="operation-cancelled","pending peer callback cancellation");
		await Promise.all([waiting.promise,ready.promise]);
		const shutdown=b.dispose();await fails(()=>g(y),e=>/closed/i.test(e.message),"closing peer revoked its functions");
		await cancellation;late.resolve(new Proxy(y,{getPrototypeOf: v=>{inspected++;return Reflect.getPrototypeOf(v);}}));
		resume.resolve();check(await survivor===x && delivered===1,"sibling callback completed once");
		await shutdown;await waitTaskRuntimeIdle();
		check(!inspected && f(y)===x,"late result was not adopted");
		check(f.dispose() && !f.dispose(),"dispose is deterministic");
		await a.dispose();await fails(()=>read(1),e=>/closed/i.test(e.message),"closed owner invalidates scalar function");
		const stats=taskRuntimeStats();
		for(const key of ["frames","allocations","pending","nativeOwners","notifications","hostPins","hostErrors"]) check(stats[key]===0,"leaked "+key);
	} finally
	{ await Promise.all([a.dispose(),b.dispose()]);await closeTaskRuntime(); }
	return {checks};
}
