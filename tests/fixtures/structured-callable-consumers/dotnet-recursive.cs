using System;
using System.Collections.Generic;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Threading;
using LeanBridge.Structured;

internal static class RecursiveCases
{
    private static int checks;
    private sealed class Marker : Exception { }
    private static void Check(bool condition, string detail = "recursive C# check")
    { ++checks; if (!condition) throw new Exception(detail + " " + checks); }
    private static void Reject<T>(Action action) where T : Exception
    { try { action(); } catch (T) { ++checks; return; } throw new Exception("Expected " + typeof(T).Name); }
    internal static Tree Value(int seed) => seed % 5 == 0
        ? new TreeLeaf(StructuredValues.Huge(seed)) : new TreeBranch(new Tree[] {
            new TreeLeaf(StructuredValues.Huge(seed)), new TreeBranch(Array.Empty<Tree>()),
            new TreeBranch(new Tree[] { new TreeLeaf(seed), new TreeLeaf(BigInteger.Zero) }) });
    private static void Same(Tree expected, Tree actual)
    {
        Check(expected.Equals(actual), "recursive structural equality");
        Check(expected.GetHashCode() == actual.GetHashCode(), "recursive equal hash");
        Check(!ReferenceEquals(expected, actual), "detached tree");
        if (expected is TreeBranch branch)
        {
            var copied = (TreeBranch)actual;
            if (branch.Children.Length != 0) Check(!ReferenceEquals(branch.Children, copied.Children), "detached children");
            for (var i = 0; i < branch.Children.Length; ++i) Same(branch.Children[i], copied.Children[i]);
        }
    }
    private static void Mutate(Tree value)
    { if (value is TreeBranch branch && branch.Children.Length != 0) branch.Children[0] = new TreeLeaf(999); }
    private static void Invalid(Tree bad)
    {
        var valid = Value(2); var calls = 0;
        Reject<ArgumentException>(() => Api.CallRecursive(bad, value => { ++calls; return value; }));
        Check(calls == 0); Reject<ArgumentException>(() => Api.MakeRecursive(bad));
        Reject<ArgumentException>(() => Api.CallRecursive(valid, _ => bad));
        Reject<ArgumentException>(() => Api.TwiceRecursive(valid, _ => { ++calls; return bad; }));
        Check(calls == 1, "callback continued after invalid result");
        using var owned = Api.MakeRecursive(valid);
        Reject<ArgumentException>(() => owned.Invoke(false, bad));
        Same(valid, owned.Invoke(true, valid)); Same(valid, Api.CallRecursive(valid, value => value));
    }
    internal static void Run()
    {
        NativeProbe.LayoutCheck();
        for (var seed = 0; seed < 32; ++seed)
        {
            var input = Value(seed); var replacement = Value(seed + 1); Tree retained = null!; var calls = 0;
            var output = Api.CallRecursive(input, value => {
                ++calls; Same(input, value); retained = value;
                GC.Collect(); GC.WaitForPendingFinalizers(); return replacement;
            });
            Check(calls == 1); Same(replacement, output);
            Mutate(input); Mutate(replacement); Same(Value(seed), retained); Same(Value(seed + 1), output);
            calls = 0;
            Same(Value(seed + 2), Api.TwiceRecursive(Value(seed), value => {
                Same(Value(seed + calls), value); return Value(seed + ++calls);
            })); Check(calls == 2);
            input = Value(seed);
            using (var owned = Api.MakeRecursive(input))
            {
                Mutate(input); var invoke = owned.Invoke;
                Same(Value(seed), invoke(true, Value(seed + 1)));
                Same(Value(seed + 1), invoke(false, Value(seed + 1)));
                Mutate(invoke(true, Value(seed + 1))); Same(Value(seed), invoke(true, Value(seed + 2)));
                Same(Value(seed), Api.CallRecursive(Value(seed), value => invoke(true, value)));
                Exception? wrong = null;
                var thread = new Thread(() => { try { invoke(true, Value(seed)); } catch (Exception error) { wrong = error; } });
                thread.Start(); thread.Join(); Check(wrong is InvalidOperationException);
                owned.Dispose(); owned.Dispose(); Check(owned.IsClosed);
                Reject<ObjectDisposedException>(() => invoke(false, Value(seed)));
            }
            foreach (var error in new Exception[] { new Marker(), new OutOfMemoryException("callback"), new OperationCanceledException("callback") })
            {
                calls = 0;
                try { Api.TwiceRecursive(Value(seed), _ => { ++calls; throw error; }); Check(false); }
                catch (Exception caught) { Check(ReferenceEquals(error, caught)); Check(caught.StackTrace?.Contains(nameof(Run), StringComparison.Ordinal) == true); }
                Check(calls == 1); Same(Value(seed), Api.CallRecursive(Value(seed), value => value));
            }
            Same(Value(seed), Api.CallRecursive(Value(seed), outer => Api.CallRecursive(outer, inner => inner)));
            using var alias = Api.MakeNestedAlias(StructuredValues.Record(seed));
            using var plain = Api.MakeNestedPlain(StructuredValues.Record(seed));
            var text = StructuredValues.Text(seed) + "<none>" + StructuredValues.Text(seed);
            Check(Api.CallNestedAlias(StructuredValues.Record(seed), alias.Invoke) == text);
            Check(Api.CallNestedPlain(StructuredValues.Record(seed), plain.Invoke) == text);
        }
        Invalid(null!); Invalid(new TreeLeaf(-1)); Invalid(new TreeBranch(null!)); Invalid(new TreeBranch(new Tree[] { null! }));
        var cycle = new TreeBranch(new Tree[1]); cycle.Children[0] = cycle;
        Invalid(cycle); cycle.Children[0] = new TreeLeaf(0);
        Tree deep = Value(0); for (var i = 0; i < 130; ++i) deep = new TreeBranch(new[] { deep }); Invalid(deep);
        var wide = new Tree[300_000]; Array.Fill(wide, new TreeLeaf(1)); Invalid(new TreeBranch(wide));
        var shared = Value(1); Same(new TreeBranch(new[] { shared, shared }), Api.CallRecursive(new TreeBranch(new[] { shared, shared }), value => value));
        var nesting = 0; Func<Tree, Tree> reenter = null!;
        reenter = value => { ++nesting; return Api.CallRecursive(value, reenter); };
        Reject<ArgumentException>(() => Api.CallRecursive(Value(0), reenter));
        Check(nesting == 64, "native reentry bound");
        Same(Value(2), Api.CallRecursive(Value(2), value => value));
        Check(NativeProbe.Live() == 0, "zero identities after recursive calls");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, nesting, layout = NativeProbe.LayoutCount }));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference BorrowRoot()
    {
        var target = new object(); var weak = new WeakReference(target);
        Api.CallRecursive(Value(1), value => { GC.KeepAlive(target); return value; }); return weak;
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference FillAndRelease()
    {
        var held = new LeanClosure<Func<bool, Tree, Tree>>[4096];
        for (var i = 0; i < held.Length; ++i) held[i] = Api.MakeRecursive(Value(0));
        Check(NativeProbe.Live() == 4096);
        Reject<OutOfMemoryException>(() => Api.MakeRecursive(Value(0)));
        Check(NativeProbe.Live() == 4096);
        var stale = held[0]; var staleInvoke = stale.Invoke; stale.Dispose(); Check(NativeProbe.Live() == 4095);
        held[0] = Api.MakeRecursive(Value(0)); Check(NativeProbe.Live() == 4096);
        Reject<ObjectDisposedException>(() => staleInvoke(true, Value(0)));
        Same(Value(0), held[0].Invoke(true, Value(1)));
        return new WeakReference(held[4095]);
    }
    internal static void Lifetimes()
    {
        Check(NativeProbe.Live() == 0);
        var borrow = BorrowRoot(); var weak = FillAndRelease();
        for (var pass = 0; pass < 4; ++pass) { GC.Collect(); GC.WaitForPendingFinalizers(); }
        Check(!borrow.IsAlive); Check(!weak.IsAlive); Check(NativeProbe.Live() == 0, "finalized identities");
        using (var closed = Api.MakeRecursive(Value(1)))
        {
            Exception? error = null;
            var thread = new Thread(() => { try { closed.Dispose(); } catch (Exception caught) { error = caught; } });
            thread.Start(); thread.Join(); Check(error is null); Check(closed.IsClosed);
        }
        LeanClosure<Func<bool, Tree, Tree>>? departed = null;
        var creator = new Thread(() => departed = Api.MakeRecursive(Value(1)));
        creator.Start(); creator.Join(); Check(departed is not null);
        Reject<InvalidOperationException>(() => departed!.Invoke(true, Value(1)));
        Exception? reused = null;
        var later = new Thread(() => { try { departed!.Invoke(true, Value(1)); } catch (Exception error) { reused = error; } });
        later.Start(); later.Join(); Check(reused is InvalidOperationException);
        departed!.Dispose();
        Check(NativeProbe.Live() == 0);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, capacity = 4096, identities = NativeProbe.Live(), finalized = !weak.IsAlive }));
    }
}
