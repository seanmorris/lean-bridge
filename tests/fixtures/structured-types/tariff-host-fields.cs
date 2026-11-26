internal static partial class Program
{
    static partial void HostInputCases()
    {
        int calls = 0;
        var local = new TariffInput(n => n + (uint)++calls + 39);
        GC.Collect();
        Check(Api.ApplyTariffWithHostFields(local, 2) == 42);
        Check(Api.ApplyTariffWithHostFields(local, 2) == 43 && calls == 2);
        Settled("host-capture"); Console.WriteLine("delegate field captures managed state across two calls");

        int inner = 0;
        var nested = new TariffInput(n => Api.ApplyTariffWithHostFields(new TariffInput(x => { ++inner; return x + 40; }), n));
        Check(Api.ApplyTariffWithHostFields(nested, 2) == 42 && inner == 1);
        Settled("host-nested"); Console.WriteLine("nested calls have distinct input frames");

        using (var escaped = Api.EchoTariffWithHostFields(local).Quote) Fails(() => escaped.Invoke(3), 10);
        using (var escaped = Api.UnpackQuoteWithHostFields(local)) Fails(() => escaped.Invoke(3), 10);
        Check(calls == 2);
        Settled("host-expired"); Console.WriteLine("escaped field and direct result refuse a late delegate");

        var original = new ApplicationException("host field failed");
        Exception? caught = null;
        try { Api.ApplyTariffWithHostFields(new TariffInput(_ => throw original), 2); }
        catch (ApplicationException e) { caught = e; }
        Check(ReferenceEquals(original, caught) && Api.ApplyTariffWithHostFields(local, 2) == 44);
        Settled("host-error"); Console.WriteLine("original delegate exception and healthy retry");

        var source = Api.MakeTariff(40);
        TariffInput fromLease = source;
        using (var preserved = Api.EchoTariffWithHostFields(fromLease).Quote)
        {
            source.Quote.Dispose();
            Check(preserved.Invoke(2) == 42);
            Fails(() => Api.ApplyTariffWithHostFields(fromLease, 1), 4);
        }
        Settled("host-lease"); Console.WriteLine("genuine Lean field survives its source and rejects a closed input");
        bool invalid = false;
        try { Api.ApplyTariffWithHostFields(null!, 1); } catch (ArgumentNullException) { invalid = true; }
        Check(invalid && calls == 3 && inner == 1);
        Settled("host-validation"); Console.WriteLine("invalid input rejected before dispatch");
    }
}
