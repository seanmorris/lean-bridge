/** @file Keep native worker callback allowances attached to the checked binder. */
import assert from "node:assert/strict";
import test from "node:test";
import {reconcileHostExports} from "../src/analyze/host-export-model.mjs";
import {generateCTaskExports} from "../src/backends/c/task-exports.mjs";
import {generateCppTaskHeader} from "../src/backends/cpp/task-exports.mjs";
import {retainedOnceSlots} from "../src/backends/native/task-callback.mjs";
import {generateRustTaskSources} from "../src/backends/rust/task-crate.mjs";

for(const target of ["c","cpp","rust"]) test(target+" rejects a stale reviewed callback limit and generates admission before the request",async()=>{
	const v={kind: "primitive",name: "uint32"},fn={kind: "io-callback",argument: v,reply: v};
	const parameters=[{name: "n",type: v},{name: "f",type: fn},{name: "g",type: fn}],name="Budget.probe";
	const entry={name: "probe",declaration: name,module: "Budget",parameters
		, delivery: "task",effect: "BaseIO",taskIO: true,result: v,hostMembers: []};
	const selection={exports: [name],exportModules: ["Budget"],members: []
		, taskExports: [name],taskIOErrors: [name],[target+"TaskCallbacks"]: true};
	const metadata={kind: "lean-bridge-host-export-metadata",schemaVersion: 1
		, leanVersion: "4.32.2",entries: [entry]};
	const component={name: "budget",id: "budget@1.0.0",version: "1.0.0"};
	const checked={...selection,taskCallbackPolicies: [{declaration: name,parameter: "g",invocation: "once"}]};
	const {api,entries}=reconcileHostExports({metadata,selection: checked,component});
	const onceByDeclaration=retainedOnceSlots(api);assert.deepEqual([...onceByDeclaration],[[name,[2]]]);
	const componentIdentity="1".repeat(64),integerMode=target==="c"?"gmp":"words";
	const opts={entries,modules: ["Budget"],name: "budget"
		, componentIdentity,[target+"Callbacks"]: true,integerMode};
	const plain=generateCTaskExports(opts),built=generateCTaskExports({...opts,onceByDeclaration});
	assert.deepEqual(generateCTaskExports({...opts,onceByDeclaration: new Map()}),plain);
	for(const bad of [new Map([[name,[0]]]),new Map([["Other.entry",[2]]]),new Map([[name,[2,2]]])])
		assert.throws(()=>generateCTaskExports({...opts,onceByDeclaration: bad}),/Invalid native one-call callback slot/u);
	assert.doesNotMatch(plain.header+plain.source+plain.entryLean,/CALLBACK_ALREADY_INVOKED|cbBudgetClaim/u);
	assert.match(built.entryLean,/Budget.probe v0 \(cbInvoke port 1\) \(cbInvokeOnce port used2 denied 2\)/u);
	assert.match(built.header,/CALLBACK_ALREADY_INVOKED/u);
	if(target==="cpp")
	{
		const header={entries,prefix: built.prefix};
		assert.match(generateCppTaskHeader({...header,onceByDeclaration}),/throw CallbackAlreadyInvoked\{\}/u);
		const declaration="Budget.CallbackAlreadyInvoked",id="lean:"+declaration;
		const source={declaration,extensions: {"lean-bridge.dev/resource-identity": componentIdentity}};
		const resources=[{kind: "resource",id,host: null,source,resource: {kindId: "resource:"+declaration+"/"+componentIdentity}}];
		assert.doesNotThrow(()=>generateCppTaskHeader({...header,resources}));
		assert.throws(()=>generateCppTaskHeader({...header,resources,onceByDeclaration}),/Reserved C\+\+ resource class name/u);
	}
	if(target==="rust")
	{
		const prefix=built.prefix,library="lib"+prefix+".so";
		const opts={prefix,entries,evidence: {library,runtimeIdentity: componentIdentity,libraries: {[library]: componentIdentity}}};
		await assert.rejects(generateRustTaskSources({...opts,onceByDeclaration}),/compiled admission status/u);
		const plain=await generateRustTaskSources(opts);
		assert.doesNotMatch(plain["src/native.rs"],/CallbackAlreadyInvoked/u);
		const api=await generateRustTaskSources({...opts,onceByDeclaration,onceStatus: built.onceStatus});
		assert.ok(api["src/native.rs"].includes("if s=="+built.onceStatus+"{return Err(Fault::CallbackAlreadyInvoked"));
	}
	const wrong=structuredClone(api);wrong.declarations[0].parameters[2].type=api.declarations[0].parameters[1].type;
	assert.throws(()=>reconcileHostExports({metadata,selection: checked,component
		, review: {source: JSON.stringify(wrong)}}),/Reviewed API differs/u);
});
