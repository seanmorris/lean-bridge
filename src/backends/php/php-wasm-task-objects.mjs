/** @file Mirror Zend-owned application objects on one Lean worker's JavaScript owner. */

/**
 * Create a domain for one PHP interpreter, shared by its independently loaded
 * components. Only a minted capability can enter Lean; only its exact mirror
 * can return to Zend. Neither table is a strong root.
 *
 * @param kinds - Nominal host type keys from the admitted worker ABI.
 */
export const phpWasmObjectDomain=kinds=>{
	const types=new Map(),caps=new WeakMap(),mirrors=new WeakMap();
	const nonce=crypto.randomUUID().replaceAll("-","");let next=0n;
	for(const kind of kinds)
	{
		if(typeof kind!=="string" || !/^host:[a-f0-9]{64}$/u.test(kind) || types.has(kind)) throw new TypeError("Invalid PHP worker object kind");
		// Mirrors never execute PHP. In particular new Kind() is not a PHP constructor.
		/** Private nominal prototype, never an application constructor. */
		class Mirror
		{
			/** Require the owner to supply the original PHP object. */
			constructor(){throw new TypeError("Expected an object from Zend");}
		}
		types.set(kind,Mirror);
	}
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
	const tagged=(phase,shape,value)=>{
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
		return types.has(type)?packet(phase,type,v,tags):null;
	};
	return Object.freeze({classFor,mint,borrow,key,packet,tagged,has: kind=>types.has(kind)});
};
