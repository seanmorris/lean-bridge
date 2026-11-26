/**
 * Reconcile application-owned IO exports with independently declared host imports.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import {hashBindingIr} from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { compiledHostModules, hostDeclarationName, hostMemberSymbol } from "../backends/lean/host-object.mjs";
import { hasJavaScriptHostOwner, nativeEffectPolicy, resolveNativeHostEffects } from "./native-host-effects.mjs";
import { heapResourceIdentities } from "./heap-resource-identity.mjs";
import {callbackHostName} from "../abi/host-member-names.mjs";
import {hostPublicHash, hostRecordPolicy, hostRecordTypes, parseHostPublic} from "./host-records.mjs";

const doc = summary => ({ summary, details: "" });
const fail = message => { throw Object.assign(new TypeError(message), { code: "host-export-contract-mismatch" }); };
const resources = (ir, target) => ir?.types.filter(t => t.kind === "resource" && t.host?.targets.includes(target)) ?? [];
const importedMembers = (ir, types, hostModule) => new Map(types.flatMap(t =>
	ir.declarations.filter(d => d.owner === t.id).map(d => [`${hostModule}.${t.name}.${hostDeclarationName(d)}`, d])));
const snake = value => value.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const signature = type => type.kind !== "named"
	? { type, ownership: "copy", lifetime: null }
	: { type, ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
const isCallback = t => t?.kind === "io-callback";
const hasCallbacks = e => e.parameters.some(p => isCallback(p.type));

/**
 * Select only generated foreign names and concrete nominal identities.
 *
 * @param ir - Validated import contract.
 * @param target - Host selected by the compiler, not by a reviewed public declaration.
 */
export const nativeHostSelection = (ir, target) => {
	if(!Object.hasOwn(compiledHostModules, target)) fail("Unsupported native host import target");
	const types = resources(ir, target), hostModule = compiledHostModules[target], ids = new Set(types.map(t => t.id));
	if(ir && (!types.length || ir.types.length !== ids.size || ir.declarations.some(d => !ids.has(d.owner))))
		fail("Host import contract must contain only the selected host's resources and members");
	return {
		...(ir ? { hostModule } : {})
		, resources: types.map(t => ({ lean: `${hostModule}.${t.name}`, id: t.id }))
		, members: [...importedMembers(ir, types, hostModule).keys()].sort()
	};
};

/**
 * Derive the private JS scheduler contract from the same inspected Lean
 * entries as the public Zend contract. Never use this view to validate or
 * publish the author's PHP review.
 *
 * @param api - Source-checked public interface.
 * @param evidence - Actual compiler selection and elaborated metadata.
 */
export const taskWorkerInterface=(api,evidence)=>{
	if(evidence.selection.phpWasmSyncObjects!==undefined) throw new TypeError("Synchronous Zend objects cannot use the JavaScript worker interface");
	if(evidence.selection.staticTaskOwner!==undefined) throw new TypeError("Native static host object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.rubyTaskObjects) throw new TypeError("Ruby task object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.perlTaskObjects) throw new TypeError("Perl task object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.jvmTaskObjects) throw new TypeError("JVM task object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.dotnetTaskObjects) throw new TypeError("CLR task object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.pythonTaskObjects) throw new TypeError("Python task object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.phpNativeTaskObjects) throw new TypeError("Native PHP task object carriers cannot use the JavaScript worker interface");
	if(evidence.selection.phpNativeFunctions) throw new TypeError("Native PHP returned functions cannot use the JavaScript worker interface");
	// Nominal Zend workers have their own checked ABI; never turn their
	// synchronous PHP callbacks into JavaScript promises.
	if(evidence.selection.phpWasmTaskObjects) return api;
	if(!evidence.selection.phpTaskCallbacks || !api.types.some(t=>t.kind==="callback")) return api;
	const selection={...evidence.selection,javascriptTaskCallbacks: true};delete selection.phpTaskCallbacks;
	delete selection.phpWasmCallbackBudgets;
	const resources=evidence.metadata.leanResources??[];
	return reconcileHostExports({ir: null,component: api.component
		, owned: resources.length?heapResourceIdentities({...evidence,resources}):[]
		, metadata: evidence.metadata,selection}).api;
};

/**
 * Generate the public application Binding IR from actual checked signatures.
 * Reviewed prose may vary; identities, shapes, effects and lifetime claims may not.
 *
 * @param options - Application identity, imported resource contract, compiler metadata and optional reviewed exports.
 */
