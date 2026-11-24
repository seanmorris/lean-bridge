/** @file Load the native identity broker once per initialized, single-threaded Wasm heap. */
import { createWasmHostDomain } from "./wasm-host-domain.mjs";
import { createWasmHostErrorStore, createWasmHostWire } from "./wasm-host-wire.mjs";

const installations=new WeakMap(), name=new TextEncoder().encode("lb_jsh_domain_control_v1\0");
const init = async (wasm,bytes,lifecycle) => {
	if(!wasm._bridge_lean_runtime_status || wasm._bridge_lean_runtime_status()!==2 || Object.hasOwn(wasm,"lbJshDomainV1"))
		throw new Error("JavaScript host domain requires a fresh, initialized owner heap");
	const view=()=>new DataView(wasm.HEAP8.buffer);
	const retire=kind=>{
		lifecycle?.assertOpen();
		try
		{
			const p=wasm._malloc(32+name.length)>>>0;
			if(!p) throw new Error("Cannot allocate JavaScript domain retirement frame");
			wasm.HEAP8.fill(0,p,p+32); wasm.HEAP8.set(name,p+32);
			const v=view(); v.setUint32(p,0x4a484431,true);v.setUint32(p+4,32,true);
			v.setUint32(p+12,1,true);v.setUint32(p+16,kind,true);
			const status=wasm._bridge_scalar_call(p+32,p);
			lifecycle?.assertOpen();
			if(status) throw new Error("JavaScript domain could not retire its native wrappers");
			wasm._free(p);
		} catch(error)
		{ lifecycle?.poison(); throw error; }
	};
	const arena=createWasmHostDomain(retire), errors=createWasmHostErrorStore(), stack=[];
	const current=id=>{
		const s=stack.at(-1); if(!s || s.id!==id) throw new Error("Host call outside its bound component");
		return s;
	};
	const hooks=Object.freeze({attach: arena.attach, detach: arena.detach
		, strong: arena.strong, discard: errors.discard
		, kind: (id,i)=>current(id).session.kind(i)
		, send: (id,...args)=>current(id).wire.call(...args)
		, finish: (id,out)=>current(id).wire.finish(out)
		, deliver: (id,...args)=>{
			lifecycle?.assertOpen();
			const status=current(id).deliver(...args);
			lifecycle?.assertOpen();return status;
		}
		, record: (id,status,out)=>{
			const {wire}=current(id);
			const failure=out?wire.observed(out):null;
			if(failure && (failure.application?1:3)===status) return errors.keep(failure);
			if(status===1) throw new Error("Host exception without a matching owner frame");
			return errors.keep({application: false,error: new TypeError("Invalid native JavaScript host value")});
		}
	});
	Object.defineProperty(wasm,"lbJshDomainV1",{value: hooks});
	const path="/lean-bridge-javascript-host-domain-v1.wasm";
	wasm.FS.writeFile(path,bytes);
	try
	{ await wasm.loadDynamicLibrary(path,{global: true,loadAsync: true,nodelete: true}); }
	finally
	{ wasm.FS.unlink(path); }
	const bind=(id,model,supplied)=>{
		if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(id)) throw new TypeError("Invalid JavaScript host component identity");
		const session=arena.bind(model,supplied);
		let wire;
		try
		{ wire=createWasmHostWire(wasm,model,session.classes,session,lifecycle); }
		catch(error)
		{ session.close(); throw error; }
		const during=(fn,deliver)=>{
			session.enter();stack.push({id,session,wire,deliver});
			try
			{ return fn(); }
			finally
			{ stack.pop();session.leave(); }
		};
		return Object.freeze({during,close: session.close,pin: session.pin,release: session.release,resolve: session.resolve,kind: session.kind});
	};
	return Object.freeze({bind,takeError: errors.take,live: arena.live,heldErrors: errors.size});
};

/**
 * Install a previously integrity-checked broker binary, rejecting different
 * bytes on the same heap even while an earlier load is in flight. A failed
 * dynamic link is sticky: never retry on a potentially partially linked heap.
 *
 * @param wasm - Initialized shared Emscripten runtime.
 * @param binary - Authenticated bytes from the matching prepared runtime release.
 * @param lifecycle - Optional shared loader retirement guard and quarantine.
 */
export const installWasmHostDomain = (wasm,binary,lifecycle) => {
	if(!(binary instanceof Uint8Array) || !binary.length) throw new TypeError("Expected JavaScript host broker Wasm");
	const old=installations.get(wasm);
	if(old)
	{
		if(old.bytes.length!==binary.length || old.bytes.some((v,i)=>v!==binary[i])) throw new Error("Conflicting JavaScript host broker on one heap");
		return old.promise;
	}
	const bytes=new Uint8Array(binary);
	const promise=Promise.resolve().then(()=>init(wasm,bytes,lifecycle));
	installations.set(wasm,{bytes,promise});return promise;
};
