/** @file Deliver one Lean worker's callback requests to the PHP stack that observes its task. */
import {readPhpTaskValue,writePhpTaskValue} from "./php-wasm-task-wire.mjs";

/** A Zend interpreter drives all its installed components from one notification queue. */
export const createPhpCallbackHub=()=>{
	const calls=new Map(); let wake,serial=0n;
	const notify=()=>{const signal=wake;wake=null;signal?.resolve();};
	const receive=async terminal=>{
		while(true)
		{
			const done=terminal();if(done!==undefined) return done;
			const entry=calls.entries().next();
			if(!entry.done)
			{const [key,take]=entry.value;calls.delete(key);return take();}
			wake??=Promise.withResolvers();await wake.promise;
		}
	};
	const monitor=promise=>{
		let packet;
		Promise.resolve(promise).then(v=>{packet=v;notify();},()=>{packet='["fault"]';notify();});
		return Object.freeze({result: ()=>receive(()=>packet)});
	};
	const post=(key,take)=>{calls.set(key,take);notify();};
	return {allocate: ()=>"p"+(++serial),post,revoke: key=>calls.delete(key),notify,receive,monitor};
};

/**
 * A native port issues at most one request at a time. Its response is a JS
 * promise, but Zend only awaits fulfilled envelopes: no foreign stack reentry.
 * A ticket is private to this operation (never a pointer or shared identity).
 *
 * @param slots - Compiler-authenticated callback slot, input and output triples.
 * @param hub - Notification queue shared only within this PHP interpreter.
 * @param objects - Optional interpreter-local domain for Zend object arguments and replies.
 * @param errorId - Callback exception channel required by this compiled component.
 */
export const createPhpCallbackMailbox=(slots,hub,objects,errorId="error:JavaScriptCallbackError")=>{
	const specs=new Map(slots.map(([slot,input,output])=>[slot,{input,output}]));
	const failures=new WeakMap();
	const key=hub.allocate();
	let current, terminal, sequence=0;
	const discard=()=>{
		const request=current;current=null;
		if(request) request.reject(new Error("PHP callback owner is closed"));
	};
	const finish=packet=>{if(terminal!==undefined) return false;terminal=packet;hub.revoke(key);discard();hub.notify();return true;};
	const request=(slot,value)=>{
		const spec=specs.get(slot);
		if(terminal!==undefined || current || !spec || sequence>=2147483647) throw new Error("Invalid PHP callback request");
		const bytes=objects?.has(spec.input)?objects.key(spec.input,value):writePhpTaskValue(spec.input,value)[1],ticket=++sequence;
		const wait=Promise.withResolvers();
		current={ticket,output: spec.output,claimed: false,...wait};
		hub.post(key,()=>{current.claimed=true;return JSON.stringify(["call",key,ticket,slot,bytes]);});
		return wait.promise;
	};
	const currentTicket=ticket=>current && current.claimed && current.ticket===ticket && terminal===undefined;
	const stop=ticket=>{
		if(!currentTicket(ticket)) return false;
		finish(JSON.stringify(["throw",ticket]));return true;
	};
	const answer=(ticket,ok,value,makeFailure,cancel)=>{
		const r=current;
		if(!currentTicket(ticket)) return false;
		current=null;
		try
		{
			if(ok) r.resolve(objects?.has(r.output)?objects.borrow(r.output,value):readPhpTaskValue(r.output,value));
			else
			{
				const marker=makeFailure(readPhpTaskValue("string",value));
				failures.set(marker,ticket);r.reject(marker);
			}
		}
		catch(error)
		{
			// The request is no longer queued. Settle the worker promise even
			// when decoding its reply (including an exception message) fails.
			finish('["fault"]');r.reject(error);
			try
			{cancel();} catch { /* A retired heap has already rejected its tasks. */ }
			return false;
		}
		return true;
	};
	const failure=(error,exhausted)=>{
		if(error?.code!==errorId) return null;
		if(exhausted?.(error.cause)) return '["callback-already-invoked"]';
		const ticket=failures.get(error.cause);
		return ticket ? JSON.stringify(["throw",ticket]) : null;
	};
	return {key,request,answer,stop,next: ()=>hub.receive(()=>terminal),finish,failure};
};
