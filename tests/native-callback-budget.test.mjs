/** @file Keep native worker callback allowances attached to the checked binder. */
import assert from "node:assert/strict";
import test from "node:test";
import {reconcileHostExports,taskWorkerInterface} from "../src/analyze/host-export-model.mjs";
import {generateCTaskExports} from "../src/backends/c/task-exports.mjs";
import {generateCppTaskHeader} from "../src/backends/cpp/task-exports.mjs";
import {retainedOnceSlots} from "../src/backends/native/task-callback.mjs";
import {generateRustTaskSources} from "../src/backends/rust/task-crate.mjs";
import {generateSyncWire} from "../src/backends/c/sync-wire.mjs";
import {generateRubySyncSources} from "../src/backends/ruby/sync-io.mjs";
import {generateDotnetTasks} from "../src/backends/dotnet/sync-io.mjs";
import {generateJvmIO} from "../src/backends/jvm/sync-io.mjs";
import {compilePhpTaskSurface} from "../src/backends/php/io-surface.mjs";
import {generatePhpIOFiles} from "../src/backends/php/io-package.mjs";
import {hashBindingIr} from "../src/binding-ir/canonical.mjs";
import {preparePerlIOFiles} from "../src/backends/perl/sync-io.mjs";
import {sha256} from "../src/capsule/node.mjs";

