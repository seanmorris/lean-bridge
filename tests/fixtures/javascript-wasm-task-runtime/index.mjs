/** @file Public interface of the installed task feasibility fixture. */
import createModule from "./task.mjs";
import { PendingOperationRegistry } from "./pending-operations.mjs";

const plan = Object.freeze({kind: "pending-operation-v1", abiVersion: 1, declarationId: "ThreadProbe.start"});

// Node does not keep a process alive for an unresolved Promise. Emscripten
// unrefs idle pooled workers, including workers loaded just after launch.
// Retain the event loop (not a timer) through native drain, even after abort.
const retainOwner = () => {
	if(!globalThis.process?.versions?.node) return () => {};
	const {port1, port2} = new MessageChannel();
	port1.start(); port1.ref();
	return () => { port1.close(); port2.close(); };
};

/**
 * The gate makes cancellation races deterministic. The native continuation,
 * not a JavaScript timeout, notifies the owner of start and completion.
 */
export const openProbe = async () => {
	const domain = new PendingOperationRegistry({capacity: 1});
	let job, closed = false, closing, module;
	const wake = (key, kind) => {
		const row = job;
		if(!row || row.key !== key) return;
		const state = module._probe_state(key);
		if(kind === 1 && (state & 1)) row.enter();
		if(kind !== 2) return;
		if(state !== 3) throw new Error("Lean completed without the worker entering");
		row.enter(); // The two owner notifications can be interleaved.
		const result = module._probe_take(key);
		if(result < 0) throw new Error("Native completion was not consumable");
		job = undefined;
		row.releaseOwner();
		if(!row.cancelled) domain.resolve(row.token, result);
		row.drain(result);
	};
	module = await createModule({onTaskWake: wake});
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
		row.token = op.token; row.drained = drained; row.releaseOwner = retainOwner(); job = row;
		row.key = module._probe_open(Number(cooperative));
		if(!row.key)
		{
			job = undefined; row.releaseOwner(); const error = new Error("Native task did not start");
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
	return Object.freeze({start, close, counts: () => domain.snapshot()});
};
