/** @file Deliver retained worker requests on the owning JavaScript event loop. */
import {taskFrame as op} from "../abi/wasm-task-frame.mjs";
import {exhaustedWasmCallback,WasmTaskCallbackLimit,wasmHostThrown} from "./wasm-task-frames.mjs";

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
 * @param options.admitted - Whether the owning binding still accepts callback delivery.
 */
export const createWasmTaskCallbacks=({method,args,frame,notifications,retire,abort,admitted=()=>true}) => {
	const slots=new Map(method.callbacks.map(([i]) => [i,args[i]]));
	// Per task and per slot, never per function identity. Consume before
	// invoking the host; rejection or an outstanding promise cannot restore it.
	const used=method.onceSlots?.length ? new Set() : null;
	let open=true, sub, ticket;
	const accepts=()=>open && admitted();
	const close=() => {
		open=false; sub?.detach(); sub=null;
		if(ticket) ticket.answer=null;
		ticket=null; slots.clear(); frame.forgetFailures();
	};
	const fatal=error => { try
	{
		if(wasmHostThrown.has(error))
		{if(accepts()) abort(wasmHostThrown.get(error).error);}
		else if(error instanceof WasmTaskCallbackLimit) abort(error);
		else retire(error);
	} catch { /* A retired session has already rejected all public work. */ } };
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
		sub=null; if(!accepts()) return;
		try
		{
			const req=frame.request(used && (slot=>!used.has(slot)));
			if(!req || !accepts()) return; // Completion or reentrant cancellation won.
			const {slot,value}=req, fn=slots.get(slot);
			const active={answer: (ok,v) => {
				if(!accepts() || active!==ticket) return;
				active.answer=null; ticket=null;
				try
				{
					frame.answer(slot,ok,v,accepts); if(accepts()) arm();
				} catch(error)
				{ fatal(error); }
			}};
			ticket=active;
			if(req.refused)
			{
				active.answer(false,exhaustedWasmCallback());
				return;
			}
			if(used && method.onceSlots.includes(slot)) used.add(slot);
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
