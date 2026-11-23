/** @file Public interface of the installed task feasibility fixture. */
import createModule from "./task.mjs";
import { PendingOperationRegistry } from "./pending-operations.mjs";
import { createWasmTaskNotifications } from "./wasm-task-notifications.mjs";

const plan = Object.freeze({kind: "pending-operation-v1", abiVersion: 1, declarationId: "ThreadProbe.start"});

/**
 * The gate makes cancellation races deterministic. The native continuation,
 * not a JavaScript timeout, notifies the owner of start and completion.
 */
export const openProbe = async () => {
	const domain = new PendingOperationRegistry({capacity: 1});
	const notifications = createWasmTaskNotifications();
	let job, closed = false, closing, module;
	const wake = (row, kind) => {
		if(row !== job) return;
		const state = module._probe_state(row.key);
		if(kind === 1 && (state & 1)) row.enter();
		if(kind !== 2) return;
		if(state !== 3) throw new Error("Lean completed without the worker entering");
		row.enter(); // The two owner notifications can be interleaved.
		const result = module._probe_take(row.key);
		if(result < 0) throw new Error("Native completion was not consumable");
		job = undefined;
		row.onEntry.detach(); // A result can reach the owner before its entry notification.
		if(!row.cancelled) domain.resolve(row.token, result);
		row.drain(result);
	};
	module = await createModule({onLeanTaskReady: notifications.notify});
	if(module._probe_init() !== 1) throw new Error("Could not initialize threaded Lean");
	if(!module._probe_check_temp_io())
	{
		module.PThread.terminateAllThreads();
		throw new Error("Lean temporary file/directory check failed");
	}
	const start = cooperative => {
		if(closed || job || typeof cooperative !== "boolean") throw new Error("Closed, busy or invalid task");
		const row = {key: 0, cancelled: false};
		const entered = new Promise(done => { row.enter = done; });
		const drained = new Promise(done => { row.drain = done; });
		const op = domain.begin(plan, {cancel: () => {
			if(!module._probe_cancel(row.key)) throw new Error("Invalid native cancellation");
			row.cancelled = true;
		}});
		row.token = op.token; row.drained = drained; job = row;
		try
		{
			row.onEntry = notifications.subscribe(() => wake(row, 1));
			row.onResult = notifications.subscribe(() => wake(row, 2));
			row.key = module._probe_open(Number(cooperative), row.onEntry.token, row.onResult.token);
			if(!row.key) throw new Error("Native task did not start");
		}
		catch(error)
		{
			job = undefined; row.onEntry?.detach(); row.onResult?.detach();
			domain.reject(op.token, error); op.promise.catch(() => {}); throw error;
		}
		return Object.freeze({entered, result: op.promise, drained
			, cancel: () => job === row && !row.cancelled && domain.cancel(op.token)
			, release: value => {
				if(!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new TypeError("Expected UInt32");
				return job === row && Boolean(module._probe_release(row.key, value));
			}
		});
	};
	const close = () => {
		if(closing) return closing;
		closed = true; const row = job; domain.shutdown();
		if(row) module._probe_release(row.key, 0);
		closing = Promise.resolve(row?.drained).then(() => { module.PThread.terminateAllThreads(); });
		return closing;
	};
	const alreadyReady = () => {
		if(closed) throw new Error("Runtime is closed");
		let calls = 0, inside = true;
		return new Promise((resolve, reject) => {
			const ready = () => {
				if(inside) reject(new Error("Reentered component before subscribe returned"));
				if(++calls === 2) resolve(calls);
			};
			const a = notifications.subscribe(ready), b = notifications.subscribe(ready);
			if(!module._probe_watch_ready(a.token, b.token))
			{ a.detach(); b.detach(); reject(new Error("Ready task did not start")); }
			inside = false;
		});
	};
	return Object.freeze({start, close, alreadyReady, counts: () => domain.snapshot()});
};
