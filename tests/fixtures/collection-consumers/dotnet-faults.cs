// Isolated allocation/conversion probes. Host mode never calls a Lean library.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Text;
using System.Text.Json;
using LeanBridge.Collections;
using LeanBridge.Collections.Interop;
using Single = LeanBridge.Collections.Single;
using Probe = LeanBridge.Collections.Interop.CollectionProbe;

static class CollectionFaultConsumer
{
    static bool native;
    static int checkpoints, partialInputChecks;
    static Dictionary<string, int> indices = new();
    static readonly Type RuntimeType = typeof(Api).Assembly.GetType("LeanBridge.Collections.Interop.Runtime")!;
    static void Check(bool value) { if (!value) throw new Exception("collection cleanup check failed"); }
    static MethodInfo Method(string prefix, string name) => RuntimeType.GetMethod(prefix + indices[name], BindingFlags.Static | BindingFlags.NonPublic)!;
    static object Invoke(MethodInfo method, params object[] values)
    {
        try { return method.Invoke(null, values)!; }
        catch (TargetInvocationException error) when (error.InnerException is not null)
        { ExceptionDispatchInfo.Capture(error.InnerException).Throw(); throw; }
    }
    static object Roundtrip(string name, object value)
    {
        using var scope = new Scope();
        var method = Method("To", name);
        var encoded = method.GetParameters().Length == 1 ? Invoke(method, value) : Invoke(method, value, scope);
        return Invoke(Method("From", name), encoded);
    }
    static Primitives Value() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
        BigInteger.One << 5120, -(BigInteger.One << 5120), -0.0f, 3.25, "\ufeff🌱\0", new byte[] { 0, 255, 128 }, new Rune(0x1f331), ulong.MaxValue, long.MinValue);
    static Packet Parcel() => new("parcel\0", new[] { new[] { Value() }, Array.Empty<Primitives>(), new[] { Value(), Value() } },
        new Empty(), new Single(ulong.MaxValue), new Count(BigInteger.One << 5120), new Pair(17, "a\0"), new Reversed("b\0", 23));
    static void Recover()
    {
        var input = new[] { new uint[] { 1, 2, 3 } };
        var result = native ? Api.ArrayReverseUint32(input) : (uint[][])Roundtrip("array_reverse_uint32", input);
        Check(result.Length == 1 && result[0].SequenceEqual(native ? new uint[] { 3, 2, 1 } : input[0]));
        Check(Probe.Live == 0);
    }
    static void Faults(Action action)
    {
        Probe.Target = 0; Probe.Count = 0;
        var beforeCalls = Probe.Calls; var beforeClears = Probe.Clears;
        action(); int count = Probe.Count;
        Check(count > 0 && Probe.Live == 0);
        Check(Probe.Calls - beforeCalls == (native ? 1 : 0));
        Check(Probe.Clears - beforeClears == (native ? 1 : 0));
        for (int target = 1; target <= count; ++target)
        {
            int calls = Probe.Calls, clears = Probe.Clears;
            Probe.Count = 0; Probe.Target = target;
            bool failed = false;
            try { action(); }
            catch (OutOfMemoryException) { failed = true; }
            finally { Probe.Target = 0; }
            Check(failed && Probe.Count == target && Probe.Live == 0);
            Check(Probe.Calls - calls <= (native ? 1 : 0));
            Check(Probe.Clears - clears == Probe.Calls - calls);
            Recover(); ++checkpoints;
        }
    }
    static void Partial<T>(Action action) where T : Exception
    {
        var calls = Probe.Calls; var clears = Probe.Clears;
        bool failed = false;
        try { action(); }
        catch (T error) { Check(error.GetType() == typeof(T)); failed = true; }
        Check(failed && Probe.Live == 0 && Probe.Calls == calls && Probe.Clears == clears);
        ++partialInputChecks; Recover();
    }
    static void Run(string[] args)
    {
        Check(args.Length == 2 && (args[0] == "host" || args[0] == "native"));
        native = args[0] == "native";
        indices = JsonSerializer.Deserialize<Dictionary<string, int>>(args[1])!;
        var packet = Parcel(); var huge = BigInteger.One << 5120;
        var strings = new[] { new[] { "\ufeff🌱\0", "last" }, Array.Empty<string>() };
        var bytes = new[] { new[] { new byte[] { 0, 255 }, Array.Empty<byte>() } };
        var naturals = new[] { new[] { huge, BigInteger.Zero, BigInteger.One }, Array.Empty<BigInteger>() };
        object deep = 42u;
        for (int level = 0; level < 24; ++level) { var outer = Array.CreateInstance(deep.GetType(), 1); outer.SetValue(deep, 0); deep = outer; }
        if (native)
        {
            Faults(() => Api.RecordShuffle(packet));
            Faults(() => Api.RecordDuplicate(packet));
            Faults(() => Api.ArrayReverseString(strings));
            Faults(() => Api.ArrayReverseBytes(bytes));
            Faults(() => Api.ArrayReverseNat(naturals));
            Faults(() => Api.ArrayReverseInt(new[] { new[] { -huge, huge } }));
            Faults(() => Invoke(typeof(Api).GetMethod(nameof(Api.Deep))!, deep));
        }
        else
        {
            Faults(() => Roundtrip("packet", packet));
            Faults(() => Roundtrip("record_reverse", new[] { Value(), Value() }));
            Faults(() => Roundtrip("array_reverse_string", strings));
            Faults(() => Roundtrip("array_reverse_bytes", bytes));
            Faults(() => Roundtrip("array_reverse_nat", naturals));
            Faults(() => Roundtrip("array_reverse_int", new[] { new[] { -huge, huge } }));
            Faults(() => Roundtrip("deep", deep));
        }
        for (int repeat = 0; repeat < 16; ++repeat)
        {
            var invalidText = new[] { new[] { "allocated", null! } };
            var invalidRow = new uint[][] { new uint[] { 1, 2 }, null! };
            var invalidNat = new[] { new[] { huge, -BigInteger.One } };
            var invalidRecord = Parcel() with { Pair = new Pair(1, "\ud800") };
            Partial<ArgumentNullException>(() => { if (native) Api.ArrayReverseString(invalidText); else Roundtrip("array_reverse_string", invalidText); });
            Partial<ArgumentNullException>(() => { if (native) Api.ArrayReverseUint32(invalidRow); else Roundtrip("array_reverse_uint32", invalidRow); });
            Partial<ArgumentOutOfRangeException>(() => { if (native) Api.ArrayReverseNat(invalidNat); else Roundtrip("array_reverse_nat", invalidNat); });
            Partial<EncoderFallbackException>(() => { if (native) Api.RecordShuffle(invalidRecord); else Roundtrip("packet", invalidRecord); });
        }
        Check(Probe.Live == 0);
        if (!native) Check(Probe.Calls == 0 && Probe.Clears == 0);
        Console.WriteLine(JsonSerializer.Serialize(new { mode = args[0], checkpoints, partialInputChecks, nativeExecuted = native, liveAllocations = Probe.Live }));
    }
    static int Main(string[] args)
    {
        try { Run(args); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
