using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using P = LeanBridge.Pulse.Api;
using S = LeanBridge.Signals.Api;

static class Parked
{
    static void Check(bool condition, [System.Runtime.CompilerServices.CallerLineNumber] int line = 0)
    {
        if (!condition) throw new Exception("Parked pull assertion at line " + line);
    }

    static async Task Until(Func<bool> ready)
    {
        var timeout = Stopwatch.StartNew();
        while (!ready())
        {
            if (timeout.Elapsed > TimeSpan.FromSeconds(15)) throw new TimeoutException("Lean worker did not progress");
            await Task.Delay(5);
        }
    }

    static async Task Peer()
    {
        await foreach (var item in S.Constant(7)) { Check(item == 7); return; }
        throw new Exception("Independent peer produced no item");
    }

    static async Task Exercise(bool disposeFirst)
    {
        P.Reset();
        uint closes = P.Closes(), pulls = P.Pulls();
        Check(Audit.Read()[5] == 0);
        using var source = new CancellationTokenSource();
        var cursor = P.Series(false, true, "late").GetAsyncEnumerator(source.Token);
        var pull = cursor.MoveNextAsync().AsTask();
        await Until(() => P.State() == 1);
        Check(!pull.IsCompleted && P.Pulls() == pulls + 1 && P.Closes() == closes);
        try { await cursor.MoveNextAsync(); throw new Exception("Accepted a second demand"); }
        catch (InvalidOperationException) { }

        if (disposeFirst) await cursor.DisposeAsync();
        else await Task.Run(() => source.Cancel());
        try { await pull; throw new Exception("Delivered a cancelled item"); }
        catch (OperationCanceledException error)
        {
            Check(error.CancellationToken.IsCancellationRequested);
            if (!disposeFirst) Check(error.CancellationToken == source.Token);
        }
        // No explicit DisposeAsync in the token case. The worker is still gated.
        Check(pull.IsCanceled && P.State() == 1 && P.Closes() == closes + 1);
        Check(!await cursor.MoveNextAsync() && P.Pulls() == pulls + 1);
        await Peer();
        P.Release();
        await Until(() => P.State() == 3 && Audit.Read()[5] == 0);
        Check(!await cursor.MoveNextAsync() && pull.IsCanceled);
        await cursor.DisposeAsync();
        await cursor.DisposeAsync();
        Check(P.Closes() == closes + 1 && P.Pulls() == pulls + 1 && Audit.Read()[5] == 0);
    }

    static void Main(string[] args)
    {
        bool peerFirst = args[0] == "peer-first";
        Action<Func<Task>> run = peerFirst ? LeanBridge.Signals.LeanRuntime.Run : LeanBridge.Pulse.LeanRuntime.Run;
        run(async () => { if (peerFirst) await Peer(); await Exercise(false); await Exercise(true); });
        Console.WriteLine(args[0] + ": parked token cancellation finalized before disposal; disposal woke a second blocked pull; no late items or live owners");
    }
}
