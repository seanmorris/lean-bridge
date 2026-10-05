using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using LeanBridge.Structured;

internal static unsafe class FaultProbe
{
    internal static int Points, Target, Mode, Attempts, Scopes, Frames, Roots, Clears, Checks, Failures;
    internal static bool Active;
    internal static Exception Error = new OutOfMemoryException("injected");
    internal static Action? During;
    internal static readonly HashSet<nint> Allocations = new();
    internal static void Check(bool condition, string detail = "fault probe assertion")
    { ++Checks; if (!condition) throw new Exception(detail + " " + Checks); }
    internal static void Tick()
    {
        var action = During; During = null; action?.Invoke();
        if (Active && ++Points == Target && Mode == 1) throw Error;
    }
    internal static void* Allocate(nuint count, nuint size)
    {
        if (Active && ++Attempts == Target && Mode == 2) return null;
        var value = NativeMemory.AllocZeroed(count, size);
        if (value != null) Check(Allocations.Add((nint)value));
        return value;
    }
    internal static void Free(void* value)
    { Check(Allocations.Remove((nint)value)); NativeMemory.Free(value); }
    internal static void Clean()
    { Check(Allocations.Count == 0 && Scopes == 0 && Frames == 0 && Roots == 0); Check(FaultNative.Live() == 0); }
}

internal static class FaultCases
{
    private sealed class Marker : Exception { }
    private static int deferred;
    private static (int points, int host, int native) Exercise(Action action, int mode = 0, int target = 0, bool marker = false)
    {
        FaultProbe.Clean(); var baseline = NativeProbe.Live();
        FaultProbe.Mode = mode; FaultProbe.Target = target; FaultProbe.Points = FaultProbe.Attempts = 0;
        FaultProbe.Error = marker ? new Marker() : new OutOfMemoryException("checkpoint");
        FaultNative.Reset(mode == 3 ? (ulong)target : 0); FaultProbe.Active = true;
        var failed = false;
        try { action(); }
        catch (Exception error) when (mode == 1 ? ReferenceEquals(error, FaultProbe.Error) : error is OutOfMemoryException)
        { failed = true; ++FaultProbe.Failures; }
        finally { FaultProbe.Active = false; }
        FaultProbe.Check(failed == (target != 0)); FaultProbe.Clean();
        FaultProbe.Check(NativeProbe.Live() == baseline);
        return (FaultProbe.Points, FaultProbe.Attempts, checked((int)FaultNative.Attempts()));
    }
    private static object Cases<T>(string shape, int seed, Func<int, T> value,
        Func<T, Func<T, T>, T> call, Func<T, Func<T, T>, T> twice,
        Func<T, LeanClosure<Func<bool, T, T>>> make)
    {
        var input = value(seed); var other = value(seed + 1);
        var paths = new Dictionary<string, object>(); var before = FaultProbe.Failures;
        using (var held = make(input))
        {
            var actions = new Dictionary<string, Action> {
                ["callback"] = () => call(input, _ => other),
                ["repeated"] = () => twice(input, _ => other),
                ["create"] = () => { using var owned = make(input); },
                ["create-call"] = () => { using var owned = make(input); owned.Invoke(false, other); },
                ["held-call"] = () => held.Invoke(true, other)
            };
            foreach (var (name, action) in actions)
            {
                var count = Exercise(action); FaultProbe.Check(count.points > 0, "missing checkpoints: " + shape + "/" + name);
                paths[name] = new { checkpoints = count.points, hostAllocations = count.host, nativeAllocations = count.native };
                for (var mode = 1; mode <= 3; ++mode)
                    foreach (var marker in mode == 1 ? new[] { false, true } : new[] { false })
                        for (var target = 1; target <= (mode == 1 ? count.points : mode == 2 ? count.host : count.native); ++target)
                        {
                            Exercise(action, mode, target, marker);
                            Exercise(() => call(input, value => value));
                        }
                FaultProbe.Check(Exercise(action) == count);
            }
        }
        var baseline = NativeProbe.Live();
        using (var owned = make(input))
        {
            FaultProbe.During = () => { owned.Dispose(); FaultProbe.Check(owned.IsClosed && NativeProbe.Live() == baseline + 1); };
            owned.Invoke(false, other);
            FaultProbe.Check(FaultProbe.During is null && owned.IsClosed && NativeProbe.Live() == baseline); ++deferred;
        }
        return new { shape, seed, paths, faults = FaultProbe.Failures - before };
    }
    internal static void Run()
    {
        var shapes = new List<object>();
        for (var seed = 0; seed < 4; ++seed) shapes.AddRange(new[] {
            Cases("array", seed, StructuredValues.Array, Api.CallArray, Api.TwiceArray, Api.MakeArray),
            Cases("list", seed, StructuredValues.List, Api.CallList, Api.TwiceList, Api.MakeList),
            Cases("option", seed, StructuredValues.Option, Api.CallOption, Api.TwiceOption, Api.MakeOption),
            Cases("result", seed, StructuredValues.Result, Api.CallResult, Api.TwiceResult, Api.MakeResult),
            Cases("tuple", seed, StructuredValues.Tuple, Api.CallTuple, Api.TwiceTuple, Api.MakeTuple),
            Cases("record", seed, StructuredValues.Record, Api.CallRecord, Api.TwiceRecord, Api.MakeRecord),
            Cases("variant", seed, StructuredValues.Variant, Api.CallVariant, Api.TwiceVariant, Api.MakeVariant),
            Cases("alias", seed, StructuredValues.Record, Api.CallAlias, Api.TwiceAlias, Api.MakeAlias),
            Cases("recursive", seed, RecursiveCases.Value, Api.CallRecursive, Api.TwiceRecursive, Api.MakeRecursive)
        });
        FaultProbe.Clean(); FaultProbe.Check(NativeProbe.Live() == 0);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks = FaultProbe.Checks,
            faults = FaultProbe.Failures, clears = FaultProbe.Clears, deferred, identities = NativeProbe.Live(), shapes }));
    }
    internal static void Poison()
    {
        var tree = RecursiveCases.Value(1);
        Api.CallRecursive(tree, value => value);
        var clears = FaultProbe.Clears;
        FaultNative.Poison(); var failed = false;
        try { Api.CallRecursive(tree, value => value); }
        catch (LeanBridgeException error) when (error.Status == 4) { failed = true; }
        FaultProbe.Check(failed); FaultProbe.Check(FaultProbe.Clears == clears + 1);
        FaultProbe.Check(FaultNative.Retired() == 1, "retirement missing after malformed output"); FaultProbe.Check(FaultNative.Poisoned() == 1); FaultProbe.Clean();
        failed = false; var callbacks = 0;
        try { Api.CallRecursive(tree, value => { ++callbacks; return value; }); }
        catch (LeanBridgeException error) when (error.Status == 5) { failed = true; }
        FaultProbe.Check(failed && callbacks == 0 && FaultProbe.Clears == clears + 1); FaultProbe.Clean();
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks = FaultProbe.Checks, retired = FaultNative.Retired(), malformed = FaultNative.Poisoned(), clears = FaultProbe.Clears - clears }));
    }
}

internal static class FaultProgram
{
    private static int Main(string[] args)
    {
        try { if (args.Length != 0 && args[0] == "poison") FaultCases.Poison(); else FaultCases.Run(); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 32; }
    }
}
