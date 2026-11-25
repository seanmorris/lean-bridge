/** @file Source-selected canonical futures and streams carrying guest-defined resources. */
import { canonicalJson } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { cHostCodecs } from "../c/host-codecs.mjs";
import { witVariantMember } from "./copied-variants.mjs";
import { richCanonicalFuture } from "./canonical-future.mjs";
import { objectFutureHost } from "./application-future-host.mjs";
import { objectFutureGraph } from "./application-future-graph.mjs";
import { witObjectCallbackProjection } from "./application-callback.mjs";
import { relayComponents } from "./application-relay.mjs";
import { canonicalStream } from "./canonical-stream.mjs";
import { objectStreamHost } from "./application-stream-host.mjs";
import { witTurnCursorGraph,witTurnCursorHost,witTurnCursorPorts } from "./application-turn-cursor.mjs";
import { witTurnRelayHost } from "./application-turn-callback.mjs";
import { witTurnRelayGraph } from "./application-turn-future.mjs";
import { witTurnPlainGraph,witTurnPlainHost } from "./application-turn-plain.mjs";
import { witTurnTaskHost } from "./application-turn-task-host.mjs";
import {copiedWorkerProjection} from "./application-turn-copied.mjs";
import {copiedWorkerHost} from "./application-turn-copied-host.mjs";

