/** @file Bind the generated synchronous Lean call entry to ordinary JavaScript methods. */
import { hostCallMagic } from "../abi/component-host-io.mjs";
import { scalarCopyLimit } from "../abi/component-scalars.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "../release/component-scalar-codec.mjs";
import { bindWasmHostFunctions } from "./wasm-host-functions.mjs";

const malformed=()=>new Error("Malformed compiled JavaScript host export reply");
const declared=(id,payload)=>Object.assign(new Error(id==="error:IO.Error"?payload:"Lean raised "+id),{
	code: "declared-error",details: {errorId: id,payload}
});

/**
 * The result of binding classes exposes no Wasm handles. An application
 * throw is never inspected, stringified or mistaken for a declared EIO.
 *
 * @param o - Shared heap, verified descriptor, native operation and heap lifecycle.
 */
export const bindJavaScriptHostExports = o => {
	const {wasm,domain,abi,model,operation,assertOpen,poison}=o;
	const view=()=>new DataView(wasm.HEAP8.buffer);
	const span=(p,n)=>Number.isInteger(p) && p>0 && p+n<=wasm.HEAP8.length;
	const bind=(supplied,makeError=declared)=>{
		assertOpen();const s=domain.bind(abi.componentIdentity,model,supplied);
		const invoke=(m,index,values,owner=0,ticket=0n)=>{
			assertOpen();
			if(values.length!==m.args.length) throw new TypeError(m.name+" expects "+m.args.length+" arguments");
			const bytes=32+16*m.args.length, pins=[], allocations=[];
			let frame=0,budget=scalarCopyLimit,reply,unsafe=false;
			const charge=n=>{if(n>budget) throw new RangeError("JavaScript host export copy budget exceeded");budget-=n;};
			const broken=()=>{unsafe=true;poison();throw malformed();};
			const native=fn=>{
				try
				{assertOpen();const v=fn();assertOpen();return v;}
				catch(error)
				{unsafe=true;poison();throw error;}
			};
			const allocate=n=>{
				const p=native(()=>wasm._malloc(Math.max(1,n)))>>>0;
				if(!p) throw new Error("JavaScript host export allocation failed");
				if(p%8 || !span(p,Math.max(1,n))) broken();
				allocations.push(p);return p;
			};
			const deliver=(p,ch,tags,n,slot)=>{
				if(reply || p!==frame || slot%8 || !span(slot,16) || n>32 || (n && !span(tags,n))
					|| ![0,1,2].includes(ch) || (ch===1 && m.effect!=="EIO")) { reply={corrupt: true};return 5; }
				try
				{
					let shape=ch===0?m.result:ch===1?m.error:"string";
					const path=[];
					while(Array.isArray(shape))
					{
						if(path.length>=n) throw malformed();
						const tag=wasm.HEAP8[tags+path.length]; if(tag!==0 && tag!==1) throw malformed();
						path.push(tag);shape=shape[tag?0:1];
					}
					if(path.length!==n) throw malformed();
					const v=view();let result;
					if(typeof shape==="number")
					{
						const token=v.getUint32(slot+8,true);
						if(v.getUint32(slot,true)!==64+shape || v.getUint32(slot+4,true) || !token || v.getUint32(slot+12,true)) throw malformed();
						result=s.resolve(shape,token);
					} else result=readComponentScalarSlot(wasm,slot,shape,charge);
					for(const tag of path.reverse()) result=Object.freeze(tag?{ok: result}:{error: result});
					reply={ch,result};return 0;
				} catch(error)
				{ reply={conversion: error};return 6; }
			};
			const outcome=s.during(()=>{
				try
				{
					frame=allocate(bytes);wasm.HEAP8.fill(0,frame,frame+bytes);
					view().setUint32(frame,hostCallMagic,true);view().setUint32(frame+4,bytes,true);
					view().setUint32(frame+12,index,true);
					view().setUint32(frame+20,owner,true);view().setBigUint64(frame+24,ticket,true);
					for(const [i,t] of m.args.entries())
					{
						const p=frame+32+16*i;
						if(typeof t==="number")
						{
							const token=s.pin(t,values[i]);pins.push(token);
							view().setUint32(p,64+t,true);view().setUint32(p+8,token,true);
						} else writeComponentScalarSlot(wasm,p,t,values[i],n=>{charge(n);return allocate(n);});
					}
					assertOpen();
					const status=native(()=>operation(frame));
					const d=view(),token=d.getUint32(frame+16,true),returned=d.getBigUint64(frame+24,true);
					const factory=owner && !ticket;
					if(d.getUint32(frame,true)!==hostCallMagic || d.getUint32(frame+4,true)!==bytes || d.getUint32(frame+8,true)!==status
						|| d.getUint32(frame+12,true)!==index || d.getUint32(frame+20,true)!==owner
						|| (!(factory && !status && !token && !reply) && returned!==ticket)) broken();
					if(factory && !status && !token && !reply && returned) return {ch: 0,result: returned};
					if(factory && (status===11 || status===12) && !token && !reply) throw new RangeError("Lean function capacity exceeded");
					if(ticket && status===16 && !token && !reply) throw new TypeError("Closed Lean function");
					if(status===6 && !token && reply && Object.hasOwn(reply,"conversion")) throw reply.conversion;
					if(status!==0 || Boolean(token)===Boolean(reply) || reply?.corrupt) broken();
					if(token)
					{
						try
						{return {original: domain.takeError(token)};}
						catch
						{return broken();}
					}
					return reply;
				} finally
				{
					for(const token of pins) s.release(token);
					if(!unsafe) for(const p of allocations.reverse()) native(()=>wasm._free(p));
				}
			},deliver);
			if(outcome.original) throw outcome.original.error;
			if(outcome.ch!==0) throw makeError(outcome.ch===1?m.errorId:"error:IO.Error",outcome.result,m);
			return outcome.result;
		};
		if(abi.methods.some(m=>m.result!==null && typeof m.result==="object" && !Array.isArray(m.result)))
		{
			const control=(index,ticket)=>!domain.abandoned() && s.during(()=>{
				assertOpen();
				try
				{
					const frame=wasm._malloc(32)>>>0;
					if(!frame || frame%8 || !span(frame,32)) throw malformed();
					wasm.HEAP8.fill(0,frame,frame+32);
					const v=view();v.setUint32(frame,hostCallMagic,true);v.setUint32(frame+4,32,true);
					v.setUint32(frame+12,index,true);v.setUint32(frame+20,s.id,true);v.setBigUint64(frame+24,ticket,true);
					const status=operation(frame);assertOpen();
					const d=view();
					if(status!==0 || d.getUint32(frame,true)!==hostCallMagic || d.getUint32(frame+4,true)!==32 || d.getUint32(frame+8,true)
						|| d.getUint32(frame+12,true)!==index || d.getUint32(frame+16,true) || d.getUint32(frame+20,true)!==s.id || d.getBigUint64(frame+24,true)!==ticket) throw malformed();
					wasm._free(frame);
				} catch(error)
				{
					// Never reenter a heap that failed to complete or release the frame.
					poison();throw error;
				}
			});
			try
			{ return bindWasmHostFunctions(abi,s.id,invoke,control,s.close); }
			catch(error)
			{ s.close();throw error; }
		}
		const api=Object.create(null);
		for(const [i,m] of abi.methods.entries()) api[m.name]=(...args)=>invoke(m,i,args);
		api.dispose=()=>{assertOpen();return s.close();};return Object.freeze(api);
	};
	return Object.freeze({withHosts: bind});
};
