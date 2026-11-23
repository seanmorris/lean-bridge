/** @file Private marshalling and ownership checks for compiled Wasm tasks and cursors. */
import {scalarCopyLimit,validateComponentScalar} from "../abi/component-scalars.mjs";
import {taskFrame as layout} from "../abi/wasm-task-frame.mjs";
import {encodeWasmWord,decodeWasmWord} from "../release/wasm-word-codecs.mjs";

const invalid = () => new Error("Malformed Lean task frame");
const knownIO = id => id === "error:IO.Error" || id === "error:TaskIO.Error";
const failed = (id,phase,value) => Object.assign(new Error(knownIO(id) ? value : "Lean raised "+id),{
	code: "declared-error",details: {errorId: id,phase,payload: value}
});

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
	for(const [k,type] of method.args.entries()) validateComponentScalar(type,args[k]);
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
		disposed = true; freeTo(0);
	};
	try
	{
		f = alloc(size); m.HEAP8.fill(0,f,f+size);
		view().setUint32(f,layout.magic,true); view().setUint32(f+4,size,true); view().setUint32(f+8,index,true);
		for(const [i,t] of method.args.entries()) encodeWasmWord(m,f+layout.args+24*i,t,args[i],alloc);
	} catch(error)
	{ dispose(); throw error; }
	const raw = (op,token) => {
		if(disposed || !isLive()) throw new Error("Lean task frame is closed");
		const d = view(); d.setUint32(f+12,op,true); d.setUint32(f+16,token,true);
		const s = native(() => invoke(f)), h = view();
		if(h.getUint32(f,true)!==layout.magic || h.getUint32(f+4,true)!==size || h.getUint32(f+8,true)!==index
			|| h.getUint32(f+12,true)!==op || h.getUint32(f+16,true)!==token || h.getUint32(f+20,true)
			|| !Number.isInteger(s) || s<0 || s>12) retire(invalid());
		return s;
	};
	const call = (op,token=0) => {
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
		const errorId = start ? method.startId : take ? method.terminalId : null;
		const declared = errorId && s === (knownIO(errorId)?4:3);
		const value = !s && (take || (start && !method.delivery));
		try
		{
			if(!declared && !value)
			{
				if(m.HEAP8.subarray(f+layout.out,f+layout.args).some(Boolean) || m.HEAP8.subarray(f+tags,f+size).some(Boolean)) retire(invalid());
				if(!s || (take && s===2 && cursor)) return {done: s===2};
				if((start || take) && [11,12].includes(s)) throw new RangeError("Lean task resource limit ("+s+")");
				return retire(new Error("Unexpected Lean task control status "+s+" for "+method.id));
			}
			let type = declared ? start ? method.error : method.terminal : method.result;
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
			{ result=decodeWasmWord(m,f+layout.out,type,{some},n => { if(n>scalarCopyLimit-used) over=true; charge(n); }); }
			catch(error)
			{ if(!over) return retire(error); clear(); throw error; }
			clear(); for(const key of wrap.reverse()) result={[key]: result};
			if(declared) throw failed(errorId,start ? method.delivery ? "factory" : "call" : cursor ? "step" : "task",result);
			return {value: result,done: false};
		}
		finally
		{
			if(start) freeTo(1); // All copied inputs have become Lean values.
			used=size; // The return budget is per call/pull, not per iterator lifetime.
		}
	};
	return {call,dispose,hasOwner: () => Boolean(handle)};
};
