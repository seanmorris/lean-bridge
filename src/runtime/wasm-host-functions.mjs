/** @file Binding-owned synchronous Lean functions on one JavaScript/Wasm agent. */
const reclaimed=typeof FinalizationRegistry==="function"?new FinalizationRegistry(clean=>{
	queueMicrotask(()=>{try
	{ clean(); } catch { /* Already retired; do not retry against this heap. */ }});
}):null;
const stale=()=>new TypeError("Lean function or host binding is closed");
const functionResult=t=>t!==null && typeof t==="object" && !Array.isArray(t);

// No function or GC cleanup closure may retain the public binding. GC is
// only a fallback: dispose() revokes the native ticket synchronously.
const releaseTicket=(g,site,row)=>{
	const id=row.ticket;row.ticket=0n;
	if(id && !g.closed) g.control(g.count*2+site,id);
};
const cleanupTicket=(g,site,row)=>()=>{
	if(row.closed) return false;
	row.closed=true;reclaimed?.unregister(row);
	if(!row.active) releaseTicket(g,site,row);
	return !g.closed;
};
const makeFunction=(g,m,site,ticket)=>{
	const row={ticket,active: 0,closed: false},drop=cleanupTicket(g,site,row);
	const method={name: m.name,args: [m.result.argument],result: m.result.reply,effect: "IO",errorId: "error:IO.Error"};
	const fn=(...values)=>{
		if(g.closed || row.closed || !g.owner.deref()) throw stale();
		g.depth++;row.active++;
		let success=false;
		try
		{ const result=g.invoke(method,g.count+site,values,g.id,row.ticket);success=true;return result; }
		finally
		{
			g.depth--;row.active--;
			if(!row.active && row.closed)
			{
				if(success) releaseTicket(g,site,row);
				else try
				{ releaseTicket(g,site,row); } catch { /* Preserve the original failure on a retired heap. */ }
			}
		}
	};
	Object.defineProperty(fn,"dispose",{value: drop});
	Object.freeze(fn);
	reclaimed?.register(fn,drop,row);
	return fn;
};
const close=g=>{
	if(g.closed) return false;
	if(g.depth) throw new TypeError("Cannot unbind an active host session");
	g.closed=true;
	try
	{ g.control(g.count*3,0n); }
	finally
	{
		try
		{ g.unbind(); }
		finally
		{
			reclaimed?.unregister(g);
			g.control=g.invoke=g.unbind=null;
		}
	}
	return true;
};
const cleanBinding=g=>()=>close(g);
const call=(g,m,i)=>(...values)=>{
	if(g.closed || !g.owner.deref()) throw stale();
	g.depth++;
	try
	{
		if(!functionResult(m.result)) return g.invoke(m,i,values);
		const ticket=g.invoke(m,i,values,g.id);
		try
		{ return makeFunction(g,m,i,ticket); }
		catch(error)
		{ g.control(2*g.count+i,ticket);throw error; }
	} finally
	{ g.depth--; }
};
/**
 * Expose only calls and disposal, never the native ticket or a raw pointer.
 *
 * @param abi - Checked component methods and factory-specific carrier shapes.
 * @param session - Fresh private binding ID on this heap.
 * @param invoke - Checked synchronous export dispatcher.
 * @param control - Release one ticket or revoke this binding's whole group.
 * @param unbind - Retire nominal object registrations after dropping captures.
 */
export const bindWasmHostFunctions=(abi,session,invoke,control,unbind)=>{
	if(!reclaimed || typeof WeakRef!=="function") throw new TypeError("Binding-owned Lean functions require WeakRef and FinalizationRegistry");
	const api=Object.create(null),g={id: session,count: abi.methods.length,depth: 0,closed: false,owner: new WeakRef(api),invoke,control,unbind};
	for(const [i,m] of abi.methods.entries()) api[m.name]=call(g,m,i);
	api.dispose=cleanBinding(g);
	Object.freeze(api);reclaimed?.register(api,api.dispose,g);
	return api;
};
