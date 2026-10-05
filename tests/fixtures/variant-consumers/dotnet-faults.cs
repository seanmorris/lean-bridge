// Separate instrumentation of verified C# sources; the release assembly is untouched.
using System;
using System.Numerics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using LeanBridge.Variants;
using Probe = LeanBridge.Variants.Interop.VariantProbe;

static class Program
{
    static void Check(bool value) { if (!value) throw new Exception("variant cleanup/layout check failed"); }
    static int Faults(Action action)
    {
        Probe.Target = 0; Probe.Count = 0; action(); int count = Probe.Count; Check(count > 0);
        for (int target = 1; target <= count; ++target)
        {
            int calls = Probe.Calls, clears = Probe.Clears;
            Probe.Target = target; Probe.Count = 0; bool failed = false;
            try { action(); } catch (OutOfMemoryException) { failed = true; }
            finally { Probe.Target = 0; }
            Check(failed); Check(Probe.Live == 0);
            Check(Probe.Calls - calls <= 1); Check(Probe.Clears - clears == Probe.Calls - calls);
            Check(Api.Make(0) is SignalIdle); Check(Api.Next(new SignalData(3, "ok")) == new SignalData(4, "ok!"));
        }
        return count;
    }
    static void Reject<T>(Action action) where T : Exception
    {
        int calls = Probe.Calls;
        try { action(); } catch (T) { Check(Probe.Live == 0); Check(calls == Probe.Calls); return; }
        throw new Exception("invalid partial variant input accepted");
    }
    static object Convert(MethodInfo method, object value) => method.Invoke(null, new[] { value })!;
    static int Malformed(string[] args)
    {
        var runtime = typeof(Api).Assembly.GetType("LeanBridge.Variants.Interop.Runtime")!;
        int checks = 0;
        foreach (string index in args)
        {
            var method = runtime.GetMethod("From" + index, BindingFlags.Static | BindingFlags.NonPublic)!;
            Type native = method.GetParameters()[0].ParameterType;
            int size = Marshal.SizeOf(native), kind = (int)Marshal.OffsetOf(native, "Kind");
            nint memory = Marshal.AllocHGlobal(size);
            try {
                for (int i = 0; i < size; ++i) Marshal.WriteByte(memory, i, 0xff);
                Marshal.WriteInt32(memory, kind, -1);
                object invalid = Marshal.PtrToStructure(memory, native)!;
                try { Convert(method, invalid); throw new Exception("invalid native tag accepted"); }
                catch (TargetInvocationException error) when (error.InnerException is InvalidOperationException) { ++checks; }
                if (method.ReturnType == typeof(One)) continue;
                Type union = native.GetField("Cases", BindingFlags.Instance | BindingFlags.NonPublic)!.FieldType;
                Type first = union.GetField("Case0", BindingFlags.Instance | BindingFlags.NonPublic)!.FieldType;
                int offset = (int)Marshal.OffsetOf(native, "Cases");
                for (int i = 0; i < Marshal.SizeOf(first); ++i) Marshal.WriteByte(memory, offset + i, 0);
                Marshal.WriteInt32(memory, kind, 0);
                object result = Convert(method, Marshal.PtrToStructure(memory, native)!);
                Check(result is SignalIdle or ModeFirst or NestedEmpty or ScalarsAbsent or AnonymousNumber or BuffersEmpty);
                ++checks;
            } finally { Marshal.FreeHGlobal(memory); }
        }
        Check(Api.Make(0) is SignalIdle);
        return checks;
    }
    static void Main(string[] args)
    {
        var signal = new SignalData(42, "A\0🌱");
        var packet = new Packet(signal, new Signal[] { new SignalIdle(), signal }, Option<Signal>.Some(new SignalMarker(default)), new Mode[] { new ModeFirst(), new ModeThird() });
        var scalar = new ScalarsAll(default, true, 255, 65535, uint.MaxValue, ulong.MaxValue,
            sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
            BigInteger.One << 5120, -(BigInteger.One << 5120), 1.5f, -2.25,
            "A\0🌱", new byte[] { 0, 255, 1 }, new Rune(0x1f331), ulong.MaxValue, long.MinValue);
        int checks = Faults(() => Api.Echo(signal))
            + Faults(() => Api.EchoNested(new NestedPacket(packet)))
            + Faults(() => Api.EchoNested(new NestedOutcome(Result<(Signal, Mode), string>.Ok((signal, new ModeSecond())))))
            + Faults(() => Api.EchoNested(new NestedOutcome(Result<(Signal, Mode), string>.Err("A\0🌱"))))
            + Faults(() => Api.Signals(new[] { new Signal[] { new SignalIdle(), signal }, new Signal[] { signal } }))
            + Faults(() => Api.EchoScalars(scalar))
            + Faults(() => Api.EchoBuffers(new BuffersPair(new byte[] { 0, 255 }, new byte[] { 1 })))
            + Faults(() => Api.Duplicate(new byte[] { 0, 255 }))
            + Faults(() => Api.Produce(17));
        for (int i = 0; i < 16; ++i) {
            Reject<ArgumentOutOfRangeException>(() => Api.EchoScalars(scalar with { Natural = -1 }));
            Reject<ArgumentNullException>(() => Api.EchoNested(new NestedPacket(packet with { Events = new Signal[] { signal, null! } })));
            Reject<ArgumentNullException>(() => Api.EchoNested(new NestedPacket(packet with { Fallback = Option<Signal>.Some(null!) })));
            Reject<EncoderFallbackException>(() => Api.EchoNested(new NestedPacket(packet with { Fallback = Option<Signal>.Some(new SignalData(1, "\ud800")) })));
        }
        Console.WriteLine($"variant-dotnet-faults:{checks}:{Malformed(args)}");
    }
}
