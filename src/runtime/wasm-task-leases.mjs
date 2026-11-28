/** @file Keep nominal leases private to one runtime; worker tasks hold ordinary Lean references. */
import {taskFrame as op} from "../abi/wasm-task-frame.mjs";

/**
 * Own resource classes and outstanding tokens across all components of one heap.
 *
 * @param context - Shared module, allocation ledger, lifecycle and retirement callbacks.
 */
export const createWasmTaskLeases = context => {
	const {module: m,ledger,retire,isLive,assertOpen}=context;
	const kinds=new Map(), wrappers=new WeakMap(), active=new Map();
	let domain;
	const bad=() => retire(new Error("Malformed Lean resource lease"));
	const live=(value,type) => {
		const row=wrappers.get(value);
		if(!row || row.def.type!==type) throw new TypeError("Expected a resource from this Lean runtime and nominal type");
		if(row.closed) throw new Error("Lean resource has been disposed");
		return row;
	};
	const command=(row,operation,other) => {
		let p=0;
		try
		{
			p=m._malloc(op.leaseSize)>>>0;
			if(!p || p%8 || p+op.leaseSize>m.HEAP8.length) return bad();
			for(const [a,n] of ledger) if(p<a+n && p+op.leaseSize>a) return bad();
			ledger.set(p,op.leaseSize); m.HEAP8.fill(0,p,p+op.leaseSize);
			const view=() => new DataView(m.HEAP8.buffer), d=view();
			d.setUint32(p,op.magic,true); d.setUint32(p+4,op.leaseSize,true); d.setUint32(p+8,row.def.index,true); d.setUint32(p+12,operation,true);
			d.setBigUint64(p+op.args,row.id,true); d.setBigUint64(p+op.args+8,row.domain,true);
			if(other)
			{ d.setBigUint64(p+op.args+16,other.id,true); d.setBigUint64(p+op.args+24,other.domain,true); }
			const status=row.def.invoke(p), after=view();
			if(after.getUint32(p,true)!==op.magic || after.getUint32(p+4,true)!==op.leaseSize || after.getUint32(p+8,true)!==row.def.index
				|| after.getUint32(p+12,true)!==operation || m.HEAP8.subarray(p+16,p+op.out).some(Boolean)
				|| m.HEAP8.subarray(p+op.out+16,p+op.args).some(Boolean)) return bad();
			const id=after.getBigUint64(p+op.out,true), dom=after.getBigUint64(p+op.out+8,true);
			if(after.getBigUint64(p+op.args,true)!==(operation===op.leaseClose ? 0n : row.id) || after.getBigUint64(p+op.args+8,true)!==(operation===op.leaseClose ? 0n : row.domain)
				|| after.getBigUint64(p+op.args+16,true)!==(other?.id??0n) || after.getBigUint64(p+op.args+24,true)!==(other?.domain??0n)) return bad();
			if(operation===op.hostPin && [10,11].includes(status) && !id && !dom) return null;
			if(status!==0) return bad();
			if(operation===op.hostResolve)
			{ if(!id || id>0xffffffffn || dom) return bad();return Number(id); }
			if(operation===op.hostPin)
			{ if(!id || !dom || domain!==undefined && dom!==domain || active.has(id)) return bad();domain=dom;return [id,dom]; }
			if(operation===op.leaseRetain)
			{ if(!id || dom!==row.domain) return bad(); return [id,dom]; }
			if(dom || id>(operation===op.leaseSame ? 1n : 0n)) return bad();
			return Boolean(id);
		} catch(error)
		{ return retire(error); }
		finally
		{
			if(p && isLive() && ledger.delete(p))
			{
				try
				{ m._free(p); } catch(error)
				{ retire(error); }
			}
		}
	};
	const closeRow=row => {
		if(row.closed) return false;
		if(isLive()) command(row,op.leaseClose);
		row.closed=true; active.delete(row.id); return true;
	};
	const adopt=(type,id,dom) => {
		const def=kinds.get(type);
		if(!def || !id || !dom || (domain!==undefined && dom!==domain) || active.has(id)) return bad();
		const row={def,id,domain: dom,closed: false};
		// Validate the nominal kind in the native ledger before taking the token.
		if(!command(row,op.leaseSame,row)) return bad();
		domain=dom; const value=Object.freeze(Object.create(def.Resource.prototype));
		wrappers.set(value,row); active.set(id,row); return value;
	};
	const register=(resource,index,invoke) => {
		const {type,name}=resource;
		if(kinds.has(type))
		{ if(kinds.get(type).name!==name) return bad(); return; }
		/** Public, non-constructible brand for one Lean type on this heap. */
		class Resource
		{
			/** Only the runtime can create and brand a lease. */
			constructor() { throw new TypeError("Obtain this resource from a Lean function"); }
			/**
			 * Check this heap's private brand, not a user-controlled prototype.
			 *
			 * @param value - Candidate wrapper.
			 */
			static [Symbol.hasInstance](value) { return wrappers.get(value)?.def.type===type; }
			/** Whether this handle has been released or its heap retired. */
			get disposed() { const row=wrappers.get(this); if(row?.def.type!==type) throw new TypeError("Invalid receiver"); return row.closed; }
			/** Release this independent owner at most once. */
			dispose() { const row=wrappers.get(this); if(row?.def.type!==type) throw new TypeError("Invalid receiver"); return closeRow(row); }
			/** Acquire another explicitly disposable handle to the same object. */
			retain() { assertOpen(); const row=live(this,type); const [id,dom]=command(row,op.leaseRetain); return adopt(type,id,dom); }
			/**
			 * Compare the actual Lean heap objects, not JS wrapper identity.
			 *
			 * @param other - Live lease of the same nominal type and heap.
			 */
			same(other) { assertOpen(); return command(live(this,type),op.leaseSame,live(other,type)); }
		}
		Object.defineProperty(Resource,"name",{value: name});
		Object.freeze(Resource.prototype); Object.freeze(Resource); kinds.set(type,{type,name,index,invoke,Resource});
	};
	const finish=() => { for(const row of active.values()) closeRow(row); };
	const pinHost=(def,session,value)=>{
		session.enter();
		try
		{
			const token=session.pin(def.local,value);
			try
			{
				assertOpen();
				const pair=command({def,id: BigInt(session.kind(def.local)),domain: BigInt(token)},op.hostPin);
				if(!pair) throw new RangeError("JavaScript task host lease limit reached");
				const row={def,id: pair[0],domain: pair[1],closed: false};
				active.set(row.id,row);return row;
			} finally
			{if(isLive()) session.release(token);}
		} finally
		{if(isLive()) session.leave();}
	};
	const resolveHost=(def,session,id,dom,detach,onInvalidClass)=>{
		if(!id || !dom || (domain!==undefined && domain!==dom) || active.has(id)) return bad();
		domain=dom;
		// Move the owned token out of the method frame before class validation:
		// an application's proxy can cancel or reenter the same method here.
		const row={def,id,domain: dom,closed: false};detach();active.set(id,row);
		try
		{
			session.enter();
			try
			{
				const token=command(row,op.hostResolve,{id: BigInt(session.kind(def.local)),domain: 0n});
				return session.resolve(def.local,token,onInvalidClass);
			} finally
			{if(isLive()) session.leave();}
		} finally
		{closeRow(row);}
	};
	return {register,adopt,finish,live,pinHost,resolveHost,releaseHost: closeRow
		, prepareHost: def=>command({def,id: 0n,domain: 0n},op.hostPrepare)
		, resourceClass: type => kinds.get(type)?.Resource};
};
