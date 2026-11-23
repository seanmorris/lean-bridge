/** @file Keep the parent's unanswered callback alive across an independent worker shutdown. */
import * as relay from "@example/lean-relay";
import { closeTaskRuntime, taskRuntimeStats } from "@lean-bridge/runtime";

/**
 * The child and parent share npm packages but not pending calls or heaps.
 *
 * @param child - Run the worker application to completion.
 * @param progress - Report the last stage when the outer test times out.
 */
export const run = async (child, progress) => {
	const entered = Promise.withResolvers(), answer = Promise.withResolvers();
	const parent = relay.factory(6, n => { entered.resolve(n); return answer.promise; });
	try
	{
		progress("waiting for the parent's callback");
		const unexpected = parent.then(() => { throw new Error("Parent settled before its callback reply"); });
		const original = await Promise.race([entered.promise, unexpected]), held = taskRuntimeStats();
		const worker = await child(progress), after = taskRuntimeStats();
		if(held.nativeOwners !== after.nativeOwners || held.pending !== 1 || after.pending !== 1 || after.state !== "open")
			throw new Error("The child's runtime changed the parent's pending task");
		answer.resolve(original * 7);
		return { value: await parent, worker };
	}
	finally
	{
		answer.resolve(0);
		await closeTaskRuntime();
	}
};
