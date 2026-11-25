/** @file Project compiler-checked Lean tasks to nominal Component Model pollable resources. */
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
import { heapResourceIdentities } from "../../analyze/heap-resource-identity.mjs";
import { nativeEffectPolicy } from "../../analyze/native-host-effects.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateSyncWire } from "../c/sync-wire.mjs";
import { taskResourceTypes } from "../c/task-resources.mjs";
import { renderCopiedWitComponent } from "./copied-component.mjs";
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";
import { witVariantMember } from "./copied-variants.mjs";
import { witTaskCallbackRequest } from "./task-callback-model.mjs";

const scalarNames = new Map(Object.entries({
	bool: "bool"
	, char: "char"
	, uint8: "u8"
	, uint16: "u16"
	, uint32: "u32"
	, uint64: "u64"
	, int8: "s8", int16: "s16", int32: "s32", int64: "s64"
	, float32: "f32", float64: "f64", string: "string"
}));
const scalar = type => {
	if(type?.kind==="primitive" && type.name==="bytes") return {scalarName: "bytes",wit: "list<u8>",wat: "(list u8)",fields: []};
	const wat = type?.kind === "primitive" && scalarNames.get(type.name);
	if(!wat) throw new TypeError("Unsupported WIT task boundary type");
	return { scalarName: type.name, wit: wat, wat, fields: [] };
};
// A fallible factory can return an owned task or a separately owned error.
const resultOf = (ok, error) => ({
	compound: "result", fields: [{type: ok},{type: error}]
	, wit: "result<"+ok.wit+", "+error.wit+">"
	, wat: "(result "+ok.wat+" (error "+error.wat+"))"
	, publicWat: "(result "+(ok.publicWat??ok.wat)+" (error "+(error.publicWat??error.wat)+"))"
});
const copied = t => t?.kind==="apply" && t.constructor==="result" && t.arguments.length===2
	? resultOf(...t.arguments.map(copied)) : scalar(t);
const fail = message => { throw new TypeError(message); };
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const field = (witName, copy) => ({ witName, copy });
const sig = (name, parameters, resultCopy) => ({ witName: name, parameters, resultCopy });
const spell = name => "%" + name; // Explicit WIT identifier, including keywords.
const resourceHandle=(r,borrowed)=>({resource: true,resourceIndex: r.index
	, borrowed,fields: []
	, wit: (borrowed?"borrow<":"own<")+r.witName+">"
	, wat: (borrowed?"$borrow":"$own")+r.index
	, publicWat: (borrowed?"$publicBorrow":"$publicOwn")+r.index});

/**
 * Emit a finite typed protocol, not a canonical future or a new package admission.
 * Poll returns a typed observation; neither the native handle nor the host's
 * readiness descriptor crosses the WIT boundary. Dropping an owned task is
 * distinct from polling or requesting cancellation through a borrow.
 *
 * @param input - Matched original export evidence, public contract and WIT coordinates.
 * @param input.api - Complete public contract, including any author-reviewed prose.
 * @param input.evidence - Captured source selection, compiler identities and checked exports.
 * @param input.bindingIrSha256 - Expected semantic hash of the public contract.
 * @param input.settings - WIT package name and version.
 */
