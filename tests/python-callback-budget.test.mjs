/** @file Check the Python worker's admission table against the author's real binder positions. */
import assert from "node:assert/strict";
import test from "node:test";
import {reconcileHostExports} from "../src/analyze/host-export-model.mjs";
import {generatePythonHostExtension} from "../src/backends/python/host-exports.mjs";

test("Python assigns a one-call budget to a registration, not a shared codec or callable",()=>{
	const uint={kind: "primitive",name: "uint32"},fn={kind: "io-callback",argument: uint,reply: uint};
	const component={name: "budget",id: "budget@1.0.0",version: "1.0.0"};
	const name="Budget.probe",identity="a".repeat(64);
	const parameters=[{name: "n",type: uint},{name: "f",type: fn},{name: "checkedArg",type: fn}];
	const entry={declaration: name,module: "Budget",hostMembers: []
		, effect: "BaseIO",delivery: "task",result: uint,taskIO: true,parameters};
	const metadata={kind: "lean-bridge-host-export-metadata",schemaVersion: 1
		, leanVersion: "4.32.2",entries: [entry]};
	const selection={exports: [name],exportModules: ["Budget"],members: []
		, taskExports: [name],taskIOErrors: [name],pythonTaskCallbacks: true};
	const checked={...selection,taskCallbackPolicies: [{declaration: name,parameter: "checkedArg",invocation: "once"}]};
	const build=(s,review)=>{
		const {entries,api}=reconcileHostExports({metadata,component,selection: s,review});
		const opts={entries,module: "Budget",runtimeIdentity: identity,componentIdentity: identity};
		return {api,opts,built: generatePythonHostExtension({...opts,callbackContract: api})};
	};
	const many=build(selection);
	assert.deepEqual(many.built,generatePythonHostExtension(many.opts));
	assert.doesNotMatch(many.built.source,/lb_cb_admit_once|lb_cb_once_slot/u);
	assert.doesNotMatch(many.built.python,/CallbackAlreadyInvoked|_lb_budget_set/u);
	const {api,built}=build(checked),[d]=api.declarations;
	assert.equal(d.parameters[2].name,"checked_arg");
	assert.equal(api.types.find(t=>t.id===d.parameters[1].type.id).callable.invocation,"many");
	assert.equal(api.types.find(t=>t.id===d.parameters[2].type.id).callable.invocation,"once");
	assert.match(built.source,/switch \(slot\) \{ case 1: return 1; default: return 0;/u);
	assert.ok(built.source.indexOf("lb_cb_admit_once(q,") < built.source.indexOf("codec->in(q->arg)"));
	assert.match(built.stub,/class CallbackAlreadyInvoked\(RuntimeError\)/u);
	const stale=structuredClone(api);stale.declarations[0].parameters[2].type=d.parameters[1].type;
	assert.throws(()=>build(checked,{source: JSON.stringify(stale)}),/Reviewed API differs/u);
	for(const wrong of ["checked_arg","n"]) assert.throws(()=>build({...selection
		, taskCallbackPolicies: [{declaration: name,parameter: wrong,invocation: "once"}]}),/Invalid task callback policy/u);
});
