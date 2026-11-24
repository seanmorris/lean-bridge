/** @file Bind generated member calls to the JS owner of one pthread heap. */
import {createWasmHostDomain} from "./wasm-host-domain.mjs";
import {taskHostOwnerExports} from "../abi/wasm-task-frame.mjs";
import {createWasmHostErrorStore,createWasmHostWire} from "./wasm-host-wire.mjs";

/**
 * Installation is private to the task loader. The synchronous stack below
 * exists only while executing a member on this agent. Suspended Lean tasks
 * are never represented by an ambient current JS invocation.
 *
 * @param wasm - Initialized runtime with the threaded host-module ABI.
 * @param lifecycle - Optional owning session's open/poison guards.
 */
export const installWasmTaskHostMembers=(wasm,lifecycle)=>{
	if(taskHostOwnerExports.some(name=>typeof wasm["_"+name]!=="function")
		|| Object.hasOwn(wasm,"lbJshDomainV1") || Object.hasOwn(wasm,"lbJstHostCallsV1"))
		throw new Error("Expected a fresh threaded host runtime");
	const bindings=new Map(), stack=[], errors=createWasmHostErrorStore();
	let faulted=false;
	const arena=createWasmHostDomain(k=>{if(wasm._lb_jst_retire_v1(k)!==1) throw new Error("Cannot retire threaded host kind");});
	const abandon=()=>{
		if(faulted) return false;
		faulted=true;bindings.clear();stack.length=0;arena.abandon();errors.clear();
		return true;
	};
	const fault=cause=>{
		if(!abandon()) return;
		// Return to the Emscripten proxy before the session stops workers.
		queueMicrotask(()=>{try
		{lifecycle?.poison?.(cause);} catch { /* A retired session may rethrow its cause. */ }});
	};
	const guard={assertOpen: ()=>{
		if(faulted) throw new Error("Threaded host heap was retired");
		lifecycle?.assertOpen?.();
	}
	, poison: fault};
	const current=()=>{
		const row=stack.at(-1);
		if(!row) throw new Error("Host member outside its owner frame");
		return row;
	};
	const bind=(id,model,classes)=>{
		if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(id) || bindings.has(id)) throw new Error("Invalid or duplicate threaded host component");
		const session=arena.bind(model,classes);
		let wire;
		try
		{
			guard.assertOpen();
			// Capturing a constructor may re-enter withHosts for this component.
			if(bindings.has(id)) throw new Error("Duplicate threaded host component");
			wire=createWasmHostWire(wasm,model,session.classes,session,guard);
		}
		catch(error)
		{session.close();throw error;}
		const row={session,wire,enabled: true};
		bindings.set(id,row);
		const close=()=>{
			const closed=session.close();if(closed) bindings.delete(id);return closed;
		};
		return Object.freeze({...session,disable: ()=>{row.enabled=false;},close});
	};
	const hooks=Object.freeze({
		enter: id=>{
			if(faulted) throw new Error("Threaded host heap was retired");
			const row=bindings.get(id); if(!row?.enabled) return false;
			row.session.enter();stack.push(row);return true;
		}
		, leave: ()=>{current().session.leave();stack.pop();}
		, unavailable: ()=>errors.keep({application: false,error: new Error("JavaScript host binding is closed")})
		, kind: i=>current().session.kind(i)
		, send: (...args)=>current().wire.call(...args)
		, finish: p=>current().wire.finish(p)
		, record: (status,p)=>{
			const failed=p?current().wire.observed(p):null;
			if(failed && (failed.application?1:3)===status) return errors.keep(failed);
			if(status===1) throw new Error("Host exception without its owning member frame");
			return errors.keep({application: false,error: new TypeError("Invalid native JavaScript host value")});
		}
		, discard: errors.discard,copy: errors.copy
		, fault
	});
	Object.defineProperties(wasm,{
		lbJshDomainV1: {value: Object.freeze({attach: arena.attach,detach: arena.detach,strong: arena.strong})}
		, lbJstHostCallsV1: {value: hooks}
	});
	const collect=()=>{
		if(faulted) return;
		try
		{wasm._lb_jst_collect_v1();}
		catch(error)
		{abandon();lifecycle?.poison?.(error);throw error;}
	};
	return Object.freeze({bind,abandon,takeError: errors.take
		, heldErrors: errors.size,live: arena.live,collect});
};
