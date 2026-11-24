/** @file Keep a PHP-Wasm caller's task and iterator owners on the Lean pthread runtime's JavaScript agent. */
import {readPhpTaskValue,writePhpTaskValue} from "./php-wasm-task-wire.mjs";
import {createPhpCallbackHub,createPhpCallbackMailbox} from "./php-wasm-task-mailbox.mjs";

const fault=JSON.stringify(["fault"]);
const val=(type,result)=>JSON.stringify(["value",...writePhpTaskValue(type,result)]);
const failure=(m,e)=>{
	try
	{
		if(e?.code==="operation-cancelled") return '["cancelled"]';
		const details=e?.cause?.details;
		if(!details || details.errorId!==e.code) return fault;
		for(const [tag,id,type] of [["start",m.startId,m.error],["worker",m.terminalId,m.terminal]])
			if(id && id===e.code) return JSON.stringify([tag,...writePhpTaskValue(type,details.payload)]);
	} catch
	{ return fault; }
	return fault;
};
const guarded=(m,perform,success)=>{
	try
	{return Promise.resolve(perform()).then(success).catch(e=>failure(m,e));}
	catch(e)
	{return Promise.resolve(failure(m,e));}
};
const operation=(m,call,hub)=>(...args)=>{
	const box=m.callbacks && createPhpCallbackMailbox(m.callbacks,hub);
	try
	{
		if(args.length!==m.args.length) return fault;
		const owner=call(...args.map((v,i)=>m.args[i]==="callback"?value=>box.request(i,value):readPhpTaskValue(m.args[i],v)));
		if(!m.delivery) return val(m.result,owner);
		if(m.delivery==="task")
		{
			const cleanup=hub.monitor(owner.drained?.then(ok=>ok?'["end"]':fault)??Promise.resolve(fault));
			if(box)
			{
				Promise.resolve(owner).then(v=>val(m.result,v)).catch(e=>box.failure(e)??failure(m,e)).then(box.finish);
				const cancel=()=>{const stopped=owner.cancel();if(stopped) box.finish('["cancelled"]');return stopped;};
				const answer=(id,ok,value)=>box.answer(id,ok,value,owner.callbackFailure,()=>owner.cancel());
				const invalid=id=>{if(!box.stop(id)) return false;owner.cancel();return true;};
				const trap=id=>{const live=box.stop(id);owner.hostTrap();return live;};
				return Object.freeze({result: box.next,key: ()=>box.key,answer,invalid,trap,cancel,cleanup: ()=>cleanup});
			}
			// Install the rejection handler synchronously, even if PHP never awaits.
			const result=guarded(m,()=>owner,v=>val(m.result,v));
			return Object.freeze({...hub.monitor(result),cancel: ()=>owner.cancel(),cleanup: ()=>cleanup});
		}
		const close=()=>guarded(m,()=>owner.return(),()=>'["end"]');
		const next=()=>guarded(m,()=>owner.next(),step=>step.done?'["end"]':val(m.result,step.value));
		return Object.freeze({pull: ()=>hub.monitor(next()),drain: ()=>hub.monitor(close()),dispose: ()=>{void close();}});
	} catch(e)
	{const packet=failure(m,e);box?.finish(packet);return packet;}
};
/**
 * Install private method closures before Zend starts. The PHP surface never
 * names a JS export, waits on a raw rejection, or touches a Lean pointer.
 *
 * @param definition - Compiler-derived namespace, component identity and methods.
 * @param bindings - The public exports of the exact compiled component.
 * @param files - Package-relative preload assets for this component.
 * @param ownerRuntime - Actual installed executor, shared by all components on this PHP host.
 */
export const createPhpTaskDescriptor=(definition,bindings,files,ownerRuntime)=>{
	if(typeof ownerRuntime!=="function") throw new TypeError("Missing PHP task runtime");
	const {key,namespace}=definition, registry=Symbol.for("lean-bridge.php-wasm.task-host.v1");
	const methods=definition.methods.map(m=>{
		if(typeof bindings[m.name]!=="function") throw new Error("Missing installed Lean task binding: "+m.name);
		return m;
	});
	const getFiles=php=>{
		const registryState=php[registry]??={ownerRuntime,namespaces: new Map()};
		if(registryState.ownerRuntime!==ownerRuntime) throw new Error("Conflicting PHP-Wasm task runtimes");
		const hub=registryState.callbackHub??=createPhpCallbackHub();
		const state=registryState.namespaces, name=namespace.toLowerCase();
		if(state.has(name))
		{
			if(state.get(name)===key) return [];
			throw new Error("Conflicting PHP-Wasm task namespace: "+namespace);
		}
		const names=methods.map((_,i)=>key+"_"+i);
		if(names.some(n=>n in php.shared)) throw new Error("PHP-Wasm task binding already installed");
		for(const [i,n] of names.entries()) php.shared[n]=operation(methods[i],bindings[methods[i].name],hub);
		state.set(name,key);return files;
	};
	return Object.freeze({getLibs: ()=>[],getFiles});
};
