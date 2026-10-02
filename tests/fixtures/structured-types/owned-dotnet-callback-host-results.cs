    private static void HostReplies()
    {
        using var seed = Api.NewTicket(42, "host"); var raw = Bundle(seed.Get());
        using var whole = Api.CopyValue(raw);
        Ticket? escaped = null, retained = null;
        using var first = Api.CallbackRecord(raw, OwnedCallbacks.WithRecovery(value => {
            escaped = value.Primary; retained = escaped.Retain();
            Check(Api.Serial(value.Primary) == 42, "host callback can reenter Lean");
            return value;
        }, raw));
        Check(Api.Serial(first.Get().Primary) == 42, "raw host reply is copied before frame expiration");
        Check(escaped!.IsClosed, "escaped host callback view expires");
        Expired(() => Api.Serial(escaped!));
        Check(Api.Serial(retained!) == 42, "explicitly retained host view survives");
        retained!.Dispose(); escaped!.Dispose();
        using var owned = Api.CallbackRecord(raw, OwnedCallbacks.WithRecovery(_value => whole, whole));
        whole.Dispose();
        Check(Api.Serial(owned.Get().Primary) == 42, "whole host reply has an independent published owner");
        try
        {
            Api.CallbackRecord(raw, OwnedCallbacks.WithRecovery(_value => whole, raw));
            throw new Exception("expired whole host reply was accepted");
        }
        catch (LeanBridgeException error) when (error.Status == 4) { checks++; }
        bool invoked = false;
        try
        {
            Api.CallbackRecord(raw, OwnedCallbacks.WithRecovery(value => { invoked = true; return value; }, whole));
            throw new Exception("expired recovery owner was accepted");
        }
        catch (LeanBridgeException error) when (error.Status == 4) { checks++; }
        Check(!invoked, "invalid recovery rejects before the callback");
        using var automatic = Api.CallbackRecord(raw, value => value);
        Check(Api.Serial(automatic.Get().Primary) == 42, "ordinary host delegate uses compiler-proven recovery");
        try
        {
            Api.CallbackRecord(raw, OwnedCallbacks.WithRecovery(_value => default(CallbackResult<Bundle>), raw));
            throw new Exception("uninitialized host reply was accepted");
        }
        catch (ArgumentException) { checks++; }
        var originalError = new InvalidOperationException("original callback exception");
        try
        {
            Api.CallbackRecord(raw, _value => throw originalError);
            throw new Exception("host exception was swallowed");
        }
        catch (InvalidOperationException error)
        { Check(ReferenceEquals(error, originalError), "host exception identity survives native cleanup"); }
        using var native = Api.MakeRecordCallback(raw);
        using var owner = Api.CopyValue(raw);
        using var invokedNative = native.Get().AsCallback.Invoke(owner);
        using var passed = Api.CallbackRecord(raw, native.Get().AsCallback);
        owner.Dispose(); native.Dispose();
        Check(invokedNative.IsClosed, "native AsCallback invocation follows its original argument owner");
        Check(Api.Serial(passed.Get().Primary) == 42, "native AsCallback passback needs no recovery delegate");
        Tree empty = new TreeBranch(Array.Empty<Tree>());
        using var emptyOwner = Api.CopyValue(empty);
        Tree? escapedEmpty = null;
        using var emptyReply = Api.CallbackRecursive(empty, value => { escapedEmpty = value; return emptyOwner; });
        emptyOwner.Dispose();
        Check(escapedEmpty is TreeBranch { Children.Length: 0 }, "host receives an ordinary empty payload");
        Check(emptyReply.Get() is TreeBranch { Children.Length: 0 }, "whole empty host reply survives conversion");
        using var treeNative = Api.MakeTreeCallback(empty);
        using var emptyPassed = Api.CallbackRecursive(empty, treeNative.Get().AsCallback);
        Check(emptyPassed.Get() is TreeBranch { Children.Length: 0 }, "empty native callback passback");
        using var nativeAgain = Api.MakeRecordCallback(raw);
        using var allHost = Api.ApplyTwice(raw, value => value, value => value);
        using var hostThenNative = Api.ApplyTwice(raw, value => value, nativeAgain.Get());
        using var nativeThenHost = Api.ApplyTwice(raw, nativeAgain.Get(), value => value);
        using var allNative = Api.ApplyTwice(raw, nativeAgain.Get(), nativeAgain.Get());
        foreach (var result in new[] { allHost, hostThenNative, nativeThenHost, allNative })
            Check(Api.Serial(result.Get().Primary) == 42, "mixed native/host export overloads preserve results");
        using var dispatch = Api.Dispatch(raw);
        using var hostDispatch = dispatch.Get().Invoke(value => value);
        using var nativeDispatch = dispatch.Get().Invoke(nativeAgain.Get().AsCallback);
        var rawDispatch = dispatch.Get().AsCallback(nativeAgain.Get());
        Check(Api.Serial(rawDispatch.Primary) == 42, "unanchored higher-order AsCallback preserves native inner identity");
        rawDispatch.Primary.Dispose(); rawDispatch.Spare.Value.Dispose();
        foreach (var value in rawDispatch.Peers) value.Dispose();
        foreach (var value in rawDispatch.History) value.Dispose();
        nativeAgain.Dispose(); dispatch.Dispose();
        Check(Api.Serial(hostDispatch.Get().Primary) == 42 && Api.Serial(nativeDispatch.Get().Primary) == 42,
            "higher-order Invoke publishes results from both callback overloads");
    }
    private static int HostFaults(bool managed, bool wholeReply)
    {
        using var seed = Api.NewTicket(11, "host-faults"); var raw = Bundle(seed.Get());
        using var whole = Api.CopyValue(raw);
        Collect(); var live = Live(); var identities = Identities(); int rejected = 0;
        for (int index = 0; index < 2048; ++index)
        {
            bool succeeded = false;
            try
            {
                if (managed) remaining = index; else Fail(index);
                using var result = Api.CallbackRecord(raw, OwnedCallbacks.WithRecovery(value => {
                    if (wholeReply) return whole;
                    return value;
                }, whole));
                Check(Api.Serial(result.Get().Primary) == 11, "host fault run preserves the callback result");
                succeeded = true;
            }
            catch (OutOfMemoryException) when (managed) { rejected++; }
            catch (LeanBridgeException error) when (!managed && error.Status == 3) { rejected++; }
            finally { remaining = -1; Fail(-1); }
            Collect();
            Check(Live() == live && Identities() == identities, "failed host publication leaves no owners");
            Check(!whole.IsClosed, "host reply conversion does not consume the supplied whole owner");
            if (succeeded) { Check(rejected > 0, "host allocation failures were exercised"); return rejected; }
        }
        throw new Exception("host callback fault injection never reached success");
    }
