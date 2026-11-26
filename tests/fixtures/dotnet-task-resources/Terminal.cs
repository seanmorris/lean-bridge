using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.LeaseDepot;
using LeanBridge.Resources.Shared;
using Desk = LeanBridge.LeaseDesk.Api;
using Depot = LeanBridge.LeaseDepot.Api;

static class Terminal {
    static void Check(bool ok, string reason) { if (!ok) throw new Exception(reason); }
    static int Files() => Directory.GetFiles("/proc/self/fd").Count(p => new FileInfo(p).LinkTarget == "/dev/null");
    // The observer returns ABI, state, initializer count, components, attachments, live identities.
    static uint LiveIdentities() => Audit.Read()[5];
    static async Task Exercise(string mode) {
        using var cancel = new CancellationTokenSource();
        var live = LiveIdentities(); var baseline = Files(); var before = Depot.Closes();
        Check(live == 0, "previous run left an identity");
        using var original = Desk.Issue(41);
        var cursor = Depot.Tickets(original, mode == "failure").GetAsyncEnumerator(cancel.Token);
        Check(await cursor.MoveNextAsync(), "missing ticket"); using var first = cursor.Current;
        Check(first.SameResource(original), "wrong item"); original.Dispose();
        Ticket? payload = null;
        try {
            if (mode == "failure") {
                try { await cursor.MoveNextAsync(); throw new Exception("expected a typed step failure"); }
                catch (DeclaredError<Ticket> e) {
                    Check(e.Declaration == "Depot.next" && e.Payload.SameResource(first), "wrong failure");
                    payload = e.Payload;
                }
            } else if (mode == "cancel") {
                cancel.Cancel();
                try { await cursor.MoveNextAsync(); throw new Exception("expected cancellation"); }
                catch (OperationCanceledException e) { Check(e.CancellationToken == cancel.Token, "wrong cancellation token"); }
            } else Check(!await cursor.MoveNextAsync(), "unexpected second item");

            // Do not use await foreach or await using here. Neither a compiler-generated
            // finally nor an explicit DisposeAsync may be responsible for this first check.
            Check(Depot.Closes() == before + 1, "Lean finalizer had not run when the terminal outcome arrived: " + mode);
            Check(!await cursor.MoveNextAsync() && Depot.Closes() == before + 1, "terminal pull did more work");
            Check(Desk.Count(first) == 41, "cursor disposal revoked its delivered item");
            if (payload != null) {
                first.Dispose(); Check(LiveIdentities() == live + 1 && Files() == baseline + 1, "error was not the last owner");
                Depot.Add(payload, 1); Check(Desk.Count(payload) == 42, "peer could not use the error payload");
                payload.Dispose();
                Check(LiveIdentities() == live && Files() == baseline, "an owner survived the payload before cursor disposal");
            }
        } finally {
            payload?.Dispose(); first.Dispose(); await cursor.DisposeAsync(); await cursor.DisposeAsync();
        }
        Check(Depot.Closes() == before + 1 && LiveIdentities() == live && Files() == baseline, "cleanup was not exactly once");
    }
    public static void Main(string[] args) {
        if (args[0] == "desk-first") Desk.Issue(0).Dispose(); else Depot.Closes();
        Desk.Issue(0).Dispose(); Depot.Closes();
        LeanRuntime.Run(async () => { foreach (var mode in new[] {"end", "failure", "cancel"}) await Exercise(mode); });
        Console.WriteLine(args[0] + ": end, typed failure and cancellation finalized before explicit disposal; last error owner usable, zero owner and descriptor delta");
    }
}
