using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using Item = LeanBridge.Pulse.Result<uint, string>;

namespace LeanBridge.Pulse;

// Compiled only by the scheduler regression against the receipt-pinned Pulse
// library. The ports below are the current C# generator's actual native ports.
internal static class ScopeProbe
{
    private static void Check(bool ok, [CallerLineNumber] int line = 0)
    { if (!ok) throw new Exception("Scope probe failed at line " + line); }
    private static E Reject<E>(Action action) where E : Exception
    {
        try { action(); } catch (E e) { return e; }
        throw new Exception("Expected " + typeof(E));
    }
    private static async Task RejectAsync<E>(Func<Task> action) where E : Exception
    {
        try { await action(); } catch (E) { return; }
        throw new Exception("Expected " + typeof(E));
    }

    private sealed class Label { public readonly string Text = "bound"; }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static IAsyncEnumerable<Item> Cold(HostTaskScope scope, bool paused, out WeakReference label)
    {
        var box = new Label();
        label = new WeakReference(box);
        return Delivery<Item>.Sequence(scope.Defer(() => Wire.__SeriesPort__(false, paused, box.Text)), scope.Track);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static WeakReference Abandon(HostTaskScope scope)
    { _ = Cold(scope, false, out var label); return label; }
    private static void Collect()
    { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); }

    private static async Task Exercise()
    {
        using var a = new HostTaskScope(); using var b = new HostTaskScope();
        Check(a.Invoke(() => b.Invoke(() => a.Invoke(() => 41))) == 41);
        a.Invoke(() => Reject<InvalidOperationException>(a.Dispose));
        Exception? wrong = null;
        var thread = new Thread(() => { try { a.Dispose(); } catch (Exception e) { wrong = e; } });
        thread.Start(); thread.Join(); Check(wrong is WrongContextException);
        int cleanup = 0;
        var detach = a.Track(() => cleanup += 100); detach(); detach();
        var error = new FormatException("first cleanup failure");
        a.Track(() => throw error); a.Track(() => { cleanup++; throw new Exception("second"); });

        Api.Reset();
        var abandoned = Abandon(a);
        var retained = Cold(a, false, out var retainedLabel);
        var blocked = Cold(a, true, out _);
        var sibling = Cold(b, false, out _);
        Collect(); Check(!abandoned.IsAlive && retainedLabel.IsAlive);
        // Cold factories can be reused; each pull owns an independent port.
        for (int i = 0; i < 2; i++)
        {
            await using var idle = retained.GetAsyncEnumerator();
            Check(await idle.MoveNextAsync() && idle.Current.Error == "bound");
        }
        uint closes = Api.Closes();
        await using var cursor = blocked.GetAsyncEnumerator();
        var pull = cursor.MoveNextAsync().AsTask();
        var first = Delivery<long>.Value(() => Wire.__LatePort__(false, 51), default, a.Track);
        var second = Delivery<long>.Value(() => Wire.__LatePort__(false, 93), default, b.Track);
        Check(!pull.IsCompleted && !first.IsCompleted && !second.IsCompleted);
        try
        {
            Check(ReferenceEquals(Reject<FormatException>(a.Dispose), error));
            Check(cleanup == 1 && first.IsCanceled && !second.IsCompleted);
            Check(Api.Closes() == closes + 1);
            await RejectAsync<OperationCanceledException>(() => pull);
            await RejectAsync<OperationCanceledException>(() => first);
            Check(pull.IsCanceled && !await cursor.MoveNextAsync());
            await using var stale = retained.GetAsyncEnumerator();
            await RejectAsync<ObjectDisposedException>(() => stale.MoveNextAsync().AsTask());
            Collect(); Check(!retainedLabel.IsAlive); GC.KeepAlive(retained);
            a.Dispose();
        }
        finally { Api.Release(); }
        Check(await second == 93);
        await using var live = sibling.GetAsyncEnumerator();
        Check(await live.MoveNextAsync() && live.Current.Error == "bound");
    }

    private static void Main()
    {
        LeanRuntime.Run(Exercise);
        Console.WriteLine("binding isolation: task, pending pull, cold captures, cleanup faults and owner thread");
    }
}
