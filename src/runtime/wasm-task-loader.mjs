/** @file Share one owner-side pthread heap between installed task packages. */
import {javaScriptTaskAbi} from "../abi/javascript-wasm-tasks.mjs";
import {createWasmTaskNotifications} from "./wasm-task-notifications.mjs";
import {createWasmTaskSession} from "./wasm-task-bindings.mjs";
import {installWasmTaskHostMembers} from "./wasm-task-host-members.mjs";
import {javaScriptHostMembers} from "../backends/javascript/host-members.mjs";
import {phpWasmHostMembers} from "../backends/php/host-members.mjs";

const componentBytes = async url => {
	if(url.protocol === "file:") return (await import("node:fs/promises")).readFile(url);
	const response = await fetch(url);
	if(!response.ok) throw new Error("Cannot load Lean task component: "+response.status);
	return new Uint8Array(await response.arrayBuffer());
};
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v => v.toString(16).padStart(2,"0")).join("");

/**
 * Route failures from the pinned Emscripten pthread runtime into the session.
 * Its default handler throws on the parent event loop and strands pending tasks.
 * Node may load additional workers after startup; browsers use the fixed pool.
 *
 * @param pool - The installed SDK's PThread object.
 * @param failed - Retire only the heap that owns the failed worker.
 */
export const observeTaskWorkerFailures=(pool,failed) => {
	const observe=worker => {
		worker.onerror=event => {
			event?.preventDefault?.();
			const reason=event?.error ?? event;
			failed(new Error("Lean Wasm worker failed"+(event?.message ? ": "+event.message : ""),{cause: reason}));
		};
	};
	for(const worker of [...pool.unusedWorkers,...Object.values(pool.pthreads)]) observe(worker);
	const load=pool.loadWasmModuleToWorker;
	pool.loadWasmModuleToWorker=worker => {
		const loaded=load.call(pool,worker); // Emscripten installs onerror synchronously.
		observe(worker); return loaded;
	};
};

/**
 * Load generated descriptors without exposing the heap or native slots.
 *
 * @param createModule - Package-local Emscripten module factory.
 */
export const createWasmTaskLoader = createModule => {
	const loaded = new Map(), notifications = createWasmTaskNotifications();
	let engine, session, module, closed = false, closing, finalOwners=null;
	const start = () => engine ??= (async () => {
		if(typeof SharedArrayBuffer === "undefined" || globalThis.crossOriginIsolated === false)
			throw new Error("Lean tasks require a shared WebAssembly heap (cross-origin isolation in browsers)");
		const failed=error => {
			if(!session || !["open","closing"].includes(session.snapshot().state)) return;
			try
{ session.retire(error); } catch { /* The session delivered this error to all public operations. */ }
		};
		module=await createModule({onLeanTaskReady: notifications.notify,onAbort: reason => failed(new Error("Lean Wasm runtime aborted",{cause: reason}))});
		session=createWasmTaskSession({module,notifications,installHost: lifecycle=>installWasmTaskHostMembers(module,lifecycle),nativeOwners: () => finalOwners=module._bridge_owned_runtime_identities(),terminate: () => module.PThread.terminateAllThreads()});
		observeTaskWorkerFailures(module.PThread,failed);
		return session;
	})();
	const load = async ({bindingIr,componentIdentity,bindingIrSha256,integrity,sideModule,hostImports=null,zendObjects=false}) => {
		if(closed || (session && session.snapshot().state!=="open")) throw new Error("Lean task loader is closed");
		const abi=javaScriptTaskAbi(bindingIr,componentIdentity,hostImports,zendObjects);
		if(abi.bindingIrSha256!==bindingIrSha256 || !/^[0-9a-f]{64}$/u.test(integrity) || !(sideModule instanceof URL))
			throw new TypeError("Invalid Lean task component identity");
		const id=bindingIr.component.id, revision=[componentIdentity,bindingIrSha256,integrity].join(":");
		const previous=loaded.get(id);
		if(previous)
		{
			if(previous.revision!==revision) throw new Error("Conflicting installed task components: "+id);
			return previous.binding;
		}
		const binding=(async () => {
			const bytes=await componentBytes(sideModule);
			if(await digest(bytes)!==integrity) throw new Error("Lean task component integrity mismatch");
			const exports=WebAssembly.Module.exports(await WebAssembly.compile(bytes)).filter(e => e.name.startsWith("lb_js_task_"));
			if(exports.length!==1 || exports[0].name!==abi.controlSymbol || exports[0].kind!=="function")
				throw new Error("Lean task component control mismatch");
			if(closed) throw new Error("Lean task loader is closed");
			const owner=await start();
			if(closed || owner.snapshot().state!=="open") throw new Error("Lean task runtime is not open");
			const pointers=[];
			const string=value => {
				const data=new TextEncoder().encode(value+"\0"), p=module._malloc(data.length);
				if(!p) throw new Error("Unable to allocate Lean task loader arguments");
				pointers.push(p); module.HEAP8.set(data,p); return p;
			};
			const path="/task-"+componentIdentity+".wasm";
			try
			{
				module.FS.writeFile(path,bytes);
				const slot=module._lb_js_task_load(string(path),string(abi.controlSymbol));
				if(!slot) throw new Error("Cannot link installed Lean task component");
				module.FS.unlink(path);
				while(pointers.length) module._free(pointers.pop());
				return owner.bind(abi,frame => module._lb_js_task_call(slot,frame),hostImports?(zendObjects?phpWasmHostMembers:javaScriptHostMembers)(hostImports):null);
			}
			catch(error)
{ return owner.retire(error); }
		})();
		loaded.set(id,{revision,binding});
		try
		{ return await binding; }
		catch(error)
		{ loaded.delete(id); throw error; }
	};
	const close = () => {
		closed=true;
		// Do not yield to an already queued readiness microtask before closing
		// admission and claiming cancellation of the pending public operations.
		return closing ??= session ? session.close() : engine ? engine.then(owner => owner.close()) : Promise.resolve();
	};
	const stats = () => {
		const snapshot=session?.snapshot();
		return {...snapshot, notifications: notifications.pending()
			, nativeOwners: snapshot?.state==="open" ? module._bridge_owned_runtime_identities() : finalOwners};
	};
	return Object.freeze({load,close,stats,whenIdle: notifications.whenIdle});
};
