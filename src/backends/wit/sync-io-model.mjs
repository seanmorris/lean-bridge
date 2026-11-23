/** @file Lower source-checked synchronous IO to an executable native-host WIT world. */
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
import { nativeEffectPolicy } from "../../analyze/native-host-effects.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateSyncWire } from "../c/sync-wire.mjs";
import { compileCopiedWitModel, validateOrdinaryWasiSettings } from "./copied-model.mjs";

const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const noFailure = {mode: "none", errors: [], unexpected: "poison-runtime"};

/**
 * WIT has no implicit PHP/JS-style exception channel. Only a fallible
 * declaration gets an outer result. A Lean Except stays an ordinary inner
 * value, even when the EIO failure has exactly the same type. Bridge faults
 * are not elements of either sum. OS effects execute in the native host.
 *
 * @param input - Original Binding IR, captured Lean export evidence, expected IR hash and WIT coordinates.
 */
export const compileWitSyncIO = input => {
	const {api,evidence,bindingIrSha256,settings = {}} = input, s = evidence?.selection;
	if(s?.synchronousIO !== true || !Array.isArray(s.nativeEffects) || s.nativeEffectPolicy !== nativeEffectPolicy
		|| evidence.hostImportsSourceSha256 !== null || !evidence.interfaces?.length
		|| [s.taskExports,s.asyncIterators,s.leanResources,s.taskIOErrors,s.resources,s.members].some(v=>v?.length)
		|| ![evidence.sourceTreeSha256,evidence.compilerSha256,evidence.extractorSha256,evidence.configurationSha256].every(digest))
		throw new TypeError("WIT IO requires standalone synchronous native-host compiler evidence");
	if(hashBindingIr(api) !== bindingIrSha256) throw new TypeError("WIT IO Binding IR digest mismatch");
	if(Object.keys(settings).some(k=>!["name","version"].includes(k))) throw new TypeError("Unexpected synchronous WIT package setting");
	validateOrdinaryWasiSettings(settings);
	const {entries} = reconcileHostExports({ ...evidence, ir: null, component: api.component, review: {source: canonicalJson(api)} });
	const prefix = "lbc_wit_"+sha256(api.component.id), wire = generateSyncWire(prefix,entries);
	const errorTypes = new Map(api.errors.map(e=>[e.id,e.payload]));
	const declarations = api.declarations.map((d,i)=>{
		const entry = wire.methods[i];
		if(d.source.declaration !== entry.declaration || d.resultMode !== "value" || d.failure.unexpected !== "poison-runtime")
			throw new TypeError("WIT IO declaration differs from native call");
		const error = d.failure.errors[0] ?? null, fallible = entry.error !== null;
		if(d.failure.errors.length !== Number(fallible) || (fallible && !errorTypes.has(error)))
			throw new TypeError("WIT IO declaration has an inconsistent failure channel");
		const payload = error === "error:IO.Error" ? {kind: "primitive",name: "string"} : errorTypes.get(error);
		const result = fallible ? { ...d.result, type: {kind: "apply",constructor: "result",arguments: [d.result.type,payload]} } : d.result;
		return { ...d, name: "entry"+i, result, effects: [], capabilities: []
			, parameters: d.parameters.map((p,j)=>({...p,name: "arg"+j}))
			, failure: noFailure };
	});
	// This intermediate describes *only* the copied Component Model values,
	// not Lean guarantees. Never publish its Binding IR or manifest.
	const publicSites = new Map(api.declarations.map(d=>[d.id,{name: d.name,parameters: d.parameters.map(p=>p.name)}]));
	const values = compileCopiedWitModel({...api,declarations,capabilities: [],errors: []},settings,{publicSites,exportTypes: true});
	const methods = wire.methods.map((m,i)=>({ declaration: m.declaration
		, witName: values.functions[i].witName, effect: m.effect
		, failure: api.declarations[i].failure.errors[0] ?? null
		, capabilities: api.declarations[i].capabilities }));
	return { bindingIrSha256, prefix, wire, methods, layout: values.surface
		, name: values.name, version: values.version
		, importName: values.importName, exportName: values.exportName
		, wit: values.wit, wat: values.wat };
};
