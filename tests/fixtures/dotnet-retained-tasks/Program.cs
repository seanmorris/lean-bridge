using System;
using System.Diagnostics;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Feedback;
using A = LeanBridge.Feedback.Api;
using B = LeanBridge.Relay.Api;
using BR = LeanBridge.Relay.LeanRuntime;

static class Program
{
    static int owner;
    static void Check(bool b, [CallerLineNumber] int line = 0)
    { if (!b) throw new Exception("Assertion failed at line " + line); }
    static T Throws<T>(Action f) where T : Exception
    {
        try { f(); } catch (T e) { return e; }
        throw new Exception("Expected " + typeof(T));
    }
    static async Task<T> Reject<T>(Func<Task> f) where T : Exception
    {
        try { await f(); } catch (T e) { return e; }
        throw new Exception("Expected " + typeof(T));
    }
    static async Task Until(Func<bool> predicate)
    {
        var clock = Stopwatch.StartNew();
        while (!predicate())
        { if (clock.Elapsed > TimeSpan.FromSeconds(20)) throw new TimeoutException("Worker state"); await Task.Delay(5); }
    }
    static void Owner() => Check(owner == Environment.CurrentManagedThreadId);
    static async Task Phase(string name, Func<Task> action)
    { Console.Error.WriteLine("Checking " + name); await action(); }
    static async Task Carriers()
    {
        var wide = (BigInteger.One << 4097) + 71; string text = "a\0λ🌿"; byte[] buf = [0, 128, 255];
        int calls = 0; void Visit(bool b) { Owner(); Check(b); calls++; }
        await A.ScalarTour(
            u => { Visit(u == default); return true; },
            b => { Visit(b); return new Rune(0x1f33f); },
            r => { Visit(r.Value == 0x1f33f); return text; },
            s => { Visit(s == text); return buf; },
            v => { Visit(v.AsSpan().SequenceEqual(buf) && !ReferenceEquals(v, buf)); return wide; },
            n => { Visit(n == wide); return -wide; },
            i => { Visit(i == -wide); return byte.MaxValue; },
            b => { Visit(b == byte.MaxValue); return ushort.MaxValue; },
            h => { Visit(h == ushort.MaxValue); return uint.MaxValue; },
            w => { Visit(w == uint.MaxValue); return ulong.MaxValue; },
            d => { Visit(d == ulong.MaxValue); return nuint.MaxValue; },
            u => { Visit(u == nuint.MaxValue); return sbyte.MinValue; },
            b => { Visit(b == sbyte.MinValue); return short.MinValue; },
            h => { Visit(h == short.MinValue); return int.MinValue; },
            w => { Visit(w == int.MinValue); return long.MinValue; },
            d => { Visit(d == long.MinValue); return nint.MinValue; },
            n => { Visit(n == nint.MinValue); return -0.0f; },
            f => { Visit(float.IsNegativeInfinity(1 / f)); return double.PositiveInfinity; },
            d => Visit(double.IsPositiveInfinity(d)));
        Check(calls == 19);
        Throws<ArgumentException>(() => RetainedCallback.Create<double>(async _ => { await Task.Yield(); }));
        await Reject<ArgumentNullException>(() => A.Once(1, null!));
        await Reject<ArgumentOutOfRangeException>(() => A.Recover(_ => -1, 0));
        await Reject<ArgumentNullException>(() => A.TypedStart(_ => null!, false, buf));
        await Reject<EncoderFallbackException>(() => A.RepeatCall("", s => "\ud800"));
    }
    static async Task Reentry()
    {
        var ctx = SynchronizationContext.Current!;
        var posted = new TaskCompletionSource<bool>(); var answer = new TaskCompletionSource<int>();
        ctx.Post(_ => { LeanRuntime.Await(posted.Task); answer.SetResult(13); }, null);
        ctx.Post(_ => posted.SetResult(true), null);
        Check(await answer.Task == 13);
        Check(await A.DuringStart(s => BR.Await(B.Run(s, x => { Owner(); return x + "!"; })), s => s + "?", "α\0") == "α\0!!?!!");
        Task<uint>? outer = null;
        outer = A.Once(20, n => {
            Owner(); Check(Throws<InvalidOperationException>(() => BR.Await(outer!)).Message.Contains("own active"));
            return LeanRuntime.Await(A.Once(n, x => 2 * A.Plain(x)));
        });
        Check(await outer == 42 && await outer == 42);
    }
    sealed class Original(string message) : Exception(message) { }
    sealed class BadMessage : Exception { public override string Message => throw new FormatException("not the callback failure"); }
    sealed class RethrowMessage : Exception { public override string Message => throw this; }
    sealed class TrapMessage(Exception fatal) : Exception { public override string Message => throw fatal; }
    [MethodImpl(MethodImplOptions.NoInlining)] static T ThrowSite<T>(Exception e) => throw e;
    static async Task Errors()
    {
        var original = new Original("identical"); Func<string, string> bad = s => ThrowSite<string>(original);
        var twice = A.RepeatCall("x", bad);
        for (int i = 0; i < 2; i++) Check(ReferenceEquals(await Reject<Original>(() => twice), original));
        Check(twice.IsFaulted && original.StackTrace!.Contains("ThrowSite"));
        Check(ReferenceEquals(await Reject<Original>(() => A.DuringStart(bad, bad, "")), original));
        var caught = await A.Recover(n => throw original, 7); Check(caught.IsError && caught.Error == "caught in Lean");
        var replacement = await Reject<TaskIOException>(() => A.ReplaceError(n => throw original));
        Check(replacement.Declaration == "Retained.replaceError" && replacement.Message.Contains("identical"));
        var start = await Reject<LeanIOException>(() => A.Early(true, n => n)); Check(start.Declaration == "Feedback.early");
        var typed = await Reject<DeclaredError<string>>(() => A.TypedStart(v => v, true, []));
        Check(typed.Declaration == "Retained.typedStart" && typed.Payload == "factory refused");
        var badMessage = new BadMessage(); Check(ReferenceEquals(await Reject<BadMessage>(() => A.Once(1, n => throw badMessage)), badMessage));
        var rewritten = new RethrowMessage();
        Check(ReferenceEquals(await Reject<RethrowMessage>(() => A.Once(1, n => ThrowSite<uint>(rewritten))), rewritten));
        Check(rewritten.StackTrace!.Contains("ThrowSite"));
        var unrelated = new OperationCanceledException(new CancellationToken(true));
        var fault = A.Once(1, n => throw unrelated);
        Check(ReferenceEquals(await Reject<OperationCanceledException>(() => fault), unrelated) && fault.IsFaulted && !fault.IsCanceled);
        Check(A.Plain(3) == 4 && await B.Direct(4) == 5);
    }
    static async Task Lifetimes()
    {
        RetainedCallback<Func<uint, uint>>? self = null;
        self = RetainedCallback.Create<uint, uint>(n => { self!.Dispose(); return n + 1; });
        Check(await A.Once(9, self.Callback) == 10 && self.IsClosed);
        self.Dispose(); await Reject<ObjectDisposedException>(() => A.Once(9, self.Callback));
        using var shared = RetainedCallback.Create<string, string>(s => s + "x");
        using var first = new CancellationTokenSource();
        var a = A.RepeatCall("a", shared.Callback, first.Token); var b = B.Run("b", shared.Callback);
        first.Cancel(); Check((await Reject<OperationCanceledException>(() => a)).CancellationToken == first.Token);
        Check(await b == "bxx" && !shared.IsClosed);
        await Reject<WrongContextException>(() => Task.Run(shared.Dispose));
        shared.Dispose();
        await Reject<ObjectDisposedException>(() => B.Run("later", shared.Callback));
        Check(await A.Remember(n => n + 1) == 17);
        var expired = await Reject<TaskIOException>(() => A.UseExpired()); Check(expired.Message.Contains("expired")); A.Forget();
    }
    sealed class Capture { internal uint N = 7; }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (Task<uint>, WeakReference) Hold(CancellationToken token)
    {
        var capture = new Capture();
        return (A.Queued(n => n + capture.N, token), new WeakReference(capture));
    }
    static void Collect() { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); }
    static async Task Cancellation()
    {
        A.Reset(); using var source = new CancellationTokenSource(); var (pending, weak) = Hold(source.Token);
        await Until(() => A.State() == 3);
        Collect(); Check(weak.IsAlive && !pending.IsCompleted);
        await Task.Run(() => source.Cancel());
        Check((await Reject<OperationCanceledException>(() => pending)).CancellationToken == source.Token);
        A.Release(); await Until(() => A.State() == 4); await Until(() => { Collect(); return !weak.IsAlive; });
        GC.KeepAlive(pending);
        A.Reset(); int calls = 0; using var late = new CancellationTokenSource();
        var before = A.CancelLate(n => { calls++; return n; }, late.Token); await Until(() => A.State() == 1);
        late.Cancel(); await Reject<OperationCanceledException>(() => before); A.Release();
        await Until(() => A.State() == 2); Check(calls == 0);
        using var inward = new CancellationTokenSource();
        var self = A.Once(8, n => {
            var ctx = SynchronizationContext.Current!; var released = new TaskCompletionSource<bool>();
            ctx.Post(_ => { inward.Cancel(); ctx.Post(_ => released.SetResult(true), null); }, null);
            LeanRuntime.Await(released.Task); // Native owner closes while this delegate is still on its stack.
            return n;
        }, inward.Token);
        Check((await Reject<OperationCanceledException>(() => self)).CancellationToken == inward.Token && self.IsCanceled);
        Check(await A.Once(11, n => n) == 11);
    }
    static int Main(string[] args)
    {
        try { RunClient(args); return 0; }
        catch (Exception e) { Console.Error.WriteLine(e); return 1; }
    }
    static void RunClient(string[] args)
    {
        if (args[0] == "corrupt")
        {
            var err = Throws<InvalidOperationException>(() => A.Plain(0)); Check(err.Message.Contains("differs from the compiled package"));
            Console.WriteLine("tampered native library rejected"); return;
        }
        owner = Environment.CurrentManagedThreadId;
        bool peerFirst = args[0] == "peer-first";
        Action<Func<Task>> run = peerFirst ? BR.Run : LeanRuntime.Run;
        run(async () => {
            if (peerFirst) Check(await B.Run("", s => s + "!") == "!!");
            else Check(await A.Once(40, n => n + 2) == 42);
            await Phase("copied carriers", Carriers); await Phase("nested owner waits", Reentry);
            await Phase("error identity", Errors); await Phase("revocation", Lifetimes); await Phase("cancellation and collection", Cancellation);
            await foreach (var x in B.Constant(9)) { Check(x == 9); break; }
            await Until(() => Audit.Read()[5] == 0);
            var warm = Audit.Read(); Check(warm[1] == 2 && warm[2] == 1 && warm[3] == 2 && warm[4] == 2);
            // Test-only injection: a catchable CLR fatal exception; no real memory exhaustion.
            Console.Error.WriteLine("Checking shared runtime retirement");
            var fatal = new OutOfMemoryException("injected callback trap");
            using var cancel = new CancellationTokenSource();
            var trap = A.Once(0, n => { if (peerFirst) { cancel.Cancel(); throw fatal; } throw new TrapMessage(fatal); }, cancel.Token);
            Check(ReferenceEquals(await Reject<OutOfMemoryException>(() => trap), fatal));
            Check(ReferenceEquals(await Reject<OutOfMemoryException>(() => trap), fatal));
            Throws<RuntimeUnavailableException>(() => A.Plain(1));
            await Reject<LeanBridge.Relay.RuntimeUnavailableException>(() => B.Direct(1));
            await Until(() => Audit.Read()[5] == 0); Check(Audit.Read()[1] == 3);
        });
        Console.WriteLine(args[0] + ": 19 retained carriers, nested owner reentry, exception identity, revocation, cancellation and shared trap; 2 components, 0 live identities");
    }
}
