using System;
using System.Diagnostics;
using System.Numerics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.Pulse;
using P = LeanBridge.Pulse.Api;
using S = LeanBridge.Signals.Api;

static class Program
{
    static void Check(bool b, [System.Runtime.CompilerServices.CallerLineNumber] int line = 0)
    { if (!b) throw new Exception("Assertion failed at line " + line); }
    static async Task<T> Reject<T>(Func<Task> action) where T : Exception
    {
        try { await action(); } catch (T e) { return e; }
        throw new Exception("Expected " + typeof(T));
    }
    static async Task Until(Func<bool> predicate)
    {
        var clock = Stopwatch.StartNew();
        while (!predicate())
        {
            if (clock.Elapsed > TimeSpan.FromSeconds(20)) throw new TimeoutException("Lean worker did not reach expected state");
            await Task.Delay(5);
        }
    }
    static async Task Values()
    {
        await P.RtUnit(default);
        Check(await P.RtBool(true) && !await P.RtBool(false));
        Check(await P.RtUint8(byte.MaxValue) == byte.MaxValue && await P.RtInt8(sbyte.MinValue) == sbyte.MinValue);
        Check(await P.RtUint16(ushort.MaxValue) == ushort.MaxValue && await P.RtInt16(short.MinValue) == short.MinValue);
        Check(await P.RtUint32(uint.MaxValue) == uint.MaxValue && await P.RtInt32(int.MinValue) == int.MinValue);
        Check(await P.RtUint64(ulong.MaxValue) == ulong.MaxValue && await P.RtInt64(long.MinValue) == long.MinValue);
        Check(await P.RtUsize(nuint.MaxValue) == nuint.MaxValue && await P.RtIsize(nint.MinValue) == nint.MinValue);
        string text = "λ\0🌿"; Check(await P.RtString(text) == text && (await P.RtChar(new Rune(0x1F33F))).Value == 0x1F33F);
        Check(float.IsNaN(await P.RtFloat32(float.NaN)) && double.IsNegativeInfinity(1 / await P.RtFloat64(-0.0)));
        byte[] bytes = [0, 128, 255]; var copy = await P.RtBytes(bytes);
        Check(!ReferenceEquals(bytes, copy) && copy.AsSpan().SequenceEqual(bytes));
        var wide = (BigInteger.One << 4097) + 17;
        Check(await P.RtNat(wide) == wide && await P.RtInt(-wide) == -wide);
        await Reject<ArgumentOutOfRangeException>(() => P.RtNat(-1));
        await Reject<EncoderFallbackException>(() => P.RtString("\ud800"));
        var ret = await P.Wide(false, -wide, bytes);
        Check(ret.IsError && ret.Error.AsSpan().SequenceEqual(bytes));
        var raised = await Reject<DeclaredError<Result<BigInteger, byte[]>>>(() => P.Wide(true, wide, bytes));
        Check(raised.Declaration == "RubyTasks.wide" && raised.Payload.Value == wide);
        var start = await Reject<LeanIOException>(() => P.IoTask(true));
        Check(start.Declaration == "Pulse.ioTask" && start.Message.Contains("IO refusal"));
        await P.IoTask(false);
        var term = await Reject<TaskIOException>(() => P.Terminal(true, wide));
        Check(term.Declaration == "RubyTasks.terminal" && term.Message.Contains("terminal"));
        Check(await P.Terminal(false, -wide) == -wide && P.Identity(text) == text && P.Base(23) == 23);
    }
    static async Task Pending()
    {
        P.Reset();
        var first = P.Late(false, -41); var second = P.Late(false, 93);
        await Until(() => P.State() == 1);
        Check(!first.IsCompleted && !second.IsCompleted);
        await Task.Yield(); await Peer(); Check(!first.IsCompleted && !second.IsCompleted);
        P.Release(); Check(await first == -41 && await second == 93 && await first == -41);
        foreach (bool cooperate in new[] { true, false })
        {
            P.Reset(); using var source = new CancellationTokenSource();
            var pending = P.Late(cooperate, 71, source.Token); await Until(() => P.State() == 1);
            await Task.Run(() => source.Cancel());
            var e = await Reject<OperationCanceledException>(() => pending);
            Check(e.CancellationToken == source.Token && pending.IsCanceled);
            if (cooperate) await Until(() => P.State() == 2);
            else { P.Release(); await Until(() => P.State() == 3); }
            Check(pending.IsCanceled);
        }
        P.Reset(); var canceled = new CancellationToken(true);
        Check((await Reject<OperationCanceledException>(() => P.Late(true, 1, canceled))).CancellationToken == canceled);
        Check(P.State() == 0);
        await Reject<WrongContextException>(() => Task.Run(() => P.Late(true, 42)));
    }
    static async Task Streams()
    {
        uint pulls = P.Pulls(), closes = P.Closes();
        var seq = P.Series(false, false, "edge");
        await using (var idle = seq.GetAsyncEnumerator()) { }
        Check(P.Pulls() == pulls && P.Closes() == closes);
        await foreach (var item in seq) { Check(item.IsError && item.Error == "edge"); break; }
        Check(P.Pulls() == pulls + 1 && P.Closes() == ++closes);
        int n = 0; await foreach (var item in seq) { if (n++ == 1) Check(item.Value == 73); }
        Check(n == 2 && P.Pulls() == pulls + 4 && P.Closes() == ++closes);
        var step = await Reject<DeclaredError<ushort>>(async () => { await foreach (var item in P.Series(true, false, "")) { } });
        Check(step.Declaration == "Pulse.next" && step.Payload == 413 && P.Closes() == ++closes);
        P.Reset(); using var cts = new CancellationTokenSource();
        await using var cursor = P.Series(false, true, "").GetAsyncEnumerator(cts.Token);
        var stalled = cursor.MoveNextAsync().AsTask(); await Until(() => P.State() == 1);
        await Reject<InvalidOperationException>(() => cursor.MoveNextAsync().AsTask());
        await Task.Run(() => cts.Cancel());
        Check((await Reject<OperationCanceledException>(() => stalled)).CancellationToken == cts.Token);
        await cursor.DisposeAsync(); Check(P.Closes() == ++closes && !await cursor.MoveNextAsync());
        P.Release(); await Until(() => P.State() == 3);
        P.Reset(); await using var abandoned = P.Series(false, true, "").GetAsyncEnumerator();
        var pull = abandoned.MoveNextAsync().AsTask(); await Until(() => P.State() == 1);
        await abandoned.DisposeAsync(); await Reject<OperationCanceledException>(() => pull);
        P.Release(); await Until(() => P.State() == 3); Check(P.Closes() == ++closes);
    }
    static async Task Peer()
    {
        await foreach (var x in S.Constant(71)) { Check(x == 71); break; }
        await foreach (var x in S.Checked(0, false)) throw new Exception("Empty stream produced " + x);
        var e = await Reject<LeanBridge.Signals.LeanIOException>(async () => { await foreach (var x in S.Checked(0, true)) { } });
        Check(e.Declaration == "Signals.checked");
    }
    static void Main(string[] args)
    {
        if (args[0] == "corrupt")
        {
            try { P.State(); } catch (InvalidOperationException e) when (e.Message.Contains("differs from the compiled package"))
            { Console.WriteLine("tampered native library rejected"); return; }
            throw new Exception("Tampered library loaded");
        }
        var outside = Reject<InvalidOperationException>(() => P.Late(true, 0)).GetAwaiter().GetResult();
        Check(outside.Message.Contains("LeanRuntime.Run"));
        bool peerFirst = args[0] == "peer-first"; Task<long> orphan = null!;
        Action<Func<Task>> run = peerFirst ? LeanBridge.Signals.LeanRuntime.Run : LeanRuntime.Run;
        run(async () => {
            if (peerFirst) await Peer();
            await Values();
            if (!peerFirst) await Peer();
            await Pending(); await Streams();
            await Until(() => Audit.Read()[5] == 0);
            var snapshot = Audit.Read(); Check(snapshot[1] == 2 && snapshot[2] == 1 && snapshot[3] == 2);
            P.Reset(); orphan = P.Late(true, 101); await Until(() => P.State() == 1);
        });
        Reject<OperationCanceledException>(() => orphan.WaitAsync(TimeSpan.FromSeconds(10))).GetAwaiter().GetResult();
        run(async () => {
            await Until(() => P.State() == 2);
            P.Reset(); var parked = P.Late(true, 9); await Until(() => P.State() == 1);
            using var cts = new CancellationTokenSource();
            await using var cursor = S.Constant(9).GetAsyncEnumerator(cts.Token);
            Check(await cursor.MoveNextAsync());
            await Task.Run(Audit.Retire);
            await Reject<RuntimeUnavailableException>(() => parked);
            await Reject<LeanBridge.Signals.RuntimeUnavailableException>(() => cursor.MoveNextAsync().AsTask());
            await cursor.DisposeAsync();
            await Until(() => Audit.Read()[5] == 0); Check(Audit.Read()[1] == 3);
        });
        Console.WriteLine(args[0] + ": 19 scalars, genuine await, cancellation, pull backpressure, disposal and retirement; shared owner, 2 components, 0 live identities");
    }
}
