    private static Action? wholeReadHook, allocationHook;
    private static WeakReference? temporaryGuard;
    private static int lifetimeCollections, exitedThreads, concurrentReads;
    internal static void AfterWholeReadCheck()
    {
        var hook = wholeReadHook; wholeReadHook = null; hook?.Invoke();
    }
    private static void CollectTemporary()
    {
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        lifetimeCollections++;
        Check(temporaryGuard is not null && temporaryGuard.IsAlive,
            "temporary callback-result guard remains alive during operation");
    }
    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private static Value<Tree> TemporaryResult(Func<Value<Tree>> factory, bool reading)
    {
        var result = factory(); temporaryGuard = new WeakReference(result.Guard);
        if (reading) wholeReadHook = CollectTemporary; else allocationHook = CollectTemporary;
        return result;
    }
    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private static (WeakReference, Value<Tree>, Value<Tree>, Value<Tree>) AbandonCallbackOwner(Tree raw)
    {
        var owner = Api.CopyValue(raw);
        using var closure = Api.MakeRecursive(raw);
        var result = closure.Get().Invoke(false, owner);
        var descendant = closure.Get().Invoke(false, result);
        return (new WeakReference(owner), result, descendant, descendant.Retain());
    }
    private static void CallbackLifetimeOwners()
    {
        foreach (bool populated in new[] { false, true })
        {
            using var seed = Api.NewTicket(92, "collected callback owner");
            Tree raw = populated ? new TreeBranch(new Tree[] { new TreeLeaf(seed.Get()) })
                : new TreeBranch(Array.Empty<Tree>());
            var (weak, result, descendant, retained) = AbandonCallbackOwner(raw);
            Collect();
            Check(!weak.IsAlive && result.IsClosed && descendant.IsClosed,
                "callback descendants do not keep an abandoned original owner alive");
            Expired(() => result.Get()); Expired(() => descendant.Get());
            Check(retained.Get() is TreeBranch branch && branch.Children.Length == (populated ? 1 : 0),
                "explicit retain survives original owner collection");
            result.Dispose(); descendant.Dispose(); retained.Dispose();
            using var owner = Api.CopyValue(raw);
            using var closure = Api.MakeRecursive(raw);
            using var view = closure.Get().Invoke(false, owner);
            var closer = new Thread(owner.Dispose); closer.Start();
            Check(closer.Join(TimeSpan.FromSeconds(10)), "foreign owner disposal completed");
            Runtime.Current.Require();
            Check(view.IsClosed, "foreign disposal expires callback results after creator drain");
            Expired(() => view.Get());
            GC.KeepAlive(closer);
        }
        Tree empty = new TreeBranch(Array.Empty<Tree>());
        using var original = Api.CopyValue(empty);
        using var factory = Api.MakeRecursive(empty);
        Func<Value<Tree>> make = () => factory.Get().Invoke(false, original);
        for (int index = 0; index < 3; ++index)
        {
            TemporaryResult(make, true).Get();
            using var retained = TemporaryResult(make, false).Retain();
            using var shared = TemporaryResult(make, false).Share();
            Check(retained.Get() is TreeBranch { Children.Length: 0 }
                && shared.Get() is TreeBranch { Children.Length: 0 }, "temporary anchored results remain usable");
        }
        Check(lifetimeCollections == 9, "all callback-result GC schedules ran");
        using var closing = factory.Get().Invoke(false, original);
        wholeReadHook = () => {
            var thread = new Thread(closing.Dispose); thread.Start();
            Check(thread.Join(TimeSpan.FromSeconds(10)), "concurrent callback-result close completed");
        };
        try
        {
            Check(closing.Get() is TreeBranch { Children.Length: 0 },
                "callback-result read preserves its validated snapshot during close");
            Expired(() => closing.Get()); concurrentReads++;
        }
        finally { wholeReadHook = null; }
        Check(!original.IsClosed, "closing a callback result does not close its original owner");
        Collect(); var live = Live(); var identities = Identities();
        for (int index = 0; index < 4; ++index)
        {
            Value<Tree>? escapedOwner = null, escapedResult = null, escapedRetain = null;
            var worker = new Thread(() => {
                escapedOwner = Api.CopyValue(empty);
                using var closure = Api.MakeRecursive(empty);
                escapedResult = closure.Get().Invoke(false, escapedOwner);
                escapedRetain = escapedResult.Retain();
            });
            worker.Start(); Check(worker.Join(TimeSpan.FromSeconds(10)), "callback owner creator exited");
            Check(escapedOwner!.IsClosed && escapedResult!.IsClosed && escapedRetain!.IsClosed,
                "creator thread exit expires callback results and explicit retains");
            Expired(() => escapedOwner!.Get()); Expired(() => escapedResult!.Get());
            Expired(() => escapedRetain!.Get());
            escapedOwner!.Dispose(); escapedResult!.Dispose(); escapedRetain!.Dispose();
            Check(Live() == live && Identities() == identities,
                "creator exit drains callback owners while the Thread object remains reachable");
            GC.KeepAlive(worker); exitedThreads++;
        }
    }
