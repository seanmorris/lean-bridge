/** @file Private marshalling and ownership checks for compiled Wasm tasks and cursors. */
import {scalarCopyLimit,validateComponentScalar} from "../abi/component-scalars.mjs";
import {taskFrame as layout} from "../abi/wasm-task-frame.mjs";
import {encodeWasmWord,decodeWasmWord} from "../release/wasm-word-codecs.mjs";

const invalid = () => new Error("Malformed Lean task frame");
const phpFailureMessages=new WeakMap();
// An arbitrary thrown JS value may have hostile getters (or be undefined).
// Unwrap only at the public boundary, before inspecting ordinary error codes.
export const wasmHostThrown=new WeakMap();
// Only a decoded failure frame may invoke the package's declared-error
// translator. An application exception (or native trap) may itself expose
// a "code" property with the same spelling or an observable getter.
const declaredFailures=new WeakSet();
/**
 * Check a failure's private identity without consulting application properties.
 *
 * @param value - A caught value from either side of the boundary.
 */
export const isWasmTaskDeclaredFailure=value=>declaredFailures.has(value);
/**
 * Brand a copied message without inspecting arbitrary JS exceptions or their getters.
 *
 * @param message - Bounded UTF-8 text already checked by the PHP transport.
 */
export const phpTaskCallbackFailure=message=>{
	const marker=new Error("PHP callback failed");
	phpFailureMessages.set(marker,typeof message==="string" && message.length<=4096 ? message : "PHP callback failed");
	return marker;
};
/** A valid callback request exceeded the bounded resources of its task. */
export class WasmTaskCallbackLimit extends RangeError {}
const knownIO = id => id === "error:IO.Error" || id === "error:TaskIO.Error";
const failed = (id,phase,value,io=knownIO(id)) => {
	const error=Object.assign(new Error(io ? value : "Lean raised "+id),{
		code: "declared-error",details: {errorId: id,phase,payload: value}
	});
	declaredFailures.add(error);return error;
};

/**
 * Allocate and use an authenticated declaration's frame. Every JS-owned
 * allocation is tracked across the shared runtime, not merely the current call.
 *
 * @param context - Module, runtime-wide address ledger, live check and retirement callback.
 * @param invoke - The component's private native control.
 * @param method - Reconstructed binding method.
 * @param index - Checked declaration ordinal.
 * @param args - Public JS arguments.
 */
