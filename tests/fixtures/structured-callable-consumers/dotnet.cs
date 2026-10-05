// Typed calls against the original installed NuGet assembly, without private API access.
using System;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Threading;
using LeanBridge.Structured;

internal static class Program
{
    private static int checks, calls, rejected;
    private sealed class Marker : Exception { }
    private static void Check(bool condition, string detail = "structured C# check")
    {
        ++checks;
        if (!condition) throw new Exception(detail);
    }
    private static void Same(object? expected, object? actual, bool detached = false)
    {
        Check(expected is not null && actual is not null, "unexpected null");
        var type = expected!.GetType();
        Check(type == actual!.GetType(), "value or branch type changed");
        if (expected is Array array)
        {
            var result = (Array)actual;
            Check(array.Length == result.Length);
            if (detached && array.Length != 0) Check(!ReferenceEquals(array, result), "shared mutable array");
            for (var index = 0; index < array.Length; ++index) Same(array.GetValue(index), result.GetValue(index), detached);
        }
        else if (expected is Payload payload)
        {
            var result = (Payload)actual;
            if (detached) Check(!ReferenceEquals(payload, result));
            Same(payload.Text, result.Text); Same(payload.Rows, result.Rows, detached);
            Same(payload.Count, result.Count); Same(payload.Nested, result.Nested, detached);
        }
        else if (expected is PacketPayload packet)
        {
            var result = (PacketPayload)actual;
            if (detached) Check(!ReferenceEquals(packet, result));
            Same(packet.Label, result.Label); Same(packet.Rows, result.Rows, detached);
        }
        else if (expected is PacketCounts counts)
        {
            var result = (PacketCounts)actual;
            Same(counts.Positive, result.Positive); Same(counts.Negative, result.Negative);
        }
        else if (expected is ITuple tuple)
        {
            var result = (ITuple)actual;
            Check(tuple.Length == result.Length);
            for (var index = 0; index < tuple.Length; ++index) Same(tuple[index], result[index], detached);
        }
        else if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Option<>))
        {
            var some = (bool)type.GetProperty("IsSome")!.GetValue(expected)!;
            Check(some == (bool)type.GetProperty("IsSome")!.GetValue(actual)!);
            if (some) Same(type.GetProperty("Value")!.GetValue(expected), type.GetProperty("Value")!.GetValue(actual), detached);
        }
        else if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Result<,>))
        {
            Check((bool)type.GetProperty("IsInitialized")!.GetValue(actual)!);
            var ok = (bool)type.GetProperty("IsOk")!.GetValue(expected)!;
            Check(ok == (bool)type.GetProperty("IsOk")!.GetValue(actual)!);
            var field = type.GetProperty(ok ? "Value" : "Error")!;
            Same(field.GetValue(expected), field.GetValue(actual), detached);
        }
        else Check(expected.Equals(actual));
        if (expected is Payload or Packet || type.IsGenericType &&
            (type.GetGenericTypeDefinition() == typeof(Option<>) || type.GetGenericTypeDefinition() == typeof(Result<,>)))
        {
            Check(expected.Equals(actual), "public structural equality");
            Check(expected.GetHashCode() == actual.GetHashCode(), "equal values must hash equally");
        }
    }
    private static void Reject<TException>(Action action, string? message = null) where TException : Exception
    {
        ++rejected;
        try { action(); }
        catch (TException error) { ++checks; if (message is not null) Check(error.Message.Contains(message, StringComparison.Ordinal)); return; }
        throw new Exception("expected " + typeof(TException).Name);
    }
    private static void Cases<T>(string shape, Func<int, T> value,
        Func<T, Func<T, T>, T> call, Func<T, Func<T, T>, T> twice,
        Func<T, LeanClosure<Func<bool, T, T>>> make)
    {
        for (var seed = 0; seed < 24; ++seed)
        {
            var input = value(seed); var replacement = value(seed + 1);
            T retained = default!; var invoked = 0;
            var output = call(input, argument =>
            {
                ++invoked; Same(input, argument, true); retained = argument;
                GC.Collect(); GC.WaitForPendingFinalizers();
                return replacement;
            });
            ++calls; Check(invoked == 1, shape); Same(replacement, output, true);
            StructuredValues.Mutate(input); StructuredValues.Mutate(replacement);
            Same(value(seed), retained); Same(value(seed + 1), output);
            invoked = 0;
            output = twice(value(seed), argument =>
            {
                Same(value(seed + invoked), argument);
                ++invoked;
                return value(seed + invoked);
            });
            ++calls; Check(invoked == 2); Same(value(seed + 2), output);
            invoked = 0;
            input = value(seed);
            Same(value(seed + 1), call(input, argument =>
            {
                ++invoked; StructuredValues.Mutate(argument); return value(seed + 1);
            }));
            ++calls; Check(invoked == 1); Same(value(seed), input);
            using (var owned = make(input))
            {
                ++calls; Check(!owned.IsClosed); StructuredValues.Mutate(input);
                var alias = owned.Invoke;
                Same(value(seed), alias(true, value(seed + 1)));
                Same(value(seed + 1), alias(false, value(seed + 1)));
                var first = alias(true, value(seed + 1)); StructuredValues.Mutate(first);
                Same(value(seed), alias(true, value(seed + 2))); calls += 4;
                GC.Collect(); GC.WaitForPendingFinalizers();
                Same(value(seed), owned.Invoke(true, value(seed + 3))); ++calls;
                Exception? wrongThread = null;
                var thread = new Thread(() => { try { alias(true, value(seed)); } catch (Exception error) { wrongThread = error; } });
                thread.Start(); thread.Join(); Check(wrongThread is InvalidOperationException);
                owned.Dispose(); owned.Dispose(); Check(owned.IsClosed);
                Reject<ObjectDisposedException>(() => alias(false, value(seed)));
            }
            foreach (var failure in new Exception[] { new Marker(), new OutOfMemoryException("callback"), new OperationCanceledException("callback") })
            {
                invoked = 0;
                try { twice(value(seed), argument => { ++invoked; throw failure; }); Check(false); }
                catch (Exception caught)
                {
                    Check(ReferenceEquals(failure, caught), "exception identity");
                    Check(caught.StackTrace?.Contains(nameof(Cases), StringComparison.Ordinal) == true, "callback stack lost");
                }
                Check(invoked == 1); ++rejected;
                Same(value(seed), call(value(seed), argument => argument)); ++calls;
            }
            Same(value(seed), call(value(seed), outer => call(outer, inner => inner))); calls += 2;
            var innerFailure = new Marker();
            Same(value(seed), call(value(seed), outer =>
            {
                try { call(outer, _ => throw innerFailure); Check(false); }
                catch (Marker caught) { Check(ReferenceEquals(caught, innerFailure)); }
                return outer;
            })); calls += 2;
        }
        using (var otherThreadClose = make(value(1)))
        {
            var thread = new Thread(otherThreadClose.Dispose); thread.Start(); thread.Join();
            Check(otherThreadClose.IsClosed); Reject<ObjectDisposedException>(() => otherThreadClose.Invoke(true, value(1)));
        }
        Reject<ArgumentNullException>(() => call(value(1), null!));
    }
    private static void Invalid<T>(T value, T valid, Func<T, Func<T, T>, T> call,
        Func<T, Func<T, T>, T> twice, Func<T, LeanClosure<Func<bool, T, T>>> make)
    {
        var invoked = 0;
        Reject<ArgumentException>(() => call(value, argument => { ++invoked; return argument; }));
        Check(invoked == 0);
        Reject<ArgumentException>(() => make(value));
        Reject<ArgumentException>(() => call(valid, _ => value));
        Reject<ArgumentException>(() => twice(valid, _ => { ++invoked; return value; }));
        Check(invoked == 1, "second callback ran after invalid first result");
        using var owned = make(valid);
        Reject<ArgumentException>(() => owned.Invoke(false, value));
        Same(valid, owned.Invoke(true, valid));
        Same(valid, call(valid, argument => argument));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference BorrowRoots()
    {
        var target = new object(); var weak = new WeakReference(target);
        Api.CallRecord(StructuredValues.Record(1), value => { GC.KeepAlive(target); return value; });
        return weak;
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference OwnedRoot()
    {
        var owned = Api.MakeRecord(StructuredValues.Record(1));
        owned.Invoke(true, StructuredValues.Record(2));
        return new WeakReference(owned);
    }
    private static void Main()
    {
        Cases("array", StructuredValues.Array, Api.CallArray, Api.TwiceArray, Api.MakeArray);
        Cases("list", StructuredValues.List, Api.CallList, Api.TwiceList, Api.MakeList);
        Cases("option", StructuredValues.Option, Api.CallOption, Api.TwiceOption, Api.MakeOption);
        Cases("result", StructuredValues.Result, Api.CallResult, Api.TwiceResult, Api.MakeResult);
        Cases("tuple", StructuredValues.Tuple, Api.CallTuple, Api.TwiceTuple, Api.MakeTuple);
        Cases("record", StructuredValues.Record, Api.CallRecord, Api.TwiceRecord, Api.MakeRecord);
        Cases("variant", StructuredValues.Variant, Api.CallVariant, Api.TwiceVariant, Api.MakeVariant);
        Cases("alias", StructuredValues.Record, Api.CallAlias, Api.TwiceAlias, Api.MakeAlias);
        foreach (var value in new Option<string>[][] { null!, new[] { Option<string>.Some(null!) }, new[] { Option<string>.Some("\ud800") } })
            Invalid(value, StructuredValues.Array(1), Api.CallArray, Api.TwiceArray, Api.MakeArray);
        foreach (var value in new Result<(uint, string), string>[][] { null!, new[] { default(Result<(uint, string), string>) },
            new[] { Result<(uint, string), string>.Ok((0, null!)) }, new[] { Result<(uint, string), string>.Err(null!) } })
            Invalid(value, StructuredValues.List(1), Api.CallList, Api.TwiceList, Api.MakeList);
        foreach (var value in new[] { default(Result<Option<uint>, string[]>), Result<Option<uint>, string[]>.Err(null!),
            Result<Option<uint>, string[]>.Err(new string[] { null! }), Result<Option<uint>, string[]>.Err(new[] { "\ud800" }) })
            Invalid(value, StructuredValues.Result(1), Api.CallResult, Api.TwiceResult, Api.MakeResult);
        foreach (var value in new (string, (byte[], BigInteger))[] { (null!, (new byte[0], 1)), ("", (null!, 1)), ("", (new byte[0], -1)) })
            Invalid(value, StructuredValues.Tuple(1), Api.CallTuple, Api.TwiceTuple, Api.MakeTuple);
        foreach (var value in new Payload[] { null!, StructuredValues.Record(1) with { Count = -1 },
            StructuredValues.Record(1) with { Rows = null! }, StructuredValues.Record(1) with { Text = null! },
            StructuredValues.Record(1) with { Nested = Option<Result<(ulong, Unit), string>>.Some(default) },
            StructuredValues.Record(1) with { Nested = Option<Result<(ulong, Unit), string>>.Some(Result<(ulong, Unit), string>.Err(null!)) } })
        {
            Invalid(value, StructuredValues.Record(1), Api.CallRecord, Api.TwiceRecord, Api.MakeRecord);
            Invalid(value, StructuredValues.Record(1), Api.CallAlias, Api.TwiceAlias, Api.MakeAlias);
        }
        foreach (var value in new Packet[] { null!, new PacketPayload(null!, StructuredValues.Array(1)),
            new PacketPayload("", null!), new PacketCounts(-1, 0) })
            Invalid(value, StructuredValues.Variant(1), Api.CallVariant, Api.TwiceVariant, Api.MakeVariant);
        var record = StructuredValues.Record(1); var invoked = 0;
        using (var expired = Api.RetainRecord(value => { ++invoked; return value; }))
        {
            Reject<ArgumentException>(() => expired.Invoke(record), "Expired or wrong-thread host callback"); Check(invoked == 0);
        }
        var marker = new Marker();
        try { Api.AfterFailure(record, _ => throw marker); Check(false); }
        catch (Marker caught) { Check(ReferenceEquals(marker, caught)); }
        Check(Api.AfterFailure(record, value => value) == record.Text);
        var borrow = BorrowRoots(); var closure = OwnedRoot();
        for (var pass = 0; pass < 3; ++pass) { GC.Collect(); GC.WaitForPendingFinalizers(); }
        Check(!borrow.IsAlive, "callback retained after call"); Check(!closure.IsAlive, "owned wrapper retained after GC");
        var huge = new Option<string>[600_000];
        Reject<ArgumentException>(() => Api.CallArray(huge, value => value));
        Reject<ArgumentException>(() => Api.CallArray(StructuredValues.Array(1), _ => huge));
        Same(record, Api.CallRecord(record, value => value));
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, calls, rejected, shapes = StructuredValues.Shapes }));
    }
}
