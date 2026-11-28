/** @file Keep a live Lean ticket and an unfinished task in the page while a different heap closes. */
import * as depot from "@example/lean-depot";
import * as peer from "@example/lean-peer";
import { closeTaskRuntime, taskRuntimeStats } from "@lean-bridge/runtime";

/**
 * Run a dedicated worker, then use the same ticket through both parent packages.
 *
 * @param child - Start an independent worker and await its report.
 * @param progress - Report the last completed application step on a timeout.
 */
export const run = async (child, progress) => {
	const baseline = taskRuntimeStats().nativeOwners;
	const ticket = depot.make(30), ticketOwners = taskRuntimeStats().nativeOwners;
	const task = depot.pending(ticket);
	try
	{
		const held = taskRuntimeStats();
		// A public ticket lease and a live task handle each own a native slot.
		if(baseline !== 0 || ticketOwners !== 1 || held.pending !== 1 || held.nativeOwners !== 2)
			throw new Error("Unexpected parent ticket/task ownership: " + JSON.stringify({baseline,ticketOwners,held}));
		progress("holding the parent ticket while the worker runs");
		const worker = await child(progress);
		const after = taskRuntimeStats();
		if(after.state !== "open" || after.pending !== 1 || after.nativeOwners !== held.nativeOwners || depot.read(ticket) !== 30)
			throw new Error("Worker shutdown affected the parent ticket or task");
		depot.release(6);
		const delivered = await task, mutated = await peer.bump(delivered, 6);
		if(!ticket.same(delivered) || !ticket.same(mutated))
			throw new Error("The two parent packages lost the ticket's identity");
		const value = depot.read(ticket);
		mutated.dispose(); delivered.dispose(); ticket.dispose();
		return { value, worker };
	}
	finally
	{
		// A failed child must not leave the parent's non-cooperative worker gated.
		if(taskRuntimeStats().state === "open") depot.release(0);
		await task.then(t => t.dispose(), () => {});
		ticket.dispose();
		await closeTaskRuntime();
	}
};
