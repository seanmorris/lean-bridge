/** @file Synchronous WIT call surface for compiled Lean with application-owned resources. */
import { canonicalValue } from "./canonical-values.mjs";
import { canonicalJson } from "../../capsule/node.mjs";
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";
import { witVariantMember } from "./copied-variants.mjs";

const reject=message=>{throw new TypeError("WIT application operations: "+message);};
const align=(n,a)=>Math.ceil(n/a)*a;
const sum=(a,b)=>{
	const alignment=Math.max(a.align,b.align);
	return {
		left: a
		, right: b
		, align: alignment
		, size: align(alignment+Math.max(a.size,b.size),alignment)
		, flat: ["i32","i32"]
		, wit: `result<${a.wit}, ${b.wit}>`
		, native: `result<${a.native}, ${b.native}>`
		, wat: `(result ${a.wat} (error ${b.wat}))`
	};
};
/**
 * Match the Component Model's standard32 mangling compatibility track.
 *
 * @param qualified - Versioned package/interface coordinate.
 */
export const witCoreInterface = qualified => qualified.replace(/@([^@]+)$/u,(_,v)=>{
	const [major,minor]=v.split(".");
	return "@"+(v.includes("-")?v:major!=="0"?major:minor!=="0"?"0."+minor:v);
});

/**
 * Public functions preserve real resource identities. Only the private native
 * hooks substitute a checked zero for a resource moved through the exchange;
 * their copyable arguments/results still use the ordinary canonical ABI.
 *
 * @param options - Captured synchronous source entries and object interface.
 */
export const witApplicationOperations = options => {
	const {descriptor,entries,name,version,api: binding}=options,{contract,interfaceName: objects}=descriptor;
	validateOrdinaryWasiSettings({name,version});
	const names=new Set(),unique=base=>{let n=base;while(names.has(n))n="lb-"+n;names.add(n);return n;};
	const labels=entries.map(e=>witVariantMember(e.name,names,reject,"operation"));
	const privateNames=new Set(labels);
	let signedName="signed-value";while(privateNames.has(signedName))signedName="lb-"+signedName;
	const aliases=new Map(),local=key=>{
		if(!aliases.has(key))aliases.set(key,unique(key));
		return "%"+aliases.get(key);
	};
	const resource=(index,borrow=false)=>{
		const r=contract.resources[index],alias=local(r?r.name:contract.error);
		return {slot: index,wit: (borrow?"borrow":"own")+"<"+alias+">",native: "u32",wat: "u32",size: 4,align: 4,flat: ["i32"]};
	};
	const types=new Map(contract.resources.map((r,i)=>[r.id,i]));
	let signed=false,io=null;
	const value=(t,borrow=false)=>{
		if(t.kind==="named" && types.has(t.id))return resource(types.get(t.id),borrow);
		if(t.kind==="apply" && t.constructor==="result" && t.arguments.length===2 && !borrow)return sum(...t.arguments.map(v=>value(v)));
		if(t.kind!=="primitive")return reject("unsupported "+(borrow?"parameter":"result")+" type "+JSON.stringify(t));
		const k=t.name;
		if(k==="int")
		{
			signed=true;return {k,wit: local(contract.integer),native: signedName,wat: "$signed",flat: ["i32","i32","i32"],size: 12,align: 4};
		}
		if(k==="unit")return {k,wit: local(contract.unit),native: "u8",wat: "u8",flat: ["i32"],size: 1,align: 1};
		if(k==="nat")return {k,wit: "list<u32>",native: "list<u32>",wat: "(list u32)",flat: ["i32","i32"],size: 8,align: 4};
		const v=canonicalValue({kind: "primitive",name: k==="isize"?"int64":k==="usize"?"uint64":k});
		return {...v,k,native: v.wit};
	};
	const declarations=new Map(binding.declarations.filter(d=>d.resultMode==="value").map(d=>[d.source.declaration,d]));
	const payloads=new Map(binding.errors.map(err=>[err.id,err.payload]));
	if(declarations.size!==entries.length)return reject("synchronous export inventory differs from Binding IR");
	const variants=[],methods=entries.map((e,i)=>{
		if(e.delivery || !["pure","BaseIO","IO","EIO"].includes(e.effect))return reject("expected a synchronous Lean export");
		const d=declarations.get(e.declaration);
		if(!d || d.name!==e.name || d.failure.unexpected!=="poison-runtime")return reject("inconsistent source declaration: "+e.declaration);
		if(canonicalJson(d.result.type)!==canonicalJson(e.result)
			|| canonicalJson(d.parameters.map(({name,type})=>({name,type})))!==canonicalJson(e.parameters)
			|| (e.effect==="EIO" && canonicalJson(payloads.get("error:EIO."+e.declaration)??null)!==canonicalJson(e.error)))
			return reject("value or failure payload differs from Binding IR: "+e.declaration);
		const errors=d.failure.errors,member=errors.includes("error:WitHostError");
		const expected=e.effect==="IO"?["error:IO.Error",...member?["error:WitHostError"]:[]]:e.effect==="EIO"?["error:EIO."+e.declaration]:[];
		if(errors.length!==expected.length || !expected.every(id=>errors.includes(id) && payloads.has(id)))return reject("unrecognized failure channels for "+e.declaration);
		const argNames=new Set(),params=e.parameters.map(p=>({name: witVariantMember(p.name,argNames,reject,"parameter"),type: value(p.type,true)}));
		const result=value(e.result),declared=e.effect==="EIO"?value(e.error):null;
		let output=result;
		if(errors.length)
{
			let payload=declared??value({kind: "primitive",name: "string"});
			if(member)
{
				const external=resource(contract.resources.length),fault=io??=unique("io-failure");
				if(!variants.length)variants.push({wit: `  variant %${fault} { member(${external.wit}), io(string) }`});
				payload={...sum(external,payload),wit: "%"+fault};
}
			output=sum(result,payload);
}
		return {entry: e,index: i,name: labels[i],params,result,declared,member,errors,output};
	});
	const nativeName="lean-bridge:"+name+"/native@"+version,publicName="lean-bridge:"+name+"/api@"+version,exchange=objects.replace("/objects@","/exchange@");
	const signatures=side=>methods.map(m=>"  %"+m.name+": func("+m.params.map(p=>"%"+p.name+": "+p.type[side]).join(", ")+") -> "+m.output[side]+";");
	const nativeType=[
		"(instance"
		, ...signed?['(type $record (record (field "negative" bool) (field "limbs" (list u32))))',`(export "${signedName}" (type $signed (eq $record)))`]:[]
		, ...methods.map(m=>`(export "${m.name}" (func ${m.params.map(p=>`(param "${p.name}" ${p.type.wat})`).join(" ")} (result ${m.output.wat})))`)
		, ")"
	].join("\n");
	const imports=[...aliases].map(([key,alias])=>"%"+key+(key===alias?"":" as %"+alias));
	const pkg="package lean-bridge:"+name+"@"+version+";";
	const api=[
		"interface api {"
		, ...imports.length?["  use "+objects+".{"+imports.join(", ")+"};"]:[]
		, ...variants.map(v=>v.wit),...signatures("wit"),"}"
	].join("\n");
	const wit=[
		pkg,"interface native {"
		, ...signed?["  record "+signedName+" { negative: bool, limbs: list<u32> }"]:[]
		, ...signatures("native"),"}",api
		, `world bridge { import ${objects}; import ${exchange}; import native; export api; }`
	].join("\n");
	const publicWit=[pkg,api,"world consumer { import api; }"].join("\n");
	return {methods,publicName,nativeName,exchange,objects,nativeType,wit,publicWit,contract};
};
