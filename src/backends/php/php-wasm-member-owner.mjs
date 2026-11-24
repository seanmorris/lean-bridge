/** @file Dispatch immediate Lean imports on the active Zend stack, never a pthread. */
import {readPhpTaskValue,writePhpTaskValue} from "./php-wasm-task-wire.mjs";

/**
 * Connect one component's authenticated PHP member slots to its interpreter.
 * A nested entry gets its own exception tickets. No closure or member result
 * is retained on the JS side once the synchronous Lean invocation returns.
 *
 * @param model - Compiler-checked Zend member definitions.
 * @param objects - That interpreter's nominal capabilities.
 */
export const phpWasmMemberOwner=(model,objects)=>{
	if(model.zend!==true) throw new TypeError("Expected a Zend member model");
	const kind=i=>"host:"+model.kinds[i].key,stack=[];
	const enter=(invoke,perform)=>{
		if(typeof invoke!=="function") throw new TypeError("Missing PHP member scope");
		const errors=new WeakMap();stack.push({invoke,errors});
		try
		{return perform(e=>errors.has(e)?JSON.stringify(["member",errors.get(e)]):null);}
		finally
		{stack.pop();}
	};
	const send=(slot,values,invalid,trap)=>{
		const frame=stack.at(-1),m=model.members[slot];
		if(!frame || !m || values.length!==m.args.length) return invalid(new TypeError("PHP member outside its owner"));
		let encoded,reply;
		try
		{
			encoded=values.map((v,i)=>typeof m.args[i]==="number"?objects.key(kind(m.args[i]),v):writePhpTaskValue(m.args[i],v)[1]);
		} catch(e)
		{return invalid(e);}
		// All PHP application and conversion failures have envelopes. A raw
		// exception from the interpreter is a trap, not a declared IO error.
		try
		{reply=frame.invoke(slot,...encoded);} catch(e)
		{return trap(e);}
		if(typeof reply==="string" && /^[eb][1-9][0-9]{0,3}$(?![\s\S])/u.test(reply) && Number(reply.slice(1))<=4096)
		{
			const error=new Error("PHP member failed");frame.errors.set(error,Number(reply.slice(1)));
			if(reply[0]==="b") return invalid(error);
			throw error;
		}
		try
		{
			if(typeof m.result==="number") return objects.borrow(kind(m.result),reply);
			if(typeof reply!=="string" || reply[0]!=="v") throw new TypeError("Invalid PHP member result");
			return readPhpTaskValue(m.result,reply.slice(1));
		} catch(e)
		{return trap(e);}
	};
	return Object.freeze({enter,send});
};
