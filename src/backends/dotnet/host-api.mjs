/** @file Generate scoped, typed C# bindings for application-owned host classes. */
import { readFile } from "node:fs/promises";
import { copiedResultType } from "./copied-conversions.mjs";
import { dotnetComponentAssembly } from "./copied-model.mjs";
import { dotnetHostCarrier } from "./host-native-members.mjs";
import { dotnetScalarArgument, dotnetScalarResult, dotnetScalarType } from "./sync-io.mjs";
import { verifiedDotnetAssets } from "./verified-assets.mjs";

/**
 * List the C# signatures the consumer must supply, without private wire details.
 *
 * @param host - Validated nominal types and the same bound member model used by C#.
 */
export const dotnetHostSignatures = host => {
	const name = s => s.index === undefined ? s.kind === "unit" ? "void" : dotnetScalarType(s.kind).replace("global::", "") : host.ir.types[s.index].name;
	return host.model.members.map(m => {
		const owner = host.ir.types[m.owner].name, params = m.params.filter(s => s.kind !== "unit").map(name).join(", ");
		if(m.mode === "new") return "new " + owner + "(" + params + ")";
		if(m.mode === "get" || m.mode === "set") return (m.mode === "get" ? name(m.out) : params) + " " + owner + "." + m.name + " { " + m.mode + "; }";
		return (m.mode === "static" ? "static " : "") + name(m.out) + " " + owner + "." + m.name + "(" + params + ")";
	});
};

/**
 * No raw handles, Type arrays, marshaling code or scheduler in the consumer API.
 *
 * @param o - Compiler-reconciled exports, native model and authenticated library evidence.
 */
