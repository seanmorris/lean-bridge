// Runs against an instrumented copy of the compiler-produced C# projection.
using System;
using System.Numerics;
using System.Reflection;
using LeanBridge.Compounds;
using Probe = LeanBridge.Compounds.Interop.CompoundProbe;

static class Program
{
    static void Check(bool value) { if (!value) throw new Exception("compound cleanup/flag check failed"); }
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
            Check(Api.Classify(Option<Option<Unit>>.Some(Option<Unit>.Some(default))) == 2);
        }
        return count;
    }
    static object Convert(MethodInfo method, object value) => method.Invoke(null, new[] { value })!;
    static void Set(object value, string field, object fieldValue) => value.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(value, fieldValue);
    static void Poison(object value, string field)
    {
        var child = value.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic)!;
        object payload = Activator.CreateInstance(child.FieldType)!;
        Set(payload, "Data", (nint)1); Set(payload, "Length", nuint.MaxValue); child.SetValue(value, payload);
    }
    static int Flags(int optionIndex, int resultIndex)
    {
        var runtime = typeof(Api).Assembly.GetType("LeanBridge.Compounds.Interop.Runtime")!;
        var option = runtime.GetMethod("From" + optionIndex, BindingFlags.Static | BindingFlags.NonPublic)!;
        var result = runtime.GetMethod("From" + resultIndex, BindingFlags.Static | BindingFlags.NonPublic)!;
        int checks = 0;
        foreach (var method in new[] { option, result }) foreach (byte flag in new byte[] { 2, 127, 255 })
        {
            object value = Activator.CreateInstance(method.GetParameters()[0].ParameterType)!; Set(value, "Flag", flag);
            try { Convert(method, value); throw new Exception("invalid native flag accepted"); }
            catch (TargetInvocationException error) when (error.InnerException is InvalidOperationException) { ++checks; }
        }
        object none = Activator.CreateInstance(option.GetParameters()[0].ParameterType)!; Poison(none, "F0");
        Check(((Option<string>)Convert(option, none)).IsNone); ++checks;
        object ok = Activator.CreateInstance(result.GetParameters()[0].ParameterType)!; Set(ok, "Flag", (byte)1); Poison(ok, "F1");
        Check(((Result<string, string>)Convert(result, ok)).Value == ""); ++checks;
        object errorValue = Activator.CreateInstance(result.GetParameters()[0].ParameterType)!; Poison(errorValue, "F0");
        Check(((Result<string, string>)Convert(result, errorValue)).Error == ""); ++checks;
        return checks;
    }
    static void Main(string[] args)
    {
        var huge = BigInteger.One << 4096;
        var packet = new Packet(Option<Result<(BigInteger, Unit), string>>.Some(Result<(BigInteger, Unit), string>.Ok((huge, default))),
            ((42, "copied\0λ"), (true, new System.Text.Rune(0x1f331))),
            new[] { Option<Result<(string, ulong), (byte[], BigInteger)>>.Some(Result<(string, ulong), (byte[], BigInteger)>.Err((new byte[] { 0, 255 }, -huge))),
                    Option<Result<(string, ulong), (byte[], BigInteger)>>.Some(Result<(string, ulong), (byte[], BigInteger)>.Ok(("row", ulong.MaxValue))) },
            Result<Option<Result<(uint, Unit), string>>, Option<BigInteger>>.Ok(Option<Result<(uint, Unit), string>>.Some(Result<(uint, Unit), string>.Err("nested"))));
        int faults = Faults(() => Api.Transform(packet))
            + Faults(() => Api.Duplicate(Option<byte[]>.Some(new byte[] { 0, 255 })))
            + Faults(() => Api.OptionNat(Option<BigInteger>.Some(huge)))
            + Faults(() => Api.ResultString(Result<string, string>.Ok("success")))
            + Faults(() => Api.ResultString(Result<string, string>.Err("error")))
            + Faults(() => Api.TupleString(("left", "right")));
        for (int i = 0; i < 16; ++i)
        {
            try { Api.TupleString(("allocated", null!)); throw new Exception("null accepted"); }
            catch (ArgumentNullException) { Check(Probe.Live == 0); }
        }
        Console.WriteLine($"compound-dotnet-faults:{faults}:{Flags(int.Parse(args[0]), int.Parse(args[1]))}");
    }
}
