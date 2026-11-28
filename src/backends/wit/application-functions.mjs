/** @file Lower a guest-owned WIT callable to its private, binding-checked native operations. */
import {canonicalJson,sha256} from "../../capsule/node.mjs";
import {hashBindingIr} from "../../binding-ir/canonical.mjs";
import {hostDeclarationName} from "../../abi/host-member-names.mjs";

const u32={kind: "primitive",name: "uint32"},unit={kind: "primitive",name: "unit"};
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);

/**
 * Expand one public factory into its private native entry points.
 *
 * @param e - Actual source entry, never a synthetic declaration in public Binding IR.
 */
export const witFunctionEntries=e=>{
	if(e.result.kind!=="io-closure")return [e];
	if(e.delivery || e.effect!=="IO") throw new TypeError("WIT functions require an immediate IO factory");
	const base=(role,parameters,result)=>({...e,name: "lb_wit_"+role+"_"+e.name,parameters,result});
	const self={name: "self",type: u32};
	return [base("make",e.parameters,u32)
		, base("invoke",[self,{name: "value",type: e.result.argument}],e.result.reply)
		, {...base("drop",[self],unit),effect: "BaseIO",hostMembers: []}];
};

/**
 * Check that a factory really returns this Lean function, not an imported registration.
 *
 * @param e - Fresh Lean elaboration.
 * @param d - Corresponding source declaration.
 * @param api - Reconciled public IR.
 * @param ir - Independent, authored guest resource import declarations.
 */
export const verifyWitFunction=(e,d,api,ir)=>{
	const fail=()=>{throw new TypeError("Inconsistent binding-owned WIT function: "+e.declaration);};
	const source=d.source.extensions,imports=hashBindingIr(ir),owner="wit-wasi-host-binding";
	const used=source["lean-bridge.dev/host-members"],members=new Map(ir.declarations.map(m=>
		["LeanBridge.Host.WitWasi."+ir.types.find(t=>t.id===m.owner).name+"."+hostDeclarationName(m),m]));
	if(!Array.isArray(used) || new Set(used).size!==used.length || used.some(n=>!members.has(n))) fail();
	const {argument,reply}=e.result,errors=["error:IO.Error",...used.length?["error:WitHostError"]:[]];
	const effects=[...new Set(["fails","nondeterministic",...used.flatMap(n=>members.get(n).effects)])].sort();
	const capabilities=d.capabilities;
	const hash=sha256(canonicalJson({component: api.component,declaration: e.declaration,argument,reply,imports,owner,errors,capabilities}));
	const name="LeanClosure"+hash.slice(0,20),t=api.types.find(v=>v.id==="bridge:"+name),c=t?.callable;
	const site=type=>{
		const nominal=type.kind==="named" && ir.types.find(k=>k.id===type.id);
		if(!nominal && type.kind!=="primitive") fail();
		return {type,ownership: nominal?"lease":"copy",lifetime: nominal?{scope: "explicit",anchor: null}:null};
	};
	const parameters=e.parameters.map(p=>({...p.type.kind==="host-record"?{type: {kind: "named",id: "lean:"+p.type.declaration},ownership: "borrow",lifetime: {scope: "call",anchor: null}}:site(p.type),name: p.name
		, mutability: ir.types.find(k=>k.id===p.type.id)?.mutability??"immutable"
		, optional: false
		, default: null}));
	if(d.source.producer!=="lean" || source["lean-lang.org/effect"]!=="IO" || d.resultMode!=="value"
		|| !same(d.parameters,parameters)
		|| !same(d.result,{type: {kind: "named",id: "bridge:"+name},ownership: "lease",lifetime: {scope: "explicit",anchor: null}}) || source["lean-bridge.dev/host-imports-sha256"]!==imports
		|| !same(d.failure,{mode: "declared",errors,unexpected: "poison-runtime"})
		|| t?.name!==name || t.kind!=="callback" || t.representation!=="identity" || t.mutability!=="immutable"
		|| t.resource!==null || t.host!==null || t.target!==null || t.fields.length || t.cases.length || t.typeParameters.length || t.assurance.length
		|| !same(t.source,{producer: "lean",declaration: e.declaration,extensions: {"lean-bridge.dev/closure-owner": owner,"lean-bridge.dev/required-capabilities": capabilities}})
		|| !c || c.invocation!=="many" || c.reentry!=="same-agent" || c.selfDisposal!=="defer" || c.resultMode!=="value"
		|| !same(c.effects,effects) || !same(c.failure,{mode: "declared",errors,unexpected: "poison-runtime"})
		|| !same(c.parameters,[{...site(argument),name: "value",mutability: ir.types.find(k=>k.id===argument.id)?.mutability??"immutable",optional: false,default: null}])
		|| !same(c.result,site(reply))) fail();
};
