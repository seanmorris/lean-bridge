/** @file Present private worker leases as scope-owned JavaScript functions. */
const gc=typeof FinalizationRegistry==="function"?new FinalizationRegistry(clean=>{
	queueMicrotask(()=>{try
	{ clean(); } catch { /* Do not retry cleanup on a retired runtime. */ }});
}):null;
const stale=()=>new Error("Returned Lean worker function or its host binding is closed");
const release=(group,row)=>{
	const lease=row.lease;row.lease=null;
	try
	{ lease.dispose(); }
	finally
	{ group.collect?.(); }
};
const drop=(group,row)=>{
	if(row.closed) return false;
	row.closed=true;group.rows.delete(row);gc.unregister(row);
	if(!row.active) release(group,row);
	return true;
};
const dropCallback=(group,row)=>()=>drop(group,row);
const unbindCallback=dispose=>()=>{dispose().catch(()=>{});};
const wrap=(group,row,method)=>{
	const fn=(...values)=>{
		if(row.closed || !group.owner.deref() || !group.open()) throw stale();
		row.active++;let success=false;
		try
		{
			const result=group.apply(method,[row.lease,...values]);success=true;return result;
		} finally
		{
			row.active--;
			if(!row.active && row.closed)
			{
				if(success) release(group,row);
				else try
				{ release(group,row); } catch { /* Preserve the application's original failure. */ }
			}
		}
	};
	const clean=dropCallback(group,row);
	Object.defineProperty(fn,"dispose",{value: clean});Object.freeze(fn);
	gc.register(fn,clean,row);return fn;
};
/**
 * Only the private invocation has the typed native lease. No raw lease,
 * retain() or token passes to the consumer, even through a worker callback.
 *
 * @param owner - The public withHosts() binding; a function cannot keep it alive.
 * @param options - Binding lifecycle and private call dispatcher.
 */
export const createWasmTaskFunctions=(owner,options)=>{
	if(!gc || typeof WeakRef!=="function") throw new TypeError("Returned Lean functions require WeakRef and FinalizationRegistry");
	const group={owner: new WeakRef(owner),rows: new Set(),open: options.open,apply: options.apply,collect: options.collect};
	gc.register(owner,unbindCallback(options.dispose),group);
	return {
		publish: (method,lease)=>{
			const row={lease,active: 0,closed: false};
			try
			{
				if(!group.open?.() || !group.owner.deref()) throw stale();
				group.rows.add(row);return wrap(group,row,method);
			} catch(error)
			{ drop(group,row);throw error; }
		}
		, revoke: ()=>{
			gc.unregister(group);
			try
			{ for(const row of group.rows) drop(group,row); }
			finally
			{ group.open=group.apply=group.collect=null; }
		}
	};
};
