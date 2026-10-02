    private static void CombinedOwners()
    {
        using var seed = Api.NewTicket(63, "receiver"); var raw = Bundle(seed.Get());
        using var owner = Api.CopyValue(raw);
        using var alias = owner.Share();
        using var independent = owner.Retain();
        using var borrowed = owner.BorrowRecord();
        using var closure = owner.MakeRecord();
        using var descendant = closure.Get().Invoke(false, owner);
        using var nested = closure.Get().Invoke(false, descendant);
        using var retainedDescendant = nested.Retain();
        using var native = Api.MakeRecordCallback(raw);
        try
        {
            borrowed.MoveRecord(value => value);
            throw new Exception("borrowed receiver was consumed");
        }
        catch (LeanBridgeException error) when (error.Status == 1) { checks++; }
        Check(!owner.IsClosed && !borrowed.IsClosed && !nested.IsClosed, "rejected borrowed transfer preserves owners");
        using var expiredRecovery = Api.CopyValue(raw); expiredRecovery.Dispose();
        bool invoked = false;
        try
        {
            owner.MoveRecord(OwnedCallbacks.WithRecovery(value => { invoked = true; return value; }, expiredRecovery));
            throw new Exception("invalid recovery owner crossed handoff");
        }
        catch (LeanBridgeException error) when (error.Status == 4) { checks++; }
        Check(!invoked && !owner.IsClosed && !alias.IsClosed, "recovery validation precedes original-owner handoff");
        using var moved = owner.MoveRecord(value => value);
        Check(owner.IsClosed && alias.IsClosed && borrowed.IsClosed && descendant.IsClosed && nested.IsClosed,
            "consuming receiver invalidates the original owner and all anchored descendants");
        Check(Api.Serial(moved.Get().Primary) == 63 && Api.Serial(independent.Get().Primary) == 63
            && Api.Serial(retainedDescendant.Get().Primary) == 63, "independent owners survive consuming callback handoff");
        using var nativeOwner = Api.CopyValue(raw);
        using var nativeMoved = nativeOwner.MoveRecord(native.Get().AsCallback);
        Check(nativeOwner.IsClosed && Api.Serial(nativeMoved.Get().Primary) == 63, "receiver overload passes native identity at handoff");
        for (int mode = 0; mode < 4; ++mode)
        {
            using var receiver = Api.CopyValue(raw);
            using var result = mode switch {
                0 => receiver.MoveTwice(value => value, value => value),
                1 => receiver.MoveTwice(native.Get(), value => value),
                2 => receiver.MoveTwice(value => value, native.Get()),
                _ => receiver.MoveTwice(native.Get(), native.Get())
            };
            Check(receiver.IsClosed && Api.Serial(result.Get().Primary) == 63, "mixed receiver overloads consume the original owner");
        }
        using var failedOwner = Api.CopyValue(raw);
        using var failedAlias = failedOwner.Share();
        using var failedChild = closure.Get().Invoke(false, failedOwner);
        var originalError = new InvalidOperationException("receiver callback failed");
        try
        {
            failedOwner.MoveTwice(value => value, _value => throw originalError);
            throw new Exception("post-handoff exception was swallowed");
        }
        catch (InvalidOperationException error)
        { Check(ReferenceEquals(error, originalError), "post-handoff callback exception preserves identity"); }
        Check(failedOwner.IsClosed && failedAlias.IsClosed && failedChild.IsClosed, "post-handoff failure keeps original owner consumed");
    }
