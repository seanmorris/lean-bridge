/** @file Marshal synchronous wasm32 calls without exposing Lean pointers or flattening Except. */
import { scalarCopyLimit, validateComponentScalar } from "../abi/component-scalars.mjs";

const magic = 0x4a53494f, clear = 0xffffffff;
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8",{fatal: true,ignoreBOM: true});
const limit = ()=>new RangeError("Synchronous IO copy budget exceeded");
const word = n=>BigInt.asUintN(64,BigInt(n));
const malformed = ()=>new Error("Malformed synchronous Lean IO reply");
const data = m=>new DataView(m.HEAP8.buffer);
const integerHex = v=>(v<0n?-v:v).toString(16);
const encode = (m,offset,type,input,alloc)=>{
	const v = validateComponentScalar(type,input);
	let bits=0n, count=0, sign=0;
	if(type==="string" || type==="bytes")
	{
		if((type==="string"?v.length:v.byteLength)>scalarCopyLimit) throw limit();
		const bytes = type==="string"?encoder.encode(v):v;
		count=bytes.byteLength; const p=alloc(count); m.HEAP8.set(bytes,p); bits=BigInt(p);
	}
	else if(type==="nat" || type==="int")
	{
		const hex=integerHex(v); count=v===0n?0:Math.ceil(hex.length/16);
		const p=alloc(8*count), view=data(m);
		for(let i=0,end=hex.length;i<count;i++,end-=16) view.setBigUint64(p+8*i,BigInt("0x"+hex.slice(Math.max(0,end-16),end)),true);
		bits=BigInt(p); sign=Number(v<0n);
	}
	else if(type==="float64" || type==="float32")
	{
		if(type==="float64") data(m).setFloat64(offset,v,true); else data(m).setFloat32(offset,v,true);
		return;
	}
	else if(type!=="unit") bits=word(type==="char"?v.codePointAt(0):v);
	const view=data(m); view.setBigUint64(offset,bits,true); view.setBigUint64(offset+8,BigInt(count),true); view.setBigUint64(offset+16,BigInt(sign),true);
};

const decode = (m,p,type,live,charge)=>{
	const d=data(m), bits=d.getBigUint64(p,true), n=d.getBigUint64(p+8,true), sign=d.getBigUint64(p+16,true), tag=d.getBigUint64(p+24,true);
	const wide=type==="nat" || type==="int", buffer=type==="string" || type==="bytes";
	if(wide || buffer)
	{
		const stride=wide?8:1;
		if(tag!==BigInt(wide?2:1) || bits>0xffffffffn || n>0xffffffffn || sign>BigInt(type==="int"?1:0) || (!n && sign)) throw malformed();
		const base=Number(bits), count=Number(n), size=count*stride;
		// Both byte buffers and limb arrays come from malloc, even though a byte
		// may be read unaligned. Never hand an unaligned address back to free.
		if((size && !base) || base%8 || (base && base>=d.byteLength) || base+size>d.byteLength
			|| (base && live.some(([a,s])=>base<a+s && base+Math.max(1,size)>a))) throw malformed();
		if(wide && count && !d.getBigUint64(base+size-8,true)) throw malformed();
		charge(size);
		if(buffer)
		{
			const b=new Uint8Array(d.buffer,base,size);
			if(type==="bytes") return b.slice();
			return decoder.decode(b);
		}
		if(!count) return 0n;
		const hex=new Array(count);
		for(let i=0;i<count;i++) hex[count-1-i]=d.getBigUint64(base+8*i,true).toString(16).padStart(16,"0");
		const value=BigInt("0x"+hex.join("")); return sign?-value:value;
	}
	if(n || sign || tag) throw malformed();
	if(type==="unit")
	{ if(bits) throw malformed(); return undefined; }
	if(type==="bool")
	{ if(bits>1n) throw malformed(); return bits===1n; }
	if(type==="char")
	{ if(bits>0x10ffffn || (bits>=0xd800n && bits<=0xdfffn)) throw malformed(); return String.fromCodePoint(Number(bits)); }
	if(type==="float64") return d.getFloat64(p,true);
	if(type==="float32")
	{ if(bits>0xffffffffn) throw malformed(); return d.getFloat32(p,true); }
	const value=type.startsWith("int") || type==="isize"?BigInt.asIntN(64,bits):bits;
	return validateComponentScalar(type,type.endsWith("64")?value:Number(value));
};

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
