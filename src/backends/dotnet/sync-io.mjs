/**
 * Generate direct C# IO calls over the private checked C wire. No Task is invented.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { copiedResultType } from "./copied-conversions.mjs";
import { dotnetComponentAssembly } from "./copied-model.mjs";
import { verifiedDotnetAssets } from "./verified-assets.mjs";

const primitive = { unit: "Unit", bool: "bool", char: "global::System.Text.Rune"
	, uint8: "byte", int8: "sbyte", uint16: "ushort", int16: "short"
	, uint32: "uint", int32: "int", uint64: "ulong", int64: "long"
	, usize: "nuint", isize: "nint", float32: "float", float64: "double"
	, bytes: "byte[]", string: "string", nat: "global::System.Numerics.BigInteger"
	, int: "global::System.Numerics.BigInteger" };
const type = t => {
	if(Array.isArray(t) && t.length === 2) return `Result<${type(t[0])}, ${type(t[1])}>`;
	if(typeof t !== "string" || !Object.hasOwn(primitive, t)) throw new TypeError("Unsupported .NET synchronous value");
	return primitive[t];
};
const pascal = s => s.split(/[^A-Za-z0-9]+/u).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join("");
const args = (t, v, i) => {
	const slot = "input + " + 3 * i;
	if(t === "bytes" || t === "string") return `frame.Copy(${v}, ${slot});`;
	if(t === "nat" || t === "int") return `frame.Number(${v}, ${t === "nat" ? "true" : "false"}, ${slot});`;
	const from = { unit: "0UL", bool: `${v} ? 1UL : 0UL`, char: `(ulong)${v}.Value`
		, float32: `global::System.BitConverter.SingleToUInt32Bits(${v})`
		, float64: `global::System.BitConverter.DoubleToUInt64Bits(${v})` };
	return `input[${3 * i}] = ${from[t] ?? `unchecked((ulong)${v})`};`;
};
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

/**
 * Derive the public managed API and its internal marshaller from the same compiler model.
 *
 * @param options - Reconciled application declarations and native compiler output.
 * @param options.api - Canonical public Binding IR.
 * @param options.wire - Generated synchronous entries, layouts and cleanup symbol.
 * @param options.evidence - Native library digests and runtime identity for the loader.
 */
export const generateDotnetIO = async ({ api, wire, evidence }) => {
	if(wire.wait || wire.leases?.length || wire.methods.some(m => m.delivery) || api.types?.some(t => t.kind === "resource"))
		throw new TypeError("The .NET IO profile requires synchronous copied values");
	const assembly = dotnetComponentAssembly(api.component), component = assembly.slice("LeanBridge.".length);
	const names = new Set(["Api", "Equals", "ReferenceEquals", "GetType", "ToString", "GetHashCode", "MemberwiseClone", "Finalize"]);
	if(!/^[A-Za-z][A-Za-z0-9]*$/u.test(component) || names.has(component)) throw new TypeError("Invalid .NET IO component name");
	const runtimeClass = wire.methods.some(m => pascal(m.name) === "Wire") ? "global::" + assembly + ".Wire" : "Wire";
	const pub = [], impl = [];
	for(const [i, m] of wire.methods.entries())
	{
		const d = api.declarations.find(s => s.source.declaration === m.declaration), method = pascal(m.name);
		if(!d || d.resultMode !== "value" || names.has(method) || !/^[A-Z][A-Za-z0-9]*$/u.test(method)
			|| !["pure", "BaseIO", "IO", "EIO"].includes(m.effect) || d.parameters.length !== m.args.length)
			throw new TypeError("Invalid, asynchronous or colliding .NET IO method: " + m.name);
		names.add(method);
		const params = d.parameters.map(p => p.name);
		if(params.some(n => !/^[a-z][a-z0-9_]*$/u.test(n)) || new Set(params).size !== params.length) throw new TypeError("Invalid .NET parameter names");
		const output = m.result === "unit" ? "void" : type(m.result);
		const signature = m.args.map((t, j) => type(t) + " @" + params[j]).join(", ");
		pub.push(`    /// <summary>Calls ${m.declaration} synchronously.</summary>
    public static ${output} ${method}(${signature}) => ${runtimeClass}.Call${i}(${params.map(n => "@" + n).join(", ")});`);
		impl.push(`    internal static ${output} Call${i}(${m.args.map((t, j) => type(t) + " v" + j).join(", ")})
    {
        using var frame = new Frame();
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
        finally { clear(output); }
    }`);
	}
	const runtime = (await readFile(new URL("sync-wire.cs", import.meta.url), "utf8")).replace("namespace LeanBridge.GeneratedIO;", "namespace " + assembly + ";");
	const files = { "Api.cs": `namespace ${assembly};
public readonly record struct Unit;
${wire.methods.some(m => Array.isArray(m.result) || Array.isArray(m.error)) ? copiedResultType : ""}
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
${impl.join("\n")}
}
` };
	return { assembly, files };
};
