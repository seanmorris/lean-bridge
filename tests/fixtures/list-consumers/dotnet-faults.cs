// Isolated instrumentation of the compiler-produced C# projection.
using System;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Runtime.InteropServices;
using LeanBridge.Lists;
using Probe = LeanBridge.Lists.Interop.ListProbe;
using Choice = LeanBridge.Lists.Option<LeanBridge.Lists.Result<(System.Numerics.BigInteger, LeanBridge.Lists.Unit), string>>;
using Nested = LeanBridge.Lists.Option<LeanBridge.Lists.Result<LeanBridge.Lists.Unit[], string>[]>;
using SwapInput = LeanBridge.Lists.Result<(System.Numerics.BigInteger[], uint[]), string[]>;

static class Program
{
    static void Check(bool value) { if (!value) throw new Exception("List cleanup/layout check failed"); }
    static int Faults(Action action)
    {
        Probe.Target = 0; Probe.Count = 0; action(); int count = Probe.Count; Check(count > 0);
        for (int target = 1; target <= count; ++target)
        {
            int calls = Probe.Calls, clears = Probe.Clears;
            Probe.Target = target; Probe.Count = 0;
            bool failed = false;
            try { action(); }
            catch (OutOfMemoryException) { failed = true; }
            catch (TargetInvocationException error) when (error.InnerException is OutOfMemoryException) { failed = true; }
            finally { Probe.Target = 0; }
            Check(failed); Check(Probe.Live == 0);
            Check(Probe.Calls - calls <= 1); Check(Probe.Clears - clears == Probe.Calls - calls);
            Check(Api.ReverseUint32(new uint[] { 1, 2, 3 }).SequenceEqual(new uint[] { 3, 2, 1 }));
        }
        return count;
    }
    static object Convert(MethodInfo method, object value) => method.Invoke(null, new[] { value })!;
    static void Set(object value, string field, object fieldValue) => value.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(value, fieldValue);
    static void Reject(MethodInfo method, object value, Type expected)
    {
        try { Convert(method, value); throw new Exception("invalid native List accepted"); }
        catch (TargetInvocationException error) when (error.InnerException?.GetType() == expected) { }
    }
    static int Layouts(int listIndex, int nestedIndex)
    {
        var runtime = typeof(Api).Assembly.GetType("LeanBridge.Lists.Interop.Runtime")!;
        var list = runtime.GetMethod("From" + listIndex, BindingFlags.Static | BindingFlags.NonPublic)!;
        var nested = runtime.GetMethod("From" + nestedIndex, BindingFlags.Static | BindingFlags.NonPublic)!;
        int checks = 0;
        foreach (var method in new[] { list, nested })
        {
            object value = Activator.CreateInstance(method.GetParameters()[0].ParameterType)!;
            Set(value, "Length", (nuint)1);
            Reject(method, value, typeof(InvalidOperationException)); ++checks;
            Set(value, "Data", (nint)1);
            Reject(method, value, typeof(InvalidOperationException)); ++checks;
            Set(value, "Length", nuint.MaxValue);
            Reject(method, value, typeof(ArgumentException)); ++checks;
            Set(value, "Length", (nuint)0);
            Check(((Array)Convert(method, value)).Length == 0); ++checks;
        }
        object child = Activator.CreateInstance(list.GetParameters()[0].ParameterType)!;
        Set(child, "Length", (nuint)1);
        nint memory = Marshal.AllocHGlobal(Marshal.SizeOf(child));
        try {
            Marshal.StructureToPtr(child, memory, false);
            object value = Activator.CreateInstance(nested.GetParameters()[0].ParameterType)!;
            Set(value, "Data", memory); Set(value, "Length", (nuint)1);
            Reject(nested, value, typeof(InvalidOperationException)); ++checks;
        } finally { Marshal.FreeHGlobal(memory); }
        return checks;
    }
    static void Main(string[] args)
    {
        var huge = BigInteger.One << 4096;
        var packet = new Packet(new[] { new uint[] { 1, 2, 3 }, Array.Empty<uint>(), new uint[] { 4 } },
            new[] { Choice.Some(Result<(BigInteger, Unit), string>.Ok((huge, default))), Choice.Some(Result<(BigInteger, Unit), string>.Err("bad\0λ")), Choice.None },
            new[] { new byte[] { 0, 255 }, Array.Empty<byte>(), new byte[] { 1 } },
            new[] { new[] { (true, new System.Text.Rune(0x1f33f)), (false, new System.Text.Rune(0)) }, Array.Empty<(bool, System.Text.Rune)>() });
        object deep = 42u;
        for (int level = 0; level < 24; ++level) {
            var outer = Array.CreateInstance(deep.GetType(), 1); outer.SetValue(deep, 0); deep = outer;
        }
        var deepMethod = typeof(Api).GetMethod(nameof(Api.Deep))!;
        int faults = Faults(() => Api.Transform(packet))
            + Faults(() => Api.Duplicate(new byte[] { 0, 255 }))
            + Faults(() => Api.ReverseNat(new BigInteger[] { huge, 42 }))
            + Faults(() => Api.Nest(Nested.Some(new[] { Result<Unit[], string>.Ok(new Unit[2]), Result<Unit[], string>.Err("bad"), Result<Unit[], string>.Ok(Array.Empty<Unit>()) })))
            + Faults(() => Api.Swap(SwapInput.Ok((new[] { huge }, new uint[] { 1, 2 }))))
            + Faults(() => Api.Swap(SwapInput.Err(new[] { "first", "last" })))
            + Faults(() => deepMethod.Invoke(null, new[] { deep }));
        for (int i = 0; i < 16; ++i)
        {
            var calls = Probe.Calls;
            try { Api.ReverseString(new[] { "allocated", null! }); throw new Exception("null accepted"); }
            catch (ArgumentNullException) { Check(Probe.Live == 0); Check(Probe.Calls == calls); }
        }
        Console.WriteLine($"list-dotnet-faults:{faults}:{Layouts(int.Parse(args[0]), int.Parse(args[1]))}");
    }
}
