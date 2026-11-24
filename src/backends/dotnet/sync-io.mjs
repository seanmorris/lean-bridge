/**
 * Generate C# IO and task APIs over the private checked C wire. Only selected
 * native tasks and pull protocols acquire asynchronous delivery.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { taskResourceTypes } from "../c/task-resources.mjs";
import { copiedResultType } from "./copied-conversions.mjs";
import { dotnetComponentAssembly } from "./copied-model.mjs";
import { verifiedDotnetAssets } from "./verified-assets.mjs";

const primitive = { unit: "Unit", bool: "bool", char: "global::System.Text.Rune"
	, uint8: "byte", int8: "sbyte", uint16: "ushort", int16: "short"
	, uint32: "uint", int32: "int", uint64: "ulong", int64: "long"
	, usize: "nuint", isize: "nint", float32: "float", float64: "double"
	, bytes: "byte[]", string: "string", nat: "global::System.Numerics.BigInteger"
	, int: "global::System.Numerics.BigInteger" };
/**
 * Render the public C# type of a copied scalar or nested result.
 *
 * @param t - A primitive name or an ordered success/error pair.
 */
const type = t => {
	if(Array.isArray(t) && t.length === 2) return `Result<${type(t[0])}, ${type(t[1])}>`;
	if(typeof t !== "string" || !Object.hasOwn(primitive, t)) throw new TypeError("Unsupported .NET synchronous value");
	return primitive[t];
};
const pascal = s => s.split(/[^A-Za-z0-9]+/u).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join("");
/**
 * Emit code writing a C# argument into its private three-word slot.
 *
 * @param t - Copied primitive.
 * @param v - Local C# expression.
 * @param i - Argument index.
 */
const args = (t, v, i) => {
	const slot = "input + " + 3 * i;
	if(t === "bytes" || t === "string") return `frame.Copy(${v}, ${slot});`;
	if(t === "nat" || t === "int") return `frame.Number(${v}, ${t === "nat" ? "true" : "false"}, ${slot});`;
	const from = { unit: "0UL", bool: `${v} ? 1UL : 0UL`, char: `(ulong)${v}.Value`
		, float32: `global::System.BitConverter.SingleToUInt32Bits(${v})`
		, float64: `global::System.BitConverter.DoubleToUInt64Bits(${v})` };
	return `input[${3 * i}] = ${from[t] ?? `unchecked((ulong)${v})`};`;
};
/**
 * Emit the C# expression that copies an owned native result.
 *
 * @param t - Copied scalar or nested success/error pair.
 * @param depth - Current discriminant index.
 */
const decode = (t, depth = 0) => {
	if(Array.isArray(t)) return `(Tag(tags[${depth}]) ? ${type(t)}.Ok(${decode(t[0], depth + 1)}) : ${type(t)}.Err(${decode(t[1], depth + 1)}))`;
	const base = { unit: "default(Unit)", bool: "TagWord(output[0])"
		, char: "new global::System.Text.Rune(checked((int)output[0]))"
		, float32: "global::System.BitConverter.UInt32BitsToSingle((uint)output[0])"
		, float64: "global::System.BitConverter.UInt64BitsToDouble(output[0])"
		, bytes: "Buffer(output, 1).ToArray()"
		, string: "Utf8.GetString(Buffer(output, 1))"
		, nat: "Integer(output, true)", int: "Integer(output, false)" };
	return base[t] ?? `unchecked((${type(t)})output[0])`;
};

// The host-import entry uses the identical private copy/layout ABI as plain IO.
export { args as dotnetScalarArgument, decode as dotnetScalarResult, type as dotnetScalarType };

/**
 * Select native CLR argument and delegate types from a reconciled declaration.
 *
 * @param m - Worker wire method.
 * @param d - Public declaration.
 * @param api - Binding IR containing the nominal callback types.
 * @param project - Maps a wire type to its C# type.
 * @param shape - Maps a verified type reference back to its wire type.
 */
