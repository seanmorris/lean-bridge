/** @file Lower returned worker functions to private, nominal native ledger entries. */
import {canonicalizeJsonValue} from "../../binding-ir/canonical.mjs";
import {workerFunctionNames} from "../../abi/wasm-host-factories.mjs";

/**
 * The worker already knows how to borrow a Lean reference for an active call
 * and release a typed lease. Reuse that code without projecting the lease as
 * a public class. Both the direct factory and its application run on the owner.
 *
 * @param api - Compiler-elaborated public callable definitions.
 * @param abi - Independently reconstructed public worker contract.
 * @param entries - Original checked Lean declarations in export order.
 * @param resources - Actual application-owned Lean types.
 */
export const lowerWorkerHostFunctions=(api,abi,entries,resources)=>{
	const extra=[],types=[],definitions=[];
	if(!entries.some(e=>e.result.kind==="io-closure") && !abi.methods.some(m=>m.returnedFunction)) return {entries,resources,definitions};
	const publicEntries=entries.map((e,i)=>{
		const f=abi.methods[i].returnedFunction;
		if(!f && e.result.kind!=="io-closure") return e;
		const fail=()=>{throw new TypeError("Compiled worker function differs from its factory: "+e.declaration);};
		if(!f || e.result.kind!=="io-closure" || e.delivery || e.effect!=="IO" || abi.methods[i].declaration!==e.declaration) fail();
		const site=api.types.find(t=>t.id===api.declarations[i].result.type.id),c=site?.callable;
		if(!c || canonicalizeJsonValue(c.parameters[0].type)!==canonicalizeJsonValue(e.result.argument)
			|| canonicalizeJsonValue(c.result.type)!==canonicalizeJsonValue(e.result.reply)) fail();
		const {argument,reply}=e.result,n=workerFunctionNames(f.hash),ref={kind: "named",id: "lean:"+n.lean};
		types.push({kind: "resource"
			, id: ref.id
			, host: null
			, resource: {kindId: "resource:"+n.lean+"/"+f.hash}
			, source: {declaration: n.lean,extensions: {"lean-bridge.dev/resource-identity": f.hash}}});
		definitions.push({hash: f.hash,argument,reply,owner: site.source.extensions["lean-bridge.dev/closure-owner"]});
		extra.push({name: n.wireName,declaration: n.apply,effect: "IO",parameters: [{name: "fn",type: ref},{name: "value",type: argument}],result: reply});
		return {...e,result: ref};
	});
	return {entries: [...publicEntries,...extra],resources: [...resources,...types],definitions};
};
