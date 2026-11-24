/** @file Mirror Zend-owned application objects on one Lean worker's JavaScript owner. */

/**
 * Create a domain for one PHP interpreter, shared by its independently loaded
 * components. Only a minted capability can enter Lean; only its exact mirror
 * can return to Zend. Neither table is a strong root.
 *
 * @param kinds - Nominal host type keys from the admitted worker ABI.
 * @param prototypes - Optional constructor pool belonging to the same Lean heap.
 */
export const phpWasmObjectDomain=(kinds,prototypes=new Map())=>{
	const types=new Map(),caps=new WeakMap(),mirrors=new WeakMap();
	const nonce=crypto.randomUUID().replaceAll("-","");let next=0n;
	const register=kind=> {
		if(typeof kind!=="string" || !/^host:[a-f0-9]{64}$(?![\s\S])/u.test(kind)) throw new TypeError("Invalid PHP worker object kind");
		if(types.has(kind)) return;
		// Mirrors never execute PHP. In particular new Kind() is not a PHP constructor.
		/** Private nominal prototype, never an application constructor. */
		class Mirror
		{
			/** Require the owner to supply the original PHP object. */
			constructor(){throw new TypeError("Expected an object from Zend");}
		}
		if(!prototypes.has(kind)) prototypes.set(kind,Mirror);
		types.set(kind,prototypes.get(kind));
	};
	if(new Set(kinds).size!==kinds.length) throw new TypeError("Duplicate PHP worker object kind");
	for(const kind of kinds) register(kind);
	const classFor=kind=>{const cls=types.get(kind);if(!cls) throw new TypeError("Unknown Zend object kind");return cls;};
	const mint=kind=>{
		const mirror=Object.freeze(Object.create(classFor(kind).prototype)),id="z"+nonce+":"+(++next);
		const cap=Object.freeze({key: ()=>id});
		caps.set(cap,{kind,mirror});mirrors.set(mirror,{kind,id});return cap;
	};
	const borrow=(kind,cap)=>{
		const known=caps.get(cap);
		if(!known || known.kind!==kind) throw new TypeError("Wrong or foreign Zend object capability");
		return known.mirror;
	};
	const key=(kind,mirror)=>{
		const known=mirrors.get(mirror);
		if(!known || known.kind!==kind) throw new TypeError("Unrecognized Zend object result");
		return known.id;
	};
	const packet=(phase,kind,v,tags="")=>{
		let id=key(kind,v);
		return Object.freeze({form: ()=>phase
			, tags: ()=>tags
			, claim: expected=>{if(expected!==kind) return null;const value=id;id=null;return value;}
			, discard: ()=>{id=null;}});
	};
	const tagged=(phase,shape,value,resources)=>{
		let tags="",type=shape,v=value;
		while(Array.isArray(type))
		{
			if(type.length!==2 || tags.length>=32 || !v || typeof v!=="object" || Object.keys(v).length!==1)
				throw new TypeError("Invalid Zend result branch");
			if(Object.hasOwn(v,"ok"))
			{tags+="1";type=type[0];v=v.ok;}
			else if(Object.hasOwn(v,"error"))
			{tags+="0";type=type[1];v=v.error;}
			else throw new TypeError("Invalid Zend result branch");
		}
		if(types.has(type)) return packet(phase,type,v,tags);
		if(resources?.has(type)) return Object.freeze({...resources.packet(phase,type,v),tags: ()=>tags});
		return null;
	};
	return Object.freeze({id: nonce,register,classFor,mint,borrow,key,packet,tagged,has: kind=>types.has(kind)});
};
