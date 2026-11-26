/** @file Observe nested callbacks and terminal shutdown on the installed runtime. */
import {AsyncStep_Workshop_openCursor, JavaScriptCallbackError} from "@lean-bridge/workshop-host-example";
import {closeTaskRuntime, taskRuntimeStats} from "@lean-bridge/runtime";

/** Starts a callback-taking task on the consumer's installed binding. */
type Start = (callback: (n: number) => number | Promise<number>) => Promise<number>;

/**
 * Count actual Lean finalizer writes when the *pull itself* rejects. A manual
 * close before the first observation would mask a missing automatic close.
 *
 * @param meter - The ordinary application object whose reading triggers a step error.
 * @param open - Open the installed cursor for this object without requesting an item.
 */
export const failedPullCleanup = async <T extends {level: number; reads: number}>(meter: T, open: (item: T) => AsyncIterableIterator<T> & {return(): Promise<IteratorResult<T>>}) => {
	let value = meter.level, writes = 0;
	Object.defineProperty(meter, "level", {
		get: () => value
		, set: (n: number) => { value = n; ++writes; }
	});
	const cursor = open(meter);
	if(writes !== 0 || meter.reads !== 0 || value !== 99) throw new Error("Cursor consumed or closed before demand");
	try
	{ await cursor.next(); throw new Error("Expected a typed pull failure"); }
	catch(error)
	{
		if(!(error instanceof AsyncStep_Workshop_openCursor) || error.phase !== "step") throw error;
	}
	const beforeReturn = {level: meter.level, writes, reads: meter.reads};
	const exhausted = (await cursor.next()).done === true;
	await cursor.return(); await cursor.return();
	return {phase: "step", beforeReturn, exhausted, afterReturns: {level: meter.level, writes, reads: meter.reads}};
};

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
