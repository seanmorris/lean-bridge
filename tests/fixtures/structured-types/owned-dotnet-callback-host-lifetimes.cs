    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private static CallbackResult<Tree> TemporaryHostReply(Tree value)
    {
        var owner = Api.CopyValue(value);
        temporaryGuard = new WeakReference(owner.Guard);
        wholeReadHook = CollectTemporary;
        return owner;
    }
    private static void HostLifetimeOwners()
    {
        Tree empty = new TreeBranch(Array.Empty<Tree>());
        for (int index = 0; index < 3; ++index)
        {
            using var reply = Api.CallbackRecursive(empty, value => TemporaryHostReply(value));
            Collect();
            Check(!temporaryGuard!.IsAlive, "temporary host reply owner is not retained by the callback frame");
            Check(reply.Get() is TreeBranch { Children.Length: 0 },
                "whole host reply survives collection of its temporary source owner");
        }
        Check(lifetimeCollections == 12, "all temporary host reply GC schedules ran");
        using var expired = Api.CopyValue(empty); expired.Dispose();
        Expired(() => Api.CallbackRecursive(empty, _value => expired));
        bool called = false;
        Expired(() => Api.CallbackRecursive(empty, OwnedCallbacks.WithRecovery(value => {
            called = true; return value;
        }, expired)));
        Check(!called, "expired empty recovery is rejected before calling the host");
        using var seed = Api.NewTicket(82, "callback disposal");
        using var anchor = Api.CopyValue(Bundle(seed.Get()));
        using var closure = Api.MakeRecord(anchor.Get());
        using var borrowed = closure.Get().Invoke(false, anchor);
        using var kept = borrowed.Retain();
        var originalError = new InvalidOperationException("callback closes its reply anchor");
        try
        {
            Api.CallbackRecord(borrowed.Get(), _value => {
                anchor.Dispose();
                Check(borrowed.IsClosed, "reentrant host close expires an anchored callback result");
                throw originalError;
            });
            throw new Exception("callback exception was swallowed");
        }
        catch (InvalidOperationException error)
        { Check(ReferenceEquals(error, originalError), "host close preserves the original exception"); }
        Check(Api.Serial(kept.Get().Primary) == 82, "retained result survives host-side anchor close");
    }
