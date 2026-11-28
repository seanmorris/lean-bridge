using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using LeanBridge.TariffQuotes;

internal static partial class Program
{
    static void Check(bool ok) { if (!ok) throw new InvalidOperationException("Wrong tariff value"); }
    static void Fails(Action action, int status)
    {
        try { action(); }
        catch (LeanBridgeException error) when (error.Status == status) { return; }
        throw new InvalidOperationException("Expected bridge status " + status);
    }
    // Test instrumentation only: observe the broker already loaded by the package.
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate void SnapshotRead(nint output);
    private static int Live()
    {
        var registry = (Dictionary<string, object>)AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet")!;
        var read = Marshal.GetDelegateForFunctionPointer<SnapshotRead>(
            NativeLibrary.GetExport((nint)registry["broker"], "lean_bridge_native_snapshot_read"));
        var buffer = Marshal.AllocHGlobal(40);
        try
        {
            read(buffer);
            Check(Marshal.ReadInt32(buffer) == 1);
            return Marshal.ReadInt32(buffer, 20);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    static readonly Dictionary<string, int> counters = new();
    static void Settled(string scenario)
    {
        int count = counters[scenario] = Live();
        if (count != counters["baseline"]) throw new Exception(scenario + ": identities " + count + ", expected " + counters["baseline"]);
    }
    static void Scenarios()
    {
        Check(Api.FlatQuote((a, b) => a + b, 2, 3) == 5);
        counters["baseline"] = Live();
        var original = Api.MakeTariff(40);
        using (var kept = original.Quote.Retain())
        {
            counters["held"] = Live();
            Check(counters["held"] > counters["baseline"]);
            original.Quote.Dispose();
            Check(kept.Invoke(2) == 42 && Api.ApplyTariff(new Tariff(kept), 3) == 43);
        }
        Settled("retain"); Console.WriteLine("explicitly retained field survives source disposal");

        var input = new Tariff(Api.MakeTariff(20).Quote);
        var output = Api.EchoTariff(input);
        input.Quote.Dispose();
        using (output.Quote) Check(output.Quote.Invoke(22) == 42 && Api.ApplyTariff(output, 5) == 25);
        Settled("echo"); Console.WriteLine("caller-built record crosses Lean");

        var source = Api.MakeTariff(36);
        var field = Api.UnpackQuote(source);
        source.Quote.Dispose();
        var repacked = Api.PackQuote(field.AsCallback);
        field.Dispose();
        using (repacked.Quote) Check(repacked.Quote.Invoke(6) == 42);
        Settled("repack"); Console.WriteLine("repacked function survives the input");

        int entries = 0;
        var expired = Api.PackQuote(n => { ++entries; return n; });
        using (expired.Quote)
        {
            Fails(() => expired.Quote.Invoke(1), 10);
            Fails(() => Api.ApplyTariff(expired, 1), 10);
            Check(entries == 0);
        }
        Settled("expired"); Console.WriteLine("ordinary delegate cannot escape through a field");

        var closed = Api.MakeTariff(7);
        closed.Quote.Dispose();
        Fails(() => Api.EchoTariff(closed), 4);
        Settled("closed"); Console.WriteLine("closed field rejected");

        using var recovery = Api.MakeTariff(1000).Quote;
        using var saved = Api.MakeTariff(39).Quote;
        StagedQuoteArgument0ClosureCallback choose = n => { Check(n == 9); return saved; };
        Check(Api.StagedQuote(OwnedCallbacks.WithRecovery(choose, recovery), 9, 3) == 42);
        Check(saved.Invoke(4) == 43 && recovery.Invoke(1) == 1001);
        Console.WriteLine("staged callback returns a native function");

        var originalError = new ApplicationException("price unavailable");
        StagedQuoteArgument0ClosureCallback broken = n => {
            using var temp = Api.MakeTariff(n).Quote;
            Check(temp.Invoke(2) == 11);
            throw originalError;
        };
        Exception? caught = null;
        try { Api.StagedQuote(OwnedCallbacks.WithRecovery(broken, recovery), 9, 3); }
        catch (ApplicationException e) { caught = e; }
        Check(ReferenceEquals(caught, originalError));
        Console.WriteLine("host exception retains identity");
        Check(Api.FlatQuote((a, b) => a * b, 6, 7) == 42 && saved.Invoke(3) == 42);
        saved.Dispose(); recovery.Dispose(); Settled("afterCallbackFailure");
        Console.WriteLine("binding reusable");
        HostInputCases();
    }
    static partial void HostInputCases();
    static void Main()
    {
        Exception? failed = null;
        var owner = new Thread(() => { try { Scenarios(); } catch (Exception e) { failed = e; } });
        owner.Start(); owner.Join();
        if (failed != null) throw new Exception("Owner thread failed", failed);
        if (!SpinWait.SpinUntil(() => Live() == 0, TimeSpan.FromSeconds(10)))
            throw new Exception("Owner thread exited with live identities: " + Live());
        counters["afterThreadExit"] = Live();
        File.WriteAllText("ownership-counts.json", JsonSerializer.Serialize(counters));
    }
}
