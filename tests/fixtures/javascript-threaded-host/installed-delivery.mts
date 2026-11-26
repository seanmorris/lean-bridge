/** @file Compile and execute the cancelable task and iterator contract in Node. */
import {withHosts} from "@lean-bridge/workshop-host-example";
import {closeTaskRuntime, taskRuntimeStats, waitTaskRuntimeIdle} from "@lean-bridge/runtime";
import {failedPullCleanup, nestedDelivery, terminalDelivery} from "./terminal-delivery.mjs";

/** Consumer-owned object whose reads and finalizer writes are observable. */
class Meter
{
	/** The binding reads this field through its generated host member. */
	level: number;
	/** Number of host method calls from Lean. */
	reads = 0;
	/**
     * Set the reading used by the installed component.
     *
     * @param n - Initial reading.
     */
	constructor(n: number) { this.level = n; }
	/** Count a demand and return the current value. */
	read() { ++this.reads; return this.level; }
	/** Return the original application instance. */
	identity(): this { return this; }
}
/**
 * Fail the installed program if its public behavior changes.
 *
 * @param condition - Observed result.
 * @param label - Behavior under test.
 */
function check(condition: boolean, label: string)
{
	if(!condition) throw new Error(label);
}
const api = withHosts({Box: Meter});
try
{
	const item: Meter = await api.start(6);
	const nested = await nestedDelivery(cb => api.work(item, cb));
	const value: number = nested.value;
	check(value === 7, "awaited Lean task");
	item.reads = 0;
	const cursor: AsyncIterableIterator<Meter> = api.open_cursor(item);
	check(await api.work(new Meter(20), n => n) === 20, "independent scheduler progress");
	check(item.reads === 0 && item.level === 6, "idle iterator consumed input");
	let yielded = 0;
	for await(const received of cursor)
	{
		check(received === item, "host identity"); ++yielded; break;
	}
	check(yielded === 1 && item.reads === 1 && item.level === 0 && (await cursor.next()).done === true, "early close");
	const drain = new Meter(13), exhausted = api.open_cursor(drain);
	const first = await exhausted.next();
	check(!first.done && first.value === drain && drain.level === 13, "first demand closed cursor");
	check((await exhausted.next()).done === true && drain.level === 0, "end did not close cursor");
	check((await exhausted.next()).done === true && drain.reads === 1, "exhausted cursor issued another read");
	const cleanup = await failedPullCleanup(new Meter(99), meter => api.open_cursor(meter));
	const entered = Promise.withResolvers<void>(), reply = Promise.withResolvers<number>();
	const pending = api.work(item, () => { entered.resolve(); return reply.promise; });
	const canceled: Promise<boolean> = pending.then(() => false, (e: unknown) =>
		typeof e === "object" && e !== null && "code" in e && e.code === "operation-cancelled");
	await entered.promise;
	const won: boolean = pending.cancel();
	check(won && !pending.cancel() && await canceled, "cancel lost or delivered twice");
	reply.resolve(999);
	check(await api.work(item, n => n + 2) === 2, "late reply replaced another task");
	if(import.meta.url === "typecheck-only:")
	{
		// @ts-expect-error A cursor delivers asynchronously.
		const sync: Iterator<Meter> = api.open_cursor(item);
		// @ts-expect-error A callback must deliver a number.
		api.work(item, async () => "bad");
		void sync;
	}
	await api.dispose(); await waitTaskRuntimeIdle();
	const s = taskRuntimeStats();
	check([s.pending, s.nativeOwners, s.hostPins, s.frames, s.notifications, s.hostErrors, s.allocations].every(n => n === 0), "not drained");
	const retiring = withHosts({Box: Meter});
	const terminal = await terminalDelivery(cb => retiring.work(item, cb));
	console.log(JSON.stringify({value, yielded, readsAtExhaustion: drain.reads, canceled: true, drained: true, nested: nested.trace, terminal, cleanup}));
} finally
{ await api.dispose(); await closeTaskRuntime(); }