const reject=message=>{throw new TypeError("WIT application future: "+message);};
const capacity=64;
// Keep resource.transfer operations in the component graph. The embedding
// sees a readiness key, never an i32 masquerading as a guest resource.
const ports=m=>{
	const {a,z,slots,param,shape}=m,returned=shape==="returned",factory=shape==="factory";
	const stream=shape==="stream",typed=stream && m.err!==null;
	const result=`(result u32 (error (own $r${z})))`,payload=typed?"$payload":returned?result:factory?"u32":`(own $r${z})`;
	const stageType=returned?"(result (option u32))":factory||stream?"(result u32)":"";
	const funcs=[
		["retain",`(param "value" (borrow $r${a})) (result (own $r${a}))`,"(param i32) (result i32)"]
		, ["put",`(param "value" (own $r${a}))`,"(param i32)"]
		, ["take",`(result (own $r${z}))`,"(result i32)"]
		, ...typed?[["take-error",`(result (own $r${m.err}))`,"(result i32)"]]:[]
		, ["start-native","(result u32)","(result i32)"]
		, ["stage",'(param "key" u32) '+stageType,"(param i32) "+(returned?"(param i32)":factory||stream?"(result i32)":"")]
	];
	return `(component
  ${slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join("\n  ")}
  ${m.valueTypes??""}
  ${funcs.map(([n,ty])=>`(import "${n}" (func $${n} ${ty}))`).join("\n  ")}
  (core module $memory (memory (export "m") 1)) (core instance $mem (instantiate $memory))
  ${funcs.map(([n])=>`(core func $${n} (canon lower (func $${n})${n==="stage" && returned?' (memory $mem "m")':""}))`).join("\n  ")}
  (core func $end (canon resource.drop $r${a}))
  (core module $m (import "" "end" (func $end (param i32))) (import "" "m" (memory 1))
    ${funcs.map(([n,,ty])=>`(import "" "${n}" (func $${n} ${ty}))`).join("\n    ")}
    (func (export "begin") (param i32) (result i32) (local $key i32)
      (call $put (call $retain (local.get 0))) (call $end (local.get 0))
      ${factory?`(local.set $key (call $start-native))
      (i32.store8 (i32.const 32) (i32.eqz (local.get $key)))
      (i32.store (i32.const 36) (if (result i32) (local.get $key) (then (local.get $key)) (else (call $take))))
      (i32.const 32)`:"(call $start-native)"})
    (func (export "peek") (param i32) (result i32)
      ${typed?`(i32.store (i32.const 64) (call $stage (local.get 0)))
      (if (i32.gt_u (i32.load (i32.const 64)) (i32.const 1)) (then unreachable))
      (i32.store (i32.const 68) (if (result i32) (i32.load (i32.const 64)) (then (call $take-error)) (else (call $take))))
      (i32.const 64)`:stream?"(if (call $stage (local.get 0)) (then unreachable)) (call $take)":returned?`(call $stage (local.get 0) (i32.const 64))
      ;; Stage returns some(u32), or none with the actual error owner in the exchange.
      (if (i32.load8_u (i32.const 64)) (then (i32.store8 (i32.const 64) (i32.const 0)))
        (else (i32.store8 (i32.const 64) (i32.const 1)) (i32.store (i32.const 68) (call $take))))
      (i32.const 64)`:factory?"(call $stage (local.get 0))":"(call $stage (local.get 0)) (call $take)"}))
  (core instance $i (instantiate $m (with "" (instance (export "end" (func $end))
    (export "m" (memory $mem "m")) ${funcs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "begin") (param "${param}" (borrow $r${a})) (result ${factory?result:"u32"}) (canon lift (core func $i "begin") (memory $mem "m")))
  (func (export "peek") (param "key" u32) (result ${payload}) (canon lift (core func $i "peek") (memory $mem "m"))))`;
};
const u32=t=>t?.kind==="primitive" && t.name==="uint32";
const leased=type=>({type,ownership: "lease",lifetime: {scope: "explicit",anchor: null}});
const same=(a,b)=>canonicalJson(a??null)===canonicalJson(b??null);
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
	const callbacks=witObjectCallbackProjection(options),layout=callbacks.layout;
	for(const e of entries)
	{
		const d=ds.get(e.declaration),x=d?.source.extensions;
		if(!d || d.name!==e.name || d.source.producer!=="lean" || x["lean-lang.org/effect"]!==e.effect || x["lean-bridge.dev/host-imports-sha256"]!==hash
			|| canonicalJson(d.result.type)!==canonicalJson(e.result))
			return reject("source mismatch: "+e.declaration);
		const label=witVariantMember(e.name,names,reject,"operation");
		const copied=t=>t.kind==="primitive" || (t.kind==="apply" && t.constructor==="result" && t.arguments.every(copied));
		if([e.result,...e.parameters.map(q=>q.type),...[e.error,e.stepError].filter(Boolean)].every(copied))
		{
			const {row,writer}=copiedWorkerProjection({d,e,errors: api.errors,label});
			files[label+"-copied.wat"]=writer;
			files[label+"-turn-copied.h"]=copiedWorkerHost({e,byRef,p});
			supported.push(row);continue;
		}
		const returned=e.result.kind==="apply" && e.result.constructor==="result" && e.result.arguments.length===2 && u32(e.result.arguments[0]);
		const factory=e.effect==="EIO",shape=factory?"factory":returned?"returned":"owned";
		const owner=factory?e.error:returned?e.result.arguments[1]:e.result;
		const a=rs.findIndex(r=>r.id===e.parameters[0]?.type.id),z=rs.findIndex(r=>r.id===owner?.id);
		const registration=layout.sites[e.declaration+"#1"];
		if(e.delivery==="async-iterator" && e.parameters.length===1 && a>=0 && z>=0 && e.effect==="BaseIO" && !e.stepIO && (!e.stepError || rs.some(r=>r.id===e.stepError.id)))
		{
			const s=d.parameters[0],typed=Boolean(e.stepError),err=typed?rs.findIndex(r=>r.id===e.stepError.id):null,id="error:AsyncStep."+e.declaration;
			const terminal=api.errors.find(v=>v.id===id);
			if(d.kind!=="function" || d.owner!==null || d.resultMode!=="async-iterator" || !same(e.protocol,x["lean-bridge.dev/pull-protocol"]) || e.protocol?.open!==e.declaration || !e.protocol.next || !e.protocol.close
				|| ["lean-lang.org/delivery","lean-bridge.dev/step-failure","lean-bridge.dev/task-failure","lean-bridge.dev/error-payload-site"].some(k=>Object.hasOwn(x,k))
				|| d.capabilities.length || d.parameters.length!==1 || !s || !same(s.type,e.parameters[0].type) || s.name!==e.parameters[0].name || s.mutability!==rs[a].mutability
				|| s.optional!==false || s.default!==null || s.ownership!=="lease" || !same(s.lifetime,leased(s.type).lifetime) || !same(d.result,leased(e.result))
				|| !same(d.failure,{mode: typed?"declared":"none",errors: typed?[id]:[],unexpected: "poison-runtime"})
				|| !same(x["lean-bridge.dev/step-error-payload-site"],typed?leased(e.stepError):null) || (typed && (terminal?.category!=="domain" || !same(terminal.payload,e.stepError))))
				return reject("inconsistent nominal cursor contract: "+e.declaration);
			const param=witVariantMember(s.name,new Set(),reject,"parameter"),n=cIdentifier(e.name),slots=[...new Set(typed?[a,z,err]:[a,z])];
			const row={name: label,declaration: e.declaration,input: a,owner: z,param,shape: "stream",err};
			const valueTypes=typed?`(type $item (own $r${z})) (type $payload (result $item (error (own $r${err}))))`:"";
			const m={a,z,slots,param,shape: "stream",err,valueTypes};
			files[label+"-ports.wat"]=ports(m);
			const abandon=typed?`(if (i32.load8_u offset=32 (local.get $p))
          (then (call $drop-r${err} (i32.load offset=36 (local.get $p))))
          (else (call $drop-r${z} (i32.load offset=36 (local.get $p)))))`:`(call $drop-r${z} (i32.load offset=32 (local.get $p)))`;
			files[label+"-stream.wat"]=canonicalStream({
				params: `(param "${param}" (borrow $r${a}))`
				, args: [{t: {flat: ["i32"]}}],valueTypes
				, payload: typed?{wat: "$payload",flat: ["i32","i32"],size: 8}:{wat: `(own $r${z})`,flat: ["i32"],size: 4}
				, ownership: {slots,borrows: [[0,a]],abandon}},capacity);
			const kind=i=>rs[i].name.replaceAll("-","_");
			files[label+"-turn-ports.wat"]=witTurnCursorPorts(row);
			files[label+"-turn-cursor.wat"]=witTurnCursorGraph(row,files[label+"-turn-ports.wat"],files[label+"-stream.wat"]);
			files[label+"-turn-stream.h"]=witTurnCursorHost({...m,p,n,capacity
				, input: byRef(s.type,n+"_arg").type,output: byRef(e.result,n+"_value").type
				, fault: typed?byRef(e.stepError,n+"_error").type:null});
			files[label+"-stream.h"]=objectStreamHost({
				...m
				, p
				, n
				, label
				, capacity
				, from: kind(a)
				, to: kind(z)
				, faultKind: typed?kind(err):null
				, input: byRef(s.type,n+"_arg").type
				, output: byRef(e.result,n+"_value").type
				, fault: typed?byRef(e.stepError,n+"_error").type:null});
			supported.push(row);continue;
		}
		if(e.delivery==="task" && e.parameters.length===2 && a>=0 && z>=0 && registration)
		{
			const sig=layout.signatures[registration],idx=layout.exchange.slots.findIndex(x=>x.type===sig.label);
			const err=rs.length,cb=err+1+idx,n=cIdentifier(e.name),params=new Set();
			const param=witVariantMember(e.parameters[0].name,params,reject,"parameter"),callbackParam=witVariantMember(e.parameters[1].name,params,reject,"parameter");
			const expected=["error:TaskIO.Error","error:WitCallbackError"];
			if(idx<0 || e.effect!=="BaseIO" || e.taskIO!==true || d.resultMode!=="promise" || d.capabilities.length || d.parameters.length!==2
				|| x["lean-lang.org/delivery"]!=="Task" || x["lean-bridge.dev/task-failure"]!=="IO.Error" || x["lean-bridge.dev/error-payload-site"]
				|| !same(d.failure,{mode: "declared",errors: expected,unexpected: "poison-runtime"}) || !same(d.result,leased(e.result))
				|| !expected.every(id=>api.errors.some(v=>v.id===id && v.category==="domain" && v.payload===null))
				|| !d.parameters.every((v,i)=>v.name===e.parameters[i].name && v.ownership==="lease" && same(v.lifetime,leased(v.type).lifetime) && v.optional===false && v.default===null)
				|| !same(d.parameters[0].type,e.parameters[0].type) || d.parameters[0].mutability!==rs[a].mutability || d.parameters[1].mutability!=="immutable")
				return reject("inconsistent callback Task contract: "+e.declaration);
			const row={name: label,declaration: e.declaration,input: a,owner: z,param,shape: "callback",callbackParam,cb,err,idx};
			const m={
				...row
				, p,n,label,capacity,a,z
				, callback: sig.callback
				, input: byRef(e.parameters[0].type,n+"_arg").type
				, output: byRef(e.result,n+"_value").type
				, from: rs[a].name.replaceAll("-","_")
				, to: rs[z].name.replaceAll("-","_")};
			const wasm=relayComponents(m);
			files[label+"-turn-future.h"]=witTurnRelayHost(m);
			files[label+"-turn-future.wat"]=witTurnRelayGraph(m,wasm.future);
			files[label+"-ports.wat"]=wasm.ports;files[label+"-future.wat"]=wasm.future;files[label+"-future.h"]=objectFutureHost(m);
			supported.push(row);continue;
		}
		if(e.delivery!=="task" || e.parameters.length!==1 || a<0 || z<0 || (factory?!u32(e.result):!["pure","BaseIO"].includes(e.effect)))
		{
			remaining.push(e.declaration);continue;
		}
		const id="error:EIO."+e.declaration;
		const failure=factory?{mode: "declared",errors: [id],unexpected: "poison-runtime"}:{mode: "none",errors: [],unexpected: "poison-runtime"};
		if(!same(d.parameters.map(({name,type})=>({name,type})),e.parameters) || !same(d.failure,failure)
			|| x["lean-lang.org/delivery"]!=="Task" || d.resultMode!=="promise" || d.capabilities.length
			|| d.parameters[0].ownership!=="lease" || !same(d.parameters[0].lifetime,leased(e.parameters[0].type).lifetime)
			|| !same(d.result,factory?{type: e.result,ownership: "copy",lifetime: null}:leased(e.result))
			|| !same(x["lean-bridge.dev/error-payload-site"],factory?leased(e.error):null) || x["lean-bridge.dev/task-failure"]
			|| (factory && !same(api.errors.find(err=>err.id===id)?.payload,e.error)))
			return reject("inconsistent nominal Task contract: "+e.declaration);
		const param=witVariantMember(e.parameters[0].name,new Set(),reject,"parameter");
		const slots=[...new Set([a,z])],n=cIdentifier(e.name);
		const input=byRef(e.parameters[0].type,n+"_arg").type,output=byRef(e.result,n+"_value").type;
		const from=rs[a].name.replaceAll("-","_"),to=rs[z].name.replaceAll("-","_");
		const fault=factory?byRef(e.error,n+"_failure").type:null;
		const m={a,z,slots,param,label,n,p,capacity,input,output,from,to,shape,fault};
		files[label+"-ports.wat"]=ports(m);
		const params=`(param "${param}" (borrow $r${a}))`,args=[{t: {flat: ["i32"]}}];
		const nominal={wat: `(own $r${z})`,size: 4,align: 4,flat: ["i32"]};
		const payload=returned?{wat: `(result u32 (error ${nominal.wat}))`,size: 8,align: 4,flat: ["i32","i32"]}:factory?{...nominal,wat: "u32"}:nominal;
		const abandon=returned?`(if (i32.load8_u offset=16 (local.get $p)) (then (call $drop-r${z} (i32.load offset=20 (local.get $p)))))`
			:factory?"":`(call $drop-r${z} (i32.load offset=16 (local.get $p)))`;
		const ownership={slots,borrows: [[0,a]],abandon};
		files[label+"-future.wat"]=richCanonicalFuture({params,args,payload,ownership,failure: factory?nominal:null},capacity);
		files[label+"-turn-future.wat"]=witTurnPlainGraph(m,files[label+"-future.wat"]);
		files[label+"-turn-future.h"]=witTurnPlainHost({...m,nominal: byRef(owner,n+"_owner").type});
		files[label+"-future.h"]=objectFutureHost(m);
		supported.push({name: label,declaration: e.declaration,input: a,owner: z,param,shape});
	}
	const graph=objectFutureGraph({...options,methods: supported,files: {...files,...callbacks.files},callbacks: layout,complete: !remaining.length});
	files["object-tasks.wit"]=graph.wit;files["object-tasks.wat"]=graph.wat;
	if(graph.turn)
	{
		files["object-turn-tasks.wat"]=graph.turn;
		files["application-turn-tasks.h"]=witTurnTaskHost(p,supported,entries);
	}
	files["object-delivery.json"]=canonicalJson({schemaVersion: 2,publicName: graph.api,supported,remaining});
	return {...files,...callbacks.files};
};
