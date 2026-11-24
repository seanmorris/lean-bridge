/** @file Pass non-serializable capabilities through VRZNO without exposing Lean pointers or ledger keys. */

/**
 * Bind compiler-authenticated kinds to this component's actual runtime classes.
 * Independent packages share the weak capability map only on the same PHP VM.
 *
 * @param identities - Per-interpreter weak map, not a process-wide token table.
 * @param leases - Nominal kinds from the checked component ABI.
 * @param bindings - Installed component's public JS classes.
 */
export const phpTaskLeases=(identities,leases,bindings)=>{
	const kinds=new Map(leases.map(({type,name})=>{
		if(typeof bindings[name]!=="function") throw new TypeError("Missing Lean resource class: "+name);
		return [type,bindings[name]];
	}));
	const borrow=(type,cap)=>{
		const value=identities.get(cap), Kind=kinds.get(type);
		if(!Kind || !(value instanceof Kind) || value.disposed) throw new TypeError("Wrong or closed PHP resource");
		return value;
	};
	const wrap=(type,value)=>{
		if(!(value instanceof kinds.get(type)) || value.disposed) throw new TypeError("Invalid Lean resource result");
		const cap=Object.freeze({
			closed: ()=>value.disposed
			, close: ()=>{try
			{return value.dispose();} catch
			{return false;}}
			, copy: ()=>{try
			{return wrap(type,value.retain());} catch
			{return null;}}
			, same: other=>{try
			{return value.same(borrow(type,other));} catch
			{return null;}}
		});
		identities.set(cap,value);return cap;
	};
	const packet=(phase,type,value)=>{
		let cap=wrap(type,value);
		return Object.freeze({form: ()=>phase
			, claim: expected=>{if(expected!==type) return null;const owned=cap;cap=null;return owned;}
			, discard: ()=>{const owned=cap;cap=null;owned?.close();}
		});
	};
	return {has: type=>kinds.has(type),borrow,packet};
};
