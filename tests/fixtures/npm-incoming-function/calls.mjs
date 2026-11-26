/** @file A host callback borrows, retains and reenters a function supplied by Lean. */
import {observeTariff} from "./observer.mjs";
const {api,live}=await observeTariff(()=>import("owned-aggregates"));
const check=(value,why)=>{if(!value) throw new Error(why);};
/**
 * Invoke a borrowed closure before and after its registration ends, then check
 * that an explicitly retained owner stays usable across a thrown host error.
 *
 * @param alternate - Use the mounted React/worker input.
 * @param invoke - Optional strictly typed frontend to the installed declaration.
 */
export function exercise(alternate,invoke=api.withFunction)
{
	const n=alternate?71n:42n,baseline=live(),ticket=api.newTicket(n,"client");
	const input={primary: ticket,spare: {tag: "none"},peers: [ticket],history: [],payload: {count: n,bytes: new Uint8Array([3,5])}};
	const tickets=new Set([ticket]);let first,held,afterThrow,failedBorrow,visits=0;
	const inspect=row=>{
		check(api.serial(row.primary)===n && row.payload.count===n,"wrong bundle");
		tickets.add(row.primary);for(const v of row.peers) tickets.add(v);return row;
	};
	inspect(invoke(input,(fn,value)=>{
		visits++;first=fn;held=fn.retain();return inspect(fn(value));
	}));
	const reject=fn=>{
		check(fn.disposed,"borrow remained live");
		try
		{ fn(input); } catch(e)
		{check(/expired|disposed/iu.test(e.message),"unrelated failure");return;}
		throw new Error("expired borrow remained callable");
	};
	reject(first);inspect(held(input));
	const original=new Error("incoming closure failure");let recovered=false;
	try
	{invoke(input,(fn,value)=>{visits++;failedBorrow=fn;afterThrow=fn.retain();inspect(fn(value));throw original;});}
	catch(e)
	{check(e===original,"host exception lost identity");recovered=true;}
	check(recovered,"callback did not fail");reject(failedBorrow);inspect(afterThrow(input));
	const active=live();check(active>baseline,"broker did not retain owners");
	check(held.dispose() && afterThrow.dispose(),"retained closure did not release");
	for(const v of tickets) if(!v.disposed) v.dispose();
	const after=live();check(after===baseline,"ownership counter did not return to baseline");
	return {value: Number(n),visits,expired: 2,recovered,baseline,active,after};
}
