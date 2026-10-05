    private static void exercise() {
        try (var ticket = newTicket(BigInteger.valueOf(42), "A\0🌱")) {
            var payload = new Payload(BigInteger.valueOf(-19), new byte[] { 0, -1, 3 });
            var input = new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[] { ticket }, payload);
            var escaped = new Ticket[1]; var kept = new Ticket[1];
            var output = callbackRecord(input, borrowed -> {
                check(serial(borrowed.primary()).intValueExact() == 42, "callback borrows a real Lean resource");
                check(borrowed.payload().equals(payload), "callback preserves copied fields");
                escaped[0] = borrowed.primary(); kept[0] = borrowed.primary().retain(); return borrowed;
            });
            check(escaped[0].isClosed() && !kept[0].isClosed(), "borrow expires and explicit retain survives");
            reject(LeanBridgeException.class, () -> serial(escaped[0]));
            check(serial(output.primary()).intValueExact() == 42, "returned reply owns a new lease");
            check(output.primary() != kept[0] && output.primary() != ticket, "distinct public owners");
            drop(output); kept[0].close();
            var error = new IllegalStateException("original callback failure");
            int[] invoked = { 0 };
            try {
                twice(input, borrowed -> { invoked[0]++; throw error; });
                throw new AssertionError("missing callback failure");
            } catch (IllegalStateException observed) { check(observed == error, "original exception identity"); }
            check(invoked[0] == 1, "skip subsequent callbacks after failure");
            check(!ticket.isClosed(), "failed call preserves input ownership");
            reject(IllegalArgumentException.class, () -> callbackRecord(input, ignored -> null));
            reject(IllegalArgumentException.class, () -> factory(ignored -> ticket));
            try (var made = factory(OwnedCallbacks.withRecovery((FactoryArgument0ClosureCallback)(ignored -> ticket), ticket))) {
                check(serial(made).intValueExact() == 42, "explicit recovery callback returns owned resource");
            }
            try {
                factory(OwnedCallbacks.withRecovery((FactoryArgument0ClosureCallback)(ignored -> { throw error; }), ticket));
                throw new AssertionError("recovery leaked as a successful result");
            } catch (IllegalStateException observed) { check(observed == error, "recovery is withheld from caller"); }
            var constructed = construct(ticket, borrowed -> new Bundle(borrowed, Option.none(), new Ticket[0], new Ticket[0], payload));
            check(serial(constructed.primary()).intValueExact() == 42, "resource borrowed directly in callback");
            drop(constructed);
            Tree tree = new TreeBranch(new Tree[] { new TreeLeaf(ticket), new TreeBranch(new Tree[0]) });
            var returnedTree = callbackRecursive(tree, borrowed -> borrowed);
            check(returnedTree instanceof TreeBranch, "recursive callback result"); drop(returnedTree);
            try (var closure = identityClosure(Unit.INSTANCE); var returned = retainCallback(closure.asCallback())) {
                var result = callbackRecord(input, returned.asCallback());
                check(result.payload().equals(payload), "Lean closure passed directly as callback"); drop(result);
                var owned = returned.retain(); returned.close();
                result = owned.invoke(input); check(serial(result.primary()).intValueExact() == 42, "retained closure invocation");
                drop(result); owned.close();
            }
            int[] staleCalls = { 0 };
            try (var expired = retainCallback(borrowed -> { staleCalls[0]++; return borrowed; })) {
                try { expired.invoke(input); throw new AssertionError("expired host callback ran"); }
                catch (LeanBridgeException failure) { check(failure.status() == 10, "expired callback context rejects before upcall"); }
                check(staleCalls[0] == 0, "expired callback never enters Java");
            }
            try (var closure = makeRecord(input); var dispatch = dispatch(input)) {
                var result = closure.invoke(true, input);
                check(result.payload().equals(payload), "returned multi-argument closure"); drop(result);
                result = dispatch.invoke(borrowed -> borrowed);
                check(serial(result.primary()).intValueExact() == 42, "higher-order closure invokes host callback"); drop(result);
                try (var identity = identityClosure(Unit.INSTANCE)) {
                    result = dispatch.invoke(identity.asCallback());
                    check(result.payload().equals(payload), "higher-order closure accepts Lean callback"); drop(result);
                }
                try (var identity = identityClosure(Unit.INSTANCE)) {
                    result = dispatch.asCallback().invoke(identity);
                    check(result.payload().equals(payload), "higher-order asCallback direction"); drop(result);
                }
            }
            failures(() -> callbackRecord(input, borrowed -> borrowed));
            failures(() -> factory(OwnedCallbacks.withRecovery((FactoryArgument0ClosureCallback)(ignored -> ticket), ticket)));
            var excessive = (CallbackRecordArgument1ClosureCallback)(borrowed -> borrowed);
            for (int i = 0; i < 33; i++) excessive = OwnedCallbacks.withRecovery(excessive, input);
            var nesting = excessive;
            reject(_OwnedConvert.Limit.class, () -> callbackRecord(input, nesting));
            int[] bounded = { 0 };
            try {
                repeatedly(input, borrowed -> { bounded[0]++; return borrowed; }, BigInteger.valueOf(20000));
                throw new AssertionError("callback work was not bounded");
            } catch (RuntimeException failure) {
                check(failure instanceof _OwnedConvert.Limit || failure instanceof LeanBridgeException nativeFailure && nativeFailure.status() == 2,
                    "callback work fails at its managed or native conversion budget");
            }
            check(bounded[0] > 1 && bounded[0] < 20000, "callback count bounded before completion");
            var afterLimit = callbackRecord(input, borrowed -> borrowed);
            check(afterLimit.payload().equals(payload), "conversion budget failure remains recoverable"); drop(afterLimit);
        }
        var source = newTicket(BigInteger.TEN, "close while active");
        var input = new Bundle(source, Option.none(), new Ticket[0], new Ticket[0], new Payload(BigInteger.ZERO, new byte[0]));
        var result = callbackRecord(input, borrowed -> { source.close(); return borrowed; });
        check(source.isClosed() && serial(result.primary()).equals(BigInteger.TEN), "input pin survives close during callback"); drop(result);
        callbackThreads();
    }
    private static void callbackThreads() {
        long baseline = count(live), owners = count(identities);
        long expectedExits = count(exits);
        var held = new ArrayList<Ticket>(); var threads = new ArrayList<Thread>();
        for (int index = 0; index < 4; index++) {
            var failure = new Throwable[1];
            var thread = new Thread(() -> {
                try {
                    var ticket = newTicket(BigInteger.valueOf(71), "thread"); held.add(ticket);
                    var input = new Bundle(ticket, Option.none(), new Ticket[0], new Ticket[0], new Payload(BigInteger.ZERO, new byte[0]));
                    var output = callbackRecord(input, borrowed -> { held.add(borrowed.primary()); return borrowed; });
                    held.add(output.primary());
                } catch (Throwable error) { failure[0] = error; }
            });
            threads.add(thread); thread.start();
            try { thread.join(10000); } catch (InterruptedException error) { throw new AssertionError(error); }
            check(!thread.isAlive() && failure[0] == null, "creator thread finishes callback");
            awaitExit(++expectedExits, baseline, owners);
        }
        var entered = new java.util.concurrent.CountDownLatch(1);
        var interruption = new Throwable[1];
        var interrupted = new Thread(() -> {
            try {
                var ticket = newTicket(BigInteger.valueOf(81), "interrupted"); held.add(ticket);
                var input = new Bundle(ticket, Option.none(), new Ticket[0], new Ticket[0], new Payload(BigInteger.ZERO, new byte[0]));
                callbackRecord(input, borrowed -> {
                    held.add(borrowed.primary()); entered.countDown();
                    try { Thread.sleep(60000); } catch (InterruptedException error) { throw _OwnedRuntime.rethrow(error); }
                    return borrowed;
                });
            } catch (Throwable error) { interruption[0] = error; }
        });
        threads.add(interrupted); interrupted.start();
        try {
            check(entered.await(10, java.util.concurrent.TimeUnit.SECONDS), "callback reaches interruption point");
            interrupted.interrupt(); interrupted.join(10000);
        } catch (InterruptedException error) { throw new AssertionError(error); }
        check(!interrupted.isAlive() && interruption[0] instanceof InterruptedException, "interrupt contained before native return");
        awaitExit(++expectedExits, baseline, owners);
        for (var ticket : held) check(ticket.isClosed(), "held dead-thread wrapper is closed");
        java.lang.ref.Reference.reachabilityFence(held); java.lang.ref.Reference.reachabilityFence(threads);
    }
    private static void retirement() {
        try (var ticket = newTicket(BigInteger.ONE, "retired")) {
            var input = new Bundle(ticket, Option.none(), new Ticket[0], new Ticket[0], new Payload(BigInteger.ZERO, new byte[0]));
            status(7, () -> callbackRecord(input, borrowed -> { retireRuntime(); return borrowed; }));
            status(7, () -> serial(ticket));
        }
    }
