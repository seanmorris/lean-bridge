/** @file Install class-bound PHP APIs on the shared Lean heap without sharing Zend objects between interpreters. */
import {createPhpCallbackHub} from "./php-wasm-task-mailbox.mjs";
import {phpWasmObjectDomain} from "./php-wasm-task-objects.mjs";
import {phpWasmMemberOwner} from "./php-wasm-member-owner.mjs";
import {phpZendRecords} from "./php-wasm-zend-records.mjs";
import {phpTaskFunctions,phpTaskLeases} from "./php-wasm-task-leases.mjs";
import {phpZendTaskOperation,translateZendWorkerFailure} from "./php-wasm-task-owner.mjs";

// A PHP binding cancels only the tasks and cursors that it admitted. Two
// bindings of the same compiled component can share its native member table.
const tracking=()=>{
	const pending=new Set();
	const track=(method,owner,cancel)=>{
		if(!method.delivery) return owner;
		if(method.delivery==="task")
		{
			const stop=()=>{cancel();return owner.drained;};pending.add(stop);
			owner.drained.then(()=>pending.delete(stop),()=>pending.delete(stop));return owner;
		}
		let closing;
		const stop=()=>closing??=owner.return().finally(()=>pending.delete(stop));
		pending.add(stop);
		const next=async()=>{
			try
			{const step=await owner.next();if(step.done) pending.delete(stop);return step;}
			catch(e)
			{pending.delete(stop);throw e;}
		};
		return {next,return: stop};
	};
	const drain=async()=>{
		const results=await Promise.allSettled([...pending].map(async stop=>stop()));
		if(results.some(r=>r.status==="rejected" || r.value===false)) throw new Error("Failed to drain a Zend delivery");
	};
	return {track,drain};
};

const coordinator=(compiled,classes)=>{
	let binding,dispatch,users=0,closing;
	const acquire=async()=>{
		if(closing) await closing;
		binding??=compiled.withZendOwner(classes,translateZendWorkerFailure,
			(slot,args,invalid,trap)=>dispatch?dispatch(slot,args,invalid,trap):invalid(new TypeError("Inactive Zend member")));
		++users;return binding;
	};
	const call=(send,fn,args)=>{
		const previous=dispatch;dispatch=send;
		try
		{return fn(...args);} finally
		{dispatch=previous;}
	};
	const release=async()=>{
		if(--users) return;
		const prior=binding;binding=null;closing=prior.dispose();
		try
		{await closing;} finally
		{closing=null;}
	};
	return {acquire,call,release};
};

const open=async(def,compiled,core,state,objects,hub)=>{
	const binding=await core.acquire(),owned=tracking();
	try
	{
		const classes=Object.fromEntries(def.leases.map(r=>[r.name,compiled.resourceClass(r.type)]));
		const resources=phpTaskLeases(state.leaseCaps??=new WeakMap(),def.leases,classes);
		const members=phpWasmMemberOwner(def.model,objects);
		const functions=phpTaskFunctions(def.methods,(m,fn)=>{
			const f=m.returnedFunction,inner={...m,args: [f.argument],result: f.reply};
			return phpZendTaskOperation(inner,(...args)=>core.call(members.send,fn,args),hub,objects,members,leases);
		});
		const use=t=>objects.has(t)?objects:functions.has(t)?functions:resources;
		const leases={has: t=>use(t).has(t)
			, borrow: (t,v)=>use(t).borrow(t,v)
			, packet: (p,t,v)=>use(t).packet(p,t,v)
			, tagged: (p,t,v)=>objects.tagged(p,t,v,resources)};
		const ops=def.methods.map(m=>(...encoded)=>{
			let transport;
			const call=(...args)=>owned.track(m,core.call(members.send,binding[m.name],args),()=>transport.cancel());
			transport=phpZendTaskOperation(m,call,hub,objects,members,leases)(...encoded);return transport;
		});
		let closing;
		const close=()=>closing??=(async()=>{
			try
{try
{functions.revoke();} finally
{await owned.drain();}}
			finally
{await core.release();}
		})().then(()=>'["end"]',()=>'["fault"]');
		return Object.freeze({id: ()=>objects.id,mint: objects.mint
			, retains: (type,cap)=>compiled.zendRetains(type,objects.borrow(type,cap))
			, run: (slot,...args)=>!closing && Number.isInteger(slot) && ops[slot]?ops[slot](...args):'["fault"]'
			, close: ()=>hub.monitor(close()),abandon: ()=>{void close();}});
	} catch(e)
	{await core.release();throw e;}
};

/**
 * Register one prepared component's entry point before Zend starts.
 *
 * @param def - Authenticated namespace, member model, methods and resources.
 * @param compiled - Exact byte-verified compiled component.
 * @param files - Generated PHP preload assets.
 * @param ownerRuntime - Shared installed runtime identity.
 */
