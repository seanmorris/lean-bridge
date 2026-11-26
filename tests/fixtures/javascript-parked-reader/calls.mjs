/** Observe public settlement separately from cleanup of the parked Lean task. */
export async function parked(api, stats, idle) {
	const equal = (actual, expected, label) => {
		if (!Object.is(actual,expected)) throw new Error(label+": "+String(actual)+" !== "+String(expected));
	};
	const first = api.pulls(), before = api.closes();
	const cursor = api.open_cursor(2), observedEntry = api.entered();
	let successes=0, failures=0, drained=false;
	try {
		equal(api.pulls(),first,"opened without demand");
		const pending=cursor.next().then(() => { ++successes; return "delivered"; }, e => { ++failures; return e.code; });
		equal(await observedEntry,1,"Lean worker entered");
		equal(api.pulls(),first+1,"one demand");
		const overlap=await cursor.next().then(()=>"accepted", e=>e.message);
		equal(overlap.includes("outstanding pull"),true,"overlap refused");
		const stopping=cursor.return().then(r=>{ drained=true; return r; });
		const again=cursor.return();
		equal(await pending,"operation-cancelled","pending reader rejected before releasing gate");
		equal((await cursor.next()).done,true,"no new demand");
		equal(await api.sibling(41),42,"independent task completed while worker parked");
		const whileParked={pulls:api.pulls()-first,closes:api.closes()-before,drained,nativeOwners:stats().nativeOwners};
		equal(whileParked.pulls,1,"no hidden pull");
		equal(drained,false,"return must still wait for worker cleanup");
		if (!Number.isInteger(whileParked.nativeOwners) || whileParked.nativeOwners < 1) throw new Error("lost running worker");
		const late=api.finished(); api.release(71);
		equal(await late,73,"Lean produced its real late value");
		equal((await stopping).done,true,"first return drained");
		equal((await again).done,true,"second return drained");
		equal((await cursor.next()).done,true,"terminal after late result");
		await idle();
		const s=stats(), live=[s.frames,s.allocations,s.pending,s.notifications,s.nativeOwners];
		equal(live.every(n=>n===0),true,"broker drained");
		equal(successes,0,"no late delivery"); equal(failures,1,"single rejection");
		equal(api.closes()-before,1,"one Lean finalizer"); equal(api.pulls()-first,1,"one Lean pull");
		return {successes,failures,whileParked,late:73,finalizers:1,live};
	} finally {
		api.release(0); await cursor.return();
	}
}
