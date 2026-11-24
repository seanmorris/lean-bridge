/** @file Dispatch synchronous checked Wasm imports to real application-owned objects. */
import {validateComponentScalar} from "../abi/component-scalars.mjs";

/**
 * Bind each declared class once. Instance tests use its captured prototype,
 * not an application-provided Symbol.hasInstance, equality or coercion.
 * Member exceptions pass through unchanged to the surrounding owner frame.
 *
 * @param model - Private member table generated from the host contract.
 * @param supplied - Application mapping of nominal names to constructors.
 * @param invalid - Throws a boundary failure distinguishable from an application throw.
 */
export const bindWasmHostMembers = (model,supplied,invalid = error => { throw error; }) => {
	if(supplied===null || typeof supplied!=="object" || Reflect.ownKeys(supplied).length!==model.kinds.length)
		throw new TypeError("Expected the declared JavaScript host classes");
	const classes=model.kinds.map(({name})=>{
		if(!Object.hasOwn(supplied,name)) throw new TypeError("Missing host class "+name);
		const ctor=Reflect.get(supplied,name);
		const proto=typeof ctor==="function" && Object.getOwnPropertyDescriptor(ctor,"prototype")?.value;
		if(!proto || typeof proto!=="object") throw new TypeError("Expected a JavaScript class for "+name);
		return {ctor,proto};
	});
	const value=(type,v)=>{
		if(typeof type==="number")
		{
			if(v===null || (typeof v!=="object" && typeof v!=="function") || !Object.prototype.isPrototypeOf.call(classes[type].proto,v))
				return invalid(new TypeError("Wrong JavaScript host object for "+model.kinds[type].name));
			return v;
		}
		try
		{ validateComponentScalar(type,v); }
		catch(error)
		{ return invalid(error); }
		return type==="bytes"?new Uint8Array(v):type==="float32"?Math.fround(v):v;
	};
	return (slot,args)=>{
		const m=Number.isInteger(slot) && slot>=0 && slot<model.members.length && model.members[slot];
		if(!m || !Array.isArray(args) || args.length!==m.args.length) return invalid(new TypeError("Invalid JavaScript host invocation"));
		const a=m.args.map((type,i)=>value(type,args[i]));
		const cls=classes[m.owner].ctor, target=m.op==="static-method"?cls:a[0];
		let out;
		if(m.op==="constructor") out=Reflect.construct(cls,a);
		else if(m.op==="set" || m.op==="get")
		{
			if(!Reflect.has(target,m.name)) return invalid(new TypeError("Missing host property "+m.name));
			if(m.op==="set")
			{
				if(!Reflect.set(target,m.name,a[1])) return invalid(new TypeError("Cannot set host property "+m.name));
			}
			else out=Reflect.get(target,m.name);
		}
		else
		{
			const method=Reflect.get(target,m.name);
			if(typeof method!=="function") return invalid(new TypeError("Missing host method "+m.name));
			out=Reflect.apply(method,target,m.op==="static-method"?a:a.slice(1));
		}
		return value(m.result,out);
	};
};
