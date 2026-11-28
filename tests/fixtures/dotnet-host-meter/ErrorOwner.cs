using System;
using System.Runtime.CompilerServices;
using A = LeanBridge.Workshop;
using B = LeanBridge.WorkshopPeer;

internal static class ErrorOwner {
    [MethodImpl(MethodImplOptions.NoInlining)]
    static A.DeclaredError<Meter> Capture(out WeakReference<Meter> weak) {
        using var producer = A.Api.BindHosts<Meter>();
        var original = new Meter(23);
        weak = new(original);
        try { producer.RejectBox(original); }
        catch (A.DeclaredError<Meter> e) {
            if (e.Declaration != "Workshop.rejectBox" || !ReferenceEquals(e.Payload,original))
                throw new Exception("incorrect declared error payload");
            return e;
        }
        throw new Exception("expected a declared rejection");
    }
    static void Collect() {
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static WeakReference<Meter> UseLastOwner(B.Bound<Meter> peer) {
        var error = Capture(out var weak);
        Collect();
        if (!weak.TryGetTarget(out var live) || !ReferenceEquals(live,error.Payload) ||
            peer.Read(error.Payload) != 23 || peer.Update(error.Payload,42) != 42 || live.Level != 42)
            throw new Exception("peer lost the payload after producer disposal");
        GC.KeepAlive(error);
        return weak;
    }
    public static void Main(string[] args) {
        if (args[0] != "tampered") {
            // Hold an ordinary pair open in the selected order. Capture uses
            // a separate producing binding and disposes it before returning.
            A.Bound<Meter> a; B.Bound<Meter> b;
            if (args[0] == "ab") { a=A.Api.BindHosts<Meter>(); b=B.Api.BindHosts<Meter>(); }
            else { b=B.Api.BindHosts<Meter>(); a=A.Api.BindHosts<Meter>(); }
            using (a) using (b) {
                var weak=UseLastOwner(b);
                Collect();
                if (weak.TryGetTarget(out _)) throw new Exception("last error payload still rooted after collection");
                if (a.Read(a.Make(41)) != 41) throw new Exception("declared error retired its peer");
            }
            Console.WriteLine("declared error outlived producer; peer updated last payload to 42; collected with peer still bound");
        }
        // Exercise the original scalar, callback-fault and tampering clients
        // unchanged against this very same relocated installation.
        Installed.Main(args);
    }
}