export const compileWitTaskResources = ({ api, evidence, bindingIrSha256, settings }) => {
	const selection = evidence?.selection;
	const streams=selection?.asyncIterators??[], tasks=selection?.taskExports??[];
	if(!(tasks.length || streams.length) || !evidence.interfaces?.length || evidence.hostImportsSourceSha256 !== null
		|| selection.nativeEffectPolicy !== nativeEffectPolicy || !Array.isArray(selection.nativeEffects) || selection.nativeEffects.length
		|| ![evidence.sourceTreeSha256,evidence.configurationSha256,evidence.compilerSha256,evidence.extractorSha256].every(hex)
		|| hashBindingIr(api) !== bindingIrSha256) throw new TypeError("WIT tasks require matched Lean compiler evidence");
	if(!settings?.name || !settings.version || Object.keys(settings).some(k => !["name","version"].includes(k)))
		throw new TypeError("Expected WIT task package coordinates");
	validateOrdinaryWasiSettings(settings);
	const declarations=evidence.metadata?.leanResources??[];
	const owned=declarations.length?heapResourceIdentities({...evidence,resources: declarations}):[];
	const { entries } = reconcileHostExports({ ...evidence, owned, ir: null, component: api.component, review: { source: canonicalJson(api) } });
	if(entries.length !== tasks.length+streams.length || new Set([...tasks,...streams.map(s=>s.open)]).size !== entries.length)
		throw new TypeError("Every WIT task export must map to one checked declaration");
	const resources = [], types = [], functions = [], methods = [], labels = new Set();
	const bool = scalar({ kind: "primitive", name: "bool" });
	const permitIndex=2*entries.length;
	const methodLabels=api.declarations.map(d=>witVariantMember(d.name,labels,fail));
	const reserved=new Set(["request-outcome"
		, ...methodLabels.flatMap((label,i)=>[label+"-observation"
			, label+(entries[i].delivery==="async-iterator"?"-cursor":"-task")])]);
	const heapLabels=new Set();
	const callbacks=new Map(api.types.filter(t=>t.kind==="callback").map(t=>[t.id,t]));
	if(callbacks.size && selection.witTaskCallbacks!==true) fail("WIT retained callbacks require the Wasmtime store owner");
	const heapTypes=api.types.filter(t=>t.kind!=="callback");
	const heap=taskResourceTypes(heapTypes).map((r,i)=>{
		let witName="lease-"+witVariantMember(r.name,heapLabels,fail,"heap resource");
		while(reserved.has(witName)) witName="lease-"+witName;
		reserved.add(witName);
		return {...r,index: permitIndex+1+i,witName,nativeName: witName+"-h"+r.hash};
	});
	const lease=t=>t?.kind==="named" && heap.find(r=>r.id===t.id);
	let requestIndex=permitIndex+1+heap.length;
	const delivered=t=>lease(t)?resourceHandle(lease(t),false):copied(t);
	const permit={index: permitIndex,witName: "request-outcome"
		, wit: "request-outcome",wat: "$t"+permitIndex,variant: true
		, cases: ["accepted","busy","closed"].map(witName=>({witName,fields: [],payload: null}))};
	for(const [index, d] of api.declarations.entries())
	{
		const e = entries[index];
		const stream=e?.delivery==="async-iterator";
		if(e?.declaration !== d.source.declaration || (stream ? d.resultMode!=="async-iterator" || !streams.some(s=>s.open===e.declaration)
			: e.delivery!=="task" || d.resultMode!=="promise" || !tasks.includes(e.declaration))
			|| !["pure","BaseIO","IO","EIO"].includes(e.effect)
			|| d.failure.unexpected !== "poison-runtime"
			|| d.capabilities.length || d.result.ownership !== (lease(d.result.type)?"lease":"copy")
			|| d.parameters.some(p => p.ownership !== (callbacks.has(p.type.id)?"lease":lease(p.type)?"borrow":"copy")))
			throw new TypeError("Unexpected delivery, effect or ownership in WIT task: " + d.source.declaration);
		const label = methodLabels[index], r = api.declarations.length + index;
		const resource = { index: r, witName: label + (stream?"-cursor":"-task") };
		const handle = borrowed => resourceHandle(resource,borrowed);
		const result = delivered(d.result.type), parameters = new Set();
		const text = scalar({kind: "primitive",name: "string"});
		const startError = e.effect==="EIO" ? delivered(e.error) : e.effect==="IO" ? text : null;
		const calls=[],args=[];
		for(const [slot,p] of d.parameters.entries())
		{
			if(callbacks.has(p.type.id))
			{
				if(stream || e.parameters[slot]?.type.kind!=="io-callback") fail("Retained WIT callback requires a checked task parameter");
				calls.push(witTaskCallbackRequest({slot,parameter: p
					, type: callbacks.get(p.type.id)
					, label,index: requestIndex++
					, scope: parameters
					, scalar
					, handle: resourceHandle
					, field
					, sig
					, fail
					, bool
					, text}));
			} else args.push(field(witVariantMember(p.name,parameters,fail),lease(p.type)?resourceHandle(lease(p.type),true):scalar(p.type)));
		}
		const item=stream?"item":"ready";
		const states = ["pending",item,"cancelled","closed",...stream?["idle","end"]:[]].map(witName => ({witName
			, fields: witName === item ? [{type: result}] : []
			, payload: witName === item ? result : null}));
		const witName = label + "-observation";
		if(e.taskIO) states.push({witName: "failed",fields: [{type: text}],payload: text});
		if(calls.length)
		{
			// A factory may itself invoke the host before it returns a Task. Its
			// failure must be delivered after dispatch, not reported as worker IO.
			if(startError) states.push({witName: "factory-failed",fields: [{type: startError}],payload: startError});
			if(e.effect==="IO") states.push({witName: "factory-callback-failed",fields: [{type: text}],payload: text});
			if(e.taskIO) states.push({witName: "worker-callback-failed",fields: [{type: text}],payload: text});
			states.push(...calls.map(c=>c.state));
		}
		if(e.stepIO)
			states.push({witName: "io-failed",fields: [{type: text}],payload: text});
		else if(e.stepError)
		{
			const payload=delivered(e.stepError); states.push({witName: "failed",fields: [{type: payload}],payload});
		}
		const observation = { index, witName, wit: witName, wat: "$t"+index, variant: true, cases: states };
		const owner = handle(false);
		const start = sig((stream?"open-":"start-")+label, args, startError && !calls.length ? resultOf(owner,startError) : owner);
		const borrow=[field(stream?"cursor":"task",handle(true))];
		const poll = sig("poll-"+label, borrow, observation);
		const cancel = sig("cancel-"+label, borrow, bool);
		resources.push(resource); types.push(observation); functions.push(start,poll,cancel);
		const request=stream && sig("request-"+label,borrow,permit);
		if(request) functions.push(request);
		for(const call of calls)
		{ resources.push(call.resource); functions.push(...call.functions); }
		methods.push({ declaration: e.declaration, resource: resource.witName
			, ...e.stepIO?{stepIO: true}:{}
			, start: start.witName, poll: poll.witName, cancel: cancel.witName
			, ...request?{request: request.witName}:{}
			, ...calls.length?{callbacks: calls.map(c=>c.descriptor)}:{} });
	}
	for(const r of heap)
	{
		resources.push(r);
		const borrow=resourceHandle(r,true);
		functions.push(sig("retain-"+r.witName,[field("value",borrow)],resourceHandle(r,false)),
			sig("same-"+r.witName,[field("left",borrow),field("right",borrow)],bool));
	}
	if(streams.length)
	{
		// A cursor named "outcome" exports the function "request-outcome".
		// WIT types and functions share the same interface namespace.
		const names=new Set([...resources,...types,...functions].map(x=>x.witName));
		while(names.has(permit.witName)) permit.witName="cursor-"+permit.witName;
		permit.wit=permit.witName; types.push(permit);
	}
	const {name,version} = settings, packageName = "lean-bridge:"+name;
	const importName = packageName+"/native@"+version, exportName = packageName+"/api@"+version;
	const witSigs = functions.map(f => `  ${f.witName}: func(${f.parameters.map(p => spell(p.witName)+": "+p.copy.wit).join(", ")}) -> ${f.resultCopy.wit};`).join("\n");
	const typeDefs = types.map(t => "  variant "+t.witName+" { "+t.cases.map(c => c.witName+(c.payload?"("+c.payload.wit+")":"")).join(", ")+" }");
	const uses = [...resources,...types].map(x => x.nativeName?x.nativeName+" as "+x.witName:x.witName).join(", ");
	const nativeSig=s=>s.replace(/(borrow|own)<([a-z0-9-]+)>/gu,(body,mode,name)=>{
		const r=heap.find(v=>v.witName===name);return r?mode+"<"+r.nativeName+">":body;
	});
	const wit = `package ${packageName}@${version};\n\ninterface native {\n${resources.map(r=>"  resource "+(r.nativeName??r.witName)+";").join("\n")}\n${typeDefs.map(nativeSig).join("\n")}\n${nativeSig(witSigs)}\n}\n\ninterface api {\n  use native.{${uses}};\n${witSigs}\n}\n\nworld ${name} {\n  import native;\n  export api;\n}\n`;
	const typeBody = [
		...resources.map(r => `    (export "${r.nativeName??r.witName}" (type $resource${r.index} (sub resource)))\n    (type $own${r.index} (own $resource${r.index}))\n    (type $borrow${r.index} (borrow $resource${r.index}))`)
		, ...types.map(t => `    (type $base${t.index} (variant ${t.cases.map(c => '(case "'+c.witName+'"'+(c.payload?" "+c.payload.wat:"")+')').join(" ")}))\n    (export "${t.witName}" (type ${t.wat} (eq $base${t.index})))`)
		, ...functions.map(f => `    (export "${f.witName}" (func ${f.parameters.map(p => '(param "'+p.witName+'" '+p.copy.wat+')').join(" ")} (result ${f.resultCopy.wat})))`)
	].join("\n");
	const wat = renderCopiedWitComponent({ surface: { functions }, functions, resources, types, typeBody, importName, exportName, preserveTypes: true });
	const prefix = "lbc_wit_"+sha256(api.component.id);
	const wire = generateSyncWire(prefix,entries,{tasks: true,resources: heapTypes,witCallbacks: callbacks.size>0});
	return { wit, wat, methods, name, version, importName, exportName, bindingIrSha256, prefix, wire,heap };
};
