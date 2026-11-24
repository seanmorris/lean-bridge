/** @file Idiomatic Promise and async-iterator delivery over a runtime-owned, notification-driven Wasm scheduler. */
import {PendingOperationRegistry} from "./pending-operations.mjs";
import {isWasmTaskDeclaredFailure,openWasmTaskFrame,phpTaskCallbackFailure,wasmHostThrown} from "./wasm-task-frames.mjs";
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
	let state = "open", closing, stopped = false, cause,hostRuntime;
	const hostScopes=new Set();
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
			hostRuntime?.abandon();hostScopes.clear();
			for(const row of rows)
			{
				row.work?.sub.detach();
				row.callbacks?.close();
				if(row.work) settle(row.work,"reject",failure);
				row.work=null; row.ending=true; row.frame.dispose(); row.drained(false);
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
		{ row.frame.dispose(); row.drained(state!=="poisoned"); }
	};
	const cancel = p => !p.settled && !p.taking && settle(p,"cancel","Lean operation cancelled");
	const end = row => {
		row.ending=true;
		if(row.work) cancel(row.work); else drop(row);
		return row.drain;
	};
	const observe = (row,start,cursor,syncStart=false) => {
		const p={settled: false}, done = () => {
			try
			{
				if(row.host && !row.host.open && !p.settled) cancel(p);
				// Taking terminal ownership wins before lifting an application
				// object can run a reentrant prototype check on this agent.
				p.taking=true;
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
			{ row.work=null;if(row.host && live()) hostRuntime.collect(); }
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
			// PHP throws a failed factory before handing the caller an awaitable.
			// Drain the already reserved private Promise; JS callers still receive it.
			if(syncStart && p.promise) p.promise.catch(() => {});
			try
			{ drop(row); } finally
			{ if(p.promise) settle(p,"reject",syncStart ? error : row.mapError(error)); }
			if(!p.promise || syncStart) throw error;
		}
		if(!cursor) Object.defineProperty(p.promise,"cancel",{value: () => cancel(p)});
		if(syncStart && !cursor) Object.defineProperty(p.promise,"drained",{value: row.drain});
		if(syncStart && row.method.callbacks?.length)
		{
			Object.defineProperty(p.promise,"callbackFailure",{value: phpTaskCallbackFailure});
			Object.defineProperty(p.promise,"hostTrap",{value: ()=>{
				try
				{retire(new Error("PHP callback trapped"));} catch { /* Already delivered to the whole session. */ }
			}});
		}
		return p.promise;
	};
	const dispatch = (method,index,invoke,args,mapError,leaseTypes,syncStart,host) => {
		assertOpen();host?.assertOpen();
		const frame=openWasmTaskFrame({...context,leases,leaseTypes,host},invoke,method,index,args);
		try
		{host?.assertOpen();} catch(error)
		{frame.dispose();throw error;}
		if(!method.delivery)
		{
			try
			{ return frame.call(op.start).value; } finally
			{ frame.dispose(); }
		}
		const row={frame,method,mapError,host,ending: false,work: null};
		if(method.callbacks?.length)
		{
			const abort=error => {
			// Reject this task only; retain its completion notification until native drain.
				row.ending=true; row.callbacks.close(); frame.call(op.cancel); settle(row.work,"reject",error);
			};
			row.callbacks=createWasmTaskCallbacks({method,args,frame,notifications,retire,abort,admitted: ()=>!host || host.open});
		}
		row.drain=new Promise(resolve => { row.drained=resolve; }); rows.add(row);
		if(method.delivery==="task") return observe(row,() => frame.call(op.start),false,syncStart);
		try
		{ frame.call(op.start); } catch(error)
		{ drop(row); throw error; }
		const iterator = {
			/** Return this same single-pass iterator. */
			[Symbol.asyncIterator]() { return this; }
			, next: async () => {
				if(state==="poisoned") throw cause;
				if(row.ending || host && !host.open) return {done: true,value: undefined};
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
	const bind = (abi,invoke,model) => {
		assertOpen();
		const entries=new Map(abi.methods.map((m,i) => [m.id,{m,i}]));
		const leaseTypes=new Map();
		for(const [i,r] of (abi.leases ?? []).entries())
		{ leases.register(r,abi.methods.length+i,invoke); leaseTypes.set(r.type,r); }
		const invokePublic=(id,args,translate,syncStart,host) => {
			const entry=entries.get(id); if(!entry) throw new TypeError("Unknown Lean task method");
			const mapError = e => {
				if(wasmHostThrown.has(e)) return wasmHostThrown.get(e).error;
				if(!translate || !isWasmTaskDeclaredFailure(e)) return e;
				try
				{ return translate(e); } catch(error)
				{ return error; }
			};
			try
			{ return dispatch(entry.m,entry.i,invoke,args,mapError,leaseTypes,syncStart,host); } catch(error)
			{ throw mapError(error); }
		};
		if(model)
		{
			hostRuntime??=options.installHost({assertOpen,poison: retire});
			const defs=new Map(abi.hostKinds.map(r=>[r.type,{...r,local: r.index,index: abi.methods.length+(abi.leases?.length??0)+r.index,invoke}]));
			let prepared=false;
			const bindClasses=(classes,translate,syncStart,memberBridge)=>{
				assertOpen();
				// The first public call may pin a JS argument before Lean has run,
				// or the application may dispose without ever invoking an export.
				if(!prepared && defs.size)
				{leases.prepareHost(defs.values().next().value);prepared=true;}
				const session=hostRuntime.bind(abi.componentIdentity,model,classes,memberBridge);
				const host={session,defs,takeError: hostRuntime.takeError,open: true
					, assertOpen: ()=>{if(!host.open)throw new Error("JavaScript task host binding is closed");}};
				let disposing;
				host.dispose=()=>{
					if(disposing) return disposing;
					host.open=false;session.disable();
					disposing=Promise.resolve().then(async()=>{
						if(state==="poisoned") throw cause;
						await Promise.all([...rows].filter(r=>r.host===host).map(end));
						if(state==="poisoned") throw cause;
						try
{session.close();hostRuntime.collect();} catch(error)
{retire(error);}
						hostScopes.delete(host);
					});
					return disposing;
				};
				hostScopes.add(host);
				const bound=Object.create(null);
				for(const m of abi.methods) bound[m.name]=(...args)=>{
					try
					{return invokePublic(m.id,args,translate,syncStart,host);}
					finally
					{if(live()) hostRuntime.collect();}
				};
				bound.dispose=host.dispose;return Object.freeze(bound);
			};
			const constructors=model.zend?{withZendOwner: (classes,translate,bridge)=>{
				if(typeof bridge!=="function") throw new TypeError("Missing Zend owner dispatch");
				return bindClasses(classes,translate,true,bridge);
			}}:{withHosts: (classes,translate)=>bindClasses(classes,translate,false)
				, withHostsAndSynchronousStart: (classes,translate)=>bindClasses(classes,translate,true)};
			return Object.freeze({...constructors
				, resourceClass: type=>leaseTypes.has(type)?leases.resourceClass(type):undefined});
		}
		return Object.freeze({invoke: (id,args,translate)=>invokePublic(id,args,translate,false)
			, invokeWithSynchronousStart: (id,args,translate)=>invokePublic(id,args,translate,true)
			, resourceClass: type => leaseTypes.has(type) ? leases.resourceClass(type) : undefined});
	};
	const close = () => {
		if(closing) return closing;
		if(state==="poisoned") return Promise.reject(cause);
		state="closing";
		const {promise,resolve,reject}=Promise.withResolvers(); closing=promise;
		try
		{
			const scopes=[...hostScopes].map(h=>h.dispose());
			for(const row of rows) if(!row.host) end(row);
			Promise.all([notifications.whenIdle(),...scopes]).then(() => {
				if(state==="poisoned") throw cause;
				try
{
					leases.finish();
					if(rows.size || ledger.size || domain.snapshot().live || options.nativeOwners?.())
						throw new Error("Lean task runtime did not drain");
} catch(error)
{ return retire(error); }
				domain.shutdown(); state="closed"; stop();
				// No native work can reenter the owner after shutdown. Release any
				// host exception still retained solely by private Lean module state.
				hostRuntime?.abandon();
			}).then(resolve,reject);
		}
		catch(error)
		{ reject(error); }
		return promise;
	};
	return Object.freeze({bind,close,retire
		, snapshot: () => ({state,frames: rows.size,allocations: ledger.size
			, pending: domain.snapshot().live
			, ...hostRuntime?{hostPins: hostRuntime.live(),hostErrors: hostRuntime.heldErrors()}:{} })});
};
