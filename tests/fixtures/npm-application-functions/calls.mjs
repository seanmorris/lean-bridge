/** @file Forward an application function while its registration is still live. */
import {observeTariff} from "./observer.mjs";
const {api,live}=await observeTariff(()=>import("@example/tariff-quotes"));
const check=(ok,message)=>{if(!ok) throw new Error(message);};
const expired=fn=>{
	try
	{fn(90);} catch(e)
	{if(e.status===10)return;throw e;}
	throw new Error("A caller-owned registration outlived its scope");
};
/**
 * Follow a stateful host callback, not a price function created in Lean.
 *
 * @param alternate - Select a second input for the React/worker clients.
 */
export function exercise(alternate)
{
	const base=alternate?70:40,values=[],owners=new Set(),original=new Error("price source failed");
	const baseline=live();let errorPreserved=false,staleCalls=0,value;
	const host=n=>{values.push(n);return base+n;};
	try
	{
		const fresh=api.passApplicationQuote(n=>{staleCalls++;return n;});
		owners.add(fresh);expired(fresh);
		const fallback=api.makeTariff(800).quote;owners.add(fallback);
		let immediate,held,borrow;
		value=api.visitApplicationQuote(host,(q,n)=>{
			borrow=q;held=q.retain();owners.add(held);
			check(q(0)===base,"visitor did not receive the application's function");
			immediate=api.passApplicationQuote(q);owners.add(immediate);
			check(immediate(1)===base+1,"export result lost the active application function");
			// Lean calls the function supplied as the callback reply. The fallback
			// has a different result and must not be mistaken for that reply.
			return api.stagedQuote(api.withRecovery(()=>immediate,fallback),99,n);
		},2);
		check(value===base+2 && values.join(",")==="0,1,2","wrong registration, order or callback reply");
		check(borrow.disposed,"original callback view survived the visit");
		expired(immediate);expired(held);
		check(values.length===3 && staleCalls===0,"a stale callable reentered application code");
		try
		{
			api.visitApplicationQuote(()=>{throw original;},(q,n)=>{
				const forward=api.passApplicationQuote(q);
				try
				{return forward(n);} finally
				{forward.dispose();}
			},2);
		}
		catch(e)
		{if(e!==original)throw e;errorPreserved=true;}
		check(errorPreserved,"original application error was lost");
	} finally
	{for(const fn of owners) fn.dispose();}
	const after=live();check(after===baseline,"native owners did not drain");
	return {value,calls: values.length,errorPreserved,staleCalls,after};
}
