/** @file Browser-safe contract for synchronous, in-memory IO on the shared wasm32 heap. */
import { canonicalizeJsonValue, hashBindingIr } from "../binding-ir/canonical.mjs";
import { componentScalarTypes } from "./component-scalars.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";

export const componentSyncIOAbi = 15;
export const componentImmediateIOAbi = 18;
// Ordinary calls and cursor constructors use their declaration index. These
// two disjoint spaces contain only the selected cursor operations.
export const immediateNextBase = 0x40000000, immediateCloseBase = 0x80000000;
/**
 * A concrete error payload the wasm32 IO transport can copy without a handle.
 *
 * @param type - Public error payload type.
 * @param level - Current Except nesting depth.
 */
export const supportsJavaScriptIOPayload = (type, level = 0) =>
	(type?.kind === "primitive" && componentScalarTypes.includes(type.name))
	|| (level < 32 && type?.kind === "apply" && type.constructor === "result"
		&& type.arguments?.length === 2 && type.arguments.every(item => supportsJavaScriptIOPayload(item, level + 1)));
const shape = (t,level=0)=>{
	if(t?.kind==="primitive" && componentScalarTypes.includes(t.name)) return t.name;
	if(level<32 && t?.kind==="apply" && t.constructor==="result" && t.arguments?.length===2) return t.arguments.map(x=>shape(x,level+1));
	throw new TypeError("The synchronous JS IO surface requires primitives or returned Except values");
};
const depth = t=>Array.isArray(t)?1+Math.max(...t.map(depth)):0;

/**
 * Derive every frame from the original binding contract. The descriptor never
 * decides which error channel to use or what type an owned pointer contains.
 *
 * @param ir - Public checked Binding IR.
 * @param componentIdentity - Identity of the compiler evidence and native adapter.
 */
export const javaScriptIOAbi = (ir,componentIdentity) => {
	const bindingIrSha256 = hashBindingIr(ir);
	if(!/^[0-9a-f]{64}$(?![\s\S])/u.test(componentIdentity) || ir.capabilities.length || ir.types.length)
		throw new Error("JavaScript IO requires an in-memory function API and compiled identity");
	const methods = ir.declarations.map(d=>{
		const ext = d.source?.extensions, effect = ext?.["lean-lang.org/effect"];
		const errorId = effect==="IO"?"error:IO.Error":effect==="EIO"?"error:EIO."+d.source.declaration:null;
		const direct = d.resultMode==="iterator", protocol = ext?.["lean-bridge.dev/pull-protocol"], step = ext?.["lean-bridge.dev/pull-effect"];
		const stepId = direct && step!=="BaseIO" ? "error:Step."+d.source.declaration : null;
		const stepError = stepId ? ir.errors.find(e=>e.id===stepId) : null;
		if(direct && (protocol?.open!==d.source.declaration || !protocol.next || !protocol.close
			|| !["BaseIO","IO","EIO"].includes(step) || Boolean(ext["lean-bridge.dev/step-failure"])!==(step==="IO")
			|| step==="IO" && (ext["lean-bridge.dev/step-failure"]!=="IO.Error" || stepError?.payload!==null)
			|| stepId && stepError?.category!=="domain" || d.effects.includes("async")))
			throw new Error("Inconsistent immediate JavaScript pull: "+d.id);
		if(!["pure","IO","EIO","BaseIO"].includes(effect) || d.kind!=="function" || d.owner!==null || (!direct && d.resultMode!=="value")
			|| d.failure.unexpected!=="poison-runtime" || d.capabilities.length || canonicalizeJsonValue(d.failure.errors)!==canonicalizeJsonValue([errorId,stepId].filter(Boolean)))
			throw new Error("Inconsistent synchronous JavaScript effect: "+d.id);
		const args = d.parameters.map(p=>shape(p.type)), result = shape(d.result.type);
		if(args.some(Array.isArray)) throw new Error("JavaScript IO arguments must be primitives");
		const error = effect==="IO"?"string":errorId?shape(ir.errors.find(e=>e.id===errorId)?.payload):null;
		const terminal = stepId ? step==="IO" ? "string" : shape(stepError.payload) : null;
		const cursor = direct ? {cursor: true,stepId,terminal,stepIO: step==="IO",next: protocol.next} : {};
		const tagBytes = Math.max(1,depth(result),depth(error),depth(terminal));
		return {id: d.id,args,result,errorId,error,...cursor,tagBytes};
	});
	const direct = methods.some(m=>m.cursor);
	if(methods.length>=immediateNextBase) throw new Error("Too many synchronous declarations");
	const key = sha256Text((direct?"javascript-wasm-immediate-io-v1:":"javascript-wasm-sync-io-v1:")+componentIdentity+":"+bindingIrSha256);
	return {version: direct?componentImmediateIOAbi:componentSyncIOAbi,componentIdentity,bindingIrSha256,controlSymbol: "lbjs_component_"+key.slice(0,20)+"_control",methods};
};

/**
 * Validate a serialized component descriptor before loading any of its bytes.
 *
 * @param abi - Packaged private ABI.
 * @param ir - Public Binding IR.
 */
export const assertJavaScriptIOAbi = (abi,ir)=>{
	if(canonicalizeJsonValue(abi)!==canonicalizeJsonValue(javaScriptIOAbi(ir,abi?.componentIdentity))) throw new Error("JavaScript IO descriptor differs from its Binding IR");
};
