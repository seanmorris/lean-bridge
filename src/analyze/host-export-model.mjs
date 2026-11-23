/**
 * Reconcile application-owned IO exports with independently declared host imports.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { hostDeclarationName, hostMemberSymbol } from "../backends/lean/host-object.mjs";
import { resolveNativeHostEffects } from "./native-host-effects.mjs";

const doc = summary => ({ summary, details: "" });
const hostModule = "LeanBridge.Host.Python";
const fail = message => { throw Object.assign(new TypeError(message), { code: "host-export-contract-mismatch" }); };
const resources = ir => ir?.types.filter(t => t.kind === "resource" && t.host?.targets.includes("python")) ?? [];
const importedMembers = (ir, types) => new Map(types.flatMap(t =>
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
 */
export const pythonHostSelection = ir => {
	const types = resources(ir);
	return {
		resources: types.map(t => ({ lean: `${hostModule}.${t.name}`, id: t.id }))
		, members: [...importedMembers(ir, types).keys()].sort()
	};
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
	const imports = ir ? hashBindingIr(ir) : null, types = resources(ir), members = importedMembers(ir, types);
	const synchronous = selection.synchronousIO === true;
	const immediate = synchronous || (!ir && (selection.taskExports?.length || selection.asyncIterators?.length));
	if(synchronous && (!selection.nativeEffectPolicy || ir || !metadata.entries.some(e => ["IO", "BaseIO", "EIO"].includes(e.effect))
		|| selection.taskExports?.length || selection.asyncIterators?.length || metadata.entries.some(e => e.delivery || e.taskIO)))
		fail("A standalone native IO package requires a checked IO, BaseIO or EIO entry and no host imports or async protocols");
	if(selection.nativeEffectPolicy && ir?.capabilities.some(c => c.id.startsWith("capability:native.")))
		fail("Host imports cannot declare compiler-owned capability:native.* identifiers");
	// Unmarked records also occur in pre-policy evidence. Canonical builds always
	// mark the request; a partially missing audit must never become an empty one.
	const native = selection.nativeEffectPolicy === undefined && selection.nativeEffects === undefined && metadata.nativeEffectAudit === undefined ? null
		: resolveNativeHostEffects(selection, metadata.nativeEffectAudit, new Map([...members].map(([name, d]) =>
			[name, hostMemberSymbol("python", types.find(t => t.id === d.owner), d)])));
	const phases = e => native?.phases.get(e.declaration) ?? {};
	const capabilities = e => [...new Set([...Object.values(phases(e)).flat(), ...e.hostMembers.flatMap(n => members.get(n).capabilities)])].sort();
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
	const mayWrite = e => e.effect !== "pure" || e.delivery === "async-iterator";
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
	const site = (t, input = false) => isOwned(t) && input
		? { type: t, ownership: "borrow", lifetime: { scope: "call", anchor: null } } : signature(t);
	if(ownedTypes.some(r => !metadata.entries.some(e => [e.result, e.error, e.stepError, ...e.parameters.map(p => p.type)].some(t => t?.id === r.id))))
		fail("Selected resource does not occur directly at a checked export boundary");
	const errors = [];
	const callbacks = new Map(), rust = selection.rustTaskCallbacks === true, cpp = selection.cppTaskCallbacks === true;
	const c = selection.cTaskCallbacks === true, ruby = selection.rubyTaskCallbacks === true;
	const dotnet = selection.dotnetTaskCallbacks === true, jvm = selection.jvmTaskCallbacks === true;
	const perl = selection.perlTaskCallbacks === true;
	if([rust, cpp, c, ruby, dotnet, jvm, perl, selection.pythonTaskCallbacks === true].filter(Boolean).length > 1) fail("Ambiguous retained-callback host");
	const hostErrorName = perl ? "PerlHostException" : jvm ? "JvmCallbackException" : dotnet ? "DotNetCallbackException" : ruby ? "RubyHostException" : c ? "CCallbackError" : cpp ? "CppCallbackException" : rust ? "RustCallbackError" : "PythonHostException";
	const hostError = "error:" + hostErrorName, terminal = "error:TaskIO.Error";
	const callbackRef = t => {
		const name = `Retained_${t.argument.name}_to_${t.reply.name}`, id = "bridge:" + name;
		if(!callbacks.has(id)) callbacks.set(id, {
			id, name, kind: "callback", representation: "identity"
			, mutability: "immutable"
			, fields: [], cases: [], typeParameters: [], assurance: []
			, target: null, host: null, resource: null
			, callable: { invocation: "many", reentry: "same-agent"
				, selfDisposal: "defer", resultMode: "value"
				, parameters: [{ ...signature(t.argument), name: "value", mutability: "immutable", optional: false, default: null }]
				, result: signature(t.reply), effects: ["fails", "host-call"]
				, failure: { mode: "declared", errors: [hostError], unexpected: "poison-runtime" } }
			, source: { producer: "lean", declaration: name, extensions: { "lean-bridge.dev/callback-scheduler": jvm ? "jvm-virtual-thread" : "owner-event-loop" } }
			, documentation: doc("A synchronous host callable retained until its exporting task settles or is cancelled.") });
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
	if(metadata.entries.some(e => (e.effect === "IO" && e.hostMembers.length) || hasCallbacks(e))) errors.push({ id: hostError
		, name: hostErrorName
		, category: "domain"
		, payload: null
		, documentation: doc(perl ? "A Perl exception propagated through its original Lean IO error." : jvm ? "A JVM exception propagated through its original Lean IO error." : dotnet ? "A C# exception propagated through its original Lean IO error." : ruby ? "A Ruby exception propagated through its original Lean IO error." : c ? "A C callback failure propagated through its original Lean IO error." : cpp ? "A C++ callback exception propagated through the original Lean IO error." : rust ? "A Rust callback error propagated through the original Lean IO error." : metadata.entries.some(hasCallbacks) ? "A Python exception propagated through the original Lean IO error."
			: "The bound Python object raised an exception that escaped the Lean call.") });
	const startErrors = e => e.effect === "EIO" ? [`error:EIO.${e.declaration}`] : ["pure", "BaseIO"].includes(e.effect) ? []
		: ["error:IO.Error", ...(e.hostMembers.length || hasCallbacks(e) ? [hostError] : [])];
	const errorIds = e => {
		const ids = new Set(startErrors(e));
		if(e.taskIO)
		{ ids.add(terminal); if(hasCallbacks(e)) ids.add(hostError); }
		if(e.stepError) ids.add(`error:AsyncStep.${e.declaration}`);
		return [...ids];
	};
	const entries = metadata.entries.map(e => {
		const task = e.delivery === "task", stream = e.delivery === "async-iterator", async = task || stream;
		const selected = selection.asyncIterators?.find(s => s.open === e.declaration);
		if(Boolean(e.taskIO) !== Boolean(selection.taskIOErrors?.includes(e.declaration)) || (e.taskIO && !task))
			fail("Unverified terminal IO selection");
		if(hasCallbacks(e) && (!task || !(selection.pythonTaskCallbacks || rust || cpp || c || ruby || dotnet || jvm || perl)))
			fail("Unverified retained-callback selection");
		for(const p of e.parameters) if(isCallback(p.type)) callbackRef(p.type);
		if(!["IO", "EIO", "pure", ...(async || immediate ? ["BaseIO"] : [])].includes(e.effect) || !selection.exportModules.includes(e.module)
			|| Boolean(selection.taskExports?.includes(e.declaration)) !== task || (async && e.hostMembers.length)
			|| Boolean(selected) !== stream || (stream && canonicalJson(selected) !== canonicalJson(e.protocol))
			|| (!stream && (e.stepError || e.protocol)) || (e.delivery !== undefined && !async)
			|| (!async && e.effect === "pure" && ((!immediate && e.result?.constructor !== "result") || e.hostMembers.length))
			|| e.hostMembers.some(n => !selection.members.includes(n))) fail(`Unauthenticated effect or host member for ${e.declaration}`);
		if(e.effect === "EIO") errors.push({
			id: errorIds(e)[0], name: `EIO_${e.declaration.replaceAll(".", "_")}`
			, category: "domain", payload: e.error
			, documentation: doc(`Typed synchronous failure of ${e.declaration}.`)
		});
		if(e.stepError) errors.push({
			id: `error:AsyncStep.${e.declaration}`
			, name: `AsyncStep_${e.declaration.replaceAll(".", "_")}`
			, category: "domain", payload: e.stepError
			, documentation: doc(`Failure while pulling from ${e.declaration}.`)
		});
		return { name: snake(e.declaration.split(".").at(-1))
			, declaration: e.declaration
			, effect: e.effect
			, ...(async ? { delivery: e.delivery } : {})
			, ...(e.taskIO ? { taskIO: true } : {})
			, ...(stream ? { protocol: e.protocol, ...(e.stepError ? { stepError: e.stepError } : {}) } : {})
			, ...(e.effect === "EIO" ? { error: e.error } : {})
			, parameters: e.parameters.map(p => ({ name: snake(p.name), type: p.type }))
			, result: e.result };
	});
	const importedCaps = new Set(metadata.entries.flatMap(e => e.hostMembers.flatMap(n => members.get(n).capabilities)));
	const requiredCaps = [...(native?.capabilities ?? []), ...(ir?.capabilities.filter(c => importedCaps.has(c.id)) ?? [])];
	const api = {
		schemaVersion: 3, component
		, producers: [{ id: "lean", adapter: "lean-bridge-host-exports", adapterVersion: 1, tool: "Lean", toolVersion: metadata.leanVersion, extensions: {} }]
		, types: [...ownedTypes, ...callbacks.values()
			, ...types.map(t => ({ ...t, assurance: []
				, host: { ...t.host, targets: ["python"] }
				, source: { producer: "lean", declaration: `${hostModule}.${t.name}`, extensions: {} } }))]
		, declarations: metadata.entries.map((e, i) => ({
			id: `lean:${e.declaration}`, name: entries[i].name, kind: "function"
			, owner: null, overloadKey: e.declaration, typeParameters: [], receiver: null
			, parameters: e.parameters.map((p, j) => ({ ...site(isCallback(p.type) ? callbackRef(p.type) : p.type, true), name: entries[i].parameters[j].name
				, mutability: isOwned(p.type) ? mayWrite(e) ? "write" : "read" : p.type.kind === "named" ? types.find(t => t.id === p.type.id).mutability : "immutable"
				, optional: false, default: null }))
			, result: site(e.result), mutability: "immutable"
			, effects: [...new Set([...(e.delivery ? ["async"] : []), ...(hasCallbacks(e) ? ["host-call"] : []), ...(e.effect === "pure" && !e.protocol ? [] : ["nondeterministic"]), ...(errorIds(e).length ? ["fails"] : []), ...resourceEffects(e), ...e.hostMembers.flatMap(n => members.get(n).effects)])].sort()
			, failure: { mode: errorIds(e).length ? "declared" : "none", errors: errorIds(e), unexpected: "poison-runtime" }
			, resultMode: e.delivery === "task" ? "promise" : e.delivery ?? "value"
			, capabilities: capabilities(e), assurance: []
			, documentation: doc(e.protocol ? `Pull elements from ${e.declaration}; close on exhaustion or early exit.` : e.delivery === "task" ? `Await the Lean task returned by ${e.declaration}.` : `${e.effect === "pure" ? "Pure" : `Synchronous ${e.effect}`} entry ${e.declaration}.`)
			, source: { producer: "lean", declaration: e.declaration
				, extensions: {
					"lean-lang.org/effect": e.effect
					, ...(Object.keys(phases(e)).length ? { "lean-bridge.dev/native-effects-v1": phases(e) } : {})
					, ...(e.delivery === "task" ? { "lean-lang.org/delivery": "Task" } : {})
					, ...(e.taskIO ? { "lean-bridge.dev/task-failure": "IO.Error" } : {})
					, ...(e.protocol ? { "lean-bridge.dev/pull-protocol": e.protocol } : {})
					, ...(imports ? { "lean-bridge.dev/host-imports-sha256": imports } : {})
					, "lean-bridge.dev/host-members": e.hostMembers
				}
			}
		}))
		, errors, capabilities: requiredCaps, assurance: []
		, documentation: doc(`Compiled ${ir ? "host-object" : synchronous ? "synchronous IO" : "task"} API for ${component.name}.`)
	};
	validateBindingIr(api);
	if(review)
	{
		const reviewed = parseBindingIr(review.source);
		const ignoreProse = item => ({ ...item, documentation: doc("Public API.") });
		const identity = value => hashBindingIr({ ...ignoreProse(value), types: value.types.map(ignoreProse)
			, declarations: value.declarations.map(ignoreProse)
			, errors: value.errors.map(ignoreProse)
			, capabilities: value.capabilities.map(ignoreProse) });
		if(identity(api) !== identity(reviewed)) fail("Reviewed API differs from compiled host exports, effects, ownership, or import identity");
		return { entries, api: reviewed };
	}
	return { entries, api };
};
