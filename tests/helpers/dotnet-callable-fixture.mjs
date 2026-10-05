/**
 * Independent C# primitive callable signatures and installed consumer.
 *
 * @file
 */
import { callableArities, callablePrimitives, callableSignatures } from "./callable-fixture.mjs";

export const dotnetCallableSignatures = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [{ callback: { parameters: ["uint32"], result: "uint32" } }], result: { callback: { parameters: ["uint32"], result: "uint32" } } }
	, { name: "Callables.combine", parameters: ["string", "uint64", { callback: { parameters: ["string", "uint64"], result: "string" } }, { callback: { parameters: ["string"], result: "string" } }], result: "string" }
	, { name: "Callables.wide", parameters: ["uint32", { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } }], result: "uint32" }
	, { name: "Callables.makeWide", parameters: ["uint32"], result: { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } } }];
export const dotnetCallableArities = { ...callableArities, "Callables.retainCallback": 1, "Callables.makeWide": 1 };
const cases = {
	unit: ["Unit", ["default"]], bool: ["bool", ["false", "true"]]
	, uint8: ["byte", ["0", "1", "127", "128", "255"]]
	, uint16: ["ushort", ["0", "1", "32767", "32768", "65535"]]
	, uint32: ["uint", ["0", "1", "2147483647", "2147483648", "uint.MaxValue"]]
	, uint64: ["ulong", ["0", "1", "4294967296", "9007199254740993", "ulong.MaxValue"]]
	, int8: ["sbyte", ["sbyte.MinValue", "-1", "0", "1", "sbyte.MaxValue"]]
	, int16: ["short", ["short.MinValue", "-1", "0", "1", "short.MaxValue"]]
	, int32: ["int", ["int.MinValue", "-1", "0", "1", "int.MaxValue"]]
	, int64: ["long", ["long.MinValue", "-9007199254740993", "-1", "0", "1", "long.MaxValue"]]
	, nat: ["BigInteger", ["0", "1", ...[31, 32, 53, 64, 255, 4096, 16384].map(bit => `(BigInteger.One << ${bit}) + 1`)]]
	, int: ["BigInteger", ["0", "1", "-1", ...[31, 32, 53, 64, 255, 4096, 16384].flatMap(bit => [`(BigInteger.One << ${bit}) + 1`, `-(BigInteger.One << ${bit}) - 1`])]]
	, float32: ["float", ["0f", "-0f", "float.Epsilon", "-float.Epsilon", "float.MaxValue", "float.MinValue", "float.NaN", "float.PositiveInfinity", "float.NegativeInfinity", "1.0000001f"]]
	, float64: ["double", ["0d", "-0d", "double.Epsilon", "-double.Epsilon", "double.MaxValue", "double.MinValue", "double.NaN", "double.PositiveInfinity", "double.NegativeInfinity", "1.0000000000000002d"]]
	, string: ["string", ['""', '"a\\0λ🌿"', '"e\\u0301"', '"\\ufdd0\\uffff"', '"\\r\\n"', 'new string(\'x\', 2048)']]
	, bytes: ["byte[]", ["Array.Empty<byte>()", "new byte[] { 0, 255, 128, 1 }", "Enumerable.Range(0, 256).Select(x => (byte)x).ToArray()"]]
	, char: ["Rune", ["new Rune(0)", "new Rune(0x10ffff)", "new Rune(0xd7ff)", "new Rune(0xe000)", "new Rune(0x301)", "new Rune(0x1f33f)", "new Rune(0xfdd0)"]]
	, usize: ["ulong", ["0", "1", "4294967296", "9007199254740993", "ulong.MaxValue"]]
	, isize: ["long", ["long.MinValue", "-9007199254740993", "-1", "0", "1", "long.MaxValue"]]
};

