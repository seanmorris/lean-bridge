/** Observe callback admission through the public API, including failure and nested registration. */
export async function runBudget(api,stats,idle) {
	const eq=(actual,expected)=>{ if(actual!==expected) throw new Error("Expected "+expected+", got "+actual); };
	const failure=async work=>{ try { await work; } catch(e) { return e; } throw new Error("Missing failure"); };
	const policy=e=>{
		eq(e instanceof api.JavaScriptCallbackError,true); eq(e.phase,"task");
		eq(e.cause.code,"callback-already-invoked");
	};
	let first=0, many=0, nested=0, attempted=0, sameFunction=0;
	policy(await failure(api.probe(39,async n=>{
		++first;
		return api.single(n,v=>{++nested; return v+1;});
	},n=>{++many;return n+1;})));
	eq(first,1); eq(nested,1); eq(many,2);
	const marker=new Error("application rejected");
	policy(await failure(api.retry(1,()=>{++attempted;throw marker;})));
	eq(attempted,1);
	const propagated=await failure(api.single(1,()=>Promise.reject(marker)));
	eq(propagated instanceof api.JavaScriptCallbackError,true); eq(propagated.cause,marker);
	const add=n=>{++sameFunction;return n+1;};
	eq(await api.pair(40,add,add),42); eq(sameFunction,2);
	const recovered=await api.single(41,add); eq(recovered,42); eq(sameFunction,3);
	await idle(); const s=stats(), live=[s.frames,s.allocations,s.pending,s.notifications,s.nativeOwners];
	eq(live.every(v=>v===0),true);
	return {first,many,nested,attempted,sameFunction,recovered,live};
}
