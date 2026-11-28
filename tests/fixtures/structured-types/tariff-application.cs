namespace DirectTariff
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using LeanBridge.TariffQuotes;

    internal static class Application
    {
        static void Check(bool ok)
        {
            if (!ok) throw new InvalidOperationException("unexpected public API result");
        }
        static void Expired(PackQuoteArgument0Closure quote, int status)
        {
            try { quote.Invoke(999); }
            catch (LeanBridgeException e) when (e.Status == status) { return; }
            throw new InvalidOperationException("expired registration accepted");
        }
        internal static void Run(Action<string> checkpoint)
        {
            Check(Api.FlatQuote((a,b) => a + b, 2, 3) == 5);
            checkpoint("baseline");
            var calls = new List<uint>();
            PackQuoteArgument0ClosureCallback price = n => { calls.Add(n); return 40 + n; };
            using (var expired = Api.PassApplicationQuote(price)) Expired(expired,10);
            Check(calls.Count == 0); checkpoint("expired");
            PackQuoteArgument0Closure? saved = null, alias = null;
            using (var fallback = Api.MakeTariff(800).Quote)
            {
                try {
                    uint result = Api.VisitApplicationQuote(price,(q,n) => {
                        saved = q; alias = q.Retain(); Check(q.Invoke(0) == 40);
                        using var live = Api.PassApplicationQuote(q.AsCallback);
                        StagedQuoteArgument0ClosureCallback reply = _ => live;
                        checkpoint("held");
                        return Api.StagedQuote(OwnedCallbacks.WithRecovery(reply,fallback),99,n);
                    },2);
                    Check(result == 42); Expired(saved!,4); Expired(alias!,10);
                } finally { saved?.Dispose(); alias?.Dispose(); }
            }
            checkpoint("forward");
            var original = new ApplicationException("inner price rejected");
            uint after = Api.VisitApplicationQuote(price,(outer,n) => {
                try {
                    Api.VisitApplicationQuote(_ => throw original,(inner,m) => inner.Invoke(m),99);
                    throw new InvalidOperationException("inner callback failure was swallowed");
                } catch (ApplicationException e) when (ReferenceEquals(e,original)) { return outer.Invoke(n); }
            },3);
            Check(after == 43 && calls.SequenceEqual(new uint[] {0,2,3}));
            checkpoint("nested");
#if DIRECT_TICKETS
            foreach (uint n in new uint[] {42,71})
            {
                using (var input = Api.NewTicket(n))
                using (var fallback = Api.NewTicket(800))
                using (var reply = Api.NewTicket(n+1))
                {
                    int hits = 0;
                    ExchangeTicketArgument1ClosureCallback exchange = t => {
                        ++hits; Check(Api.TicketSerial(t) == n); return reply;
                    };
                    Check(Api.ExchangeTicket(input,OwnedCallbacks.WithRecovery(exchange,fallback)) == n+1 && hits == 1);
                    ExchangeTicketArgument1ClosureCallback fail = t => {
                        Check(Api.TicketSerial(t) == n); throw original;
                    };
                    try {
                        Api.ExchangeTicket(input,OwnedCallbacks.WithRecovery(fail,fallback));
                        throw new InvalidOperationException("returned fallback instead of original exception");
                    } catch (ApplicationException e) when (ReferenceEquals(e,original)) { }
                    Check(Api.TicketSerial(input) == n && Api.TicketSerial(fallback) == 800);
                }
                checkpoint("ticket"+n);
            }
#endif
            using (var source = Api.MakeTariff(900).Quote)
            using (var kept = Api.PassApplicationQuote(source.AsCallback))
            {
                source.Dispose(); Check(kept.Invoke(6) == 906);
            }
            Check(Api.VisitApplicationQuote(price,(q,n) => q.Invoke(n),7) == 47);
            Check(calls.SequenceEqual(new uint[] {0,2,3,7})); checkpoint("fresh");
        }
    }
}
