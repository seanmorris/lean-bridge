using System;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using LeanBridge.Dials;
using LeanBridge.Resources.TicketPulls;

static class Program
{
    static LeanCursor<uint>? atExit;
    static void Check(bool value, [CallerArgumentExpression(nameof(value))] string? expression = null)
    { if (!value) throw new Exception("cursor assertion: " + expression); }
    static uint LiveIdentities() => Audit.Read()[5]; // Native snapshot: ABI/state/init/components/attached/live.
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void Abandon() { var cursor = Api.Sequence(8); Check(cursor.MoveNext()); }
    static void Main(string[] args)
    {
        Check(Api.Counts() == 0);
        if (args[0] == "shutdown") {
            atExit = Api.Sequence(3);
            Check(atExit.MoveNext() && Api.Counts() == 10100 && !File.Exists("state")); return;
        }
        Check(LiveIdentities() == 0);
        using (var t = Api.Issue(3)) using (var it = Api.Tickets(t)) {
            Check(it.MoveNext()); t.Dispose(); // Do not claim the buffered resource.
        }
        Check(LiveIdentities() == 0);
        using (var t = Api.Issue(42)) using (var it = Api.Tickets(t)) {
            Check(it.MoveNext()); using var item = it.Current;
            Check(t.SameResource(item)); t.Dispose();
            try { it.MoveNext(); throw new Exception("no typed resource error"); }
            catch (DeclaredError<Ticket> e) {
                using var payload = e.Payload; Check(e.Declaration == "TicketPulls.nextTicket");
                Check(payload.SameResource(item)); it.Dispose(); item.Dispose(); Check(Api.ReadTicket(payload) == 42);
            }
        }
        Check(Api.ClosedTickets() == 2 && LiveIdentities() == 0);
        using (var it = Api.Sequence(4)) {
            bool refused = false;
            var foreign = new Thread(() => { try { it.MoveNext(); } catch (WrongContextException) { refused = true; } });
            foreign.Start(); foreign.Join(); Check(refused && Api.Counts() == 10000);
            foreach (var n in it) { if (n == 1) break; }
            Check(!it.MoveNext());
        }
        try { Api.Checked(0); throw new Exception("no factory error"); }
        catch (DeclaredError<string> e) { Check(e.Declaration == "Dials.checked" && e.Payload == "factory"); }
        using (var it = Api.Checked(1)) {
            Check(it.MoveNext() && it.Current == 0);
            try { it.MoveNext(); throw new Exception("no step error"); }
            catch (DeclaredError<string> e) { Check(e.Declaration == "Dials.checkedNext" && e.Payload == "step"); }
        }
        using (var it = Api.Units(1)) {
            Check(it.MoveNext() && it.Current.Equals(default(Unit)));
            try { it.MoveNext(); throw new Exception("no IO failure"); }
            catch (LeanIOException e) { Check(e.Declaration == "Dials.nextUnit" && e.Message == "unit step"); }
        }
        int total = 0;
        foreach (var n in Api.Sequence(2)) total += (int)n;
        Check(total == 1);
        var cause = new Exception("caller");
        try { foreach (var n in Api.Sequence(1)) throw cause; }
        catch (Exception e) { Check(ReferenceEquals(cause,e)); }
        using (var unused = Api.Sequence(0)) {}
        Abandon(); GC.Collect(); GC.WaitForPendingFinalizers();
        Check(Api.Counts() == 71107 && LiveIdentities() == 0);
        Console.WriteLine("7 opens, 11 pulls, 7 closes");
    }
}
