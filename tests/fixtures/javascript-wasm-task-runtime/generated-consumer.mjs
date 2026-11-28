/** @file Exercise the private generated ABI inside a real offline-installed runtime, independently of the author compiler. */
import createModule from "./task.mjs";
import {createWasmTaskNotifications} from "./wasm-task-notifications.mjs";
import {readComponent} from "@example/lean-jobs";
import {methods,controlSymbol} from "@example/lean-jobs";

/** Verify the compiled wire before a public Promise/iterator facade consumes it. */
export const exercise = async () => {
	const notifications = createWasmTaskNotifications();
	const m = await createModule({onLeanTaskReady: notifications.notify});
	let checks = 0, slot;
	const eq = (a,b,what) => { if(a !== b) throw new Error(what + ": got " + a + ", expected " + b); checks++; };
	const view = () => new DataView(m.HEAP8.buffer);
	const live = new Set();
	const open = (name,...input) => {
		const i = methods.findIndex(s => s.declaration === "Jobs."+name), method = methods[i];
		const size = 72 + 24*method.args.length + method.tagBytes, p = m._malloc(size);
		if(!p || input.length !== method.args.length) throw new Error("Invalid frame for " + name);
		live.add(p); m.HEAP8.fill(0,p,p+size);
		view().setUint32(p,0x4c425431,true); view().setUint32(p+4,size,true); view().setUint32(p+8,i,true);
		for(const [k,v] of input.entries()) view().setBigUint64(p+72+k*24,BigInt(v),true);
		const call = (op, token = 0) => {
			view().setUint32(p+12,op,true); view().setUint32(p+16,token,true); return m._lb_js_task_call(slot,p);
		};
		const ready = () => new Promise((resolve,reject) => {
			const sub = notifications.subscribe(resolve);
			if(call(1,sub.token) !== 0)
			{ sub.detach(); reject(new Error("missing native subscription for "+name)); }
		});
		const word = offset => view().getBigUint64(p+offset,true);
		return {call
			, ready
			, value: () => Number(word(40))
			, handle: () => word(24)
			, tag: () => view().getUint8(p+size-method.tagBytes)
			, domain: () => word(32)
			, setHandle: (id,domain) => { view().setBigUint64(p+24,id,true); view().setBigUint64(p+32,domain,true); }
			, message: () => new TextDecoder().decode(m.HEAP8.slice(Number(word(40)),Number(word(40)+word(48))))};
	};
	try
	{
		m.FS.writeFile("/component.wasm",await readComponent());
		const name = new TextEncoder().encode(controlSymbol+"\0"), ptr = m._malloc(name.length); m.HEAP8.set(name,ptr);
		const path = new TextEncoder().encode("/component.wasm\0"), pathPtr = m._malloc(path.length);
		m.HEAP8.set(path,pathPtr);
		try
		{ slot=m._lb_js_task_load(pathPtr,ptr); eq(slot,1,"load exact component control"); } finally
		{ m._free(pathPtr); m._free(ptr); }
		const ids = () => m._bridge_owned_runtime_identities();
		eq(ids(),0,"baseline"); eq(m._lb_js_task_call(slot,1),5,"unaligned frame");
		const invalid = open("checked",2,0,9); eq(invalid.call(0),5,"invalid bool"); eq(ids(),0,"no admission");
		const bad = open("checked",1,0,617); eq(bad.call(0),3,"factory EIO"); eq(bad.value(),617,"typed factory payload");
		eq(bad.handle(),0n,"failed factory has no handle"); eq(ids(),0,"released failed factory");
		for(const flag of [0,1])
		{
			const j = open("checked",0,flag,617); eq(j.call(0),0,"factory admitted"); eq(ids(),1,"one native owner");
			await j.ready(); eq(j.call(2),0,"Except is a return, not a failure"); eq(j.tag(),1-flag,"Except branch");
			eq(j.value(),flag ? 617 : 624,"Except value"); eq(j.call(2),6,"already taken"); eq(ids(),0,"taken owner released");
		}
		const early = open("ioStart",1); eq(early.call(0),4,"factory IO"); eq(early.message(),"factory failed","factory IO text"); eq(early.call(6),0,"free factory error");
		const late = open("terminal",1); eq(late.call(0),0,"worker admitted"); await late.ready();
		eq(late.call(2),4,"terminal IO"); eq(late.message(),"worker failed","worker IO text"); eq(late.call(6),0,"free terminal error");
		const good = open("terminal",0); eq(good.call(0),0,"healthy after IO error"); await good.ready(); eq(good.call(2),0,"worker success"); eq(good.value(),97,"worker value");
		const held = open("hold"); eq(held.call(0),0,"pending start"); eq(held.call(2),1,"nonblocking pending take"); eq(held.call(1,0),5,"reject zero token");
		const foreign = open("hold"); foreign.setHandle(held.handle(),held.domain() ^ 1n);
		eq(foreign.call(4),6,"foreign domain cannot release a real task");
		const wrong = open("terminal",0); wrong.setHandle(held.handle(),held.domain()); eq(wrong.call(3),6,"wrong declaration cannot cancel");
		const done = held.ready(); eq(held.call(1,42),7,"reject duplicate listener"); eq(held.call(3),0,"cancel request");
		eq(ids(),1,"cancel retains pending owner"); const unlock = open("release",11); eq(unlock.call(0),0,"synchronous release");
		await done; eq(held.call(2),0,"late drain"); eq(held.value(),1001,"Lean observed cancellation"); eq(ids(),0,"no pending owner");
		for(const earlyExit of [false,true])
		{
			const it = open("series",1); eq(it.call(0),0,"open iterator"); eq(it.call(2),8,"idle before pull");
			eq(it.call(5),0,"request one element"); eq(it.call(5),7,"backpressure"); await it.ready();
			eq(it.call(2),0,"take element"); eq(it.value(),0,"element"); eq(it.call(2),8,"no prefetch");
			if(earlyExit) eq(it.call(4),0,"early return");
			else
			{ eq(it.call(5),0,"pull end"); await it.ready(); eq(it.call(2),2,"exhaustion"); }
			eq(it.call(4),6,"closed once"); eq(ids(),0,"no cursor owner");
			const count = open("closes"); eq(count.call(0),0,"read close count"); eq(count.value(),earlyExit?2:1,"Lean cursor cleanup");
		}
		const failed = open("series",413); eq(failed.call(0),0,"failing iterator starts"); eq(failed.call(5),0,"failing pull admitted");
		await failed.ready(); eq(failed.call(2),3,"typed step error"); eq(failed.value(),413,"step error payload");
		eq(failed.call(4),6,"failed iterator closed"); eq(ids(),0,"no leaked cursor on step error");
		const count = open("closes"); eq(count.call(0),0,"read final close count"); eq(count.value(),3,"exactly one cleanup after failed pull");
		eq(notifications.pending(),0,"no notification leaks");
		return {checks, live: ids()};
	} finally
	{ for(const p of live) m._free(p); m.PThread.terminateAllThreads(); }
};
