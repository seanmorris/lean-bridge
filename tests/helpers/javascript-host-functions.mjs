/** @file Downstream checks shared by an installed Node client, Chromium and its worker. */
/**
 * Exercise the public API, using application-owned objects and independent
 * bindings. No native token or private dispatcher is available here.
 *
 * @param first - Installed or directly compiled owner component.
 * @param second - Independently bound sibling component.
 * @param Box - Both packages implement the same imported nominal class.
 */
export const exerciseHostFunctions=(first,second,Box)=>{
	const check=(v,message)=>{if(!v) throw new Error(message);};
	const failure=f=>{try
	{ f(); } catch(error)
	{ return {error}; }throw new Error("Expected a failure");};
	const a=first.withHosts({Box}),b=second.withHosts({Box}),one=new Box(7),two=new Box(7);
	try
	{
		const keep=a.remember(one),sibling=b.remember(two);
		check(typeof keep==="function" && keep(two)===one && sibling(one)===two,"equal-looking captures lost identity");
		const batch=Array.from({length: 19},(_,i)=>{const value=new Box(i);return [a.remember(value),value];});
		for(const [fn,value] of batch.reverse()) check(fn(two)===value && fn.dispose(),"growing the native function table lost a capture");
		check(!Reflect.ownKeys(keep).some(k=>typeof k==="symbol" || !["dispose","length","name"].includes(k)),"private ticket escaped");
		const once=a.remember(one);let checked=false;
		const proxy=new Proxy(two,{getPrototypeOf: target=>{if(!checked)
		{ checked=true;once.dispose(); }return Reflect.getPrototypeOf(target);}});
		check(once(proxy)===one && checked && failure(()=>once(two)).error instanceof TypeError,"argument validation prematurely dropped an active capture");
		check(failure(()=>keep({})).error instanceof TypeError && failure(()=>keep()).error instanceof TypeError,"invalid function input");
		const original=Object.freeze({toString: ()=>{throw new Error("exception was inspected");}});
		two.read=()=>{throw original;};
		check(failure(()=>keep(two)).error===original && failure(()=>a.remember(two)).error===original,"exception replacement");
		two.read=()=>{throw undefined;};
		check(failure(()=>keep(two)).error===undefined,"lost a falsy exception");
		two.read=()=>two.level;
		const read=a.reader(one),identity=a.identity_reader(one);
		check(read(5)===12 && failure(()=>read(-1)).error instanceof RangeError && identity(0)===one,"wrong scalar or nominal return");
		two.read=()=>{check(read(2)===9 && keep.dispose() && !keep.dispose(),"self-disposal or reentry");return 7;};
		check(keep(two)===one && failure(()=>keep(one)).error instanceof TypeError,"active invocation was not preserved");
		two.read=()=>two.level;
		const left=a.remember(one);
		check(a.dispose() && !a.dispose() && failure(()=>left(two)).error instanceof TypeError && failure(()=>identity(0)).error instanceof TypeError,"owner revocation");
		check(sibling(one)===two && sibling.dispose() && !sibling.dispose(),"sibling cleanup");
		return true;
	} finally
	{ a.dispose();b.dispose(); }
};