const parameterTypes = (m, d, api, project, shape = ref => ref?.name) => {
	const slots = new Map();
	for(const [i, from, to] of m.callbacks ?? [])
	{
		const p = d.parameters[i], cb = api.types?.find(t => t.id === p?.type?.id)?.callable;
		if(m.delivery !== "task" || slots.has(i) || m.args[i] !== "callback" || p?.ownership !== "lease"
			|| p.lifetime?.scope !== "explicit" || cb?.parameters.length !== 1 || shape(cb.parameters[0].type) !== from
			|| shape(cb.result?.type) !== to || cb.reentry !== "same-agent" || cb.selfDisposal !== "defer"
			|| cb.resultMode !== "value" || cb.failure?.errors?.[0] !== "error:DotNetCallbackException")
			throw new TypeError("Invalid retained .NET callback contract");
		slots.set(i, to === "unit" ? `global::System.Action<${project(from)}>` : `global::System.Func<${project(from)}, ${project(to)}>`);
	}
	return m.args.map((t, i) => slots.get(i) ?? project(t));
};
// CLR identity includes the defining assembly, so each verified Lean kind
// defines its own shared contract, independent of the exporting component.
const leaseModels = (api, wire, evidence) => {
	const kinds = taskResourceTypes(api.types?.filter(t => t.kind === "resource") ?? []);
	if(kinds.length !== (wire.leases?.length ?? 0)) throw new TypeError("Inconsistent .NET resource definitions");
	const leases = new Map();
	for(const [i, r] of kinds.entries())
	{
		const w = wire.leases[i], ledger = evidence?.ledgerId;
		if(!/^[a-f0-9]{64}$/u.test(ledger) || !evidence.libraries?.["liblb_task_resources_" + ledger + ".so"]
			|| w.hash !== r.hash || w.name !== r.name || w.type !== "lease:" + r.hash
			|| w.tag !== 3 + i || w.symbol !== wire.clear.slice(0, -6) + "_lease_" + i)
			throw new TypeError("Unverified .NET resource kind or ledger");
		const assembly = "LeanBridge.ResourceV1.H" + r.hash;
		const ns = ["LeanBridge.Resources", ...r.lean.split(".").slice(0, -1).map(n => "@" + n)].join(".");
		// Compiler-selected source kinds start with a letter, so an escaped
		// member/CLR name can never collide with another authored kind.
		const reserved = ["Borrow", "Dispose", "Retain", "IsClosed", "SameResource", "Finalize", "Equals", "ToString", "ReferenceEquals", "GetType", "GetHashCode", "MemberwiseClone", "IDisposable", "Action", "Func", "InvalidOperationException"];
		const name = reserved.includes(r.name) ? "_" + r.name : r.name;
		leases.set(w.type, { ...w, id: r.id, index: i, ledger, assembly, ns, className: "@" + name, cs: "global::" + ns + ".@" + name });
	}
	return leases;
};
const resourcePort = r => `    private static class Lease${r.index}
    {
        [global::System.Runtime.CompilerServices.UnsafeAccessor(global::System.Runtime.CompilerServices.UnsafeAccessorKind.Constructor)]
        private static extern ${r.cs} Make(global::System.Func<string, (ulong, ulong)> borrow, global::System.Action dispose,
            global::System.Func<bool> closed, global::System.Func<${r.cs}> retain, global::System.Func<${r.cs}, bool> same);
        [global::System.Runtime.CompilerServices.UnsafeAccessor(global::System.Runtime.CompilerServices.UnsafeAccessorKind.Method, Name = "Borrow")]
        private static extern (ulong, ulong) Borrow(${r.cs} self, string ledger);
        internal static readonly LeaseOps<${r.cs}> Ops = new("${r.ledger}", ${r.tag}, "${r.symbol}", Make, Borrow);
    }`;
