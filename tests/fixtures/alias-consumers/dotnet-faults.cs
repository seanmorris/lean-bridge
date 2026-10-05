// Isolated instrumentation of the compiler-produced C# projection.
using System;
using System.Numerics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using LeanBridge.Aliases;
using Probe = LeanBridge.Aliases.Interop.AliasProbe;

static class Program
{
    static void Check(bool value) { if (!value) throw new Exception("alias cleanup/layout check failed"); }
    static int Faults(Action action)
    {
        Probe.Target = 0; Probe.Count = 0; action(); int count = Probe.Count; Check(count > 0);
        for (int target = 1; target <= count; ++target)
        {
            int calls = Probe.Calls, clears = Probe.Clears;
            Probe.Target = target; Probe.Count = 0;
            bool failed = false;
            try { action(); } catch (OutOfMemoryException) { failed = true; }
            finally { Probe.Target = 0; }
            Check(failed); Check(Probe.Live == 0);
            Check(Probe.Calls - calls <= 1); Check(Probe.Clears - clears == Probe.Calls - calls);
            Check(Api.Make() == 41); Check(Api.EchoNat(BigInteger.One << 256) == BigInteger.One << 256);
        }
        return count;
    }
    static void Reject<T>(Action action) where T : Exception
    {
        int calls = Probe.Calls;
        try { action(); } catch (T) { Check(Probe.Live == 0); Check(calls == Probe.Calls); return; }
        throw new Exception("invalid alias input accepted");
    }
    static object Convert(MethodInfo method, object value) => method.Invoke(null, new[] { value })!;
    static FieldInfo Field(object value, string name) => value.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!;
    static void Set(object value, string name, object fieldValue) => Field(value, name).SetValue(value, fieldValue);
    static object Blank(MethodInfo method) => Activator.CreateInstance(method.GetParameters()[0].ParameterType)!;
    static void Poison(object value, string name)
    {
        var field = Field(value, name); object child = Activator.CreateInstance(field.FieldType)!;
        Set(child, "Data", (nint)1); Set(child, "Length", nuint.MaxValue); field.SetValue(value, child);
    }
    static int Invalid(MethodInfo method, object value, Type expected)
    {
        try { Convert(method, value); throw new Exception("invalid alias native value accepted"); }
        catch (TargetInvocationException error) when (error.InnerException?.GetType() == expected) { return 1; }
    }
    static int Malformed(string[] args)
    {
        var runtime = typeof(Api).Assembly.GetType("LeanBridge.Aliases.Interop.Runtime")!;
        MethodInfo From(int i) => runtime.GetMethod("From" + args[i], BindingFlags.Static | BindingFlags.NonPublic)!;
        var maybe = From(0); var outcome = From(1); var rows = From(2); var text = From(3); var character = From(4);
        int checks = 0;
        foreach (var method in new[] { maybe, outcome }) foreach (byte flag in new byte[] { 2, 127, 255 })
        {
            object value = Blank(method); Set(value, "Flag", flag);
            checks += Invalid(method, value, typeof(InvalidOperationException));
        }
        object none = Blank(maybe), inner = Activator.CreateInstance(Field(none, "F0").FieldType)!;
        Set(inner, "Flag", (byte)255); Set(none, "F0", inner);
        Check(((Option<Option<Unit>>)Convert(maybe, none)).IsNone); ++checks;
        Set(none, "Flag", (byte)1); checks += Invalid(maybe, none, typeof(InvalidOperationException));
        object ok = Blank(outcome); Set(ok, "Flag", (byte)1); Poison(ok, "F1");
        Check(((Result<(uint, byte[]), string>)Convert(outcome, ok)).Value.Item2.Length == 0); ++checks;
        object error = Blank(outcome), tuple = Activator.CreateInstance(Field(error, "F0").FieldType)!;
        Poison(tuple, "F1"); Set(error, "F0", tuple);
        Check(((Result<(uint, byte[]), string>)Convert(outcome, error)).Error == ""); ++checks;
        object sequence = Blank(rows); Set(sequence, "Length", (nuint)1);
        checks += Invalid(rows, sequence, typeof(InvalidOperationException));
        Set(sequence, "Data", (nint)1); checks += Invalid(rows, sequence, typeof(InvalidOperationException));
        Set(sequence, "Length", nuint.MaxValue); checks += Invalid(rows, sequence, typeof(ArgumentException));
        Set(sequence, "Length", (nuint)0); Check(((uint[][])Convert(rows, sequence)).Length == 0); ++checks;
        foreach (uint value in new uint[] { 0xd800, 0x110000 }) checks += Invalid(character, value, typeof(ArgumentOutOfRangeException));
        nint memory = Marshal.AllocHGlobal(1);
        try {
            Marshal.WriteByte(memory, 0xff); object value = Blank(text); Set(value, "Data", memory); Set(value, "Length", (nuint)1);
            checks += Invalid(text, value, typeof(DecoderFallbackException));
        } finally { Marshal.FreeHGlobal(memory); }
        return checks;
    }
    static void Main(string[] args)
    {
        var huge = BigInteger.One << 4096;
        var fields = new Scalars(default, true, 255, 65535, uint.MaxValue, ulong.MaxValue,
            sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue, huge, -huge, 1.5f, -2.25,
            "text\0🌱", new byte[] { 0, 255 }, new Rune(0x1f331), ulong.MaxValue, long.MinValue);
        var packet = new Packet(41, "allocated\0🌱", new[] { new uint[] { 1, 2, 3 }, Array.Empty<uint>(), new uint[] { 4 } },
            Option<Option<Unit>>.Some(Option<Unit>.Some(default)), Result<(uint, byte[]), string>.Ok((7, new byte[] { 0, 255 })));
        int faults = Faults(() => Api.EchoScalars(fields))
            + Faults(() => Api.ChangePacket(packet))
            + Faults(() => Api.ReversePackets(new[] { packet, packet with { Outcome = Result<(uint, byte[]), string>.Err("error\0🌱") } }))
            + Faults(() => Api.Duplicate(new byte[] { 0, 255 }))
            + Faults(() => Api.EchoNat(huge))
            + Faults(() => Api.EchoOutcome(Result<(uint, byte[]), string>.Err("allocated")));
        for (int i = 0; i < 16; ++i)
        {
            Reject<ArgumentOutOfRangeException>(() => Api.EchoScalars(fields with { VNat = -1 }));
            Reject<ArgumentNullException>(() => Api.ChangePacket(packet with { Rows = new[] { new uint[] { 1 }, null! } }));
            Reject<ArgumentNullException>(() => Api.ChangePacket(packet with { Outcome = Result<(uint, byte[]), string>.Ok((1, null!)) }));
            Reject<EncoderFallbackException>(() => Api.ChangePacket(packet with { Outcome = Result<(uint, byte[]), string>.Err("\ud800") }));
        }
        Console.WriteLine($"alias-dotnet-faults:{faults}:{Malformed(args)}");
    }
}
