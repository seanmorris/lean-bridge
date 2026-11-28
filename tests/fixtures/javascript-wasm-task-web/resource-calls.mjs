/** @file Use for-await's real IteratorClose protocol on installed resource-returning cursors. */
import * as depot from "@example/lean-depot";
import { taskRuntimeStats } from "@lean-bridge/runtime";
import { exercise as original } from "./original-calls.mjs";

/**
 * Prove iteration closes exactly once without taking ownership of its yielded item.
 *
 * @param progress - Last completed step sent to the owning page.
 */
export const exercise = async progress => {
	const start = depot.closes(), ticket = depot.make(21);
	let kept, exhausted = 0;
	try
	{
		for await(const item of depot.stream(ticket, false))
		{
			kept = item;
			break;
		}
		if(depot.closes() !== start + 1 || !kept?.same(ticket) || depot.read(kept) !== 21)
			throw new Error("Breaking the loop did not close once and preserve the yielded lease");
		progress("for-await break closed the cursor but not the item");
		for await(const item of depot.stream(kept, false))
		{
			if(!item.same(ticket)) throw new Error("Exhaustion yielded a different ticket");
			item.dispose(); exhausted++;
		}
		if(exhausted !== 1 || depot.closes() !== start + 2)
			throw new Error("Natural exhaustion did not close the second cursor exactly once");
	}
	finally
	{ kept?.dispose(); ticket.dispose(); }
	if(taskRuntimeStats().nativeOwners !== 0) throw new Error("An iterated ticket leaked");
	progress("for-await exhaustion closed once; no live native owners");
	const { checks } = await original();
	return { checks, earlyBreak: true, exhausted, cursorCloses: 2 };
};
