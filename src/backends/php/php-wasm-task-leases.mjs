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

const releaseFunction=row=>{
	const fn=row.fn;if(!fn) return false;
	row.fn=row.invoke=null;row.rows.delete(row);row.rows=null;
	fn.dispose();return true;
};
// A stale PHP callable can survive in application storage indefinitely. Its
// proxy must not retain the binding, other rows or the interpreter coordinator.
const functionCapability=row=>Object.freeze({run: (...args)=>row.invoke?row.invoke(...args):'["fault"]',close: ()=>releaseFunction(row)});
const functionPacket=(phase,kind,cap)=>Object.freeze({form: ()=>phase
	, claim: expected=>{if(expected!==kind) return null;const value=cap;cap=null;return value;}
	, discard: ()=>{const value=cap;cap=null;value?.close();}});

/**
 * One PHP binding owns the functions it receives, even if other bindings
 * share the same compiled component or the same Zend interpreter.
 *
 * @param methods - Authenticated factories on this component.
 * @param application - Build the checked inner operation around the actual function.
 */
export const phpTaskFunctions=(methods,application)=>{
	const sites=new Map(methods.filter(m=>m.returnedFunction).map(m=>[m.result,m]));
	const rows=new Set();let closed=false;
	const packet=(phase,kind,fn)=>{
		const method=sites.get(kind);
		if(typeof fn!=="function" || typeof fn.dispose!=="function") throw new TypeError("Invalid returned Lean function");
		const row={fn,invoke: null,rows};
		try
		{
			if(closed || !method || phase!=="value") throw new TypeError("Inactive PHP function factory");
			row.invoke=application(method,fn);rows.add(row);
			return functionPacket(phase,kind,functionCapability(row));
		} catch(error)
		{
			try
			{releaseFunction(row);} catch { /* Preserve the publication error. */ }
			throw error;
		}
	};
	const revoke=()=>{
		closed=true;let failed=false,first;
		for(const row of rows) try
		{releaseFunction(row);} catch(error)
		{if(!failed) first=error;failed=true;}
		if(failed) throw first;
	};
	return {has: kind=>sites.has(kind),packet,revoke};
};
