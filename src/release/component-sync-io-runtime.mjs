/** @file Marshal synchronous wasm32 calls without exposing Lean pointers or flattening Except. */
import { scalarCopyLimit, validateComponentScalar } from "../abi/component-scalars.mjs";
import { encodeWasmWord as encode, decodeWasmWord as decode } from "./wasm-word-codecs.mjs";

const magic = 0x4a53494f, clear = 0xffffffff;
const limit = ()=>new RangeError("Synchronous IO copy budget exceeded");
const malformed = ()=>new Error("Malformed synchronous Lean IO reply");
const data = m=>new DataView(m.HEAP8.buffer);

/**
 * Link a checked IO descriptor to its single native control function. A Lean
 * failure owns the same copied JS payload as a normal return. An invalid
 * native envelope or Wasm trap retires the heap before any foreign cleanup.
 *
 * @param module - Shared Emscripten instance.
 * @param abi - Reconstructed synchronous private ABI.
 * @param invoke - Single component control entry.
 * @param lifecycle - Shared assertOpen and permanent poison hooks.
 */
export const bindJavaScriptIO = (module,abi,invoke,lifecycle)=>{
	const methods=new Map(abi.methods.map((m,i)=>[m.id,{...m,i}]));
	const call=(id,args)=>{
		lifecycle.assertOpen(); const method=methods.get(id);
		if(!method || !Array.isArray(args) || args.length!==method.args.length) throw new TypeError("Unknown synchronous IO declaration or wrong arity");
		for(const [i,t] of method.args.entries()) validateComponentScalar(t,args[i]);
		const live=[]; let used=0, unsafe=false, owned=false, f=0, error, failed=false, result;
		const retire=e=>{ unsafe=true; lifecycle.poison(); throw e; };
		const native=op=>{ try
		{ lifecycle.assertOpen(); const v=op(); lifecycle.assertOpen(); return v; } catch(e)
		{ return retire(e); } };
		const charge=n=>{ if(!Number.isSafeInteger(n) || n<0 || n>scalarCopyLimit-used) throw limit(); used+=n; };
		const alloc=n=>{
			const size=Math.max(1,n); charge(size); const p=native(()=>module._malloc(size))>>>0;
			if(!p) throw new Error("JavaScript IO allocation failed");
			if(p%8 || p+size>module.HEAP8.byteLength || live.some(([a,s])=>p<a+s && p+size>a)) retire(new Error("Invalid JavaScript IO allocation"));
			live.push([p,size]); return p;
		};
		const size=48+24*args.length+method.tagBytes, tags=48+24*args.length;
		try
		{
			f=alloc(size); module.HEAP8.fill(0,f,f+size);
			const h=data(module); h.setUint32(f,magic,true); h.setUint32(f+4,size,true); h.setUint32(f+12,method.i,true);
			for(const [i,t] of method.args.entries()) encode(module,f+48+24*i,t,args[i],alloc);
			const status=native(()=>invoke(f)), d=data(module);
			if(d.getUint32(f,true)!==magic || d.getUint32(f+4,true)!==size || d.getUint32(f+12,true)!==method.i || status!==d.getUint32(f+8,true)) retire(malformed());
			const declared=method.errorId && status===(method.errorId==="error:IO.Error"?4:3);
			if(status!==0 && !declared)
			{
				if(![5,9,10,11,12].includes(status) || module.HEAP8.subarray(f+16,f+48).some(Boolean) || module.HEAP8.subarray(f+tags,f+size).some(Boolean)) retire(malformed());
				throw new Error("Lean bridge failure in "+id+" (status "+status+")");
			}
			let type=declared?method.error:method.result;
			const branches=[]; let ix=0;
			while(Array.isArray(type))
			{
				const b=d.getUint8(f+tags+ix++); if(b>1) retire(malformed());
				branches.push(b?"ok":"error"); type=type[b?0:1];
			}
			while(ix<method.tagBytes) if(d.getUint8(f+tags+ix++)) retire(malformed());
			let over=false;
			try
			{ result=decode(module,f+16,type,live,n=>{ if(n>scalarCopyLimit-used)
			{ over=true; throw limit(); } charge(n); }); }
			catch(e)
			{ if(!over) retire(e); owned=true; throw e; }
			owned=true;
			for(const key of branches.reverse()) result={[key]: result};
			if(declared) throw Object.assign(new Error(method.errorId==="error:IO.Error"?result:"Lean raised "+method.errorId),{code: "declared-error",details: {errorId: method.errorId,payload: result}});
		}
		catch(e)
		{ failed=true; error=e; }
		finally
		{
			if(owned && !unsafe)
			{
				data(module).setUint32(f+12,clear,true);
				if(native(()=>invoke(f))!==0 || data(module).getUint32(f+8,true)!==0 || module.HEAP8.subarray(f+16,f+48).some(Boolean))
					retire(new Error("Could not release synchronous IO result"));
			}
			if(!unsafe) for(const [p] of live.reverse()) native(()=>module._free(p));
		}
		if(failed) throw error;
		return result;
	};
	return Object.freeze({call});
};
