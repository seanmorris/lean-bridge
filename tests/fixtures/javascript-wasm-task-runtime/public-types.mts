/** @file Typecheck an installed task component under strict NodeNext resolution. */
import {checked,closes,hold,series,exact,EIO_Jobs_checked} from "@example/lean-jobs";

const value: bigint = await exact(1n << 95n);
const count: number = closes();
const task = hold();
const promise: Promise<number> = task;
const cancelled: boolean = task.cancel();
const branch = await checked(false, false, 7);
const payload: number = "ok" in branch ? branch.ok : branch.error;
for await(const item of series(count))
{ const n: number = item; void n; }
await series(0).return();
try
{ await checked(true, false, 7); } catch(e)
{
	if(e instanceof EIO_Jobs_checked)
	{ const n: number = e.payload; void n; }
}
// @ts-expect-error IO is synchronous.
closes().then();
// @ts-expect-error Lean Int requires a JS bigint, not a rounded double.
exact(0.3);
void [value, promise, cancelled, payload];
