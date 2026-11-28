namespace DirectTariff
{
    using System;
    using LeanBridge.TariffQuotes;

    // Consumer code uses only the generated public API.
    internal static class Application
    {
        static void Check(bool value)
        {
            if (!value) throw new InvalidOperationException("wrong callback observation");
        }
        static void Expired(Action call)
        {
            try { call(); }
            catch (LeanBridgeException e) when (e.Status == 4) { return; }
            throw new InvalidOperationException("accepted an expired view");
        }
        internal static void Run(Action<string> checkpoint)
        {
            Check(Api.FlatQuote((a,b) => a+b, 2, 3) == 5);
            checkpoint("baseline");
            foreach (bool keep in new[] {false,true}) foreach (bool fail in new[] {false,true})
            {
                PackQuoteArgument0Closure? borrowed = null, retained = null;
                var original = new ApplicationException("application rejected quote");
                try
                {
                    var result = Api.VisitQuote(40, (quote,n) => {
                        Check(borrowed == null && quote.Invoke(n) == 42);
                        borrowed = quote;
                        if (keep) {
                            retained = quote.Retain();
                            Check(quote.SameIdentity(retained) && retained.Equals(quote));
                        }
                        if (fail) throw original;
                        return quote.Invoke(n);
                    }, 2);
                    Check(!fail && result == 42);
                }
                catch (ApplicationException e) { Check(fail && ReferenceEquals(e,original)); }
                Expired(() => borrowed!.Invoke(1));
                if (keep) {
                    Expired(() => borrowed!.SameIdentity(retained!));
                    if (!fail) checkpoint("held");
                    borrowed!.Dispose();
                    Check(retained!.Invoke(5) == 45);
                    retained.Dispose(); Expired(() => retained.Invoke(1));
                } else borrowed!.Dispose();
                checkpoint(keep ? (fail ? "errorLease" : "lease") : (fail ? "error" : "success"));
            }
            var innerFailure = new ApplicationException("inner refused");
            PackQuoteArgument0Closure? inner = null;
            var total = Api.VisitQuote(30, (outer,n) => {
                try {
                    Api.VisitQuote(90, (other,m) => {
                        Check(!outer.SameIdentity(other) && other.Invoke(m) == 93);
                        inner = other;
                        throw innerFailure;
                    }, 3);
                    throw new InvalidOperationException("lost inner failure");
                } catch (ApplicationException e) { Check(ReferenceEquals(e,innerFailure)); }
                Expired(() => inner!.Invoke(1)); inner!.Dispose();
                return outer.Invoke(n);
            }, 4);
            Check(total == 34); checkpoint("nested");
            Check(Api.VisitQuote(1, (q,n) => q.Invoke(n), 5) == 6);
            Check(Api.VisitQuote(60, (q,n) => q.Invoke(n), 3) == 63); checkpoint("fresh");
        }
    }
}
