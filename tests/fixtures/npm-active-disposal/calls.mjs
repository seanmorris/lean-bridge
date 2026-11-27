/** @file Release only the currently executing wrapper, including while a nested host function throws. */
import {observeTariff} from "./observer.mjs";
const {api,live}=await observeTariff(()=>import("@example/tariff-quotes"));
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const stale=fn=>{
	try
	{ fn(999); } catch(error)
	{ if(error.status===10)return;throw error; }
	throw new Error("revoked application registration dispatched");
};
/**
 * An inner callback revokes its own view and fails; the unrelated outer registration survives.
 *
 * @param alternate - Choose the React/worker inputs.
 */
export function exercise(alternate)
{
	const base=alternate?70:40,baseline=live(),original=new Error("inner price rejected"),trace=[],owners=[];
	const own=fn=>{owners.push(fn);return fn;};
	let active,alias,innerActive,innerAlias,innerBorrow,outerBorrow,value,fresh,sameError=false;
	try
	{
		const price=n=>{
			trace.push("outer:"+n);
			if(!active.disposed)active.dispose(); // invoked through this very handle
			return base+n;
		};
		value=api.visitApplicationQuote(price,(outer,n)=>{
			outerBorrow=outer;active=own(api.passApplicationQuote(outer));alias=own(active.retain());
			check(active(n)===base+n && active.disposed,"self-disposal interrupted its active call");
			try
			{
				api.visitApplicationQuote(m=>{
					trace.push("inner:"+m);innerActive.dispose();throw original;
				},(inner,m)=>{
					innerBorrow=inner;innerActive=own(api.passApplicationQuote(inner));innerAlias=own(innerActive.retain());
					return innerActive(m);
				},7);
			}
			catch(e)
			{if(e!==original)throw e;sameError=true;}
			check(sameError&&innerActive.disposed&&innerBorrow.disposed,"inner failure lost its error or left its borrow live");
			stale(innerAlias);
			const fallback=own(api.makeTariff(800).quote);
			// Lean must invoke the surviving outer registration, not the fallback.
			return api.stagedQuote(api.withRecovery(()=>alias,fallback),111,n+1);
		},2);
		check(outerBorrow.disposed && value===base+3,"outer borrow or reply lifetime is wrong");stale(alias);
		check(trace.join(",")==="outer:2,inner:7,outer:3","a stale call entered the application");
		fresh=own(api.makeTariff(900).quote)(3);check(fresh===903,"a recoverable callback failure poisoned the runtime");
	}
	finally
	{
		for(const owner of owners)owner.dispose();
		check(live()===baseline,"disposing during invocation leaked a native owner");
	}
	return {value,trace,sameError,fresh,after: live()};
}
