/** @file Exercise an authored Lean PHP component in the actual Zend interpreter. */
import {phpWasmMemberOwner} from "../../../src/backends/php/php-wasm-member-owner.mjs";
import {phpWasmHostMembers} from "../../../src/backends/php/host-members.mjs";
import {javaScriptTaskAbi} from "../../../src/abi/javascript-wasm-tasks.mjs";
import {createPhpCallbackHub} from "../../../src/backends/php/php-wasm-task-mailbox.mjs";
import {phpWasmObjectDomain} from "../../../src/backends/php/php-wasm-task-objects.mjs";
import {phpZendTaskOperation,translateZendWorkerFailure} from "../../../src/backends/php/php-wasm-task-owner.mjs";
import {createWasmTaskLoader} from "../../../src/runtime/wasm-task-loader.mjs";
import {runZendClient,drainedZendStats} from "./zend-test-host.mjs";

/**
 * Run the immediate and asynchronous declarations from the compiler-derived PHP interface.
 *
 * @param options - The PHP interpreter, pthread factory, mounted sources and authenticated worker descriptor.
 */
export const exerciseZendAuthor=async options=>{
	const {Php,factory,sources,brick,descriptor,side}=options;
	const d=descriptor,abi=javaScriptTaskAbi(d.bindingIr,d.componentIdentity,d.hostImports,true);
	if(!d.zendObjects || d.bindingIrSha256!==abi.bindingIrSha256 || abi.hostKinds.length!==1) throw new Error("Wrong authored PHP interface");
	const kind=abi.hostKinds[0].type,domain=phpWasmObjectDomain([kind]),hub=createPhpCallbackHub();
	const model=phpWasmHostMembers(d.hostImports),members=phpWasmMemberOwner(model,domain);
	const runtime=createWasmTaskLoader(factory);let bindings,verifiedTrap=false;
	const finish=async()=>{
		try
		{await bindings?.dispose();}
		finally
		{await runtime.close();}
	};
	try
	{
		const compiled=await runtime.load({...d,sideModule: new URL(side)});
		bindings=compiled.withZendOwner({Box: domain.classFor(kind)},translateZendWorkerFailure,members.send);
		const shared={kind: ()=>kind,mint: domain.mint,model: ()=>JSON.stringify(model),methods: ()=>JSON.stringify(abi.methods)};
		for(const m of abi.methods)
			shared[m.name]=phpZendTaskOperation(m,bindings[m.name],hub,domain,members);
		const checks=await runZendClient({Php,shared,brick,sources});
		const stats=await drainedZendStats(runtime);
		// An interpreter transport trap is not a PHP member's declared exception.
		// Inject it at the live owner boundary with unrelated native work pending.
		const mirror=domain.borrow(kind,domain.mint(kind));
		const pending=bindings.project(mirror,()=>new Promise(()=>{})).then(()=>false,()=>true);
		const fault=new WebAssembly.RuntimeError("injected Zend transport trap");
		let refused=false;
		try
		{members.enter(()=>{throw fault;},()=>bindings.read(mirror));} catch
		{refused=true;}
		if(!refused || !await pending) throw new Error("Unexpected Zend trap was not terminal");
		const poisoned=runtime.stats();
		if(poisoned.state!=="poisoned" || ["frames","pending","allocations","notifications","hostPins","hostErrors"].some(k=>poisoned[k]!==0))
			throw new Error("Poisoned Zend owner did not drain: "+JSON.stringify(poisoned));
		let rejected=false;
		try
		{bindings.read(mirror);} catch
		{rejected=true;}
		if(!rejected) throw new Error("A trapped PHP heap was reused");
		verifiedTrap=true;
		return {...checks,componentIdentity: d.componentIdentity,integrity: d.integrity,stats,trap: poisoned.state};
	} finally
	{
		if(!verifiedTrap) await finish();
		else await finish().then(()=>{throw new Error("Poisoned executor unexpectedly closed cleanly");},()=>{});
	}
};