export const generateDotnetHostApi = async o => {
	const { api, ir, entries, model, evidence, prefix } = o;
	const assembly = dotnetComponentAssembly(api.component);
	if(!/^LeanBridge\.[A-Z][A-Za-z0-9]*$/u.test(assembly) || !/^lb_dotnet_host_[a-f0-9]{64}$/u.test(prefix) || evidence.library !== "lib" + prefix + ".so")
		throw new TypeError("Invalid generated CLR host identity");
	const gens = ir.types.map((_, i) => "T" + i), g = "<" + gens.join(",") + ">", constraints = gens.map(t => "where " + t + " : class").join(" ");
	const sum = t => t.kind === "apply" && t.constructor === "result" && t.arguments.length === 2;
	const site = t => dotnetHostCarrier(ir.types, t);
	const input = (p, j) => {
		if(site(p.type).index !== undefined) return "input[" + 3*j + "]=call.Input(v" + j + ");";
		// dn_get checks the unused high bits. The general IO port accepts a
		// sign-extended ulong, but these signed narrow carriers do not.
		const width = ({ int8: "byte", int16: "ushort", int32: "uint" })[p.type.name];
		return width ? "input[" + 3*j + "]=unchecked((" + width + ")v" + j + ");" : dotnetScalarArgument(p.type.name, "v"+j, j);
	};
	const type = t => sum(t) ? "Result<" + t.arguments.map(type).join(",") + ">" : site(t).index === undefined ? dotnetScalarType(t.name) : gens[site(t).index];
	const decode = (t, n = 0) => sum(t) ? "(Tag(tags[" + n + "]) ? " + type(t) + ".Ok(" + decode(t.arguments[0], n+1) + ") : " + type(t) + ".Err(" + decode(t.arguments[1], n+1) + "))"
		: site(t).index === undefined ? dotnetScalarResult(t.name) : "(" + type(t) + ")HostRefs.Read(output[0])!";
	const impl = [], pub = [], methods = new Set([...gens, "Bound", "Binding", "Dispose", "GetType", "GetHashCode", "Equals", "ToString", "MemberwiseClone", "Finalize", "ReferenceEquals"]);
	for(const [i, e] of entries.entries())
	{
		const method = e.name.split("_").map(n => n.charAt(0).toUpperCase() + n.slice(1)).join("");
		const names = e.parameters.map(p => p.name);
		if(!/^[A-Z][A-Za-z0-9]*$/u.test(method) || methods.has(method) || names.some(n => !/^[a-z][a-z0-9_]*$/u.test(n)) || new Set(names).size !== names.length)
			throw new TypeError("Invalid or colliding CLR host export: " + e.name);
		methods.add(method);
		const result = type(e.result), unit = result === "Unit", ret = unit ? "void" : result;
		const parameters = e.parameters.map((p, j) => type(p.type) + " @" + names[j]);
		pub.push(`    public ${ret} ${method}(${parameters.join(",")}) => global::${assembly}.Wire.Call${i}${g}(this.Binding${names.map(n => ",@" + n).join("")});`);
		const local = e.parameters.map((p, j) => type(p.type) + " v" + j);
		impl.push(`    internal static ${ret} Call${i}${g}(HostMembers binding${local.length ? "," + local.join(",") : ""}) ${constraints} {
        using var call=new HostCall(binding); using var frame=new Frame();
        ulong* input=stackalloc ulong[${Math.max(1,local.length*3)}]; new System.Span<ulong>(input,${Math.max(1,local.length*3)}).Clear();
        ${e.parameters.map(input).join("\n        ")}
        ulong* output=stackalloc ulong[4]; new System.Span<ulong>(output,4).Clear();
        byte* tags=stackalloc byte[65]; uint fault=0;
        var clear=Clear;
        try {
            int status=Entry(call.Id,HostCall.Entry,${i},input,${local.length},output,tags,&fault); call.Check(fault);
            if(status==0) ${unit ? "return;" : "return " + decode(e.result) + ";"}
            ${e.effect === "EIO" ? "if(status==3) throw new DeclaredError<" + type(e.error) + ">(" + JSON.stringify(e.declaration) + "," + decode(e.error) + ");" : ""}
            if(status==4) throw new LeanIOException(${JSON.stringify(e.declaration)},${dotnetScalarResult("string")});
            throw Status(status);
        } finally { clear(output); }
    }`);
	}
	const files = { "Api.cs": `using LeanBridge.GeneratedHost;
namespace ${assembly};
public readonly record struct Unit;
${copiedResultType}
public sealed class DeclaredError<T>(string declaration,T payload):System.Exception("Lean EIO failed: "+declaration) {
    public string Declaration { get; }=declaration;
    public T Payload { get; }=payload;
}
public sealed class LeanIOException(string declaration,string message):System.IO.IOException(message) { public string Declaration { get; }=declaration; }
public sealed class WrongContextException():System.InvalidOperationException("Lean IO requires the original process main thread") {}
public sealed class RuntimeUnavailableException():System.InvalidOperationException("The Lean runtime is unavailable") {}
public static class Api {
    public static Bound${g} BindHosts${g}() ${constraints} => new(HostContract.Bind(${gens.map(n => "typeof(" + n + ")").join(",")}));
}
public sealed class Bound${g} : System.IDisposable ${constraints} {
    private HostMembers? binder;
    private HostMembers Binding => binder ?? throw new System.ObjectDisposedException("CLR host binding");
    internal Bound(HostMembers value) { global::${assembly}.Wire.Control(value,-2); binder=value; }
    public void Dispose() { if(binder is not null) { global::${assembly}.Wire.Control(binder,-1); binder=null; } }
${pub.join("\n")}
}
`
	, "HostContract.cs": "namespace LeanBridge.GeneratedHost;\n" + model.contract
	, "HostMembers.cs": model.implementation
	, "Calls.cs": `using System;
using LeanBridge.GeneratedHost;
namespace ${assembly};
internal static unsafe partial class Wire {
    private static class Assets {
${verifiedDotnetAssets(evidence)}
    }
    private static nint Symbol(string name) => System.Runtime.InteropServices.NativeLibrary.GetExport(Assets.Handle,name);
    private static delegate* unmanaged[Cdecl]<ulong,delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int>,int,ulong*,nuint,ulong*,byte*,uint*,int> Entry =>
        (delegate* unmanaged[Cdecl]<ulong,delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int>,int,ulong*,nuint,ulong*,byte*,uint*,int>)Symbol("${prefix}_call");
    private static delegate* unmanaged[Cdecl]<ulong*,void> Clear => (delegate* unmanaged[Cdecl]<ulong*,void>)Symbol("${prefix}_clear");
    private static Exception Status(int status) => status==14 ? new InvalidOperationException("Stale, wrong-kind or active CLR binding") : Failure(status);
    internal static void Control(HostMembers binding,int op) {
        using var call=new HostCall(binding); ulong* output=stackalloc ulong[4]; byte tag=0; uint fault=0;
        int status=Entry(call.Id,HostCall.Entry,op,null,0,output,&tag,&fault); call.Check(fault);
        if(status!=0) throw Status(status);
    }
${impl.join("\n")}
}
` };
	for(const name of ["host-frame.cs", "host-refs.cs", "host-wire.cs", "sync-wire.cs"])
		files[name] = (await readFile(new URL("./" + name, import.meta.url), "utf8")).replace("namespace LeanBridge.GeneratedIO;", "namespace " + assembly + ";");
	return { files, assembly };
};
