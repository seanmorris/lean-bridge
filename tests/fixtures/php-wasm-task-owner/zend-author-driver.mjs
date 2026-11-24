/** @file Exercise an authored Lean PHP component in the actual Zend interpreter. */
import {javaScriptTaskAbi} from "../../../src/abi/javascript-wasm-tasks.mjs";
import {createPhpCallbackHub} from "../../../src/backends/php/php-wasm-task-mailbox.mjs";
import {phpWasmObjectDomain} from "../../../src/backends/php/php-wasm-task-objects.mjs";
import {phpZendTaskOperation,translateZendWorkerFailure} from "../../../src/backends/php/php-wasm-task-owner.mjs";
import {createWasmTaskLoader} from "../../../src/runtime/wasm-task-loader.mjs";
import {runZendClient,drainedZendStats} from "./zend-test-host.mjs";

/**
 * Run exactly the async declarations from the compiler-derived PHP interface.
 *
 * @param options - The PHP interpreter, pthread factory, mounted sources and authenticated worker descriptor.
 */
export const exerciseZendAuthor=async options=>{
	const {Php,factory,sources,brick,descriptor,side}=options;
	const d=descriptor,abi=javaScriptTaskAbi(d.bindingIr,d.componentIdentity,d.hostImports,true);
	if(!d.zendObjects || d.bindingIrSha256!==abi.bindingIrSha256 || abi.hostKinds.length!==1) throw new Error("Wrong authored PHP interface");
	const kind=abi.hostKinds[0].type,domain=phpWasmObjectDomain([kind]),hub=createPhpCallbackHub();
	const runtime=createWasmTaskLoader(factory);let bindings;
	try
	{
		const compiled=await runtime.load({...d,sideModule: new URL(side)});
		bindings=compiled.withHostsAndSynchronousStart({Box: domain.classFor(kind)},translateZendWorkerFailure);
		const shared={kind: ()=>kind,mint: domain.mint,methods: ()=>JSON.stringify(abi.methods)};
		for(const m of abi.methods.filter(m=>m.delivery))
			shared[m.name]=phpZendTaskOperation(m,bindings[m.name],hub,domain);
		const checks=await runZendClient({Php,shared,brick,sources});
		return {...checks,componentIdentity: d.componentIdentity,integrity: d.integrity,stats: await drainedZendStats(runtime)};
	} finally
	{try
	{await bindings?.dispose();} finally
	{await runtime.close();}}
};
