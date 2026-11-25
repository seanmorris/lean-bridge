/** @file Nominal guest-provided registrations for retained Lean worker callbacks. */
import { canonicalJson } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { callbackHostName } from "../../abi/host-member-names.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { objectCallbackBinding } from "./application-callback-host.mjs";

/**
 * Generate the guest callback contract and owner-thread registrations from
 * the checked callable sites. Repeated uses share a nominal signature, not
 * a registration, native request or object identity.
 *
 * @param options - Compiler-checked workers, original import IR and matching native facade.
 */
export const witObjectCallbackFiles=options=>{
	const {ir,entries,api,descriptor,name,version}=options,rs=descriptor.contract.resources;
	const hash=hashBindingIr(ir),prefix=cIdentifier(name)+"_",shapes=new Map(),uses=new Map(),occupied=new Set(rs.map(r=>r.name));
	occupied.add(descriptor.contract.error);
	const same=(a,b)=>canonicalJson(a??null)===canonicalJson(b??null);
	const lease=s=>s?.ownership==="lease" && same(s.lifetime,{scope: "explicit",anchor: null});
	const fail=e=>{throw new TypeError("Invalid retained WIT object callback: "+e.declaration);};
	for(const e of entries)
	{
		const d=api.declarations.find(m=>m.source.declaration===e.declaration);
		for(const [i,p] of e.parameters.entries())
		{
			if(p.type.kind!=="io-callback")continue;
			const a=rs.findIndex(r=>r.id===p.type.argument.id),z=rs.findIndex(r=>r.id===p.type.reply.id);
			if(a<0 || z<0)continue;
			const site=d?.parameters[i],t=api.types.find(t=>t.id===site?.type?.id),c=t?.callable;
			const callbackId="error:WitCallbackError",err=api.errors.find(v=>v.id===callbackId);
			const sourceName=i=>ir.types.find(t=>t.id===rs[i].id).name;
			const decl="Retained_"+callbackHostName(sourceName(a))+"_to_"+callbackHostName(sourceName(z));
			if(d?.source.producer!=="lean" || d.source.extensions["lean-bridge.dev/host-imports-sha256"]!==hash
				|| d.resultMode!=="promise" || !d.failure.errors.includes(callbackId) || site?.name!==p.name || !lease(site)
				|| t?.kind!=="callback" || t.id!=="bridge:"+decl || t.name!==decl || t.representation!=="identity"
				|| t.source.producer!=="lean" || t.source.declaration!==decl || t.source.extensions["lean-bridge.dev/callback-scheduler"]!=="wasmtime-store-owner"
				|| c?.invocation!=="many" || c.reentry!=="same-agent" || c.selfDisposal!=="defer" || c.resultMode!=="value"
				|| !same(c.effects,["fails","host-call"]) || c.parameters.length!==1 || !lease(c.parameters[0]) || !lease(c.result) || !same(c.parameters[0].type,p.type.argument) || !same(c.result.type,p.type.reply)
				|| !same(c.failure,{mode: "declared",errors: [callbackId],unexpected: "poison-runtime"}) || err?.category!=="domain" || err.payload!==null)fail(e);
			const key=t.id;
			if(!shapes.has(key))
			{
				let label="call-"+rs[a].name+"-to-"+rs[z].name;
				while([label,"retain-"+label,"same-"+label].some(s=>occupied.has(s)))label="lb-"+label;
				for(const n of [label,"retain-"+label,"same-"+label])occupied.add(n);
				const nativeType=i=>cIdentifier(sourceName(i));
				shapes.set(key,{label,a,z,input: nativeType(a),output: nativeType(z),callback: "callback_"+nativeType(a)+"_to_"+nativeType(z)});
			}
			const m=shapes.get(key);if(m.a!==a || m.z!==z)fail(e);
			uses.set(e.declaration+"#"+i,key);
		}
	}
	const sigs=[...shapes.values()],inputs=[...new Set(sigs.flatMap(m=>[m.a,m.z]))],error=descriptor.contract.error;
	const jobs=entries.filter(e=>e.parameters.some((_,i)=>uses.has(e.declaration+"#"+i))).map(e=>cIdentifier(e.name));
	const fields=sigs.flatMap(({label,a,z})=>[
		`  resource %${label} { invoke: func(value: borrow<%${rs[a].name}>) -> result<own<%${rs[z].name}>, own<%${error}>>; }`
		, `  retain-${label}: func(value: borrow<%${label}>) -> own<%${label}>;`
		, `  same-${label}: func(left: borrow<%${label}>, right: borrow<%${label}>) -> bool;`
	]);
	const iface="lean-bridge:"+name+"/callbacks@"+version;
	const wit=[`package lean-bridge:${name}@${version};`,"interface callbacks {"
		, `  use ${descriptor.interfaceName}.{${[...inputs.map(i=>rs[i].name),error].map(n=>"%"+n).join(", ")}};`
		, ...fields
		, "}"
		, `world callback-provider { import ${descriptor.interfaceName}; export callbacks; }`].join("\n");
	return {"object-callbacks.wit": wit
		, "application-callbacks.h": objectCallbackBinding({sigs,jobs,prefix,iface,rs})
		, "object-callbacks.json": canonicalJson({schemaVersion: 1,interfaceName: iface,signatures: Object.fromEntries(shapes),sites: Object.fromEntries(uses)})};
};
