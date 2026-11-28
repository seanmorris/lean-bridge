/** @file Applications can implement callbacks synchronously or asynchronously. */
import {checked,worker,text,JavaScriptCallbackError,EIO_Relay_checked,type Retained_uint32_to_uint32} from "@example/lean-relay";
import {twice} from "@example/lean-echo";
const begin: Retained_uint32_to_uint32 = n => Promise.resolve(twice(n));
const task = worker(3,begin);
const cancelled: boolean = task.cancel();
const output: string = await text("Hi", s => s.trim());
try { await checked(true,begin); } catch(e) {
	if(e instanceof JavaScriptCallbackError) { const phase: "factory" | "task" = e.phase; void phase; }
	if(e instanceof EIO_Relay_checked) { const code: number = e.payload; void code; }
}
// @ts-expect-error The callback must return a number or PromiseLike<number>.
worker(3,async () => "three");
// @ts-expect-error A callback cannot be replaced with a host token.
worker(3,3);
void cancelled; void output;
