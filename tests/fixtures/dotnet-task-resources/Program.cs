using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using A = LeanBridge.LeaseDesk.Api;
using B = LeanBridge.LeaseDepot.Api;
using F = LeanBridge.OtherDesk.Api;
using Loop = LeanBridge.LeaseDepot.LeanRuntime;

static class Program
{
    static void Check(bool value, [CallerLineNumber] int line = 0)
    { if (!value) throw new Exception("Assertion failed at line " + line); }
    static T Throws<T>(Action call) where T : Exception
    { try { call(); } catch (T e) { return e; } throw new Exception("Expected " + typeof(T)); }
    static async Task<T> Reject<T>(Func<Task> call) where T : Exception
    { try { await call(); } catch (T e) { return e; } throw new Exception("Expected " + typeof(T)); }
    static T DeskError<T>(Action call, T witness) =>
        Throws<LeanBridge.LeaseDesk.DeclaredError<T>>(call).Payload;
    static async Task<T> TaskError<T>(Func<Task> call, T witness, string declaration)
    {
        var e = await Reject<LeanBridge.LeaseDepot.DeclaredError<T>>(call);
        Check(e.Declaration == declaration); return e.Payload;
    }
    static int Descriptors()
    {
        int n = 0;
        foreach (var fd in Directory.GetFiles("/proc/self/fd"))
            if (new FileInfo(fd).LinkTarget == "/dev/null") n++;
        return n;
    }
    static async Task Until(Func<bool> condition)
    {
        var clock = Stopwatch.StartNew();
        while (!condition())
        { if (clock.Elapsed > TimeSpan.FromSeconds(30)) throw new TimeoutException("Resource state"); await Task.Delay(5); }
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static WeakReference Abandon() => new WeakReference(A.Issue(7));
    static async Task Exchange()
    {
        using var t = A.Issue(40); using var second = A.Issue(40);
        using var peer = B.Alias(t); using var held = t.Retain();
        Check(t.SameResource(peer) && !t.SameResource(second) && !ReferenceEquals(t, held));
        B.Add(held, 2); Check(A.Count(peer) == 42 && B.Count(second) == 40);
        t.Dispose(); t.Dispose(); Check(t.IsClosed && !peer.IsClosed);
        Throws<ObjectDisposedException>(() => A.Count(t)); Throws<ObjectDisposedException>(() => B.Count(t));
        Throws<ObjectDisposedException>(() => t.Retain());
        Throws<ArgumentNullException>(() => B.Count(null!));
        await Task.Run(() => Throws<LeanBridge.LeaseDepot.WrongContextException>(() => B.Count(held)));
        await Task.Run(() => Throws<LeanBridge.LeaseDesk.WrongContextException>(() => held.Dispose()));
        using var badge = B.Badge(1); using var alien = F.Issue(2);
        var count = typeof(B).GetMethod("Count")!;
        Check(count.GetParameters()[0].ParameterType == held.GetType());
        Check(held.GetType() == peer.GetType() && alien.GetType() != held.GetType());
        Check(held.GetType().FullName == "LeanBridge.Resources.Shared.Ticket" && alien.GetType().FullName == held.GetType().FullName);
        Check(held.GetType().GetFields(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static).Length == 0);
        // Negative control for a mismatched ledger. No public API exposes these words.
        var borrow = held.GetType().GetMethod("Borrow", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var mismatch = Throws<TargetInvocationException>(() => borrow.Invoke(held, new object[] { new string('0', 64) }));
        Check(mismatch.InnerException is ArgumentException badLedger && badLedger.Message.Contains("ledger"));
        var forged = RuntimeHelpers.GetUninitializedObject(held.GetType());
        var rejected = Throws<TargetInvocationException>(() => count.Invoke(null, new[] { forged }));
        Check(rejected.InnerException is InvalidOperationException invalid && invalid.Message.Contains("Unissued"));
        Check(held.GetType().IsSealed && held.GetType().GetConstructors().Length == 0);
        Throws<ArgumentException>(() => count.Invoke(null, new object[] { badge }));
        Throws<ArgumentException>(() => count.Invoke(null, new object[] { alien }));
        using var sync = DeskError(() => A.CheckTicket(true, held), held);
        using var async = await TaskError(() => B.Checked(true, held), held, "Depot.checked");
        using var ok = await B.Checked(false, held); using var so = A.CheckTicket(false, held);
        Check(sync.SameResource(held) && async.SameResource(ok) && so.SameResource(peer));
        using var original = A.Issue(13);
        using var error = DeskError(() => A.CheckTicket(true, original), original);
        original.Dispose(); Check(B.Count(error) == 13);
        using var temp = A.Issue(21);
        var call = B.Revisit(temp, n => n * 2); temp.Dispose();
        using var result = await call;
        Check(A.Count(result) == 42 && ReferenceEquals(await call, result));
        var ex = new Exception("original");
        Check(ReferenceEquals(await Reject<Exception>(() => B.Revisit(peer, n => throw ex)), ex));
        for (int mode = 0; mode != 3; mode++)
        {
            var before = B.Closes(); var cursor = B.Tickets(peer, mode == 1).GetAsyncEnumerator();
            try
            {
                Check(await cursor.MoveNextAsync());
                using var item = cursor.Current; Check(item.SameResource(held));
                if (mode == 0) Check(!await cursor.MoveNextAsync() && !await cursor.MoveNextAsync());
                if (mode == 1)
                {
                    using var failed = await TaskError(async () => { await cursor.MoveNextAsync(); }, held, "Depot.next");
                    Check(failed.SameResource(item));
                }
            }
            finally { await cursor.DisposeAsync(); await cursor.DisposeAsync(); }
            Check(B.Closes() == before + 1);
        }
        using var input = A.Issue(6); var lazyStream = B.Tickets(input, false); input.Dispose();
        await using var unopened = lazyStream.GetAsyncEnumerator();
        await Reject<ObjectDisposedException>(async () => { await unopened.MoveNextAsync(); });
        using var stop = new CancellationTokenSource();
        var beforeCancel = B.Closes();
        await using var cancelled = B.Tickets(peer, false).GetAsyncEnumerator(stop.Token);
        Check(await cancelled.MoveNextAsync()); using var delivered = cancelled.Current;
        stop.Cancel();
        var end = await Reject<OperationCanceledException>(async () => { await cancelled.MoveNextAsync(); });
        Check(end.CancellationToken == stop.Token && delivered.SameResource(peer));
        await cancelled.DisposeAsync(); Check(B.Closes() == beforeCancel + 1);
    }
    static async Task Run(string order)
    {
        if (order == "desk-first") { using var warm = A.Issue(0); } else B.Reset();
        { using var warm = F.Badge(0); }
        B.Reset(); int baseline = Descriptors(); Check(Audit.Read()[5] == 0);
        await Exchange();
        await Until(() => Audit.Read()[5] == 0 && Descriptors() == baseline);
        var weak = Abandon();
        await Until(() => { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); B.State();
            return !weak.IsAlive && Audit.Read()[5] == 0 && Descriptors() == baseline; });
        for (int mode = 0; mode != 3; mode++)
        {
            bool cooperate = mode == 2;
            B.Reset(); var ticket = A.Issue(30); using var token = new CancellationTokenSource();
            var job = B.Pending(ticket, cooperate, token.Token);
            await Until(() => B.State() == 1); ticket.Dispose();
            Check(Descriptors() == baseline + 1);
            if (mode == 0)
            {
                B.Release(); using var settled = await job; Check(A.Count(settled) == 31);
            }
            else
            {
                await Task.Run(() => token.Cancel());
                Check((await Reject<OperationCanceledException>(() => job)).CancellationToken == token.Token);
                Check(job.IsCanceled); if (!cooperate) B.Release();
            }
            await Until(() => B.State() == (cooperate ? 2 : 3) && Audit.Read()[5] == 0 && Descriptors() == baseline);
        }
        var probe = B.Make(1, "retire-probe");
        var open = B.Tickets(probe, false).GetAsyncEnumerator(); Check(await open.MoveNextAsync());
        var last = open.Current; Check(probe.SameResource(last));
        var ready = Audit.Read(); Check(ready[1] == 2 && ready[2] == 1 && ready[3] == 3 && ready[4] == 3);
        Audit.Retire();
        Throws<LeanBridge.LeaseDesk.RuntimeUnavailableException>(() => A.Count(probe));
        probe.Dispose(); last.Dispose(); await open.DisposeAsync();
        await Until(() => Audit.Read()[5] == 0 && Descriptors() == baseline);
        Check(!File.Exists("retired-close-ran.txt") && Audit.Read()[1] == 3);
    }
    static int Main(string[] args)
    {
        try
        {
            if (args[0] == "corrupt")
            {
                Check(Throws<InvalidOperationException>(() => A.Issue(0)).Message.Contains("differs from the compiled package"));
                Console.WriteLine("tampered ledger rejected"); return 0;
            }
            Loop.Run(() => Run(args[0]));
            Console.WriteLine(args[0] + ": shared nominal type, distinct foreign definition, typed errors, cancellation and stream cleanup; 3 components, 0 live identities, 0 leaked descriptors");
            return 0;
        }
        catch (Exception e) { Console.Error.WriteLine(e); return 1; }
    }
}
