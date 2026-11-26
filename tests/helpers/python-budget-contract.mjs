/** @file Check a one-shot binder in the real compiled Python worker contract. */
import assert from "node:assert/strict";
import {reconcileHostExports} from "../../src/analyze/host-export-model.mjs";
import {generatePythonHostExtension} from "../../src/backends/python/host-exports.mjs";

/**
 * Apply a source binder policy to existing elaboration of a nominal worker.
 *
 * @param context - Original import IR, component and independently compiled worker metadata.
 */
export const checkPythonWorkerBudget=context=>{
	const {ir,component,evidence}=context;
	const name="Workers.relay",policy={declaration: name,parameter: "f",invocation: "once"};
	const selection={...evidence.selection,taskCallbackPolicies: [policy]};
	const {entries,api}=reconcileHostExports({ir,component,selection,metadata: evidence.metadata});
	const fn=decl=>{
		const p=api.declarations.find(d=>d.source.declaration===decl).parameters[1];
		return api.types.find(t=>t.id===p.type.id).callable;
	};
	const f=fn(name),many=fn("Workers.fallback");
	assert.equal(f.invocation,"once");assert.equal(many.invocation,"many");
	assert.deepEqual(f.parameters,many.parameters);assert.deepEqual(f.result,many.result);
	assert.match(f.parameters[0].type.id,/^host:/u);assert.deepEqual(f.result.type,f.parameters[0].type);
	assert.equal(f.result.ownership,"lease");assert.deepEqual(f.failure.errors,["error:PythonCallbackException"]);
	const identity="a".repeat(64);
	const g=generatePythonHostExtension({ir,entries,callbackContract: api
		, pythonTaskObjects: true,module: "Workshop",modules: ["Workshop","Workers"]
		, runtimeIdentity: identity,componentIdentity: identity});
	const slots=entries.flatMap(e=>e.parameters.filter(p=>p.type.kind==="io-callback").map(p=>[e.declaration,p.name]));
	const index=slots.findIndex(([d,p])=>d===name && p==="f");assert.ok(index>=0);
	assert.ok(g.source.includes("switch (slot) { case "+index+": return 1; default: return 0; }"));
	const admission=g.source.indexOf("lb_cb_admit_once(q,"),lift=g.source.indexOf("codec->in(q->arg)");
	assert.ok(admission>=0 && lift>admission);
	return g;
};
