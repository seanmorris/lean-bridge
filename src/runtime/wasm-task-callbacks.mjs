/** @file Deliver retained worker requests on the owning JavaScript event loop. */
import {taskFrame as op} from "../abi/wasm-task-frame.mjs";
import {WasmTaskCallbackLimit} from "./wasm-task-frames.mjs";

// A never-settling application promise must not keep the task, callback or
// Wasm heap alive after cancellation. Its reactions retain only this ticket.
const follow=(value,ticket) => Promise.resolve(value).then(
	v => ticket.answer?.(true,v), error => ticket.answer?.(false,error)
);

/**
 * Arm before or after a request is queued. Each native readiness token is
 * one-shot. Exactly one JS reply may be active per port, including re-entry.
 *
 * @param options - Checked callback slots, native frame, notifications and heap retirement.
 * @param options.method - Checked slot and scalar types.
 * @param options.args - Actual host callables supplied by the consumer.
 * @param options.frame - Native callback port frame.
 * @param options.notifications - Runtime-wide one-shot owner notifications.
 * @param options.retire - Reject every operation after an invariant violation.
 * @param options.abort - Reject this task and drain its native owner.
 */
export const createWasmTaskCallbacks=({method,args,frame,notifications,retire,abort}) => {
	const slots=new Map(method.callbacks.map(([i]) => [i,args[i]]));
	let open=true, sub, ticket;
	const close=() => {
		open=false; sub?.detach(); sub=null;
		if(ticket) ticket.answer=null;
		ticket=null; slots.clear(); frame.forgetFailures();
	};
	const fatal=error => { try
	{ if(error instanceof WasmTaskCallbackLimit) abort(error); else retire(error); } catch { /* A retired session has already rejected all public work. */ } };
	const reserve=() => { sub=notifications.subscribe(ready); };
	const arm=() => {
		if(!open) return;
		if(!sub)
		{
			try
			{ reserve(); } catch(error)
			{ if(!(error instanceof RangeError)) throw error; abort(error); return; }
		}
		frame.call(op.arm,sub.token);
	};
	const ready=() => {
		sub=null; if(!open) return;
		try
		{
			const req=frame.request();
			if(!req) return; // Completion won. Its independent token drains the task.
			const {slot,value}=req, fn=slots.get(slot);
			const active={answer: (ok,v) => {
				if(!open || active!==ticket) return;
				active.answer=null; ticket=null;
				try
				{
					if(open)
					{ frame.answer(slot,ok,v); arm(); }
				} catch(error)
				{ fatal(error); }
			}};
			ticket=active;
			let out;
			try
			{ out=fn(value); } catch(error)
			{ active.answer?.(false,error); return; }
			follow(out,active);
		} catch(error)
		{ fatal(error); }
	};
	return {reserve,arm,close};
};
