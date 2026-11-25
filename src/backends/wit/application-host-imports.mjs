/** @file Component Model imports for an application's nominal resource members. */
import { hostDeclarationName } from "../../abi/host-member-names.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { staticHostMembers } from "../native/static-host-members.mjs";
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";
import { witVariantMember } from "./copied-variants.mjs";

const primitive={bool: "bool",char: "char",float32: "f32",float64: "f64",string: "string",bytes: "list<u8>",usize: "u64",isize: "s64",nat: "list<u32>"};
for(const bits of [8,16,32,64])
{
	primitive["int"+bits]="s"+bits;
	primitive["uint"+bits]="u"+bits;
}
/**
 * A host owns these resource types; a Lean component imports their identity.
 * Lease and transfer both cross as own<T>, but only transfer consumes the
 * caller's last owner. Borrowed results need a new owned, anchored alias;
 * WIT borrows cannot escape a call. Preserve those policies in the descriptor.
 *
 * @param ir - Original checked import contract, not the public Lean exports.
 */
export const witApplicationHostImports=ir=>{
	const {kinds,members}=staticHostMembers(ir,"wit-wasi");
	validateOrdinaryWasiSettings({version: ir.component.version});
	const fail=m=>{throw new TypeError("WIT application objects: "+m);};
	const names=new Set(),claim=(label,used)=>{
		const name=witVariantMember(label,used,fail);
		if(!/^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/u.test(name)) fail("invalid kebab identifier: "+name);
		return name;
	};
	const allocate=base=>{let s=base;while(names.has(s))s="lb-"+s;names.add(s);return s;};
	const resources=kinds.map((k,i)=>({
		id: ir.types[i].id
		, name: claim(k.name,names)
		, key: k.key
		, identity: k.identity
		, mutability: ir.types[i].mutability
		, lifecycle: ir.types[i].resource
	}));
	const error=allocate("member-error"),unit=allocate("lean-unit"),integer=allocate("lean-int");
	const decls=new Map(ir.declarations.map(d=>[d.id,d]));
	const value=(kind,ownership)=>typeof kind==="number"?(ownership==="borrow"?"borrow":"own")+"<%"+resources[kind].name+">"
		:kind==="unit"?"%"+unit:kind==="int"?"%"+integer:primitive[kind]??fail("unsupported carrier "+kind);
	const lines=[],free=[],methods=[];
	for(const [i,r] of resources.entries())
	{
		const used=new Set(),body=[];
		// ResourceAny::clone copies a wrapper, not an independently droppable
		// owner. Ask the defining implementation to retain and compare its
		// object; equal low-level reps from different stores are not identity.
		r.retain=allocate("retain-"+r.name);r.same=allocate("same-"+r.name);
		free.push("  %"+r.retain+": func(value: borrow<%"+r.name+">) -> own<%"+r.name+">;",
			"  %"+r.same+": func(left: borrow<%"+r.name+">, right: borrow<%"+r.name+">) -> bool;");
		for(const m of members.filter(a=>a.owner===i))
		{
			const d=decls.get(m.id),receiver=d.receiver!==null;
			const consuming=receiver && m.inputOwnership[0]!=="borrow";
			const label=claim(hostDeclarationName(d),used);
			const params=new Set(),sites=receiver?[d.receiver,...d.parameters]:d.parameters;
			const inputs=sites.map((s,j)=>({
				name: claim(j===0 && receiver?"self":s.name,params)
				, kind: m.args[j]
				, ownership: s.ownership
				, lifetime: s.lifetime
				, mutability: s.mutability??null
			}));
			const args=inputs.slice(receiver && !consuming?1:0).map(a=>"%"+a.name+": "+value(a.kind,a.ownership)).join(", ");
			const result=m.result==="unit"?"":value(m.result,"lease");
			// The store supplies the original failure object, not a lossy string or
			// integer table index. Unexpected traps do not use this result branch.
			const fallible=d.failure.mode==="declared",out=fallible?"result<"+(result||"_")+", own<%"+error+">>":result;
			const suffix="func("+args+")"+(out?" -> "+out:"")+";";
			const entry=consuming?claim("take-"+r.name+"-"+label,names):label;
			if(consuming)free.push("  %"+entry+": "+suffix);
			else body.push("    %"+entry+": "+(receiver?"":"static ")+suffix);
			methods.push({
				id: m.id
				, resource: r.name
				, name: entry
				, op: m.op
				, implicitReceiver: receiver && !consuming
				, inputs
				, result: m.result
				, resultOwnership: m.resultOwnership
				, anchor: m.anchor
				, error: fallible?error:null
				, mutability: d.mutability
				, effects: d.effects
				, capabilities: d.capabilities
				, failure: d.failure
			});
		}
		lines.push("  resource %"+r.name+" {",...body,"  }");
	}
	const contract={schemaVersion: 1,owner: "wit-wasi",component: ir.component.id,resources,methods,error,integer,unit};
	const definitions=[
		"interface objects {"
		, "  enum %"+unit+" { unit }"
		, "  record %"+integer+" { negative: bool, limbs: list<u32> }"
		, "  resource %"+error+" { message: func() -> string; }"
		, ...lines
		, ...free
		, "}"
		, ""
		, "world owner { export objects; }"
		, "world client { import objects; }"
		, ""
	].join("\n");
	const identity=sha256(canonicalJson({contract,definitions})),pkg="lean-bridge:objects-h"+identity+"@"+ir.component.version;
	const wit="package "+pkg+";\n\n"+definitions;
	return {contract,identity,wit,interfaceName: pkg.replace("@","/objects@")};
};
