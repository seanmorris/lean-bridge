// Isolated, instrumented managed sources; original installed native libraries.
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using LeanBridge.Structured;
using Probe = LeanBridge.Structured.Interop.StructuredProbe;

namespace LeanBridge.Structured.Interop
{
    internal static unsafe class StructuredProbe
    {
        internal static int Count, Target, Scopes, Frames, Roots, Checks, Clears;
        internal static bool Active;
        internal static Exception Failure = new OutOfMemoryException();
        internal static Action? During;
        internal static readonly HashSet<nint> Allocations = new();
        internal static void Check(bool value)
        {
            ++Checks;
            if (!value) throw new Exception("structured C# probe check " + Checks);
        }
        internal static void Tick()
        {
            var action = During; During = null; action?.Invoke();
            if (Active && ++Count == Target) throw Failure;
        }
        internal static void* Allocate(nuint size)
        {
            Tick();
            var result = NativeMemory.AllocZeroed(size);
            if (result != null) Check(Allocations.Add((nint)result));
            return result;
        }
        internal static void Free(void* value)
        {
            Check(Allocations.Remove((nint)value)); NativeMemory.Free(value);
        }
        internal static void Zero<T>(T value) where T : unmanaged
        {
            foreach (var item in new ReadOnlySpan<byte>(&value, sizeof(T))) Check(item == 0);
            ++Clears;
        }
    }
}

internal static unsafe class Program
{
    private static int faults, deferred;
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void Snapshot(nint memory);
    private static Snapshot snapshot = null!;
    private sealed class Marker : Exception { }
    private static uint Live()
    {
        byte* memory = stackalloc byte[40]; snapshot((nint)memory);
        return *(uint*)(memory + 20);
    }
    private static int Exercise(Action action, int target = 0, bool marker = false)
    {
        var baseline = Live(); var failure = marker ? (Exception)new Marker() : new OutOfMemoryException("checkpoint");
        Probe.Check(Probe.Allocations.Count == 0 && Probe.Scopes == 0 && Probe.Frames == 0 && Probe.Roots == 0);
        Probe.Count = 0; Probe.Target = target; Probe.Failure = failure; Probe.Active = true;
        var failed = false;
        try { action(); }
        catch (Exception error) when (ReferenceEquals(error, failure)) { failed = true; ++faults; }
        finally { Probe.Active = false; }
        Probe.Check(failed == (target != 0));
        Probe.Check(Probe.Allocations.Count == 0 && Probe.Scopes == 0 && Probe.Frames == 0 && Probe.Roots == 0);
        GC.Collect(); GC.WaitForPendingFinalizers();
        Probe.Check(Live() == baseline);
        return Probe.Count;
    }
    private static object Cases<T>(string shape, Func<int, T> value,
        Func<T, Func<T, T>, T> call, Func<T, Func<T, T>, T> twice,
        Func<T, LeanClosure<Func<bool, T, T>>> make)
    {
        var input = value(shape == "option" ? 2 : 1);
        var other = value(shape == "variant" ? 6 : 2);
        var paths = new Dictionary<string, int>(); var before = faults; var baseline = Live();
        using (var held = make(other))
        {
            var actions = new Dictionary<string, Action>
            {
                ["callback"] = () => call(input, _ => other),
                ["repeated"] = () => twice(input, _ => other),
                ["create"] = () => { using var owned = make(other); },
                ["create-call"] = () => { using var owned = make(other); owned.Invoke(true, input); },
                ["held-call"] = () => held.Invoke(true, input)
            };
            foreach (var (name, action) in actions)
            {
                var count = Exercise(action); Probe.Check(count > 0); paths[name] = count;
                foreach (var marker in new[] { false, true })
                    for (var target = 1; target <= count; ++target)
                    {
                        Exercise(action, target, marker);
                        Exercise(() => call(input, _ => other));
                    }
                Probe.Check(Exercise(action) == count);
            }
        }
        Probe.Check(Live() == baseline);
        using (var owned = make(input))
        {
            Probe.During = () => { owned.Dispose(); Probe.Check(owned.IsClosed && Live() == baseline + 1); };
            owned.Invoke(true, other);
            Probe.Check(owned.IsClosed && Probe.During is null && Live() == baseline); ++deferred;
        }
        return new { shape, paths, faults = faults - before };
    }
    private static int Malformed(string json)
    {
        var count = 0; var runtime = typeof(Api).Assembly.GetType("LeanBridge.Structured.Interop.Runtime")!;
        using var document = JsonDocument.Parse(json);
        foreach (var layout in document.RootElement.EnumerateArray())
        {
            var method = runtime.GetMethod("From" + layout.GetProperty("index").GetInt32(), BindingFlags.NonPublic | BindingFlags.Static)!;
            var type = method.GetParameters()[0].ParameterType;
            var kind = layout.GetProperty("kind").GetString();
            for (var pattern = 0; pattern < (kind == "sequence" ? 2 : 1); ++pattern)
            {
                var value = Activator.CreateInstance(type)!;
                void Set(string name, object item) => type.GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(value, item);
                if (kind == "variant") Set("Kind", uint.MaxValue);
                else if (kind == "sequence")
                {
                    Set("Data", pattern == 0 ? (nint)0 : (nint)1);
                    Set("Length", pattern == 0 ? (nuint)1 : nuint.MaxValue);
                }
                else Set("Flag", (byte)2);
                var failed = false;
                try { method.Invoke(null, new[] { value }); }
                catch (TargetInvocationException error) when (error.InnerException is ArgumentException or InvalidOperationException) { failed = true; }
                Probe.Check(failed); ++count;
            }
        }
        return count;
    }
    private static void Main(string[] args)
    {
        Api.CallOption(Option<Option<Unit>>.None, value => value);
        var library = NativeLibrary.Load(Path.Combine(AppContext.BaseDirectory, "runtimes/linux-x64/native/liblean_bridge_native.so"));
        snapshot = Marshal.GetDelegateForFunctionPointer<Snapshot>(NativeLibrary.GetExport(library, "lean_bridge_native_snapshot_read"));
        Probe.Check(Live() == 0);
        var shapes = new[]
        {
            Cases("array", StructuredValues.Array, Api.CallArray, Api.TwiceArray, Api.MakeArray),
            Cases("list", StructuredValues.List, Api.CallList, Api.TwiceList, Api.MakeList),
            Cases("option", StructuredValues.Option, Api.CallOption, Api.TwiceOption, Api.MakeOption),
            Cases("result", StructuredValues.Result, Api.CallResult, Api.TwiceResult, Api.MakeResult),
            Cases("tuple", StructuredValues.Tuple, Api.CallTuple, Api.TwiceTuple, Api.MakeTuple),
            Cases("record", StructuredValues.Record, Api.CallRecord, Api.TwiceRecord, Api.MakeRecord),
            Cases("variant", StructuredValues.Variant, Api.CallVariant, Api.TwiceVariant, Api.MakeVariant),
            Cases("alias", StructuredValues.Record, Api.CallAlias, Api.TwiceAlias, Api.MakeAlias)
        };
        var malformed = Malformed(args[0]);
        Probe.Check(Live() == 0 && Probe.Allocations.Count == 0);
        Console.WriteLine(JsonSerializer.Serialize(new { checks = Probe.Checks, faults, clears = Probe.Clears,
            malformed, liveAllocations = Probe.Allocations.Count, liveIdentities = Live(), deferredCloseChecks = deferred, shapes }));
    }
}
