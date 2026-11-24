/** @file Use the same owner and PHP program in Node and Chromium. */
import {javaScriptTaskAbi} from "../../../src/abi/javascript-wasm-tasks.mjs";
import {createPhpCallbackHub} from "../../../src/backends/php/php-wasm-task-mailbox.mjs";
import {phpWasmObjectDomain} from "../../../src/backends/php/php-wasm-task-objects.mjs";
import {phpZendTaskOperation} from "../../../src/backends/php/php-wasm-task-owner.mjs";
import {createWasmTaskLoader} from "../../../src/runtime/wasm-task-loader.mjs";

/**
 * Run the private Zend transport against the supplied actual Wasm binaries.
 *
 * @param o - Receipt-bound component, owner module factory, PHP interpreter and client source.
 */
export const exerciseZendObjects=async o=>{
	const {factory,Php,sources,stages}=o,runtime=createWasmTaskLoader(factory);
	const abis=stages.map(({descriptor: d})=>{
		const abi=javaScriptTaskAbi(d.bindingIr,d.componentIdentity,d.hostImports);
		if(abi.bindingIrSha256!==d.bindingIrSha256 || abi.hostKinds.length!==1 || abi.hostKinds[0].name!=="Box")
			throw new Error("Unexpected compiled Zend test interface");
		return abi;
	});
	const kind=abis[0].hostKinds[0].type;
	if(abis[1].hostKinds[0].type!==kind) throw new Error("Components disagree on the Zend input type");
	const domain=phpWasmObjectDomain([kind]),hub=createPhpCallbackHub(),owners=[];
	const shared={objectKind: ()=>kind,objectMint: domain.mint,sameCap: (a,b)=>a===b};
	try
	{
		const translate=e=>Object.assign(new Error(e.message,{cause: e.details.errorId==="error:JavaScriptCallbackError"?e.details.payload:e}),{code: e.details.errorId});
		for(const [index,{descriptor,name: packageName}] of stages.entries())
		{
			const compiled=await runtime.load({...descriptor,sideModule: new URL(o.side(packageName))});
			const bindings=compiled.withHostsAndSynchronousStart({Box: domain.classFor(kind)},translate);owners.push(bindings);
			for(const name of ["map_box","relay_box","project_box","select_box"])
			{
				const method=abis[index].methods.find(m=>m.name===name),d=descriptor.bindingIr.declarations.find(v=>v.id===method?.id);
				if(JSON.stringify(d?.source.extensions["lean-bridge.dev/host-member-phases"])!=='{"call":[]}')
					throw new Error("Zend callback kernel cannot dispatch synchronous host members");
				shared[(index?"peer_":"")+name]=phpZendTaskOperation(method,bindings[name],hub,domain);
			}
		}
		shared.closePeer=()=>owners[1].dispose().then(()=>true);
		const php=new Php({version: "8.4",autoTransaction: false,shared});let out="",err="";
		php.addEventListener("output",e=>{out+=e.detail.join("");});php.addEventListener("error",e=>{err+=e.detail.join("");});
		if((await php.binary).HEAPU8.buffer instanceof SharedArrayBuffer) throw new Error("Expected separate, unthreaded Zend heap");
		const dirs=new Set();
		for(const [path,contents] of Object.entries(o.brick))
		{
			const parts=path.split("/");let parent="";
			for(const part of parts.slice(0,-1))
			{parent+="/"+part;if(!dirs.has(parent))
			{await php.mkdir(parent);dirs.add(parent);}}
			await php.writeFile("/"+path,contents);
		}
		for(const [name,source] of Object.entries(sources)) await php.writeFile("/"+name+".php",source);
		const rc=await php.run("<?php require '/dependencies/brick-math/autoload.php';"+Object.keys(sources).map(n=>"require '/"+n+".php';").join(" "));
		if(rc!==0 || err) throw new Error(err || out || "PHP failed: "+rc);
		const checked=JSON.parse(out);await runtime.whenIdle();const stats=runtime.stats();
		for(const key of ["frames","allocations","pending","notifications","nativeOwners","hostPins","hostErrors"])
			if(stats[key]!==0) throw new Error(key+" not drained: "+stats[key]);
		return {...checked,components: stages.map(({descriptor: d})=>({componentIdentity: d.componentIdentity,integrity: d.integrity})),stats};
	} finally
	{
		try
		{for(const owner of owners.reverse()) await owner.dispose();}
		finally
		{await runtime.close();}
	}
};