const resourceCodecs = leases => ({
	type: t => leases.get(t)?.cs ?? type(t)
	, args: (t, v, i) => leases.has(t) ? `Lease${leases.get(t).index}.Ops.Input(${v}, input + ${3 * i});` : args(t, v, i)
	, decode: t => leases.has(t) ? `Lease${leases.get(t).index}.Ops.Take(output)` : decode(t)
	, keep: m => m.args.map((t, j) => leases.has(t) ? ` global::System.GC.KeepAlive(v${j});` : "").join("")
	, drain: leases.size ? "DrainResources();" : ""
});
const verifyLeaseSites = (m, d, api, leases) => {
	if(!leases.size) return;
	const byId = new Map([...leases.values()].map(r => [r.id, r]));
	const site = (shape, field, input) => {
		const actual = leases.get(shape), expected = byId.get(field?.type?.id);
		if(actual !== expected || (actual && (field.ownership !== (input ? "borrow" : "lease")
			|| field.lifetime?.scope !== (input ? "call" : "explicit") || field.lifetime.anchor !== null)))
			throw new TypeError("Unverified .NET resource ownership: " + m.declaration);
	};
	m.args.forEach((t, i) => site(t, d.parameters[i], true)); site(m.result, d.result, false);
	const payloads = new Set(d.failure?.errors?.map(id => api.errors.find(e => e.id === id)?.payload?.id).filter(id => byId.has(id)));
	const errors = new Set([m.error, m.terminal].map(t => leases.get(t)?.id).filter(Boolean));
	if(errors.size !== payloads.size || [...errors].some(id => !payloads.has(id))) throw new TypeError("Unverified .NET resource error: " + m.declaration);
};
const callbackSetup = (m, codecs, bound) => {
	const {type,args,decode}=codecs;
	const ns = ["callbacks", "next", "arg", "reply", "fail", "trap"].map(k => {
		if(!m.names[k]) throw new TypeError("Incomplete native callback port");
		return JSON.stringify(m.names[k]);
	});
	const cases = m.callbacks.map(([j, from, to]) => {
		const argument=`owner.Argument<${type(from)}>(h, slot, static output => ${decode(from)})`;
		const invoke=to==="unit"?`{ v${j}(x); return default(Unit); }`:`v${j}(x)`;
		const reply=`owner.Reply(h, slot, (frame, input) => { ${args(to, "y", 0)} });`;
		return `                case ${j}:
                {
                    var x = ${bound?`binding.Visit(() => ${argument})`:argument};
                    if (!owner.Invoke<${type(to)}>(h, active, () => ${bound?`binding.Scope.Invoke<${type(to)}>(() => ${invoke})`:invoke}, out var y)) return;
                    ${bound?`binding.Visit(() => { ${reply} HostWorkerFrame.Admit(); });`:reply}
                    return;
                }`;
	});
	return { ns, cases, guards: m.callbacks.map(([j]) => `        CheckDelegate(v${j});`).join("\n") };
};
/**
 * Render a safe public task/stream method and its private synchronous ABI calls.
 * Start copies inputs before returning; take decodes before releasing ownership.
 *
 * @param options - Verified method, codecs, managed names and optional class binding.
 */
