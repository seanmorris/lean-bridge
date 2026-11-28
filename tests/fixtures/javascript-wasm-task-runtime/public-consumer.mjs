/** @file Ordinary application imports; runtime management is used only to verify shutdown and leaks. */
import {checked,io_start,terminal,hold,release,closes,series,exact,text,IOError,TaskIOError,EIO_Jobs_checked,AsyncStep_Jobs_series} from "@example/lean-jobs";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/** Run identically from a clean Node install and from a cross-origin-isolated browser. */
export const exercise = async () => {
	let checks=0;
	const eq=(actual,expected,label) => {
		if(!Object.is(actual,expected)) throw new Error(label+": "+String(actual)+" !== "+String(expected));
		checks++;
	};
	const errorOf=async work => {
		try
		{ await work(); } catch(error)
		{ return error; }
		throw new Error("Missing expected error");
	};
	try
	{
		const first=checked(false,false,19);
		eq(first instanceof Promise,true,"native Promise");
		eq((await first).ok,26,"returned ok"); eq(first.cancel(),false,"completed task cannot cancel");
		eq((await checked(false,true,117)).error,117,"Except.error is a value");
		const early=await errorOf(() => checked(true,false,413));
		eq(early instanceof EIO_Jobs_checked,true,"typed factory error"); eq(early.payload,413,"factory payload");
		eq(early.cause.details.phase,"factory","factory phase");
		const io=await errorOf(() => io_start(true));
		eq(io instanceof IOError,true,"IO class"); eq(io.message,"factory failed","IO text");
		const late=await errorOf(() => terminal(true));
		eq(late instanceof TaskIOError,true,"task IO class"); eq(late.message,"worker failed","worker text");
		eq(late.cause.details.phase,"task","worker phase");
		eq((await Promise.all([io_start(false),terminal(false)])).join(","),"41,97","independent completions");
		const value=-(2n**190n+7n); eq(await exact(value),value,"negative multi-limb integer");
		eq(await text("λ🟢\0"),"λ🟢\0","copied UTF-8");
		let invalid=false; try
		{ checked(1,false,0); } catch(error)
		{ invalid=error instanceof TypeError; }
		eq(invalid,true,"validate before submission"); eq(closes(),0,"sync IO is not a Promise");
		const task=hold(); const rejected=errorOf(() => task);
		eq(taskRuntimeStats().nativeOwners,1,"pending native owner"); eq(task.cancel(),true,"cancel wins");
		eq(task.cancel(),false,"no double cancel"); eq((await rejected).code,"operation-cancelled","cancelled Promise");
		eq(taskRuntimeStats().nativeOwners,1,"rejection does not dispose a running worker");
		eq(release(17),undefined,"sync companion unblocks worker"); await waitTaskRuntimeIdle();
		eq(taskRuntimeStats().nativeOwners,0,"native drain");
		const collected=[]; for await(const v of series(3)) collected.push(v);
		eq(collected.join(","),"0,1,2","for await exhaustion"); eq(closes(),1,"exhaustion closes once");
		for await(const v of series(9))
		{ eq(v,0,"first element"); break; }
		eq(closes(),2,"early break closes once");
		const it=series(8), pull=it.next(), overlap=it.next(), pending=errorOf(() => pull);
		const returning=it.return();
		eq((await errorOf(() => overlap)).message.includes("outstanding pull"),true,"backpressure");
		eq((await pending).code,"operation-cancelled","inflight pull cancelled"); eq((await returning).done,true,"return drains");
		eq((await it.next()).done,true,"no read after return"); eq(closes(),3,"concurrent return closes once");
		const step=await errorOf(() => series(413).next());
		eq(step instanceof AsyncStep_Jobs_series,true,"step class"); eq(step.payload,413,"step payload");
		eq(step.cause.details.phase,"step","step phase"); eq(closes(),4,"step failure closes once");
		await waitTaskRuntimeIdle();
		for(const k of ["frames","allocations","pending","notifications","nativeOwners"]) eq(taskRuntimeStats()[k],0,k);
		const departing=terminal(false), cancelled=errorOf(() => departing), closing=closeTaskRuntime();
		eq(taskRuntimeStats().state,"closing","shutdown begins before readiness microtasks");
		let admitted=true; try
		{ closes(); } catch
		{ admitted=false; } eq(admitted,false,"no admission after close");
		eq((await cancelled).code,"operation-cancelled","shutdown settles public work");
		await closing; eq(taskRuntimeStats().state,"closed","shutdown drains and stops");
		eq(taskRuntimeStats().nativeOwners,0,"native broker drained before terminating workers");
		return {checks};
	}
	finally
	{ await closeTaskRuntime(); }
};