export const createPhpZendDescriptor=(def,compiled,files,ownerRuntime)=>{
	if(typeof ownerRuntime!=="function" || typeof compiled.withZendOwner!=="function") throw new TypeError("Missing compiled Zend component");
	const reg=Symbol.for("lean-bridge.php-wasm.task-host.v1"),pool=Symbol.for("lean-bridge.php-wasm.zend-heap.v1");
	const heap=ownerRuntime[pool]??=Object.freeze({prototypes: new Map(),components: new WeakMap()});
	const getFiles=php=>{
		const state=php[reg]??={ownerRuntime,namespaces: new Map()};
		if(state.ownerRuntime!==ownerRuntime) throw new Error("Conflicting PHP-Wasm task runtimes");
		const ns=def.namespace.toLowerCase(),key=def.key+"_bind";
		if(state.namespaces.get(ns)===def.key) return [];
		if(state.namespaces.has(ns) || key in php.shared) throw new Error("Conflicting PHP-Wasm Zend binding");
		const objects=state.zendObjects??=phpWasmObjectDomain([],heap.prototypes),hub=state.callbackHub??=createPhpCallbackHub();
		for(const k of def.model.kinds) objects.register("host:"+k.key);
		let core=heap.components.get(compiled);
		if(!core)
		{
			const classes=Object.fromEntries(def.model.kinds.map(k=>[k.name,objects.classFor("host:"+k.key)]));
			core=coordinator(compiled,classes);heap.components.set(compiled,core);
		}
		php.shared[key]=()=>open(def,compiled,core,state,objects,hub).catch(()=>"Could not open compiled Zend binding");
		state.namespaces.set(ns,def.key);return files;
	};
	return Object.freeze({getLibs: ()=>[],getFiles});
};

/**
 * Attach a single-threaded component. Opening, invoking and closing the
 * binding all run on the active interpreter stack; there is no task owner.
 *
 * @param def - Methods and nominal classes derived from synchronous public IR.
 * @param compiled - Authenticated standalone component, not a pthread executor.
 * @param files - Prepared PHP library assets.
 * @param ownerRuntime - Installed single-threaded runtime identity.
 */
export const createPhpZendSyncDescriptor=(def,compiled,files,ownerRuntime)=>{
	if(typeof ownerRuntime!=="function" || typeof compiled.withZendOwner!=="function" || !def.model.zend
		|| def.methods.some(m=>m.delivery || m.callbacks)) throw new TypeError("Expected a synchronous Zend component");
	const reg=Symbol.for("lean-bridge.php-wasm.sync-host.v1"),pool=Symbol.for("lean-bridge.php-wasm.sync-classes.v1");
	const prototypes=ownerRuntime[pool]??=new Map();
	const getFiles=php=>{
		const state=php[reg]??={ownerRuntime,namespaces: new Map(),objects: phpWasmObjectDomain([],prototypes)};
		const {objects}=state,key=def.key+"_bind",ns=def.namespace.toLowerCase();
		if(state.ownerRuntime!==ownerRuntime) throw new Error("Conflicting synchronous Zend runtimes");
		if(state.namespaces.get(ns)===def.key) return [];
		if(state.namespaces.has(ns) || key in php.shared) throw new Error("Conflicting synchronous Zend binding");
		for(const k of def.model.kinds) objects.register("host:"+k.key);
		const classes=Object.fromEntries(def.model.kinds.map(k=>[k.name,objects.classFor("host:"+k.key)]));
		php.shared[key]=()=>{
			const members=phpWasmMemberOwner(def.model,objects);
			const binding=compiled.withZendOwner(classes,translateZendWorkerFailure,members.send);
			try
			{
				const records=def.records && phpZendRecords(def.records,compiled,objects);
				let depth=0,closed=false;
				const op=(m,fn)=>phpZendTaskOperation(m,(...args)=>{
					++depth;
					try
					{return fn(...args);} finally
					{--depth;}
				},null,objects,members,leases);
				const functions=phpTaskFunctions(def.methods,(m,fn)=>op({...m,args: [m.returnedFunction.argument],result: m.returnedFunction.reply},fn));
				const leases={has: t=>functions.has(t) || objects.has(t) || records?.has(t)
					, borrow: objects.borrow
					, packet: (p,t,v)=>records?.has(t)?records.packet(p,t,v):functions.has(t)?functions.packet(p,t,v):objects.packet(p,t,v)
					, tagged: objects.tagged};
				const methods=def.methods.map(m=>{
					const {method,invoke}=records?records.flatten(m,binding[m.name]):{method: m,invoke: binding[m.name]};
					return op(method,invoke);
				});
				const close=()=>{
					if(depth) throw new Error("Cannot close an active Zend binding");
					if(closed)return;closed=true;
					try
					{functions.revoke();} finally
					{binding.dispose();}
				};
				return Object.freeze({id: ()=>objects.id
					, mint: objects.mint
					, busy: ()=>depth!==0
					, retains: (type,cap)=>compiled.zendRetains(type,objects.borrow(type,cap))
					, run: (i,...args)=>!closed && Number.isInteger(i) && methods[i]?methods[i](...args):'["fault"]'
					, close});
			} catch(e)
			{binding.dispose();throw e;}
		};
		state.namespaces.set(ns,def.key);return files;
	};
	return Object.freeze({getLibs: ()=>[],getFiles});
};
