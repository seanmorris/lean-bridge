    private static delegate* unmanaged[Cdecl]<nuint> Handoffs;
    private static readonly System.Collections.Generic.List<Exception> retainedFailures = new();
    private static int managedBefore, managedAfter, nativeBefore, nativeAfter;
    private static void TransferLifetimeFaults(bool native)
    {
        using var seed = Api.NewTicket(81, "transfer fault cleanup");
        var raw = Bundle(seed.Get()); using var closure = Api.MakeRecord(raw);
        Collect(); var live = Live(); var identities = Identities();
        bool finished = false;
        for (int index = 0; index < 2048; ++index)
        {
            using var owner = Api.CopyValue(raw);
            using var descendant = closure.Get().Invoke(false, owner);
            using var alias = owner.Share();
            var before = Handoffs(); Value<Bundle>? reply = null; Exception? failure = null;
            try
            {
                if (native) Fail(index); else remaining = index;
                reply = owner.MoveTwice(value => value, value => value);
                finished = true;
            }
            catch (OutOfMemoryException error) when (!native) { failure = error; }
            catch (LeanBridgeException error) when (native && error.Status == 3) { failure = error; }
            finally { remaining = -1; Fail(-1); }
            bool consumed = Handoffs() > before;
            Check(owner.IsClosed == consumed && descendant.IsClosed == consumed && alias.IsClosed == consumed,
                "callback transfer failure follows the measured native handoff");
            if (failure is not null)
            {
                retainedFailures.Add(failure);
                if (native) { if (consumed) nativeAfter++; else nativeBefore++; }
                else { if (consumed) managedAfter++; else managedBefore++; }
            }
            reply?.Dispose(); descendant.Dispose(); alias.Dispose(); owner.Dispose(); Runtime.Current.Require();
            Check(Live() == live && Identities() == identities,
                "failed callback transfer cleans up without GC while exceptions remain reachable");
            if (finished) break;
        }
        Check(finished, "callback transfer allocation sweep reached success");
        Check(native ? nativeBefore > 0 && nativeAfter > 0 : managedBefore > 0 && managedAfter > 0,
            "callback transfer failures exercise both sides of handoff");
        GC.KeepAlive(retainedFailures);
    }