const taskMethod = options => {
	const { m, i, params, argTypes, signature, method, runtimeClass, assembly, wire, codecs, bound } = options;
	const { type, args, decode, keep, drain } = codecs;
	const value = type(m.result), stream = m.delivery === "async-iterator", call = params.map(n => "@" + n).join(", ");
	let token = "cancellationToken";
	while(params.includes(token)) token += "_";
	const output = stream ? `global::System.Collections.Generic.IAsyncEnumerable<${value}>`
		: "global::System.Threading.Tasks.Task" + (m.result === "unit" ? "" : `<${value}>`);
	const publicArgs = [signature, ...stream ? [] : ["global::System.Threading.CancellationToken " + token + " = default"]].filter(Boolean).join(", ");
	const binder=bound?`new ${runtimeClass}.BoundWorker(this.Binding,this.scope)`:"";
	const invocation=[binder,call].filter(Boolean).join(", ");
	const factory=`() => ${runtimeClass}.Port${i}${bound?.g??""}(${invocation})`;
	const make=bound && stream?`this.scope.Defer(${factory})`:factory;
	const delivery=`global::${assembly}.Delivery<${value}>.${stream?"Sequence":"Value"}(${make}${stream?"":", "+token}${bound?", this.scope.Track":""})`;
	const pub = `    /// <summary>${stream ? "Pull items from" : "Await"} ${m.declaration} on the Lean owner loop.</summary>
    public ${bound?"":"static "}${output} ${method}(${publicArgs}) => ${bound?`this.scope.Invoke(() => ${delivery})`:delivery};`;
	const name = JSON.stringify;
	const cb = m.callbacks?.length && callbackSetup(m,codecs,bound);
	const construct = cb ? `
    {
${cb.guards}
        var callbacks = new Requests(${cb.ns.join(", ")}, ${name(wire.clear)}, (owner, slot, h, active) =>
        {
            switch (slot) {
${cb.cases.join("\n")}
                default: owner.InvalidSlot(); return;
            }
        });
        return new(h =>` : " =>\n        new(h =>";
	const formals=[...bound?["BoundWorker binding"]:[],...argTypes.map((t,j)=>t+" v"+j)];
	const impl = `    internal static Port<${value}> Port${i}${bound?.g??""}(${formals.join(", ")})${bound?" "+bound.constraints:""}${construct}${bound?" binding.Visit(() =>":""}
        {
            ${drain ? drain + "\n            " : ""}using var frame = new Frame();
            ulong* input = stackalloc ulong[${Math.max(1, m.args.length * 3)}];
            new global::System.Span<ulong>(input, ${Math.max(1, m.args.length * 3)}).Clear();
            ${m.args.flatMap((t, j) => t === "callback" ? [] : [args(t, "v" + j, j)]).join("\n            ")}
            var fn = (delegate* unmanaged[Cdecl]<ulong*, ulong*, ulong*, byte*, int>)Symbol(${name(m.names.start)});
            var clear = (delegate* unmanaged[Cdecl]<ulong*, void>)Symbol(${name(wire.clear)});
            ulong* output = stackalloc ulong[4]; new global::System.Span<ulong>(output, 4).Clear();
            byte* tags = stackalloc byte[${m.tagBytes}];
            try
            {
                int s = fn(input, h, output, tags);${bound?"\n                if (s is 0 or 3 or 4) HostWorkerFrame.Admit();":""}
                if (s == 0) return;
                ${m.effect === "EIO" ? `if (s == 3) throw new DeclaredError<${type(m.error)}>(${name(m.declaration)}, ${decode(m.error)});` : m.effect === "IO" ? `if (s == 4) throw new LeanIOException(${name(m.declaration)}, ${decode("string")});` : ""}
                throw Failure(s);
            }
            finally { clear(output);${keep(m)} }
        }${bound?")":""}, h =>${bound?` binding.Visit<(bool,${value})>(() =>`:""}
        {
            var fn = (delegate* unmanaged[Cdecl]<ulong*, ulong*, byte*, int>)Symbol(${name(m.names.take)});
            var clear = (delegate* unmanaged[Cdecl]<ulong*, void>)Symbol(${name(wire.clear)});
            ulong* output = stackalloc ulong[4]; new global::System.Span<ulong>(output, 4).Clear();
            byte* tags = stackalloc byte[${m.tagBytes}];
            try
            {
                int s = fn(h, output, tags);
                if (s == 0) return (true, ${decode(m.result)});
                ${cb ? `if (s == 14) throw callbacks.Original(output[0]);
                if (s == 13) throw new LeanIOException(${name(m.declaration)}, ${decode("string")});
                if (s == 4) throw new TaskIOException(${name(m.declaration)}, ${decode("string")});${m.effect === "EIO" ? `
                if (s == 3) throw new DeclaredError<${type(m.error)}>(${name(m.declaration)}, ${decode(m.error)});` : ""}` : ""}
                ${stream ? "if (s == 2) return (false, default!);" : ""}
                ${m.terminal ? stream && !m.stepIO ? `if (s == 3) throw new DeclaredError<${type(m.terminal)}>(${name(m.stepDeclaration)}, ${decode(m.terminal)});` : `if (s == 4) throw new TaskIOException(${name(stream?m.stepDeclaration:m.declaration)}, ${decode("string")});` : ""}
                throw Failure(s);
            }
            finally { clear(output); }
        }${bound?")":""}, ${name(m.names.poll)}, ${name(m.names.close)}, ${name(m.names.pull ?? null)}${cb ? ", callbacks);\n    }" : ");"}`;
	return { pub, impl };
};

export { parameterTypes as dotnetTaskParameters, taskMethod as renderDotnetTaskMethod };

/**
 * Derive the public API and internal marshaller from the same compiler model.
 *
 * @param options - Reconciled application declarations and native compiler output.
 * @param options.api - Canonical public Binding IR.
 * @param options.wire - Generated synchronous entries, layouts and cleanup symbol.
 * @param options.evidence - Native library digests and runtime identity for the loader.
 * @param tasks - Require a native readiness interface and actual asynchronous declarations.
 */
const generate = async ({ api, wire, evidence }, tasks) => {
	if(!tasks && (wire.wait || wire.methods.some(m => m.delivery)))
		throw new TypeError("The .NET IO profile requires synchronous copied values");
	if(tasks && (!wire.wait || !wire.methods.some(m => m.delivery))) throw new TypeError("The .NET task profile requires real native delivery");
	const leases = leaseModels(api, wire, evidence), codecs = resourceCodecs(leases);
	const { type, args, decode, keep, drain } = codecs;
	const assembly = dotnetComponentAssembly(api.component), component = assembly.slice("LeanBridge.".length);
	const names = new Set(["Api", "Equals", "ReferenceEquals", "GetType", "ToString", "GetHashCode", "MemberwiseClone", "Finalize"]);
	if(!/^[A-Za-z][A-Za-z0-9]*$/u.test(component) || names.has(component)) throw new TypeError("Invalid .NET IO component name");
	const runtimeClass = wire.methods.some(m => pascal(m.name) === "Wire") ? "global::" + assembly + ".Wire" : "Wire";
	const pub = [], impl = [];
	for(const [i, m] of wire.methods.entries())
	{
		const d = api.declarations.find(s => s.source.declaration === m.declaration), method = pascal(m.name);
		const expected = m.delivery === "task" ? "promise" : m.delivery === "async-iterator" ? m.delivery : "value";
		if(!d || (m.delivery && expected === "value") || d.resultMode !== expected || names.has(method) || !/^[A-Z][A-Za-z0-9]*$/u.test(method)
			|| !["pure", "BaseIO", "IO", "EIO"].includes(m.effect) || d.parameters.length !== m.args.length)
			throw new TypeError("Invalid, asynchronous or colliding .NET IO method: " + m.name);
		names.add(method);
		verifyLeaseSites(m, d, api, leases);
		const params = d.parameters.map(p => p.name);
		if(params.some(n => !/^[a-z][a-z0-9_]*$/u.test(n)) || new Set(params).size !== params.length) throw new TypeError("Invalid .NET parameter names");
		const argTypes = parameterTypes(m, d, api, type), signature = argTypes.map((t, j) => t + " @" + params[j]).join(", ");
		if(m.delivery)
		{
			const generated = taskMethod({ m, i, params, argTypes, signature, method, runtimeClass, assembly, wire, codecs });
			pub.push(generated.pub); impl.push(generated.impl); continue;
		}
		const output = m.result === "unit" ? "void" : type(m.result);
		pub.push(`    /// <summary>Calls ${m.declaration} synchronously.</summary>
    public static ${output} ${method}(${signature}) => ${runtimeClass}.Call${i}(${params.map(n => "@" + n).join(", ")});`);
		impl.push(`    internal static ${output} Call${i}(${m.args.map((t, j) => type(t) + " v" + j).join(", ")})
    {
        ${drain ? drain + "\n        " : ""}using var frame = new Frame();
        ulong* input = stackalloc ulong[${Math.max(1, m.args.length * 3)}];
        new global::System.Span<ulong>(input, ${Math.max(1, m.args.length * 3)}).Clear();
        ${m.args.map((t, j) => args(t, "v" + j, j)).join("\n        ")}
        var fn = (delegate* unmanaged[Cdecl]<ulong*, ulong*, byte*, int>)Symbol("${m.symbol}");
        var clear = (delegate* unmanaged[Cdecl]<ulong*, void>)Symbol("${wire.clear}");
        ulong* output = stackalloc ulong[4]; new global::System.Span<ulong>(output, 4).Clear();
        byte* tags = stackalloc byte[${m.tagBytes}];
        try
        {
            var status = fn(input, output, tags);
            if (status == 0) ${m.result === "unit" ? "return;" : "return " + decode(m.result) + ";"}
            ${m.effect === "EIO" ? `if (status == 3) throw new DeclaredError<${type(m.error)}>("${m.declaration}", ${decode(m.error)});` : m.effect === "IO" ? `if (status == 4) throw new LeanIOException("${m.declaration}", ${decode("string")});` : ""}
            throw Failure(status);
        }
        finally { clear(output);${keep(m)} }
    }`);
	}
	const runtime = (await readFile(new URL("sync-wire.cs", import.meta.url), "utf8")).replace("namespace LeanBridge.GeneratedIO;", "namespace " + assembly + ";");
	const files = { "Api.cs": `namespace ${assembly};
public readonly record struct Unit;
${wire.methods.some(m => Array.isArray(m.result) || Array.isArray(m.error) || Array.isArray(m.terminal)) ? copiedResultType : ""}
/// <summary>A thrown Lean EIO, not a returned Except value.</summary>
public sealed class DeclaredError<T>(string declaration, T payload) : global::System.Exception("Lean EIO failed: " + declaration)
{
    public string Declaration { get; } = declaration;
    public T Payload { get; } = payload;
}
public sealed class LeanIOException(string declaration, string message) : global::System.IO.IOException(message)
{ public string Declaration { get; } = declaration; }
public sealed class WrongContextException() : global::System.InvalidOperationException("Lean IO requires the original process main thread") { }
public sealed class RuntimeUnavailableException() : global::System.InvalidOperationException("The Lean runtime is unavailable") { }
public static class Api
{
${pub.join("\n")}
}
`
	, "Wire.cs": runtime
	, "Calls.cs": `namespace ${assembly};
internal static unsafe partial class Wire
{
    private static class Assets
    {
${verifiedDotnetAssets(evidence)}
    }
    private static nint Symbol(string name) => global::System.Runtime.InteropServices.NativeLibrary.GetExport(Assets.Handle, name);
${leases.size ? [...leases.values()].map(resourcePort).join("\n") + "\n" : ""}${tasks ? `    private const string WaitOpen = "${wire.wait.open}", WaitClose = "${wire.wait.close}";\n` : ""}${impl.join("\n")}
}
` };
	if(tasks)
	{
		const templates = [["task-delivery.cs", "TaskDelivery.cs"]
			, ["task-loop.cs", "LeanRuntime.cs"]];
		if(wire.methods.some(m => m.callbacks?.length)) templates.push(["task-callbacks.cs", "RetainedCallback.cs"]);
		for(const [source, dest] of templates)
			files[dest] = (await readFile(new URL(source, import.meta.url), "utf8")).replace("namespace LeanBridge.GeneratedIO;", "namespace " + assembly + ";");
	}
	if(leases.size)
	{
		const asset = async name => readFile(new URL(name, import.meta.url), "utf8");
		files["ResourceWire.cs"] = (await asset("resource-wire.cs")).replace("namespace LeanBridge.GeneratedIO;", "namespace " + assembly + ";");
		const source = await asset("resource-contract.cs");
		const contracts = Object.fromEntries([...leases.values()].map(r => [r.assembly
			, source.replaceAll(/\bRESOURCE\b/gu, r.className).replace("LeanBridge.ResourceV1.NOMINAL", r.ns)]));
		return { assembly, files, contracts };
	}
	return { assembly, files };
};

/**
 * Generate a strictly synchronous assembly.
 *
 * @param options - Compiler-authenticated IO wire.
 */
export const generateDotnetIO = options => generate(options, false);
/**
 * Generate an assembly backed by native tasks or pull cursors.
 *
 * @param options - Compiler-authenticated task wire.
 */
export const generateDotnetTasks = options => generate(options, true);