for(const target of ["c","cpp","rust","ruby","dotnet","jvm","php","perl"]) test(target+" rejects a stale reviewed callback limit and generates admission before the request",async()=>{
	const v={kind: "primitive",name: "uint32"},fn={kind: "io-callback",argument: v,reply: v};
	const parameters=[{name: "n",type: v},{name: "f",type: fn},{name: "g",type: fn}],name="Budget.probe";
	const entry={name: "probe",declaration: name,module: "Budget",parameters
		, delivery: "task",effect: "BaseIO",taskIO: true,result: v,hostMembers: []};
	const selection={exports: [name],exportModules: ["Budget"],members: []
		, taskExports: [name],taskIOErrors: [name],[target+"TaskCallbacks"]: true};
	const metadata={kind: "lean-bridge-host-export-metadata",schemaVersion: 1
		, leanVersion: "4.32.2",entries: [entry]};
	const component={name: "budget",id: "budget@1.0.0",version: "1.0.0"};
	const checked={...selection,...target==="php"?{phpNativeCallbackBudgets: true}:{},taskCallbackPolicies: [{declaration: name,parameter: "g",invocation: "once"}]};
	const {api,entries}=reconcileHostExports({metadata,selection: checked,component});
	const onceByDeclaration=retainedOnceSlots(api);assert.deepEqual([...onceByDeclaration],[[name,[2]]]);
	const componentIdentity="1".repeat(64),integerMode=target==="c"?"gmp":"words";
	const selector=["ruby","dotnet","jvm","php","perl"].includes(target)?target+"Delivery":target+"Callbacks";
	const opts={entries,modules: ["Budget"],name: "budget"
		, componentIdentity,[selector]: true,integerMode};
	const plain=generateCTaskExports(opts),built=generateCTaskExports({...opts,onceByDeclaration});
	assert.deepEqual(generateCTaskExports({...opts,onceByDeclaration: new Map()}),plain);
	for(const bad of [new Map([[name,[0]]]),new Map([["Other.entry",[2]]]),new Map([[name,[2,2]]])])
		assert.throws(()=>generateCTaskExports({...opts,onceByDeclaration: bad}),/Invalid native one-call callback slot/u);
	assert.doesNotMatch(plain.header+plain.source+plain.entryLean,/CALLBACK_ALREADY_INVOKED|cbBudgetClaim/u);
	assert.match(built.entryLean,/Budget.probe v0 \(cbInvoke port 1\) \(cbInvokeOnce port used2 denied 2\)/u);
	assert.match(built.header,/CALLBACK_ALREADY_INVOKED/u);
	if(target==="perl")
	{
		const name="LeanBridge::Budget",prefix="lbc_perl_"+sha256(name);
		const wire=slots=>generateSyncWire(prefix,entries,{tasks: true,onceByDeclaration: slots});
		const pins={version: "0.001",runtimeVersion: "0.001",runtimeIdentity: componentIdentity};
		const emit=(api,selection,wire)=>{
			const evidence={selection,metadata,hostImportsSourceSha256: null
				, interfaces: [{module: "Budget",sourceSha256: componentIdentity}]
				, sourceTreeSha256: componentIdentity
				, compilerSha256: componentIdentity
				, extractorSha256: componentIdentity
				, configurationSha256: componentIdentity};
			const files=new Map([["lib/lib"+prefix+".so",Buffer.from("generator test")]]);
			return preparePerlIOFiles({api,name,prefix,wire,files,evidence,componentIdentity,bindingIrSha256: hashBindingIr(api)},pins);
		};
		const prior=reconcileHostExports({metadata,selection,component}).api;
		const plain=await emit(prior,selection,wire());
		assert.doesNotMatch(plain.files.get("Component.xs"),/CallbackAlreadyInvoked/u);
		for(const stale of [undefined,new Map([["Budget.probe",[1]]])])
			await assert.rejects(emit(api,checked,wire(stale)),/Perl IO wire differs/u);
		await assert.rejects(emit(prior,selection,wire(onceByDeclaration)),/Perl IO wire differs/u);
		const enabled=await emit(api,checked,wire(onceByDeclaration));
		assert.match(enabled.files.get("Component.xs"),/if \(status==16\).*LeanBridge::Budget::CallbackAlreadyInvoked/u);
		assert.match(enabled.files.get("lib/LeanBridge/Budget.pm"),/package LeanBridge::Budget::CallbackAlreadyInvoked;/u);
	}
	if(target==="php")
	{
		const surface=(api,selection)=>compilePhpTaskSurface({name: "example/callback-budget"
			, version: "1.0.0"
			, api
			, bindingIrSha256: hashBindingIr(api)
			, evidence: {metadata
				, selection
				, interfaces: ["Budget"]
				, hostImportsSourceSha256: null
				, sourceTreeSha256: componentIdentity
				, compilerSha256: componentIdentity
				, extractorSha256: componentIdentity
				, configurationSha256: componentIdentity}});
		const plain=surface(reconcileHostExports({metadata,selection,component}).api,selection);
		const model=surface(api,checked);assert.deepEqual(model.methods[0].onceSlots,[2]);
		assert.throws(()=>surface(api,{...checked,taskCallbackPolicies: [{declaration: name,parameter: "f",invocation: "once"}]}),/Reviewed API differs/u);
		assert.throws(()=>surface(api,{...checked,phpWasmCallbackBudgets: true}),/different PHP delivery/u);
		assert.throws(()=>taskWorkerInterface(api,{selection: checked}),/Native PHP callback allowances/u);
		const emit=m=>{
			const library="lib"+m.prefix+".so";
			return generatePhpIOFiles(m,{componentIdentity
				, runtimeIdentity: componentIdentity
				, componentId: component.id
				, library
				, libraries: Object.fromEntries([library,"libleanshared.so","liblean_bridge_native.so"].map(l=>[l,componentIdentity]))});
		};
		assert.doesNotMatch(Object.values(await emit(plain)).join("\n"),/CallbackAlreadyInvoked/u);
		const files=await emit(model);
		assert.match(files["src/Api.php"],/final class CallbackAlreadyInvoked extends \\RuntimeException/u);
		assert.ok(files["src/Internal/Native.php"].includes("if ($status===16) throw new \\LeanBudget\\CallbackAlreadyInvoked('Budget.probe');"));
		assert.match(files["src/Internal/Native.php"],/if \(\$status===14\) throw \$pump->original/u);
		assert.match(model.wire.source,/CALLBACK_ALREADY_INVOKED\) s = 16;/u);
	}
	if(target==="dotnet")
	{
		const wire=generateSyncWire(built.prefix,entries,{tasks: true,onceByDeclaration});
		const prior=generateSyncWire(plain.prefix,entries,{tasks: true});
		const unbounded=reconcileHostExports({metadata,selection,component}).api;
		const emit=(api,wire)=>generateDotnetTasks({api,wire,evidence: null});
		await assert.rejects(emit(unbounded,wire),/Unverified .NET callback allowance/u);
		await assert.rejects(emit(api,prior),/Unverified .NET callback allowance/u);
		const shifted=generateSyncWire(built.prefix,entries,{tasks: true,onceByDeclaration: new Map([[name,[1]]])});
		await assert.rejects(emit(api,shifted),/Unverified .NET callback allowance/u);
		const old=await emit(unbounded,prior),withOnce=await emit(api,wire);
		assert.doesNotMatch(Object.values(old.files).join("\n"),/CallbackAlreadyInvokedException/u);
		assert.match(withOnce.files["Api.cs"],/sealed class CallbackAlreadyInvokedException/u);
		assert.match(withOnce.files["Calls.cs"],/if \(s == 16\) throw new CallbackAlreadyInvokedException\("Budget.probe"\);/u);
		assert.match(withOnce.files["Calls.cs"],/if \(s == 14\) throw callbacks.Original/u);
		assert.match(withOnce.files["Calls.cs"],/if \(s == 13\) throw new LeanIOException/u);
		assert.match(wire.source,/else if \(s == lbc_budget_CALLBACK_ALREADY_INVOKED\) s = 16;/u);
	}
	if(target==="jvm")
	{
		const emit=(api,wire)=>generateJvmIO({api,wire,invoke: "budget_jvm_invoke",retire: "budget_retire",task: "budget_task",watch: "budget_watch",evidence: null});
		const prior=generateSyncWire(plain.prefix,entries,{tasks: true});
		const wire=generateSyncWire(built.prefix,entries,{tasks: true,onceByDeclaration});
		const shifted=generateSyncWire(built.prefix,entries,{tasks: true,onceByDeclaration: new Map([[name,[1]]])});
		const unbounded=reconcileHostExports({metadata,selection,component}).api;
		await assert.rejects(emit(api,prior),/Unverified JVM callback allowance/u);
		await assert.rejects(emit(unbounded,wire),/Unverified JVM callback allowance/u);
		await assert.rejects(emit(api,shifted),/Unverified JVM callback allowance/u);
		for(const bad of [[],[0],[1,1],[2,1]]) assert.throws(()=>generateSyncWire(built.prefix,entries,
			{tasks: true,onceByDeclaration: new Map([[name,bad]])}),/Invalid one-call wire slots/u);
		const plainSources=await emit(unbounded,prior),enabled=await emit(api,wire);
		const java="src/main/java/org/leanbridge/budget/";
		assert.doesNotMatch(Object.values(plainSources.files).join("\n"),/CallbackAlreadyInvokedException/u);
		assert.match(enabled.files[java+"CallbackAlreadyInvokedException.java"],/extends IllegalStateException/u);
		assert.match(enabled.files[java+"Api.java"],/if \(status == 16\) throw new CallbackAlreadyInvokedException\("Budget.probe"\);/u);
		assert.match(enabled.files[java+"Api.java"],/if \(status == 14\) throw state.original/u);
		assert.match(wire.source,/else if \(s == lbc_budget_CALLBACK_ALREADY_INVOKED\) s = 16;/u);
	}
	if(target==="ruby")
	{
		const wire=generateSyncWire(built.prefix,entries,{tasks: true,onceByDeclaration});
		const prior=generateSyncWire(plain.prefix,entries,{tasks: true});
		assert.match(wire.source,/else if \(s == lbc_budget_CALLBACK_ALREADY_INVOKED\) s = 16;/u);
		assert.match(wire.source,/if \(phase == 2\) s = 13;/u);
		assert.equal(wire.methods[0].once,true);assert.equal(prior.methods[0].once,undefined);
		const source=async w=>Object.values((await generateRubySyncSources({name: "budget",wire: w})).files).join("\n");
		assert.doesNotMatch(await source(prior),/CallbackAlreadyInvoked|__LB_ONCE_DECODE__|when 16/u);
		assert.match(await source(wire),/when 16\s+status\(code\) unless ops\[:once\]\s+raise CallbackAlreadyInvoked/u);
		await assert.rejects(generateRubySyncSources({name: "callback-already-invoked",wire}),/Reserved Ruby one-call exception/u);
	}
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