/** Generate a consumer from reviewed host types, not generated C# declarations. */
export const dotnetCallableConsumer = () => `using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Callables;

static class Program
{
    static int checks;
    static void Check(bool condition) { if (!condition) throw new Exception("check failed at " + checks); ++checks; }
    static T Reject<T>(Action action) where T : Exception
    {
        try { action(); } catch (T error) { ++checks; return error; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    static void Equal<T>(T left, T right)
    {
        if (left is byte[] a && right is byte[] b) Check(a.SequenceEqual(b));
        else if (left is float f && right is float g) Check(float.IsNaN(f) && float.IsNaN(g) || BitConverter.SingleToInt32Bits(f) == BitConverter.SingleToInt32Bits(g));
        else if (left is double d && right is double e) Check(double.IsNaN(d) && double.IsNaN(e) || BitConverter.DoubleToInt64Bits(d) == BitConverter.DoubleToInt64Bits(e));
        else Check(Equals(left, right));
    }
    sealed class Marker : Exception { internal Marker() : base("callback\\0λ") { Data["token"] = new object(); } }
    [MethodImpl(MethodImplOptions.NoInlining)] static void ThrowMarker(Marker marker) => throw marker;
    [MethodImpl(MethodImplOptions.NoInlining)] static WeakReference Abandon()
    {
        var closure = Api.MakeString("garbage-collected capture");
        return new WeakReference(closure);
    }
    [MethodImpl(MethodImplOptions.NoInlining)] static Func<bool, uint, uint> KeepInvoke() => Api.MakeUint32(42).Invoke;
    static uint Reenter(int depth) => depth == 0 ? 42 : Api.CallUint32((uint)depth, _ => Reenter(depth - 1));
    static void Main()
    {
        Check(Api.WordBits() == 64);
        Check(Api.Wide(100, (${Array.from({ length: 16 }, (_, i) => `a${i}`).join(", ")}) => {
            ${Array.from({ length: 16 }, (_, i) => `Check(a${i} == ${i ? i : 100});`).join(" ")}
            return 42;
        }) == 42);
        using (var wide = Api.MakeWide(3)) Check(wide.Invoke(${Array.from({ length: 16 }, (_, i) => i).join(", ")}) == 197968);
${callablePrimitives.map(([name, kind]) => {
	const [type, values] = cases[kind], unit = kind === "unit", suffix = name.replace("UInt", "Uint").replace("USize", "Usize").replace("ISize", "Isize");
	return `        {
            var values = new ${type}[] { ${values.join(", ")} };
            Check(typeof(Api).GetMethod("Call${suffix}")!.ReturnType == typeof(${unit ? "void" : type}));
            Check(typeof(Api).GetMethod("Call${suffix}")!.GetParameters()[1].ParameterType == typeof(${unit ? "Action<Unit>" : `Func<${type}, ${type}>`}));
            Check(typeof(Api).GetMethod("Make${suffix}")!.ReturnType == typeof(LeanClosure<${unit ? "Action<bool, Unit>" : `Func<bool, ${type}, ${type}>`}>));
            ${unit ? "Action<Unit>" : `Func<${type}, ${type}>`} identity = value => ${unit ? "{ }" : "value"};
            for (int iteration = 0; iteration < 128; ++iteration) foreach (var value in values)
            {
                ${unit ? "Api.CallUnit(value, identity); ++checks;" : `Equal(Api.Call${suffix}(value, identity), value);`}
                int calls = 0;
                ${unit ? "Api.TwiceUnit(value, _ => { ++calls; });" : `Equal(Api.Twice${suffix}(value, v => { ++calls; return v; }), value);`}
                Check(calls == 2);
                using var closure = Api.Make${suffix}(value);
                ${unit ? "closure.Invoke(true, default); closure.Invoke(false, default); checks += 2;" : `Equal(closure.Invoke(true, values[0]), value); Equal(closure.Invoke(false, values[0]), values[0]);`}
                Check(!closure.IsClosed); closure.Dispose(); closure.Dispose(); Check(closure.IsClosed);
                Reject<ObjectDisposedException>(() => closure.Invoke(true, values[0]));
            }
            var marker = new Marker(); int attempted = 0;
            var caught = Reject<Marker>(() => Api.Twice${suffix}(values[0], value => { ++attempted; ThrowMarker(marker); ${unit ? "" : "return value;"} }));
            Check(ReferenceEquals(caught, marker)); Check(ReferenceEquals(caught.Data["token"], marker.Data["token"]));
            Check(caught.Message == "callback\\0λ" && caught.StackTrace!.Contains(nameof(ThrowMarker))); Check(attempted == 1);
            Reject<ArgumentNullException>(() => Api.Call${suffix}(values[0], null!));
            ${unit ? "Api.CallUnit(default, _ => { });" : `Equal(Api.Call${suffix}(values[0], identity), values[0]);`}
        }`;
}).join("\n")}
        Check(Api.Combine("λ", ulong.MaxValue, (text, count) => text + count, text => text + "!") == "λ18446744073709551615!");
        int later = 0; var original = new Marker();
        Check(ReferenceEquals(Reject<Marker>(() => Api.Combine("x", 1, (_, _) => throw original, text => { ++later; return text; })), original)); Check(later == 0);
        for (int i = 0; i < 50; ++i)
        {
            Equal(Api.CallString("owned\\0λ", value => { GC.Collect(); GC.WaitForPendingFinalizers(); return value; }), "owned\\0λ");
            Equal(Api.TwiceBytes(new byte[] { 1, 2 }, value => { GC.Collect(); return value; }), new byte[] { 1, 2 });
        }
        byte[]? retained = null; var bytes = new byte[] { 1, 2 };
        var copied = Api.CallBytes(bytes, value => { retained = value; value[0] = 3; return value; });
        Check(bytes[0] == 1 && copied[0] == 3); retained![0] = 4; Check(copied[0] == 3);
        Reject<ArgumentOutOfRangeException>(() => Api.CallNat(-1, value => value));
        Reject<ArgumentOutOfRangeException>(() => Api.CallNat(1, _ => -1));
        Reject<ArgumentOutOfRangeException>(() => Api.MakeNat(-1));
        using (var closure = Api.MakeNat(2)) Reject<ArgumentOutOfRangeException>(() => closure.Invoke(false, -1));
        Reject<ArgumentNullException>(() => Api.CallString("x", _ => null!));
        Reject<ArgumentNullException>(() => Api.CallBytes(Array.Empty<byte>(), _ => null!));
        Reject<EncoderFallbackException>(() => Api.CallString("\\ud800", value => value));
        Reject<EncoderFallbackException>(() => Api.CallString("x", _ => "\\ud800"));
        Reject<ArgumentException>(() => Api.CallBytes(new byte[16 * 1024 * 1024 + 1], value => value));
        Reject<ArgumentException>(() => Api.CallBytes(Array.Empty<byte>(), _ => new byte[16 * 1024 * 1024 + 1]));
        Reject<ArgumentException>(() => Api.CallString("x", _ => new string('x', 16 * 1024 * 1024)));
        bool ranAsync = false;
        Action<Unit> asyncCallback = async _ => { ranAsync = true; await Task.Yield(); };
        Reject<ArgumentException>(() => Api.CallUnit(default, asyncCallback)); Check(!ranAsync);
        Action<Unit> multicast = _ => { }; multicast += asyncCallback;
        Reject<ArgumentException>(() => Api.CallUnit(default, multicast)); Check(!ranAsync);
        Check(Reenter(12) == 42);
        var depthError = Reject<LeanBridgeException>(() => Reenter(80)); Check(depthError.Status == 5 && depthError.Message.Contains("reentry limit (64)"));
        Check(Reenter(2) == 42);
        using (var expired = Api.RetainCallback(value => value + 1)) Reject<ArgumentException>(() => expired.Invoke(1));
        using (var closure = Api.MakeUint32(42))
        {
            Exception? error = null;
            var thread = new Thread(() => { try { closure.Invoke(true, 0); } catch (Exception failure) { error = failure; } });
            thread.Start(); thread.Join(); Check(error is InvalidOperationException); Check(closure.Invoke(true, 0) == 42);
            var close = new Thread(closure.Dispose); close.Start(); close.Join(); Check(closure.IsClosed);
        }
        LeanClosure<Func<bool, uint, uint>>? orphan = null;
        var creator = new Thread(() => orphan = Api.MakeUint32(9)); creator.Start(); creator.Join();
        Reject<InvalidOperationException>(() => orphan!.Invoke(true, 0)); orphan!.Dispose();
        for (int i = 0; i < 32; ++i)
        {
            var reference = Abandon(); GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); Check(!reference.IsAlive);
        }
        var invoke = KeepInvoke(); GC.Collect(); GC.WaitForPendingFinalizers(); Check(invoke(true, 0) == 42); GC.KeepAlive(invoke);
        var leases = new List<LeanClosure<Func<bool, uint, uint>>>();
        try { for (int i = 0; i < 4096; ++i) leases.Add(Api.MakeUint32((uint)i)); }
        catch (LeanBridgeException) { ++checks; }
        Check(leases.Count >= 4090 && leases.Count <= 4096);
        Reject<LeanBridgeException>(() => Api.MakeUint32(1));
        foreach (var lease in leases) lease.Dispose();
        for (int i = 0; i < 8192; ++i) { using var lease = Api.MakeUint32((uint)i); Check(lease.Invoke(true, 0) == i); }
        GC.KeepAlive(invoke);
        Check(Api.CallUint32(41, value => value + 1) == 42);
        Console.WriteLine("callable-dotnet-ok:" + checks);
    }
}
`;
