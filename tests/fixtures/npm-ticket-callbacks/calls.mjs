/** @file Use a Ticket inside a real callback and return another Ticket instead of its fallback. */
import {observeTariff} from "./observer.mjs";
const {api,live}=await observeTariff(()=>import("owned-aggregates"));
const check=(ok,reason)=>{if(!ok)throw new Error(reason);};
/**
 * Exercise the exported functions with application-owned data, then release all leases.
 *
 * @param alternate - Use distinct inputs in React and in the dedicated worker.
 * @param construct - Optional strictly typed frontend around the same installed function.
 * @param factory - Optional strictly typed frontend around the same installed function.
 */
export function exercise(alternate,construct=api.construct,factory=api.factory)
{
	const n=alternate?71n:42n,owners=new Set(),before=live();
	const own=v=>{owners.add(v);return v;};
	const ticket=own(api.newTicket(n,"input")),fallback=own(api.newTicket(800n,"fallback"));
	const bundle=t=>({primary: t,spare: {tag: "none"},peers: [],history: [],payload: {count: n,bytes: new Uint8Array()}});
	let seen=0,replies=0,failed=false;
	try
	{
		const row=construct(ticket,borrow=>{
			seen++;check(api.serial(borrow)===n && api.label(borrow)==="input","wrong Ticket in callback argument");
			return bundle(borrow);
		});
		own(row.primary);check(api.serial(row.primary)===n,"construct lost the callback's Ticket");
		const result=own(factory(api.withRecovery(()=>{
			replies++;return own(api.newTicket(n+1n,"reply"));
		},fallback)));
		check(api.serial(result)===n+1n && api.label(result)==="reply","factory substituted the recovery Ticket");
		const error=new Error("factory rejected");
		try
		{factory(api.withRecovery(()=>{throw error;},fallback));} catch(e)
		{check(e===error,"original callback exception replaced");failed=true;}
		check(failed && api.serial(fallback)===800n,"factory swallowed the exception or consumed its recovery");
	} finally
	{for(const owner of owners) if(!owner.disposed) owner.dispose();}
	check(live()===before,"callback resource owners did not drain");
	return {argument: Number(n),reply: Number(n+1n),seen,replies,failed,after: live()};
}