export const openWasmTaskFrame = (context,invoke,method,index,args) => {
	const {module: m,ledger,retire,isLive} = context;
	if(args.length !== method.args.length) throw new TypeError("Wrong arity for "+method.id);
	const lease=t => typeof t==="string" && t.startsWith("lease:");
	const host=t=>typeof t==="string" && t.startsWith("host:");
	const borrowed=[];
	const releaseInputs=()=>{while(borrowed.length)context.leases.releaseHost(borrowed.pop());};
	const inputs=method.args.map((type,i) => {
		if(type==="callback")
{
			if(typeof args[i]!=="function") throw new TypeError("Expected a JavaScript callback for "+method.id);
			return null;
}
		return host(type)?null:lease(type) ? context.leases.live(args[i],type) : (validateComponentScalar(type,args[i]),null);
	});
	const view = () => new DataView(m.HEAP8.buffer);
	const native = fn => {
		if(!isLive()) throw new Error("Lean task runtime is retired");
		try
		{ return fn(); } catch(error)
		{ return retire(error); }
	};
	const some = fn => { for(const entry of ledger) if(fn(entry)) return true; return false; };
	const own = []; let used = 0, f = 0, disposed = false, domain = 0n, handle = 0n;
	const charge = bytes => {
		if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > scalarCopyLimit - used) throw new RangeError("Lean task copy budget exceeded");
		used += bytes;
	};
	const alloc = n => {
		const size = Math.max(1,n); charge(size);
		const p = native(() => m._malloc(size)) >>> 0;
		if(!p) throw new Error("Lean task allocation failed");
		if(p % 8 || p + size > m.HEAP8.length || some(([a,s]) => p < a+s && p+size > a)) retire(invalid());
		ledger.set(p,size); own.push(p); return p;
	};
	const freeTo = length => {
		while(own.length > length)
		{
			const p = own.pop(); ledger.delete(p);
			if(isLive()) native(() => m._free(p));
		}
	};
	const tags = layout.args + method.args.length*24, size = tags + method.tagBytes;
	const dispose = () => {
		if(disposed) return;
		disposed = true;try
		{releaseInputs();} finally
		{freeTo(0);}
	};
	try
	{
		f = alloc(size); m.HEAP8.fill(0,f,f+size);
		view().setUint32(f,layout.magic,true); view().setUint32(f+4,size,true); view().setUint32(f+8,index,true);
		for(const [i,t] of method.args.entries())
		{
			const pos=f+layout.args+24*i;
			let row=inputs[i];
			if(host(t))
			{row=context.leases.pinHost(context.host.defs.get(t),context.host.session,args[i]);borrowed.push(row);}
			if(row)
			{ view().setBigUint64(pos,row.id,true); view().setBigUint64(pos+8,row.domain,true); }
			else if(t!=="callback") encodeWasmWord(m,pos,t,args[i],alloc);
		}
	} catch(error)
	{ dispose(); throw error; }
	const raw = (op,token) => {
		if(disposed || !isLive()) throw new Error("Lean task frame is closed");
		const d = view(); d.setUint32(f+12,op,true); d.setUint32(f+16,token,true);
		const s = native(() => invoke(f)), h = view();
		if(h.getUint32(f,true)!==layout.magic || h.getUint32(f+4,true)!==size || h.getUint32(f+8,true)!==index
			|| h.getUint32(f+12,true)!==op || h.getUint32(f+16,true)!==token || h.getUint32(f+20,true)
			|| !Number.isInteger(s) || s<0 || !(s<=12 || method.callbacks && op===layout.take && [13,14].includes(s)
				|| s===15 && context.host && [layout.start,layout.take].includes(op))) retire(invalid());
		return s;
	};
	const hostFailures=new Map(), slots=new Map((method.callbacks ?? []).map(([i,arg,reply]) => [i,{arg,reply}]));
	const callbackOp=(op,token=0) => {
		const status=raw(op,token), d=view();
		if(!handle || d.getBigUint64(f+24,true)!==handle || d.getBigUint64(f+32,true)!==domain
			|| m.HEAP8.subarray(f+tags,f+size).some(Boolean)) return retire(invalid());
		return status;
	};
	const blankOut=() => m.HEAP8.fill(0,f+layout.out,f+layout.args);
	const checkedOut=(offset=0) => {
		if(m.HEAP8.subarray(f+layout.out+offset,f+layout.args).some(Boolean)) retire(invalid());
	};
	const readHost=(type,discard=false)=>{
		const d=view(),pos=f+layout.out,def=context.host.defs.get(type);
		const key=d.getBigUint64(pos,true),dom=d.getBigUint64(pos+8,true);
		if(!def || !key || !dom || d.getBigUint64(pos+16,true) || d.getBigUint64(pos+24,true)!==BigInt(def.tag)) return retire(invalid());
		if(!discard) return context.leases.resolveHost(def,context.host.session,key,dom,blankOut,error=>{
			const marker=new Error("Application object no longer matches the declared class");wasmHostThrown.set(marker,{error});throw marker;
		});
	};
	const request=admit => {
		checkedOut(); const status=callbackOp(layout.next);
		if(status===1)
		{ checkedOut(); return null; }
		if(status) return retire(invalid());
		checkedOut(4); const slot=view().getUint32(f+layout.out,true), type=slots.get(slot); blankOut();
		if(!type) return retire(invalid());
		// A refused registration needs no argument lift (which, for a host
		// object, can itself run application code). The port still gets a reply.
		if(admit && !admit(slot)) return {slot,refused:true};
		const statusArg=callbackOp(layout.arg,slot);
		if([11,12].includes(statusArg))
		{ checkedOut(); throw new WasmTaskCallbackLimit("Lean callback argument exceeds task resources"); }
		if(statusArg) return retire(invalid());
		let value;
		let over=false;
		try
		{ value=host(type.arg)?readHost(type.arg):decodeWasmWord(m,f+layout.out,type.arg,{some},n => { if(n>scalarCopyLimit-used) over=true; charge(n); }); }
		catch(error)
		{
			if(!over && !wasmHostThrown.has(error)) return retire(error);
			if(callbackOp(layout.clear)) return retire(invalid());
			checkedOut(); used=size;
			if(wasmHostThrown.has(error)) throw error;
			throw new WasmTaskCallbackLimit("Lean callback argument exceeds copy budget");
		}
		if(callbackOp(layout.clear)) return retire(invalid());
		checkedOut(); used=size; return {slot,value};
	};
	const answer=(slot,ok,value,accept=()=>true) => {
		const type=slots.get(slot); if(!type) return retire(invalid());
		const pos=f+layout.args; checkedOut(); m.HEAP8.fill(0,pos,pos+24);
		let pinned;
		try
		{
			if(ok)
			{
				try
				{
					if(host(type.reply))
					{
						pinned=context.leases.pinHost(context.host.defs.get(type.reply),context.host.session,value);
						view().setBigUint64(pos,pinned.id,true);view().setBigUint64(pos+8,pinned.domain,true);
					} else encodeWasmWord(m,pos,type.reply,value,alloc);
				}
				catch(error)
				{
					// A bad JS value or oversized reply fails this callback, not the heap.
					if(!isLive() || !host(type.reply) && !(error instanceof RangeError || error instanceof TypeError)) throw error;
					freeTo(1); used=size; ok=false; value=error;
					m.HEAP8.fill(0,pos,pos+24);
				}
			}
			// A proxy's prototype trap may have cancelled the callback while
			// validating its reply. Never send a reply to a retired request.
			if(!accept()) return;
			if(ok)
			{
				if(callbackOp(layout.reply,slot)) return retire(invalid()); checkedOut();
			} else
			{
				encodeWasmWord(m,pos,"string",phpFailureMessages.get(value)??"JavaScript callback failed",alloc);
				const status=callbackOp(layout.fail);
				if([11,12].includes(status))
				{ checkedOut(); throw new WasmTaskCallbackLimit("Lean callback failure retention limit reached"); }
				if(status) return retire(invalid());
				checkedOut(4); const id=view().getUint32(f+layout.out,true); blankOut();
				if(!id || id>4096 || hostFailures.has(id)) return retire(invalid());
				hostFailures.set(id,value);
			}
		} finally
		{ try
		{if(pinned) context.leases.releaseHost(pinned);} finally
		{freeTo(1);used=size;} }
	};
	const call = (op,token=0,discard=false) => {
		// The generated C calls emit only active result tags. Never reuse a tag
		// left by a previous cursor element, especially for nested Except.
		if(disposed || !isLive()) throw new Error("Lean task frame is closed");
		m.HEAP8.fill(0,f+tags,f+size);
		const s = raw(op,token), d = view(), id = d.getBigUint64(f+24,true), dom = d.getBigUint64(f+32,true);
		const start = op === layout.start, take = op === layout.take, cursor = method.delivery === "async-iterator";
		const consumed = (take && (s===0 ? !cursor : ![1,8].includes(s))) || (op === layout.close && s===0);
		if(start ? (method.delivery && !s ? !id || !dom : id!==0n || dom!==0n)
			: dom!==domain || id!==(consumed ? 0n : handle)) retire(invalid());
		handle=id; domain=dom;
		const factory=start || (take && method.callbacks && [3,13].includes(s));
		const errorId = factory ? method.startId : take ? method.terminalId : null;
		const io=knownIO(errorId) || take && cursor && method.stepIO;
		const declared = errorId && s === (io?(take && factory ? 13 : 4):3);
		const value = !s && (take || (start && !method.delivery));
		try
		{
			if(s===15)
			{
				const pos=f+layout.out,key=d.getBigUint64(pos,true),phase=Number(d.getBigUint64(pos+8,true));
				if(!key || key>0xffffffffn || m.HEAP8.subarray(f+tags,f+size).some(Boolean)
					|| !(start && phase===(method.delivery?2:1) && method.effect==="IO"
					|| take && (phase===2 && method.callbacks && method.effect==="IO" || phase===3 && knownIO(method.terminalId) || phase===4 && method.stepIO))) return retire(invalid());
				checkedOut(16);blankOut();
				let failure;try
				{failure=context.host.takeError(Number(key));} catch(error)
				{return retire(error);}
				if(failure.application && !method.hostPhases?.[phase===4?"pull":"call"]?.length) return retire(invalid());
				if(discard) return {done: true};
				const marker=new Error("JavaScript host member failed");wasmHostThrown.set(marker,failure);throw marker;
			}
			if(take && method.callbacks && s===14)
			{
				const key=d.getBigUint64(f+layout.out,true), phase=d.getBigUint64(f+layout.out+8,true);
				if(key<1n || key>4096n || ![2n,3n].includes(phase) || (!discard && !hostFailures.has(Number(key)))) return retire(invalid());
				checkedOut(16); blankOut();
				if(discard) return {done: true};
				throw failed(method.callbackError??"error:JavaScriptCallbackError",phase===2n ? "factory" : "task",hostFailures.get(Number(key)));
			}
			if(!declared && !value)
			{
				if(m.HEAP8.subarray(f+layout.out,f+layout.args).some(Boolean) || m.HEAP8.subarray(f+tags,f+size).some(Boolean)) retire(invalid());
				if(!s || (take && s===2 && cursor)) return {done: s===2};
				if((start || take) && [11,12].includes(s)) throw new RangeError("Lean task resource limit ("+s+")");
				return retire(new Error("Unexpected Lean task control status "+s+" for "+method.id));
			}
			let type = declared ? factory ? method.error : method.terminal : method.result;
			const wrap = []; let k=0;
			while(Array.isArray(type))
			{
				const tag=d.getUint8(f+tags+k++); if(tag>1) retire(invalid()); wrap.push(tag ? "ok" : "error"); type=type[tag?0:1];
			}
			while(k<method.tagBytes) if(d.getUint8(f+tags+k++)) retire(invalid());
			let result, over = false;
			const clear = () => {
				if(raw(layout.clear,0) || view().getBigUint64(f+24,true)!==handle || view().getBigUint64(f+32,true)!==domain
					|| m.HEAP8.subarray(f+layout.out,f+layout.args).some(Boolean)) retire(invalid());
			};
			try
			{
				if(host(type))
				{result=readHost(type,discard);} else if(lease(type))
				{
					const pos=f+layout.out, def=context.leaseTypes.get(type);
					const id=d.getBigUint64(pos,true), dom=d.getBigUint64(pos+8,true);
					if(!def || !id || !dom || d.getBigUint64(pos+16,true) || d.getBigUint64(pos+24,true)!==BigInt(def.tag)) return retire(invalid());
					if(!discard)
					{
						result=context.leases.adopt(type,id,dom);
						// The wrapper now owns the native token. Otherwise clear releases it.
						m.HEAP8.fill(0,pos,pos+32);
					}
				} else result=decodeWasmWord(m,f+layout.out,type,{some},n => { if(n>scalarCopyLimit-used) over=true; charge(n); });
			}
			catch(error)
			{ if(!over && !wasmHostThrown.has(error)) return retire(error); clear(); throw error; }
			clear(); for(const key of wrap.reverse()) result={[key]: result};
			if(declared) throw failed(errorId,factory ? method.delivery ? "factory" : "call" : cursor ? "step" : "task",result,io);
			return {value: result,done: false};
		}
		finally
		{
			if(start)
			{try
			{releaseInputs();} finally
			{freeTo(1);}} // Inputs have become Lean values.
			used=size; // The return budget is per call/pull, not per iterator lifetime.
		}
	};
	return {call,request,answer,forgetFailures: () => hostFailures.clear(),dispose,hasOwner: () => Boolean(handle)};
};
