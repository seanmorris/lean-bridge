/** @file Idiomatic Promise and async-iterator delivery over a runtime-owned, notification-driven Wasm scheduler. */
import {PendingOperationRegistry} from "./pending-operations.mjs";
import {openWasmTaskFrame} from "./wasm-task-frames.mjs";
import {createWasmTaskLeases} from "./wasm-task-leases.mjs";
import {createWasmTaskCallbacks} from "./wasm-task-callbacks.mjs";
import {taskFrame as op} from "../abi/wasm-task-frame.mjs";

/**
 * A session owns the heap, not a single component. Disposal rejects public
 * work once, then waits for actual native completion before stopping workers.
 *
 * @param options - Emscripten instance, shared owner notifications and finalizer.
 */
export const createWasmTaskSession = options => {
	const {module,notifications,terminate,capacity=65535}=options;
	const domain = new PendingOperationRegistry({capacity}), rows = new Set(), ledger = new Map();
	let state = "open", closing, stopped = false, cause;
	const stop = () => { if(!stopped)
	{ stopped=true; terminate(); } };
	const live = () => state==="open" || state==="closing";
	const assertOpen = () => { if(state!=="open") throw cause ?? new Error("Lean task runtime is closed"); };
	const settle = (p,kind,value) => {
		if(p.settled) return false;
		p.settled=true;
		return domain[kind](p.token,value);
	};
	const retire = failure => {
		if(live())
		{
			state="poisoned"; cause=failure;
			for(const row of rows)
			{
				row.work?.sub.detach();
				row.callbacks?.close();
				if(row.work) settle(row.work,"reject",failure);
				row.work=null; row.ending=true; row.frame.dispose(); row.drained();
			}
			rows.clear(); ledger.clear(); leases.finish(); stop();
		}
		throw cause ?? failure;
	};
	const context={module,ledger,retire,isLive: live,assertOpen};
	const leases=createWasmTaskLeases(context);
	const drop = row => {
		if(!rows.delete(row)) return;
		row.callbacks?.close();
		row.ending=true;
		try
		{ if(live() && row.frame.hasOwner()) row.frame.call(op.close); }
		finally
		{ row.frame.dispose(); row.drained(); }
	};
	const cancel = p => !p.settled && settle(p,"cancel","Lean operation cancelled");
	const end = row => {
		row.ending=true;
		if(row.work) cancel(row.work); else drop(row);
		return row.drain;
	};
	const observe = (row,start,cursor) => {
		const p={settled: false}, done = () => {
			try
			{
				const result=row.frame.call(op.take,0,p.settled || row.ending);
				if(!cursor || result.done || row.ending) drop(row);
				settle(p,"resolve",cursor ? result : result.value);
			}
			catch(error)
			{
				try
				{ drop(row); } finally
				{ if(!p.settled) settle(p,"reject",row.mapError(error)); }
			}
			finally
			{ row.work=null; }
		};
		try
		{
			// Reserve the notification before admitting native work: a capacity
			// failure must not leave an unobservable worker running.
			p.sub=notifications.subscribe(done);
			row.callbacks?.reserve();
			const pending=domain.begin({kind: "pending-operation-v1",abiVersion: 1,declarationId: row.method.id},{
				cancel: () => { row.callbacks?.close(); if(live()) row.frame.call(op.cancel); }
			});
			p.token=pending.token; p.promise=pending.promise; row.work=p;
			start(); row.frame.call(op.listen,p.sub.token); row.callbacks?.arm();
		}
		catch(error)
		{
			p.sub?.detach(); row.work=null;
			try
			{ drop(row); } finally
			{ if(p.promise) settle(p,"reject",row.mapError(error)); }
			if(!p.promise) throw error;
		}
		if(!cursor) Object.defineProperty(p.promise,"cancel",{value: () => cancel(p)});
		return p.promise;
	};
	const dispatch = (method,index,invoke,args,mapError,leaseTypes) => {
		assertOpen(); const frame=openWasmTaskFrame({...context,leases,leaseTypes},invoke,method,index,args);
		if(!method.delivery)
		{
			try
			{ return frame.call(op.start).value; } finally
			{ frame.dispose(); }
		}
		const row={frame,method,mapError,ending: false,work: null};
		if(method.callbacks?.length)
		{
			const abort=error => {
			// Reject this task only; retain its completion notification until native drain.
				row.ending=true; row.callbacks.close(); frame.call(op.cancel); settle(row.work,"reject",error);
			};
			row.callbacks=createWasmTaskCallbacks({method,args,frame,notifications,retire,abort});
		}
		row.drain=new Promise(resolve => { row.drained=resolve; }); rows.add(row);
		if(method.delivery==="task") return observe(row,() => frame.call(op.start),false);
		try
		{ frame.call(op.start); } catch(error)
		{ drop(row); throw error; }
		const iterator = {
			/** Return this same single-pass iterator. */
			[Symbol.asyncIterator]() { return this; }
			, next: async () => {
				if(state==="poisoned") throw cause;
				if(row.ending) return {done: true,value: undefined};
				if(row.work) throw new Error("Lean iterator already has an outstanding pull");
				return observe(row,() => frame.call(op.pull),true);
			}
			, return: async value => {
				await end(row);
				if(state==="poisoned") throw cause;
				return {done: true,value};
			}
		};
		return Object.freeze(iterator);
	};
	const bind = (abi,invoke) => {
		assertOpen();
		const entries=new Map(abi.methods.map((m,i) => [m.id,{m,i}]));
		const leaseTypes=new Map();
		for(const [i,r] of (abi.leases ?? []).entries())
		{ leases.register(r,abi.methods.length+i,invoke); leaseTypes.set(r.type,r); }
		const invokePublic=(id,args,translate) => {
			const entry=entries.get(id); if(!entry) throw new TypeError("Unknown Lean task method");
			const mapError = e => {
				if(!translate || e?.code!=="declared-error") return e;
				try
				{ return translate(e); } catch(error)
				{ return error; }
			};
			try
			{ return dispatch(entry.m,entry.i,invoke,args,mapError,leaseTypes); } catch(error)
			{ throw mapError(error); }
		};
		return Object.freeze({invoke: invokePublic,resourceClass: type => leaseTypes.has(type) ? leases.resourceClass(type) : undefined});
	};
	const close = () => {
		if(closing) return closing;
		if(state==="poisoned") return Promise.reject(cause);
		state="closing";
		const {promise,resolve,reject}=Promise.withResolvers(); closing=promise;
		try
		{
			for(const row of rows) end(row);
			notifications.whenIdle().then(() => {
				if(state==="poisoned") throw cause;
				try
{
					leases.finish();
					if(rows.size || ledger.size || domain.snapshot().live || options.nativeOwners?.())
						throw new Error("Lean task runtime did not drain");
} catch(error)
{ return retire(error); }
				domain.shutdown(); state="closed"; stop();
			}).then(resolve,reject);
		}
		catch(error)
		{ reject(error); }
		return promise;
	};
	return Object.freeze({bind,close,retire,snapshot: () => ({state,frames: rows.size,allocations: ledger.size,pending: domain.snapshot().live})});
};
