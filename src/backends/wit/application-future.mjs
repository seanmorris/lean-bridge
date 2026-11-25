/** @file Source-selected canonical futures carrying guest-defined resources. */
import { canonicalJson } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { cHostCodecs } from "../c/host-codecs.mjs";
import { witVariantMember } from "./copied-variants.mjs";
import { richCanonicalFuture } from "./canonical-future.mjs";
import { objectFutureHost } from "./application-future-host.mjs";
import { objectFutureGraph } from "./application-future-graph.mjs";

const reject=message=>{throw new TypeError("WIT application future: "+message);};
const capacity=64;
// Keep resource.transfer operations in the component graph. The embedding
// sees a readiness key, never an i32 masquerading as a guest resource.
const ports=m=>{
	const {a,z,slots,param}=m;
	const funcs=[
		["retain",`(param "value" (borrow $r${a})) (result (own $r${a}))`,"(param i32) (result i32)"]
		, ["put",`(param "value" (own $r${a}))`,"(param i32)"]
		, ["take",`(result (own $r${z}))`,"(result i32)"]
		, ["start-native","(result u32)","(result i32)"]
		, ["stage","(param \"key\" u32)","(param i32)"]
	];
	return `(component
  ${slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join("\n  ")}
  ${funcs.map(([n,ty])=>`(import "${n}" (func $${n} ${ty}))`).join("\n  ")}
  ${funcs.map(([n])=>`(core func $${n} (canon lower (func $${n})))`).join("\n  ")}
  (core func $end (canon resource.drop $r${a}))
  (core module $m (import "" "end" (func $end (param i32)))
    ${funcs.map(([n,,ty])=>`(import "" "${n}" (func $${n} ${ty}))`).join("\n    ")}
    (func (export "begin") (param i32) (result i32)
      (call $put (call $retain (local.get 0))) (call $end (local.get 0)) (call $start-native))
    (func (export "peek") (param i32) (result i32) (call $stage (local.get 0)) (call $take)))
  (core instance $i (instantiate $m (with "" (instance (export "end" (func $end))
    ${funcs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "begin") (param "${param}" (borrow $r${a})) (result u32) (canon lift (core func $i "begin")))
  (func (export "peek") (param "key" u32) (result (own $r${z})) (canon lift (core func $i "peek"))))`;
};
/**
 * Private build artifacts; inventory unsupported delivery shapes explicitly.
 * The public package gate is separate and must not silently omit a method.
 *
 * @param options - Elaborated source, Binding IR, native model and original owner descriptor.
 */
export const witObjectFutureFiles=options=>{
	const {entries,api,descriptor,ir,model,name}=options,p=cIdentifier(name)+"_",rs=descriptor.contract.resources;
	const hash=hashBindingIr(ir);
	const {byRef}=cHostCodecs(ir,model.kinds,p,[]);
	const ds=new Map(api.declarations.filter(d=>d.resultMode!=="value").map(d=>[d.source.declaration,d]));
	if(ds.size!==entries.length || new Set(entries.map(e=>e.declaration)).size!==entries.length)return reject("worker inventory differs");
	const files={},supported=[],remaining=[],names=new Set();
	for(const e of entries)
	{
		const d=ds.get(e.declaration),x=d?.source.extensions;
		if(!d || d.name!==e.name || d.source.producer!=="lean" || x["lean-lang.org/effect"]!==e.effect || x["lean-bridge.dev/host-imports-sha256"]!==hash
			|| canonicalJson(d.result.type)!==canonicalJson(e.result))
			return reject("source mismatch: "+e.declaration);
		const label=witVariantMember(e.name,names,reject,"operation");
		const a=rs.findIndex(r=>r.id===e.parameters[0]?.type.id),z=rs.findIndex(r=>r.id===e.result.id);
		if(e.delivery!=="task" || e.parameters.length!==1 || a<0 || z<0 || !["pure","BaseIO"].includes(e.effect))
		{
			remaining.push(e.declaration);continue;
		}
		if(canonicalJson(d.parameters.map(({name,type})=>({name,type})))!==canonicalJson(e.parameters)
			|| x["lean-lang.org/delivery"]!=="Task" || d.resultMode!=="promise" || d.failure.mode!=="none" || d.failure.errors.length
			|| d.failure.unexpected!=="poison-runtime" || d.capabilities.length || d.parameters[0].ownership!=="lease" || d.result.ownership!=="lease")
			return reject("inconsistent nominal Task contract: "+e.declaration);
		const param=witVariantMember(e.parameters[0].name,new Set(),reject,"parameter");
		const slots=[...new Set([a,z])],n=cIdentifier(e.name);
		const input=byRef(e.parameters[0].type,n+"_arg").type,output=byRef(e.result,n+"_value").type;
		const from=rs[a].name.replaceAll("-","_"),to=rs[z].name.replaceAll("-","_");
		const m={a,z,slots,param,label,n,p,capacity,input,output,from,to};
		files[label+"-ports.wat"]=ports(m);
		const params=`(param "${param}" (borrow $r${a}))`,args=[{t: {flat: ["i32"]}}];
		const payload={wat: `(own $r${z})`,size: 4,align: 4,flat: ["i32"]};
		const ownership={slots,borrows: [[0,a]],abandon: `(call $drop-r${z} (i32.load offset=16 (local.get $p)))`};
		files[label+"-future.wat"]=richCanonicalFuture({params,args,payload,ownership},capacity);
		files[label+"-future.h"]=objectFutureHost(m);
		supported.push({name: label,declaration: e.declaration,input: a,output: z,param});
	}
	const graph=objectFutureGraph({...options,methods: supported,files});
	files["object-tasks.wit"]=graph.wit;files["object-tasks.wat"]=graph.wat;
	files["object-delivery.json"]=canonicalJson({schemaVersion: 1,publicName: graph.api,supported,remaining});
	return files;
};