export const reconcileHostExports = options => {
	const { component, ir, metadata, selection, review } = options;
	if(metadata?.kind !== "lean-bridge-host-export-metadata" || metadata.schemaVersion !== 1
		|| canonicalJson(metadata.entries.map(e => e.declaration)) !== canonicalJson(selection.exports)) fail("Fresh Lean metadata did not cover the complete export selection");
	// Older Python handoffs predate an explicit module field. They must still
	// agree with the complete Python nominal/member selection from their IR.
	const hostModule = selection.hostModule ?? compiledHostModules.python;
	const hostTarget = Object.keys(compiledHostModules).find(k => compiledHostModules[k] === hostModule);
	if(!hostTarget || (!ir && selection.hostModule !== undefined)) fail("Unverified host import module");
	const imports = ir ? hashBindingIr(ir) : null, types = resources(ir, hostTarget), members = importedMembers(ir, types, hostModule);
	if(ir)
	{
		const expected = nativeHostSelection(ir, hostTarget);
		if(!selection.modules.includes(hostModule) || selection.exportModules.includes(hostModule)
			|| canonicalJson(selection.resources) !== canonicalJson(expected.resources)
			|| canonicalJson(selection.members) !== canonicalJson(expected.members)) fail("Unverified host import selection");
	}
	const synchronous = selection.synchronousIO === true;
	const cursors = selection.iterators ?? [];
	if(selection.iterators !== undefined && (!Array.isArray(cursors) || !cursors.length || !synchronous || ir
		|| cursors.some(p => !p || !selection.exports.includes(p.open) || new Set([p.open,p.next,p.close]).size !== 3)
		|| new Set(cursors.map(p => p.open)).size !== cursors.length)) fail("Invalid immediate cursor selection");
	const witCursorIO=selection.witCursorIO===true;
	if(selection.witCursorIO!==undefined && (!witCursorIO || ir || synchronous || !selection.asyncIterators?.length
		|| selection.nativeEffectPolicy!==nativeEffectPolicy || Object.keys(selection).some(k=>k.endsWith("TaskCallbacks") && k!=="witTaskCallbacks")))
		fail("Unauthenticated WIT cursor IO selection");
	const syncOwners={c: "C",cpp: "C++",rust: "Rust","wit-wasi": "WIT/WASI"},syncOwner=Object.hasOwn(syncOwners,hostTarget),ownerLabel=syncOwners[hostTarget]??"PHP";
	if(ir && (hostTarget==="php" || syncOwner) && selection.nativeEffectPolicy!==nativeEffectPolicy)
		fail(ownerLabel+" host imports require compiled member evidence");
	const staticObjects=selection.staticTaskOwner!==undefined, ownerScheduler=(hostTarget==="wit-wasi"?"wit":hostTarget)+"TaskCallbacks";
	if(staticObjects && (!ir || !syncOwner || selection.staticTaskOwner!==hostTarget || selection.hostModule!==compiledHostModules[hostTarget]
		|| synchronous || selection.nativeEffectPolicy!==nativeEffectPolicy || !(selection.taskExports?.length || selection.asyncIterators?.length)
		|| Object.keys(selection).some(k=>k.endsWith("TaskCallbacks") && (k!==ownerScheduler || selection[k]!==true))
		|| Boolean(selection.taskExports?.length)!==(selection[ownerScheduler]===true))) fail("Unauthenticated static worker object owner");
	if(ir && syncOwner && !staticObjects && (selection[ownerScheduler]!==undefined || selection.taskExports?.length || selection.asyncIterators?.length))
		fail(ownerLabel+" host imports require synchronous owner calls until a worker binding is selected");
	const phpWasm=selection.phpWasmTaskObjects===true,phpObjects=selection.phpNativeTaskObjects===true || phpWasm;
	const zendSync=selection.phpWasmSyncObjects===true;
	if(selection.phpWasmSyncObjects!==undefined && (!zendSync || !ir || hostTarget!=="php" || selection.phpNativeFunctions!==undefined
		|| selection.phpNativeTaskObjects!==undefined || selection.phpWasmTaskObjects!==undefined
		|| Object.keys(selection).some(k=>k.endsWith("TaskCallbacks")) || selection.taskExports?.length || selection.asyncIterators?.length
		|| selection.nativeEffectPolicy!==nativeEffectPolicy || selection.nativeEffects?.length)) fail("Unauthenticated synchronous Zend owner");
	const phpFunctions=selection.phpNativeFunctions===true;
	if(selection.phpNativeFunctions!==undefined && (!phpFunctions || !ir || hostTarget!=="php" || selection.phpWasmTaskObjects!==undefined || selection.nativeEffectPolicy!==nativeEffectPolicy))
		fail("Unauthenticated native PHP returned-function owner");
	if(selection.phpWasmTaskObjects!==undefined && (!phpWasm || selection.phpNativeTaskObjects!==undefined || selection.nativeEffects?.length))
		fail("Unauthenticated PHP-Wasm task objects");
	if((selection.phpNativeTaskObjects!==undefined || phpWasm) && (!phpObjects || !ir || hostTarget!=="php" || selection.nativeEffectPolicy!==nativeEffectPolicy
		|| !(selection.taskExports?.length || selection.asyncIterators?.length) || Boolean(selection.taskExports?.length)!==(selection.phpTaskCallbacks===true)))
		fail("Unauthenticated native PHP task objects");
	if(ir && hostTarget==="php" && !phpObjects && (selection.phpTaskCallbacks===true || selection.taskExports?.length || selection.asyncIterators?.length))
		fail("PHP host objects require synchronous owner calls, not a worker scheduler");
	const owner=hasJavaScriptHostOwner(selection);
	if(selection.javascriptThreadedHostMembers!==undefined && (!owner || !ir || selection.nativeEffectPolicy!==nativeEffectPolicy
		|| selection.nativeEffects?.length || Boolean(selection.taskExports?.length)!==(selection.javascriptTaskCallbacks===true)))
		fail("Unauthenticated JavaScript host owner");
	const pythonObjects=selection.pythonTaskObjects===true;
	if(selection.pythonTaskObjects!==undefined && (!pythonObjects || !ir || selection.hostModule!==compiledHostModules.python
		|| selection.nativeEffectPolicy!==nativeEffectPolicy || !(selection.taskExports?.length || selection.asyncIterators?.length)
		|| Boolean(selection.taskExports?.length)!==(selection.pythonTaskCallbacks===true))) fail("Unauthenticated Python task objects");
	const rubyObjects=selection.rubyTaskObjects===true;
	if(selection.rubyTaskObjects!==undefined && (!rubyObjects || !ir || selection.hostModule!==compiledHostModules.ruby
		|| selection.nativeEffectPolicy!==nativeEffectPolicy || !(selection.taskExports?.length || selection.asyncIterators?.length)
		|| Boolean(selection.taskExports?.length)!==(selection.rubyTaskCallbacks===true))) fail("Unauthenticated Ruby task objects");
	const dotnetObjects=selection.dotnetTaskObjects===true;
	if(selection.dotnetTaskObjects!==undefined && (!dotnetObjects || !ir || selection.hostModule!==compiledHostModules.dotnet
		|| selection.nativeEffectPolicy!==nativeEffectPolicy || !(selection.taskExports?.length || selection.asyncIterators?.length)
		|| Boolean(selection.taskExports?.length)!==(selection.dotnetTaskCallbacks===true))) fail("Unauthenticated CLR task objects");
	const jvmObjects = selection.jvmTaskObjects === true;
	if(selection.jvmTaskObjects !== undefined && (!jvmObjects || !ir || selection.hostModule !== compiledHostModules.jvm
		|| selection.nativeEffectPolicy !== nativeEffectPolicy || !(selection.taskExports?.length || selection.asyncIterators?.length)
		|| Boolean(selection.taskExports?.length) !== (selection.jvmTaskCallbacks === true))) fail("Unauthenticated JVM task objects");
	const perlObjects=selection.perlTaskObjects===true;
	if(selection.perlTaskObjects!==undefined || (ir && hostTarget==="perl" && (selection.taskExports?.length || selection.asyncIterators?.length)))
	{
		if(!perlObjects || !ir || selection.hostModule!==compiledHostModules.perl || selection.nativeEffectPolicy!==nativeEffectPolicy
			|| !(selection.taskExports?.length || selection.asyncIterators?.length)
			|| Boolean(selection.taskExports?.length)!==(selection.perlTaskCallbacks===true)) fail("Unauthenticated Perl task objects");
	}
	const localObjects=staticObjects || pythonObjects || rubyObjects || dotnetObjects || jvmObjects || perlObjects, hostValues=owner || phpObjects || localObjects;
	const immediate = synchronous || ((!ir || hostValues) && (selection.taskExports?.length || selection.asyncIterators?.length));
	if(synchronous && (!selection.nativeEffectPolicy || ir || !(cursors.length || metadata.entries.some(e => ["IO", "BaseIO", "EIO"].includes(e.effect)))
		|| selection.taskExports?.length || selection.asyncIterators?.length || metadata.entries.some(e => (e.delivery && e.delivery!=="iterator") || e.taskIO)))
		fail("A standalone native IO package requires a checked IO, BaseIO or EIO entry and no host imports or async protocols");
	if(selection.nativeEffectPolicy && ir?.capabilities.some(c => c.id.startsWith("capability:native.")))
		fail("Host imports cannot declare compiler-owned capability:native.* identifiers");
	// Unmarked records also occur in pre-policy evidence. Canonical builds always
	// mark the request; a partially missing audit must never become an empty one.
	const native = selection.nativeEffectPolicy === undefined && selection.nativeEffects === undefined && metadata.nativeEffectAudit === undefined ? null
		: resolveNativeHostEffects(selection, metadata.nativeEffectAudit, new Map([...members].map(([name, d]) =>
			[name, hostMemberSymbol(hostTarget, types.find(t => t.id === d.owner), d)])));
	const phases = e => native?.phases.get(e.declaration) ?? {};
	const hostPhases=e=>({call: e.hostMembers,...e.protocolHostMembers});
	const used=e=>[...new Set(Object.values(hostPhases(e)).flat())].sort();
	for(const e of metadata.entries)
	{
		const p=selection.asyncIterators?.find(s=>s.open===e.declaration);
		const protocol=e.protocolHostMembers;
		if((owner || phpWasm || localObjects) && p)
		{
			if(!protocol || canonicalJson(Object.keys(protocol).sort())!==canonicalJson(["close","pull"])) fail("Invalid cursor host member phases: "+e.declaration);
		} else if(protocol!==undefined) fail("Unexpected cursor host member phases: "+e.declaration);
		for(const [phase,names] of Object.entries(hostPhases(e)))
		{
			const root=phase==="call"?e.declaration:phase==="pull"?p.next:p.close;
			if(!Array.isArray(names) || new Set(names).size!==names.length || names.some(n=>!members.has(n))
				|| native?.compiledMembers?.get(root)?.some(n=>!names.includes(n)))
				fail("Unverified host member dependencies for "+root);
		}
	}
	const capabilities = e => [...new Set([...Object.values(phases(e)).flat(), ...used(e).flatMap(n => members.get(n).capabilities)])].sort();
	const owned = options.owned ?? [];
	if(canonicalJson(owned.map(r => r.declaration)) !== canonicalJson(selection.leanResources ?? [])
		|| owned.some(r => !selection.modules.includes(r.module) || !/^[a-f0-9]{64}$/u.test(r.identity))) fail("Unverified application resource identity");
	const ownedTypes = owned.map(r => ({ id: "lean:" + r.declaration
		, name: r.declaration.split(".").at(-1)
		, kind: "resource", representation: "identity", mutability: "write"
		, typeParameters: []
		, fields: []
		, cases: []
		, target: null
		, callable: null
		, host: null
		, assurance: []
		, resource: { kindId: "resource:" + r.declaration + "/" + r.identity, disposal: "required", fallback: "none", cycles: "explicit-cut" }
		, source: { producer: "lean", declaration: r.declaration, extensions: { "lean-bridge.dev/resource-identity": r.identity } }
		, documentation: doc("An independently disposable lease of " + r.declaration + ".") }));
	const isOwned = t => t?.kind === "named" && ownedTypes.some(r => r.id === t.id);
	// A borrow prevents consuming the caller's lease, not mutating the Lean
	// object. IO/EIO/BaseIO and a cursor's BaseIO pull may write through it.
	const mayWrite = e => e.effect !== "pure" || Boolean(e.protocol);
	const resourceEffects = e => {
		const effects = [];
		if(e.parameters.some(p => isOwned(p.type)))
		{
			effects.push("reads-resource");
			if(mayWrite(e)) effects.push("writes-resource");
		}
		if([e.result, e.error, e.stepError].some(isOwned)) effects.push("allocates");
		return effects;
	};
	const hostRef = t => t?.kind === "named" ? types.some(kind => kind.id === t.id)
		: t?.kind === "apply" && t.constructor === "result" && t.arguments.some(hostRef);
	const leased = type => ({ type, ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	const records = hostRecordTypes(metadata.entries, selection, types);
	const site = (t, input = false) => t?.kind === "host-record"
		? {type: {kind: "named", id: "lean:" + t.declaration}, ownership: input ? "borrow" : "lease", lifetime: {scope: input ? "call" : "explicit", anchor: null}}
		: isOwned(t) && input
			? { type: t, ownership: "borrow", lifetime: { scope: "call", anchor: null } } : !input && hostRef(t) ? leased(t) : signature(t);
	if(ownedTypes.some(r => !metadata.entries.some(e => [e.result, e.error, e.stepError, ...e.parameters.map(p => p.type)].some(t => t?.id === r.id))))
		fail("Selected resource does not occur directly at a checked export boundary");
	const errors = [];
	const callbacks = new Map(), rust = selection.rustTaskCallbacks === true, cpp = selection.cppTaskCallbacks === true;
	const c = selection.cTaskCallbacks === true, ruby = selection.rubyTaskCallbacks === true;
	const dotnet = selection.dotnetTaskCallbacks === true, jvm = selection.jvmTaskCallbacks === true;
	const perl = selection.perlTaskCallbacks === true, php = selection.phpTaskCallbacks === true;
	const js=selection.javascriptTaskCallbacks===true, wit=selection.witTaskCallbacks===true;
	const schedulerCount = [rust, cpp, c, ruby, dotnet, jvm, perl, php, js, wit, selection.pythonTaskCallbacks === true].filter(Boolean).length;
	if(schedulerCount > 1) fail("Ambiguous retained-callback host");
	if(ir && !owner && hostTarget === "javascript" && (js || selection.taskExports?.length || selection.asyncIterators?.length))
		fail("Synchronous JavaScript host objects must run on their owning agent");
	const matchingScheduler = { c: staticObjects && c, cpp: staticObjects && cpp, rust: staticObjects && rust, "wit-wasi": staticObjects && wit, ruby, jvm, dotnet, perl, php: phpObjects && php, javascript: owner && js, python: selection.pythonTaskCallbacks === true }[hostTarget];
	if(ir && schedulerCount && !matchingScheduler)
		fail("Host imports and retained callbacks require the same runtime");
	const importedError = { c: ["CHostError","C"]
		, cpp: ["CppHostException","C++"]
		, rust: ["RustHostError","Rust"]
		, "wit-wasi": ["WitHostError","WIT/WASI"]
		, jvm: ["JvmHostException", "JVM"]
		, ruby: ["RubyHostException", "Ruby"]
		, dotnet: ["DotNetHostException", ".NET"]
		, perl: ["PerlHostException", "Perl"]
		, php: ["PhpHostException", "PHP"]
		, javascript: ["JavaScriptHostException", "JavaScript"] }[hostTarget];
	const publicErrorName = importedError?.[0] ?? (wit ? "WitCallbackError" : js ? "JavaScriptCallbackError" : php ? "PhpCallbackException" : perl ? "PerlHostException" : jvm ? "JvmCallbackException" : dotnet ? "DotNetCallbackException" : ruby ? "RubyHostException" : c ? "CCallbackError" : cpp ? "CppCallbackException" : rust ? "RustCallbackError" : "PythonHostException");
	const hostError = "error:" + publicErrorName, terminal = "error:TaskIO.Error";
	const staticCallback={c: "error:CCallbackError",cpp: "error:CppCallbackException",rust: "error:RustCallbackError","wit-wasi": "error:WitCallbackError"};
	const callbackError=staticObjects?staticCallback[hostTarget]:owner?"error:JavaScriptCallbackError":phpObjects?"error:PhpCallbackException":pythonObjects?"error:PythonCallbackException":rubyObjects?"error:RubyCallbackException":dotnetObjects?"error:DotNetCallbackException":jvmObjects?"error:JvmCallbackException":perlObjects?"error:PerlCallbackException":hostError;
	const callbackCarrier=t=>{
		if(t?.kind==="primitive") return {label: t.name,mutability: "immutable"};
		const kind=((owner && js) || (phpObjects && php) || localObjects) && t?.kind==="named" && types.find(k=>k.id===t.id);
		if(!kind) fail("Unauthenticated retained callback carrier");
		return {label: callbackHostName(kind.name),mutability: kind.mutability};
	};
	// Bind the author's policy to the original binder from the elaborated Lean
	// signature, not to a generated parameter name or a reviewed type label.
	const policies = new Map();
	const zendBudgets=selection.phpWasmCallbackBudgets===true;
	if(selection.phpWasmCallbackBudgets!==undefined && (!zendBudgets || !php || selection.phpNativeTaskObjects || !selection.taskCallbackPolicies?.length))
		fail("Invalid PHP-Wasm task callback policy owner");
	for(const {declaration, parameter, invocation} of selection.taskCallbackPolicies ?? [])
	{
		const e = metadata.entries.find(e => e.declaration === declaration);
		const matches = e?.parameters.filter(p => p.name === parameter);
		const key = declaration + ":" + parameter;
		if(!(js || zendBudgets || selection.pythonTaskCallbacks === true || (!ir && (c || cpp || rust || ruby || dotnet))) || e?.delivery !== "task" || matches.length !== 1 || !isCallback(matches[0].type)
			|| policies.has(key) || !["once", "many"].includes(invocation)) fail("Invalid task callback policy: " + key);
		policies.set(key, invocation);
	}
	const callbackRef = (e, p) => {
		const t = p.type, invocation = policies.get(e.declaration + ":" + p.name) ?? "many";
		const arg=callbackCarrier(t.argument),reply=callbackCarrier(t.reply);
		const name = (invocation === "once" ? "OnceRetained_" : "Retained_") + arg.label + "_to_" + reply.label, id = "bridge:" + name;
		if(!callbacks.has(id)) callbacks.set(id, {
			id, name, kind: "callback", representation: "identity"
			, mutability: "immutable"
			, fields: [], cases: [], typeParameters: [], assurance: []
			, target: null, host: null, resource: null
			, callable: { invocation, reentry: "same-agent"
				, selfDisposal: "defer", resultMode: js ? "promise" : "value"
				, parameters: [{ ...signature(t.argument), name: "value", mutability: arg.mutability, optional: false, default: null }]
				, result: signature(t.reply)
				, effects: [...js ? ["async"] : [], "fails", "host-call"]
				, failure: { mode: "declared", errors: [callbackError], unexpected: "poison-runtime" } }
			, source: { producer: "lean", declaration: name, extensions: { "lean-bridge.dev/callback-scheduler": wit ? "wasmtime-store-owner" : js ? "javascript-owner-agent" : jvm ? "jvm-virtual-thread" : "owner-event-loop" } }
			, documentation: doc(js ? "A callable on the JavaScript owner that may return a value or a promise; released on task settlement or cancellation." : "A synchronous host callable retained until its exporting task settles or is cancelled.") });
		return { kind: "named", id };
	};
	if(metadata.entries.some(e => e.effect === "IO")) errors.push({ id: "error:IO.Error"
		, name: "IOError"
		, category: "domain"
		, payload: null
		, documentation: doc("A synchronous Lean IO failure.") });
	if(metadata.entries.some(e => e.taskIO)) errors.push({ id: terminal
		, name: "TaskIOError", category: "domain", payload: null
		, documentation: doc("A terminal IO failure from the selected Lean task.") });
	const hostCanEscape=e=>(e.effect==="IO" || e.taskIO) && e.hostMembers.length || e.stepIO && e.protocolHostMembers?.pull?.length;
	if(hostValues && metadata.entries.some(hasCallbacks)) errors.push({id: callbackError
		, name: callbackError.slice("error:".length)
		, category: "domain"
		, payload: null
		, documentation: doc(staticObjects?"An error from the retained "+ownerLabel+" callback, propagated through Lean IO on its owner.":owner?"A retained JavaScript callback failed with the original thrown value.":perlObjects?"A retained Perl callback propagated its original exception.":jvmObjects?"A retained JVM callback propagated its original exception.":dotnetObjects?"A retained CLR delegate propagated its original exception.":rubyObjects?"A retained Ruby callback propagated its original exception.":pythonObjects?"A retained Python callback propagated its original exception.":"A retained PHP callback propagated its original exception.")});
	if(metadata.entries.some(e => hostCanEscape(e) || !hostValues && hasCallbacks(e))) errors.push({ id: hostError
		, name: publicErrorName
		, category: "domain"
		, payload: null
		, documentation: doc(hostTarget==="rust" && importedError ? "An error returned by a Rust host member and propagated through the original Lean IO error." : importedError ? "An exception raised by a bound " + importedError[1] + " object and propagated through the original Lean IO error." : wit ? "A callback failure reported by the Wasmtime store owner and propagated through its original Lean IO error." : js ? "A JavaScript callback failure propagated through its original Lean IO error." : php ? "A PHP callback exception propagated through its original Lean IO error." : perl ? "A Perl exception propagated through its original Lean IO error." : jvm ? "A JVM exception propagated through its original Lean IO error." : dotnet ? "A C# exception propagated through its original Lean IO error." : ruby ? "A Ruby exception propagated through the original Lean IO error." : c ? "A C callback failure propagated through its original Lean IO error." : cpp ? "A C++ callback exception propagated through the original Lean IO error." : rust ? "A Rust callback error propagated through the original Lean IO error." : metadata.entries.some(hasCallbacks) ? "A Python exception propagated through the original Lean IO error."
			: "The bound Python object raised an exception that escaped the Lean call.") });
	const startErrors = e => e.effect === "EIO" ? [`error:EIO.${e.declaration}`] : ["pure", "BaseIO"].includes(e.effect) ? []
		: [...new Set(["error:IO.Error", ...(e.hostMembers.length ? [hostError] : []), ...(hasCallbacks(e) ? [callbackError] : [])])];
	const errorIds = e => {
		const ids = new Set(startErrors(e));
		if(e.taskIO)
		{ ids.add(terminal); if(hasCallbacks(e)) ids.add(callbackError); if(e.hostMembers.length) ids.add(hostError); }
		if(e.stepError || e.stepIO) ids.add(`error:${e.delivery==="iterator"?"Step":"AsyncStep"}.${e.declaration}`);
		if(e.stepIO && e.protocolHostMembers?.pull?.length) ids.add(hostError);
		return [...ids];
	};
	const closures=new Map();
	const closureRef=e=>{
		const jsOwner=hostTarget==="javascript" && (owner || (selection.javascriptThreadedHostMembers===undefined && !selection.taskExports?.length && !selection.asyncIterators?.length));
		const closureOwner=phpWasm || zendSync?"php-wasm-zend-binding":hostTarget+"-host-binding";
		if(!ir || !(jsOwner || phpWasm || zendSync || phpFunctions || [compiledHostModules.python,compiledHostModules.ruby,compiledHostModules.c,compiledHostModules.cpp,compiledHostModules.rust,compiledHostModules["wit-wasi"],compiledHostModules.dotnet,compiledHostModules.jvm,compiledHostModules.perl].includes(selection.hostModule)) || selection.nativeEffectPolicy!==nativeEffectPolicy
			|| e.effect!=="IO" || e.delivery) fail("Returned IO closures require a checked synchronous host factory");
		const {argument,reply}=e.result;
		for(const t of [argument,reply]) if(!(t?.kind==="primitive" || t?.kind==="named" && types.some(r=>r.id===t.id)))
			fail("Unauthenticated returned closure carrier");
		const key=sha256(canonicalJson({
			component,declaration: e.declaration,argument,reply,imports
			, capabilities: capabilities(e),errors: errorIds(e)
			, ...hostTarget!=="python"?{owner: closureOwner}:{}
		}));
		const name="LeanClosure"+key.slice(0,20),id="bridge:"+name;
		const parameter={...site(argument,true),name: "value",mutability: types.find(r=>r.id===argument.id)?.mutability??"immutable",optional: false,default: null};
		const closureEffects=[...new Set(["fails","nondeterministic",...used(e).flatMap(n=>members.get(n).effects)])].sort();
		const extensions={"lean-bridge.dev/closure-owner": closureOwner,"lean-bridge.dev/required-capabilities": capabilities(e)};
		closures.set(e.declaration,{
			id, name, kind: "callback", representation: "identity"
			, mutability: "immutable"
			, fields: [], cases: [], typeParameters: [], assurance: []
			, target: null, host: null, resource: null
			, callable: {
				invocation: "many", reentry: "same-agent", selfDisposal: "defer"
				, resultMode: "value", parameters: [parameter], result: site(reply)
				, effects: closureEffects
				, failure: {mode: "declared",errors: errorIds(e),unexpected: "poison-runtime"}
			}
			, source: {producer: "lean",declaration: e.declaration,extensions}
			, documentation: doc("A returned Lean function. Closing its creating host binding revokes it.")
		});
		return {kind: "named",id};
	};
	const entries = metadata.entries.map(e => {
		const task = e.delivery === "task", stream = e.delivery === "async-iterator", async = task || stream;
		const cursor=e.delivery==="iterator", protocol=cursors.find(s=>s.open===e.declaration);
		if(Boolean(protocol)!==cursor || (cursor && (canonicalJson(protocol)!==canonicalJson(e.protocol) || !["IO","BaseIO","EIO"].includes(e.stepEffect)
			|| (e.stepEffect==="IO")!==(e.stepIO===true) || (e.stepEffect==="EIO")!==Boolean(e.stepError))) || (!cursor && e.stepEffect!==undefined))
			fail("Unverified immediate pull protocol: "+e.declaration);
		const selected = selection.asyncIterators?.find(s => s.open === e.declaration);
		if(async && !hostValues && [e.result,e.error,e.stepError,...e.parameters.map(p=>p.type)].some(hostRef))
			fail("Async host objects require an authenticated owner");
		if(Boolean(e.taskIO) !== Boolean(selection.taskIOErrors?.includes(e.declaration)) || (e.taskIO && !task))
			fail("Unverified terminal IO selection");
		if(hasCallbacks(e) && (!task || !(selection.pythonTaskCallbacks || rust || cpp || c || ruby || dotnet || jvm || perl || php || js || wit)))
			fail("Unverified retained-callback selection");
		for(const p of e.parameters) if(isCallback(p.type)) callbackRef(e, p);
		if(e.result?.kind==="io-closure") closureRef(e);
		if(!["IO", "EIO", "pure", ...(async || immediate ? ["BaseIO"] : [])].includes(e.effect) || !selection.exportModules.includes(e.module)
			|| Boolean(selection.taskExports?.includes(e.declaration)) !== task || (!owner && async && e.hostMembers.length)
			|| Boolean(selected) !== stream || (stream && canonicalJson(selected) !== canonicalJson(e.protocol))
			|| (!stream && !cursor && (e.stepError || e.protocol)) || (e.stepIO!==undefined && (!(cursor || stream && (hostValues || witCursorIO)) || e.stepIO!==true || e.stepError)) || (e.delivery !== undefined && !async && !cursor)
			|| (!async && e.effect === "pure" && ((!immediate && e.result?.constructor !== "result") || e.hostMembers.length))
			|| e.hostMembers.some(n => !selection.members.includes(n))) fail(`Unauthenticated effect or host member for ${e.declaration}`);
		if(e.effect === "EIO") errors.push({
			id: errorIds(e)[0], name: `EIO_${e.declaration.replaceAll(".", "_")}`
			, category: "domain", payload: e.error
			, documentation: doc(`Typed synchronous failure of ${e.declaration}.`)
		});
		if(e.stepError || e.stepIO) errors.push({
			id: `error:${cursor?"Step":"AsyncStep"}.${e.declaration}`
			, name: `${cursor?"Step":"AsyncStep"}_${e.declaration.replaceAll(".", "_")}`
			, category: "domain", payload: e.stepError ?? null
			, documentation: doc(`Failure while pulling from ${e.declaration}.`)
		});
		return { name: snake(e.declaration.split(".").at(-1))
			, declaration: e.declaration
			, effect: e.effect
			, ...(async || cursor ? { delivery: e.delivery } : {})
			, ...(cursor ? {stepEffect: e.stepEffect} : {})
			, ...(e.taskIO ? { taskIO: true } : {})
			, ...(stream || cursor ? { protocol: e.protocol, ...(e.stepError ? { stepError: e.stepError } : {}), ...(e.stepIO ? {stepIO: true} : {}) } : {})
			, ...(e.effect === "EIO" ? { error: e.error } : {})
			, parameters: e.parameters.map(p => ({ name: snake(p.name), type: p.type }))
			, result: e.result };
	});
	const importedCaps = new Set(metadata.entries.flatMap(e => used(e).flatMap(n => members.get(n).capabilities)));
	const requiredCaps = [...(native?.capabilities ?? []), ...(ir?.capabilities.filter(c => importedCaps.has(c.id)) ?? [])];
	const api = {
		schemaVersion: 3, component
		, producers: [{ id: "lean", adapter: "lean-bridge-host-exports", adapterVersion: 1, tool: "Lean", toolVersion: metadata.leanVersion, extensions: {} }]
		, types: [...ownedTypes, ...callbacks.values(), ...closures.values()
			, ...types.map(t => ({ ...t, assurance: []
				, host: { ...t.host, targets: [hostTarget] }
				, source: { producer: "lean", declaration: `${hostModule}.${t.name}`, extensions: {} } }))]
		, declarations: metadata.entries.map((e, i) => ({
			id: `lean:${e.declaration}`, name: entries[i].name, kind: "function"
			, owner: null, overloadKey: e.declaration, typeParameters: [], receiver: null
			, parameters: e.parameters.map((p, j) => ({ ...site(isCallback(p.type) ? callbackRef(e, p) : p.type, true), name: entries[i].parameters[j].name
				, mutability: isOwned(p.type) ? mayWrite(e) ? "write" : "read" : p.type.kind === "named" ? types.find(t => t.id === p.type.id).mutability : "immutable"
				, optional: false, default: null }))
			, result: closures.has(e.declaration)?leased({kind: "named",id: closures.get(e.declaration).id}):site(e.result)
			, mutability: "immutable"
			, effects: [...new Set([...(e.delivery && e.delivery!=="iterator" ? ["async"] : []), ...(e.result?.kind==="io-closure"?["allocates"]:[]), ...(hasCallbacks(e) ? ["host-call"] : []), ...(e.effect === "pure" && !e.protocol ? [] : ["nondeterministic"]), ...(errorIds(e).length ? ["fails"] : []), ...resourceEffects(e), ...used(e).flatMap(n => members.get(n).effects)])].sort()
			, failure: { mode: errorIds(e).length ? "declared" : "none", errors: errorIds(e), unexpected: "poison-runtime" }
			, resultMode: e.delivery === "task" ? "promise" : e.delivery ?? "value"
			, capabilities: capabilities(e), assurance: []
			, documentation: doc(e.protocol ? `Pull elements from ${e.declaration}; close on exhaustion or early exit.` : e.delivery === "task" ? `Await the Lean task returned by ${e.declaration}.` : `${e.effect === "pure" ? "Pure" : `Synchronous ${e.effect}`} entry ${e.declaration}.`)
			, source: { producer: "lean", declaration: e.declaration
				, extensions: {
					"lean-lang.org/effect": e.effect
					, ...(e.effect === "EIO" && (!e.delivery || hostValues) && hostRef(e.error) ? { "lean-bridge.dev/error-payload-site": leased(e.error) } : {})
					, ...(hostValues && hostRef(e.stepError) ? {"lean-bridge.dev/step-error-payload-site": leased(e.stepError)} : {})
					, ...(e.stepIO ? {"lean-bridge.dev/step-failure": "IO.Error"} : {})
					, ...(Object.keys(phases(e)).length ? { "lean-bridge.dev/native-effects-v1": phases(e) } : {})
					, ...(e.delivery === "task" ? { "lean-lang.org/delivery": "Task" } : {})
					, ...(e.taskIO ? { "lean-bridge.dev/task-failure": "IO.Error" } : {})
					, ...(e.protocol ? { "lean-bridge.dev/pull-protocol": e.protocol } : {})
					, ...(e.delivery==="iterator" ? {"lean-bridge.dev/pull-effect": e.stepEffect} : {})
					, ...(imports ? { "lean-bridge.dev/host-imports-sha256": imports } : {})
					, "lean-bridge.dev/host-members": owner ? used(e) : e.hostMembers
					, ...(owner || phpWasm || localObjects ? {"lean-bridge.dev/host-member-phases": hostPhases(e)} : {})
				}
			}
		}))
		, errors, capabilities: requiredCaps, assurance: []
		, documentation: doc(`Compiled ${ir ? "host-object" : synchronous ? "synchronous IO" : "task"} API for ${component.name}.`)
	};
	if(records.length)
	{
		api.schemaVersion = 4;
		api.aggregatePolicy = hostRecordPolicy;
		api.types = [...api.types.map(t => ({...t, aggregate: null})), ...records];
		hostPublicHash(api);
	}
	else validateBindingIr(api);
	if(review)
	{
		const reviewed = parseHostPublic(review.source, records.length > 0);
		const ignoreProse = item => ({ ...item, documentation: doc("Public API.") });
		const typeIdentity = item => records.some(r => r.id === item.id) && item.kind === "record"
			? { ...ignoreProse(item), fields: item.fields.map(ignoreProse) } : ignoreProse(item);
		const identity = value => hostPublicHash({ ...ignoreProse(value), types: value.types.map(typeIdentity)
			, declarations: value.declarations.map(ignoreProse)
			, errors: value.errors.map(ignoreProse)
			, capabilities: value.capabilities.map(ignoreProse) });
		if(identity(api) !== identity(reviewed)) fail("Reviewed API differs from compiled host exports, effects, ownership, or import identity");
		return { entries, api: reviewed };
	}
	return { entries, api };
};
