/** @file Copied scalar and exact-integer values for synchronous and asynchronous Wasm word frames. */
import { scalarCopyLimit, validateComponentScalar } from "../abi/component-scalars.mjs";

const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8",{fatal: true,ignoreBOM: true});
const limit = ()=>new RangeError("Synchronous IO copy budget exceeded");
const word = n=>BigInt.asUintN(64,BigInt(n));
const malformed = ()=>new Error("Malformed synchronous Lean IO reply");
const data = m=>new DataView(m.HEAP8.buffer);
const integerHex = v=>(v<0n?-v:v).toString(16);
/**
 * Store one validated copied argument into the three-word input cell.
 *
 * @param m - Module owning the heap.
 * @param offset - Byte address of the input cell.
 * @param type - Authenticated scalar type.
 * @param input - Host value.
 * @param alloc - Checked allocation for variable-length inputs.
 */
export const encodeWasmWord = (m,offset,type,input,alloc)=>{
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

/**
 * Copy and validate a four-word return before releasing its native allocation.
 *
 * @param m - Module owning the heap.
 * @param p - Byte address of the return cell.
 * @param type - Authenticated scalar type.
 * @param live - Currently host-owned memory ranges, which cannot be returned.
 * @param charge - Account for the number of bytes to be copied.
 */
export const decodeWasmWord = (m,p,type,live,charge)=>{
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
			// Web IDL does not allow a SharedArrayBuffer-backed view as the
			// input to TextDecoder in browsers. The fixed, owned slice lives
			// until clear; copy only on the shared-heap path.
			return decoder.decode(b.buffer instanceof ArrayBuffer ? b : b.slice());
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
