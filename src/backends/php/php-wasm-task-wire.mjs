/** @file Exchange copied values with the generated 32-bit PHP codec without converting exact numbers to doubles. */
import {scalarCopyLimit,validateComponentScalar} from "../../abi/component-scalars.mjs";

const encoder=new TextEncoder(), decoder=new TextDecoder("utf-8",{fatal: true,ignoreBOM: true});
const malformed=()=>{throw new TypeError("Invalid PHP-Wasm task value");};
const wide=k=>k==="nat" || k==="int";
const base64=bytes=>{
	let binary="";
	for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
	return btoa(binary);
};
const unwrap=str=>{
	if(typeof str!=="string" || str.length>4*Math.ceil(scalarCopyLimit/3)) malformed();
	const raw=atob(str);if(raw.length>scalarCopyLimit || btoa(raw)!==str) malformed();
	return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
/**
 * Read one PHP-validated scalar argument. Check again at the JS boundary.
 *
 * @param k - Compiler-derived scalar shape.
 * @param str - Base64-encoded PHP binary string, including any NUL bytes.
 */
export const readPhpTaskValue=(k,str)=>{
	const b=unwrap(str), d=new DataView(b.buffer);let value;
	if(k==="string") value=decoder.decode(b);
	else if(k==="bytes") value=b;
	else if(wide(k))
	{
		if(b.length<8 || b.length%8 || b.length>6816) malformed();
		const sign=d.getBigUint64(0,true);
		if(sign>1n || (sign && (k==="nat" || b.length===8)) || (b.length>8 && !d.getBigUint64(b.length-8,true))) malformed();
		let n=0n;for(let i=b.length-8;i>=8;i-=8) n=(n<<64n)|d.getBigUint64(i,true);
		value=sign?-n:n;
	} else
	{
		if(b.length!==8) malformed();
		const word=d.getBigUint64(0,true);
		if(k==="unit")
		{ if(word) malformed();value=undefined; }
		else if(k==="bool")
		{ if(word>1n) malformed();value=Boolean(word); }
		else if(k==="char") value=String.fromCodePoint(Number(word));
		else if(k==="float64") value=d.getFloat64(0,true);
		else if(k==="float32")
		{ if(d.getUint32(4,true)) malformed();value=d.getFloat32(0,true); }
		else
		{
			const n=k.startsWith("int") || k==="isize"?BigInt.asIntN(64,word):word;
			value=k==="int64" || k==="uint64"?n:Number(n);
		}
	}
	return validateComponentScalar(k,value);
};
/**
 * Encode the chosen branch of a returned Except and its scalar payload separately.
 *
 * @param shape - Checked result or declared error type.
 * @param input - Value from the installed component.
 */
export const writePhpTaskValue=(shape,input)=>{
	const tags=[];
	let k=shape,v=input;
	while(Array.isArray(k))
	{
		const ok=v && Object.hasOwn(v,"ok");
		if(!v || typeof v!=="object" || Object.keys(v).length!==1 || (!ok && !Object.hasOwn(v,"error"))) malformed();
		tags.push(ok?1:0);k=k[ok?0:1];v=v[ok?"ok":"error"];
	}
	v=validateComponentScalar(k,v);let b;
	if(k==="string") b=encoder.encode(v);
	else if(k==="bytes") b=v;
	else if(wide(k))
	{
		const digits=(v<0n?-v:v).toString(16),count=v===0n?0:Math.ceil(digits.length/16);
		if(count>851) malformed();
		b=new Uint8Array(8+8*count);const d=new DataView(b.buffer);b[0]=Number(v<0n);
		for(let i=0,end=digits.length;i<count;i++,end-=16) d.setBigUint64(8+8*i,BigInt("0x"+digits.slice(Math.max(0,end-16),end)),true);
	} else
	{
		b=new Uint8Array(8);const d=new DataView(b.buffer);
		if(k==="float32") d.setFloat32(0,v,true);
		else if(k==="float64") d.setFloat64(0,v,true);
		else if(k!=="unit") d.setBigUint64(0,BigInt(k==="char"?v.codePointAt(0):v),true);
	}
	if(b.length>scalarCopyLimit) malformed();
	return [base64(Uint8Array.from(tags)),base64(b)];
};
