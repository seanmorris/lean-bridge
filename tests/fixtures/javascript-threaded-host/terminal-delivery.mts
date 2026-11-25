/** @file Observe nested callbacks and terminal shutdown on the installed runtime. */
import {JavaScriptCallbackError} from "@lean-bridge/workshop-host-example";
import {closeTaskRuntime, taskRuntimeStats} from "@lean-bridge/runtime";

/** Starts a callback-taking task on the consumer's installed binding. */
type Start = (callback: (n: number) => number | Promise<number>) => Promise<number>;

/**
 * Await a second callback-taking Lean task from inside the first callback.
 *
 * @param start - Start an installed task on the caller's live binding and value.
 */
export const nestedDelivery = async (start: Start) => {
	const trace: string[] = [], original = new Error("inner price failed");
	const value = await start(async n => {
		trace.push("outer");
		try
		{
			await start(() => { trace.push("inner-error"); throw original; });
			throw new Error("The nested task swallowed its callback failure");
		}
		catch(error)
		{
			if(!(error instanceof JavaScriptCallbackError) || error.phase !== "task" || error.cause !== original) throw error;
			trace.push("caught-original");
		}
		const reply = await start(m => {
			if(m !== n) throw new Error("Nested callback received another task's input");
			trace.push("inner-success"); return m + 1;
		});
		trace.push("resumed"); return reply;
	});
	return {value, trace};
};

/**
 * Close the entire runtime while a host callback is parked, then fulfill its
 * old reply and verify that no settlement or owned state is resurrected.
 *
 * @param start - Start an installed task on a fresh, live binding.
 */
export const terminalDelivery = async (start: Start) => {
	const entered = Promise.withResolvers<void>(), old = Promise.withResolvers<number>();
	let visits = 0, successes = 0, failures = 0;
	const observed = start(() => { ++visits; entered.resolve(); return old.promise; })
		.then(() => { ++successes; return "success"; }, (error: unknown) => {
			++failures;
			if(typeof error !== "object" || error === null || !("code" in error)) throw error;
			return error.code;
		});
	await entered.promise;
	try
	{
		await closeTaskRuntime();
		const reason = await observed;
		old.resolve(999);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const s = taskRuntimeStats();
		const drained = [s.frames, s.allocations, s.pending, s.notifications, s.nativeOwners, s.hostPins, s.hostErrors].every(n => n === 0);
		return {reason, visits, successes, failures, state: s.state, drained};
	}
	finally
	{ old.resolve(0); }
};
