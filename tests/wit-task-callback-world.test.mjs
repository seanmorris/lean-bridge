/** @file Check nominal request identities and phase-specific callback errors in the Wasmtime world. */
import assert from "node:assert/strict";
import test from "node:test";
import { reconcileHostExports } from "../src/analyze/host-export-model.mjs";
import { nativeEffectPolicy } from "../src/analyze/native-host-effects.mjs";
import { compileWitTaskResources } from "../src/backends/wit/task-model.mjs";
import { renderWitTaskHeader } from "../src/backends/wit/task-session.mjs";
import { canonicalCallbackBindings } from "../src/backends/wit/canonical-callback.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";

const u32={kind: "primitive",name: "uint32"},str={kind: "primitive",name: "string"},cb={kind: "io-callback",argument: u32,reply: str};
const exports=["Jobs.first","Jobs.second"];
const selection={witTaskCallbacks: true,exports,exportModules: ["Jobs"]
	, modules: ["Jobs"],taskExports: exports,taskIOErrors: exports
	, asyncIterators: [],members: [],nativeEffects: [],nativeEffectPolicy};
const metadata={kind: "lean-bridge-host-export-metadata",schemaVersion: 1
	, leanVersion: "4.32.2"
	, nativeEffectAudit: {policy: nativeEffectPolicy,initializers: [],roots: exports.map(declaration=>({declaration,leaves: []}))}
	, entries: exports.map(declaration=>({declaration,module: "Jobs"
		, delivery: "task",effect: "IO",taskIO: true,result: str,hostMembers: []
		, parameters: [{name: "f",type: cb},{name: "count",type: u32},{name: "g",type: cb}]}))};
const component={id: "jobs@1.0.0",name: "jobs",version: "1.0.0"},sha="a".repeat(64);
const build=(host=selection)=>{
	const evidence={metadata,selection: host,hostImportsSourceSha256: null
		, interfaces: [{module: "Jobs"}],sourceTreeSha256: sha
		, configurationSha256: sha,compilerSha256: sha,extractorSha256: sha};
	const {api}=reconcileHostExports({component,...evidence});
	return compileWitTaskResources({api,evidence,bindingIrSha256: hashBindingIr(api),settings: {name: "jobs",version: "1.0.0"}});
};

test("the C consumer shares callable types but keeps each task and failure channel typed",()=>{
	const header=renderWitTaskHeader(build()),fn="jobs_wit_callback_uint32_to_string";
	assert.equal(header.split("jobs_wit_make_callback_uint32_to_string(").length,2);
	assert.ok(header.includes("bool (*"+fn+"_fn)(void *context, uint32_t argument, jobs_wit_text *reply, jobs_wit_text *error)"));
	for(const method of ["first","second"])
{
		const prefix="jobs_wit_",task=prefix+"task_"+method,failures=prefix+method+"_errors";
		assert.ok(header.includes("jobs_wit_start_"+method+"(jobs_wit_session *s, "+fn+" v0, uint32_t v1, "+fn+" v2, "+task+" *out);"));
		assert.ok(header.includes("jobs_wit_await_"+method+"(jobs_wit_session *s, "+task+" task, jobs_wit_state *state, jobs_wit_string *value, "+failures+" *errors);"));
		assert.ok(header.includes("jobs_wit_string factory; jobs_wit_string worker; jobs_wit_string callback; } "+failures+";"));
}
	assert.doesNotMatch(header,/wasmtime_component_resource|wasmtime_context_t/u);
});

test("equal callback signatures at different sites get distinct, consumable request types",()=>{
	const {wit,methods,wire}=build(),requests=methods.flatMap(m=>m.callbacks);
	assert.equal(new Set(requests.map(r=>r.resource)).size,4);
	for(const [i,m] of methods.entries())
{
		const task=m.resource;
		assert.ok(wit.includes(m.start+": func(%count: u32) -> own<"+task+">"));
		assert.deepEqual(wire.methods[i].callbacks,[[0,"uint32","string"],[2,"uint32","string"]]);
		for(const r of m.callbacks)
{
			assert.ok(wit.includes(r.state+"(own<"+r.resource+">)"));
			assert.ok(wit.includes(r.read+": func(%request: borrow<"+r.resource+">) -> u32"));
			assert.ok(wit.includes(r.resolve+": func(%request: own<"+r.resource+">, %value: string) -> bool"));
			assert.ok(wit.includes(r.reject+": func(%request: own<"+r.resource+">, %message: string) -> bool"));
}
}
	for(const name of ["failed","factory-failed","factory-callback-failed","worker-callback-failed"])
		assert.ok(wit.includes(name+"(string)"));
	assert.doesNotMatch(wit,/callback-id|callback-slot|pointer/u);
});

test("the Wasmtime world will not accept another host's retained-callback evidence",()=>{
	assert.throws(()=>build({...selection,witTaskCallbacks: false,phpTaskCallbacks: true}),/require the Wasmtime store owner/u);
	assert.throws(()=>build({...selection,javascriptTaskCallbacks: true}),/Ambiguous retained-callback host/u);
});

test("the canonical graph shares guest registrations but authenticates each private request site",()=>{
	const model=build(),{signatures,sites,providerWit,wat}=canonicalCallbackBindings(model);
	assert.equal(signatures.length,1);assert.equal(sites.length,4);
	assert.deepEqual(sites.map(v=>[v.method,v.request.slot,v.signature]),[[0,0,0],[0,2,0],[1,0,0],[1,2,0]]);
	assert.doesNotMatch(providerWit,/request|poll|slot|ticket/u);
	for(const site of sites) assert.ok(wat.includes('(export "dispatch-'+site.request.resource+'"'));
	model.methods[0].callbacks[0].invocation="once";
	assert.throws(()=>canonicalCallbackBindings(model),/allowance differs/u);
	delete model.methods[0].callbacks[0].invocation;
	model.methods[0].callbacks[0].resolve=model.methods[1].callbacks[0].resolve;
	assert.throws(()=>canonicalCallbackBindings(model),/nominal WIT callback request/u);
});
