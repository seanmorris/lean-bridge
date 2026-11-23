/** @file Project compiler-checked Lean tasks to nominal Component Model pollable resources. */
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
import { nativeEffectPolicy } from "../../analyze/native-host-effects.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateSyncWire } from "../c/sync-wire.mjs";
import { renderCopiedWitComponent } from "./copied-component.mjs";
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";
import { witVariantMember } from "./copied-variants.mjs";

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
	const wat = type?.kind === "primitive" && scalarNames.get(type.name);
	if(!wat) throw new TypeError("Unsupported WIT task boundary type");
	return { scalarName: type.name, wit: wat, wat, fields: [] };
};
// Preserve both arms of returned Except values, including nested values. Handles
// may occur only in the success arm of the generated factory result.
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
	if(!selection?.taskExports?.length || !evidence.interfaces?.length || evidence.hostImportsSourceSha256 !== null
		|| selection.nativeEffectPolicy !== nativeEffectPolicy || !Array.isArray(selection.nativeEffects) || selection.nativeEffects.length
		|| [selection.asyncIterators,selection.leanResources].some(s => s?.length)
		|| ![evidence.sourceTreeSha256,evidence.configurationSha256,evidence.compilerSha256,evidence.extractorSha256].every(hex)
		|| hashBindingIr(api) !== bindingIrSha256) throw new TypeError("WIT tasks require matched Lean compiler evidence");
	if(!settings?.name || !settings.version || Object.keys(settings).some(k => !["name","version"].includes(k)))
		throw new TypeError("Expected WIT task package coordinates");
	validateOrdinaryWasiSettings(settings);
	const { entries } = reconcileHostExports({ ...evidence, ir: null, component: api.component, review: { source: canonicalJson(api) } });
	if(entries.length !== selection.taskExports.length || new Set(selection.taskExports).size !== entries.length)
		throw new TypeError("Every WIT task export must map to one checked declaration");
	const resources = [], types = [], functions = [], methods = [], labels = new Set();
	const bool = scalar({ kind: "primitive", name: "bool" });
	for(const [index, d] of api.declarations.entries())
	{
		const e = entries[index];
		if(e?.declaration !== d.source.declaration || e.delivery !== "task" || d.resultMode !== "promise"
			|| !selection.taskExports.includes(e.declaration) || !["pure","BaseIO","IO","EIO"].includes(e.effect)
			|| d.failure.unexpected !== "poison-runtime"
			|| d.capabilities.length || d.result.ownership !== "copy" || d.parameters.some(p => p.ownership !== "copy"))
			throw new TypeError("Unexpected delivery, effect or ownership in WIT task: " + d.source.declaration);
		const label = witVariantMember(d.name, labels, fail), r = api.declarations.length + index;
		const resource = { index: r, witName: label + "-task" };
		const handle = borrowed => ({ resource: true, resourceIndex: r
			, borrowed, fields: []
			, wit: (borrowed ? "borrow<" : "own<") + resource.witName + ">"
			, wat: (borrowed ? "$borrow" : "$own") + r
			, publicWat: (borrowed ? "$publicBorrow" : "$publicOwn") + r });
		const result = copied(d.result.type), parameters = new Set();
		const text = scalar({kind: "primitive",name: "string"});
		const startError = e.effect==="EIO" ? copied(e.error) : e.effect==="IO" ? text : null;
		const args = d.parameters.map(p => field(witVariantMember(p.name, parameters, fail), scalar(p.type)));
		const states = ["pending","ready","cancelled","closed"].map(witName => ({witName
			, fields: witName === "ready" ? [{type: result}] : []
			, payload: witName === "ready" ? result : null}));
		const witName = label + "-observation";
		if(e.taskIO) states.push({witName: "failed",fields: [{type: text}],payload: text});
		const observation = { index, witName, wit: witName, wat: "$t"+index, variant: true, cases: states };
		const owner = handle(false);
		const start = sig("start-"+label, args, startError ? resultOf(owner,startError) : owner);
		const poll = sig("poll-"+label, [field("task",handle(true))], observation);
		const cancel = sig("cancel-"+label, [field("task",handle(true))], bool);
		resources.push(resource); types.push(observation); functions.push(start,poll,cancel);
		methods.push({ declaration: e.declaration, resource: resource.witName, start: start.witName, poll: poll.witName, cancel: cancel.witName });
	}
	const {name,version} = settings, packageName = "lean-bridge:"+name;
	const importName = packageName+"/native@"+version, exportName = packageName+"/api@"+version;
	const witSigs = functions.map(f => `  ${f.witName}: func(${f.parameters.map(p => spell(p.witName)+": "+p.copy.wit).join(", ")}) -> ${f.resultCopy.wit};`).join("\n");
	const typeDefs = types.map(t => "  variant "+t.witName+" { "+t.cases.map(c => c.witName+(c.payload?"("+c.payload.wit+")":"")).join(", ")+" }");
	const uses = [...resources,...types].map(x => x.witName).join(", ");
	const wit = `package ${packageName}@${version};\n\ninterface native {\n${resources.map(r=>"  resource "+r.witName+";").join("\n")}\n${typeDefs.join("\n")}\n${witSigs}\n}\n\ninterface api {\n  use native.{${uses}};\n${witSigs}\n}\n\nworld ${name} {\n  import native;\n  export api;\n}\n`;
	const typeBody = [
		...resources.map(r => `    (export "${r.witName}" (type $resource${r.index} (sub resource)))\n    (type $own${r.index} (own $resource${r.index}))\n    (type $borrow${r.index} (borrow $resource${r.index}))`)
		, ...types.map(t => `    (type $base${t.index} (variant ${t.cases.map(c => '(case "'+c.witName+'"'+(c.payload?" "+c.payload.wat:"")+')').join(" ")}))\n    (export "${t.witName}" (type ${t.wat} (eq $base${t.index})))`)
		, ...functions.map(f => `    (export "${f.witName}" (func ${f.parameters.map(p => '(param "'+p.witName+'" '+p.copy.wat+')').join(" ")} (result ${f.resultCopy.wat})))`)
	].join("\n");
	const wat = renderCopiedWitComponent({ surface: { functions }, functions, resources, types, typeBody, importName, exportName, preserveTypes: true });
	const prefix = "lbc_wit_"+sha256(api.component.id);
	const wire = generateSyncWire(prefix,entries,{tasks: true});
	return { wit, wat, methods, name, version, importName, exportName, bindingIrSha256, prefix, wire };
};
