package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.reflect.Array;
import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.*;
import static java.lang.foreign.ValueLayout.*;

@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class OwnedTransferProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities, fail, handoffs, exits, exitErrors;
    private static int checks, remaining = -1;
    private static final List<Throwable> retainedFailures = new ArrayList<>();
    private static final List<Object> abandoned = new ArrayList<>();
    private static CountDownLatch entered;
    static void allocation() {
        if (remaining == 0) throw new OutOfMemoryError("injected managed failure");
        if (remaining > 0) --remaining;
    }
    public static synchronized void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        checks++;
    }
    public static <T extends Throwable> T reject(Class<T> expected, Runnable action) {
        try { action.run(); }
        catch (Throwable error) {
            if (!expected.isInstance(error)) throw new AssertionError("Expected " + expected.getName(), error);
            check(true, "expected exception"); return expected.cast(error);
        }
        throw new AssertionError("Expected " + expected.getName());
    }
    public static void status(int expected, Runnable action) {
        check(reject(LeanBridgeException.class, action).status() == expected, "native status " + expected);
    }
    private static long count(MethodHandle call) {
        try { return (long)call.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static long handoffs() { return count(handoffs); }
    private static void failAfter(long value) {
        try { fail.invokeExact(value); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static List<Object> children(Object value) {
        var result = new ArrayList<Object>();
        try {
            if (value.getClass().isArray()) {
                for (int index = 0; index < Array.getLength(value); index++) result.add(Array.get(value, index));
            } else if (value.getClass().isRecord()) {
                for (var field : value.getClass().getRecordComponents()) result.add(field.getAccessor().invoke(value));
            } else if (value.getClass().getPackageName().endsWith(".kotlin")) {
                for (var field : value.getClass().getFields())
                    if (!java.lang.reflect.Modifier.isStatic(field.getModifiers())) result.add(field.get(value));
            }
        } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
        return result;
    }
    public static List<Object> resources(Object root) {
        var result = new ArrayList<Object>();
        if (root == null) return result;
        var pending = new ArrayDeque<Object>(); pending.push(root);
        var seen = new IdentityHashMap<Object, Boolean>();
        while (!pending.isEmpty()) {
            Object value = pending.pop();
            if (seen.put(value, Boolean.TRUE) != null) continue;
            if (value instanceof _OwnedValue) result.add(value);
            else for (var child : children(value)) if (child != null) pending.push(child);
        }
        return result;
    }
    public static boolean closed(Object resource) {
        try { return (boolean)resource.getClass().getMethod("isClosed").invoke(resource); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    public static boolean allClosed(Object root) { return resources(root).stream().allMatch(OwnedTransferProbe::closed); }
    public static boolean allOpen(Object root) { return resources(root).stream().noneMatch(OwnedTransferProbe::closed); }
    public static void drop(Object root) {
        for (var resource : resources(root)) try { ((AutoCloseable)resource).close(); }
        catch (Exception error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static String semantic(Object value) {
        if (value == null) return "null";
        if (value instanceof Ticket ticket) return "ticket:" + serial(ticket) + ":" + label(ticket);
        if (value instanceof _OwnedKotlinTicket) return KotlinTransferProbe.INSTANCE.identity(value);
        if (value instanceof Double number) return "f64:" + Double.doubleToRawLongBits(number);
        if (value instanceof Float number) return "f32:" + Float.floatToRawIntBits(number);
        if (value instanceof String || value instanceof Number || value instanceof Boolean || value instanceof Unit) return value.toString();
        return value.getClass().getName() + "[" + String.join(";", children(value).stream().map(OwnedTransferProbe::semantic).toList()) + "]";
    }
    public static <T> void roundTrip(Supplier<T> make, Function<T, T> call) {
        var input = make.get(); var expected = semantic(input); var result = call.apply(input);
        check(semantic(result).equals(expected), "preserve tags, copied data and resource payloads");
        check(allClosed(input), "all represented input leases consumed");
        drop(input); drop(result);
    }
    public record FaultCase(Object input, Object extra, Object independent, Supplier<Object> call,
        BooleanSupplier consumed, BooleanSupplier extraConsumed, Runnable verifyRetained) { }
    public static int[] faults(Function<Boolean, FaultCase> make) {
        int[] observations = new int[8];
        long allocations = count(live), owners = count(identities);
        for (boolean multi : new boolean[] { false, true }) for (boolean nativeFailure : new boolean[] { false, true }) {
            boolean finished = false;
            for (int index = 0; index < 4000; index++) {
                var input = make.apply(multi); long before = handoffs(); Object output = null; Throwable failure = null;
                try {
                    if (nativeFailure) failAfter(index); else remaining = index;
                    output = input.call().get(); finished = true;
                } catch (OutOfMemoryError error) { if (nativeFailure) throw error; failure = error; }
                catch (LeanBridgeException error) { if (!nativeFailure || error.status() != 3) throw error; failure = error; }
                finally { remaining = -1; failAfter(-1); }
                boolean consumed = handoffs() > before;
                check(input.consumed().getAsBoolean() == consumed && (!multi || input.extraConsumed().getAsBoolean() == consumed), "failure follows actual native handoff");
                input.verifyRetained().run();
                if (failure != null) {
                    retainedFailures.add(failure);
                    observations[(multi ? 4 : 0) + (nativeFailure ? 2 : 0) + (consumed ? 1 : 0)]++;
                }
                drop(output); drop(input.input()); drop(input.extra()); drop(input.independent()); bindings.runtime.current().require();
                check(count(live) == allocations && count(identities) == owners, "explicit cleanup without GC " + multi + "/" + nativeFailure + "/" + index);
                if (finished) break;
            }
            check(finished, "allocation sweep completed");
        }
        return observations;
    }
    public static void visibleOnOtherThread(Object input) {
        var failure = new AtomicReference<Throwable>();
        var reader = new Thread(() -> {
            try { check(allClosed(input), "foreign-thread observer sees the consumed leases"); }
            catch (Throwable error) { failure.set(error); }
        });
        reader.start(); join(reader); if (failure.get() != null) throw _OwnedRuntime.rethrow(failure.get());
    }
    private static void join(Thread thread) {
        try { thread.join(10000); } catch (InterruptedException error) { throw new AssertionError(error); }
        check(!thread.isAlive(), "worker completed");
    }
    private static void awaitExit(long expected, long allocations, long owners) {
        for (int index = 0; index < 1000 && count(exits) < expected; index++) {
            try { Thread.sleep(5); } catch (InterruptedException error) { throw new AssertionError(error); }
        }
        check(count(exits) == expected && count(exitErrors) == 0, "native TLS cleanup completed");
        check(count(live) == allocations && count(identities) == owners, "thread exit releases transfer owners");
    }
    public static void foreign(Runnable call, BooleanSupplier preserved) {
        long baseline = count(live), owners = count(identities), completed = count(exits);
        var failure = new AtomicReference<Throwable>();
        var thread = new Thread(() -> { try { call.run(); } catch (Throwable error) { failure.set(error); } });
        thread.start(); join(thread);
        check(failure.get() instanceof LeanBridgeException error && error.status() == 5 && preserved.getAsBoolean(), "foreign thread cannot consume an owner");
        awaitExit(completed + 1, baseline, owners);
    }
    public static void pauseAfterMove(Object input) {
        abandoned.add(input); check(allClosed(input), "interrupted callback sees consumed input"); entered.countDown();
        try { Thread.sleep(Long.MAX_VALUE); } catch (InterruptedException error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static void interrupted(Runnable call) {
        long baseline = count(live), owners = count(identities), completed = count(exits);
        entered = new CountDownLatch(1); var failure = new AtomicReference<Throwable>();
        var thread = new Thread(() -> { try { call.run(); } catch (Throwable error) { failure.set(error); } });
        thread.start();
        try { check(entered.await(10, TimeUnit.SECONDS), "callback reached interruption point"); }
        catch (InterruptedException error) { throw new AssertionError(error); }
        thread.interrupt(); join(thread);
        check(failure.get() instanceof InterruptedException, "interrupt propagated after native cleanup");
        awaitExit(completed + 1, baseline, owners);
    }
    /* METHODS */
    private static Ticket ticket(int serial) { return newTicket(BigInteger.valueOf(serial), "native\u0000🙂"); }
    private static Bundle record() {
        var first = ticket(17); var second = ticket(23);
        return new Bundle(first, Option.some(second), new Ticket[] { first, second }, new Ticket[] { second }, new Payload(BigInteger.ONE.shiftLeft(180).negate(), new byte[] { 0, 127, -128, -1 }));
    }
    private static Tree tree(int depth) {
        Tree value = new TreeLeaf(ticket(17));
        for (int index = 0; index < depth; index++) value = new TreeBranch(new Tree[] { value });
        return value;
    }
    private static Chain chain(int depth) {
        Chain value = new ChainStop();
        for (int index = 0; index < depth; index++) value = new ChainLink(ticket(index), Option.some(value));
        return value;
    }
    private static Mixed mixed(boolean error) {
        var ticket = ticket(17);
        return new Mixed(ticket, new Option[] { Option.none(), Option.some(Option.none()), Option.some(Option.some(false)), Option.some(Option.some(true)) },
            Option.some(Unit.INSTANCE), error ? Result.err(ticket(31)) : Result.ok(record()), BigInteger.ONE.shiftLeft(180).negate(), BigInteger.ONE.shiftLeft(200), 0x1f642, -0.0, Float.POSITIVE_INFINITY,
            new byte[] { 0, 127, -128, -1 }, new BigInteger[] { BigInteger.ZERO, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE) },
            new Pair<>(ticket, new Pair<>(Option.some(ticket(32)), new Payload(BigInteger.valueOf(-2), new byte[] { 4 }))), chain(3));
    }
    private static void values() {
        var ticket = ticket(17); var alias = ticket; var kept = ticket.retain(); var received = retainTicket(ticket);
        check(alias.isClosed() && serial(received).intValueExact() == 17 && serial(kept).intValueExact() == 17, "aliases close and independent retains survive");
        status(4, () -> serial(alias)); drop(new Ticket[] { ticket, alias, kept, received });
        var input = record(); var bundle = echoRecord(input); drop(input); kept = bundle.spare().value().retain(); received = retainTicket(bundle.primary());
        check(allClosed(bundle) && serial(kept).intValueExact() == 23, "one leaf consumes the whole shared result owner"); drop(bundle); drop(kept); drop(received);
        roundTrip(() -> new Ticket[] { ticket(17), ticket(2) }, OwnedTransferProbe::echoArray);
        roundTrip(() -> new Ticket[0], OwnedTransferProbe::echoArray);
        roundTrip(() -> new Ticket[] { ticket(17), ticket(2) }, OwnedTransferProbe::echoList);
        roundTrip(() -> new Ticket[0], OwnedTransferProbe::echoList);
        roundTrip(() -> Option.some(ticket(17)), OwnedTransferProbe::echoOption);
        roundTrip(() -> Option.none(), OwnedTransferProbe::echoOption);
        roundTrip(() -> Result.ok(record()), OwnedTransferProbe::echoResult);
        roundTrip(() -> Result.err(ticket(17)), OwnedTransferProbe::echoResult);
        roundTrip(() -> new Pair<>(ticket(17), new Pair<>(Option.some(ticket(2)), new Payload(BigInteger.valueOf(-1), new byte[] { 5 }))), OwnedTransferProbe::echoTuple);
        roundTrip(OwnedTransferProbe::record, OwnedTransferProbe::echoRecord); roundTrip(OwnedTransferProbe::record, OwnedTransferProbe::echoAlias);
        for (Supplier<Choice> make : List.<Supplier<Choice>>of(() -> new ChoiceEmpty(), () -> new ChoiceOne(ticket(17)), () -> new ChoicePair(ticket(17), ticket(2)), () -> new ChoiceMany(new Ticket[] { ticket(17), ticket(2) }), () -> new ChoiceMany(new Ticket[0]))) roundTrip(make, OwnedTransferProbe::echoVariant);
        roundTrip(() -> new Option[] { Option.none(), Option.some(ticket(17)), Option.none() }, OwnedTransferProbe::echoRow);
        roundTrip(() -> tree(30), OwnedTransferProbe::echoRecursive); roundTrip(() -> new TreeBranch(new Tree[0]), OwnedTransferProbe::echoRecursive);
        roundTrip(() -> new Option[][] { new Option[0], { Option.none(), Option.some(Result.ok(record())), Option.some(Result.err(ticket(17))) } }, OwnedTransferProbe::echoNested);
        roundTrip(() -> chain(30), OwnedTransferProbe::echoChain); roundTrip(() -> new ChainStop(), OwnedTransferProbe::echoChain);
        roundTrip(() -> new ChainLink(ticket(17), Option.none()), OwnedTransferProbe::echoChain);
        roundTrip(() -> mixed(false), OwnedTransferProbe::echoMixed); roundTrip(() -> mixed(true), OwnedTransferProbe::echoMixed);
        ticket = ticket(17); var duplicate = echoArray(new Ticket[] { ticket, ticket }); check(ticket.isClosed() && serial(duplicate[1]).intValueExact() == 17, "duplicate within one consuming argument"); drop(ticket); drop(duplicate);
        var first = ticket(17); var second = ticket(29); var borrowed = ticket(31);
        bundle = bundle(first, Option.some(borrowed), new Ticket[] { second }, new Ticket[] { borrowed }, new Payload(BigInteger.valueOf(5), new byte[0]));
        check(first.isClosed() && second.isClosed() && !borrowed.isClosed() && serial(bundle.peers()[0]).intValueExact() == 29, "only declared inputs consumed"); drop(bundle); drop(new Ticket[] { first, second, borrowed });
    }
    private static void validation() {
        try (var ticket = ticket(17)) {
            long before = handoffs();
            status(1, () -> bundle(ticket, Option.none(), new Ticket[] { ticket }, new Ticket[0], new Payload(BigInteger.ZERO, new byte[0])));
            reject(IllegalArgumentException.class, () -> echoArray(new Ticket[] { ticket, null }));
            var deep = tree(130); reject(_OwnedConvert.Limit.class, () -> echoRecursive(deep)); check(allOpen(deep), "depth rejection preserves ownership"); drop(deep);
            var cyclic = new Tree[1]; cyclic[0] = new TreeBranch(cyclic); reject(IllegalArgumentException.class, () -> echoRecursive(cyclic[0]));
            check(handoffs() == before && serial(ticket).intValueExact() == 17, "validation does not consume inputs");
        }
    }
    private static void callbacks() {
        var input = record(); var escaped = new Ticket[2];
        var received = callbackRecord(input, borrowed -> {
            System.gc(); check(allClosed(input), "callback sees consumed aliases after GC"); visibleOnOtherThread(input);
            escaped[0] = borrowed.primary(); status(1, () -> retainTicket(borrowed.primary()));
            try (var independent = borrowed.primary().retain()) { escaped[1] = retainTicket(independent); check(independent.isClosed(), "retained callback borrow transfers"); }
            var nested = record(); var reply = echoRecord(nested); drop(nested); drop(reply); return borrowed;
        });
        check(escaped[0].isClosed() && serial(escaped[1]).intValueExact() == 17, "borrow expires and independent owner survives"); drop(input); drop(received); drop(escaped);
        var failed = record(); var sentinel = new IllegalStateException("same callback error");
        check(reject(IllegalStateException.class, () -> callbackRecord(failed, value -> { throw sentinel; })) == sentinel && allClosed(failed), "post-handoff exception identity"); drop(failed);
        var tree = tree(3); var echoed = callbackRecursive(tree, value -> value); check(allClosed(tree), "recursive callback consumes"); drop(tree); drop(echoed);
        var captured = record(); var expected = semantic(captured);
        try (var closure = makeRecord(captured)) {
            check(allClosed(captured), "capture consumes input"); drop(captured); var supplied = record(); received = closure.invoke(true, supplied);
            check(semantic(received).equals(expected) && allOpen(supplied), "closure invocation still borrows"); drop(supplied); drop(received);
        }
        tree = tree(3);
        try (var closure = makeRecursive(tree)) { drop(tree); var supplied = tree(2); echoed = closure.invoke(true, supplied); drop(supplied); drop(echoed); }
        try (var identity = newRecordCallback(); var kept = identity.retain(); var moved = transferCallback(identity)) {
            check(identity.isClosed() && !kept.isClosed(), "closure identity transfer"); var supplied = record(); received = moved.invoke(supplied);
            check(semantic(received).equals(semantic(supplied)), "transferred closure remains callable"); drop(supplied); drop(received);
        }
    }
    private static int[] exercise() {
        values(); validation(); callbacks();
        var observations = faults(multi -> {
            var input = record(); var extra = ticket(29); var kept = input.primary().retain();
            return new FaultCase(input, extra, kept, () -> multi ? bundle(input.primary(), Option.none(), new Ticket[] { extra }, new Ticket[0], input.payload()) : callbackRecord(input, value -> value),
                input.primary()::isClosed, extra::isClosed, () -> check(serial(kept).intValueExact() == 17, "fault preserves independent retain"));
        });
        try (var ticket = ticket(17)) { foreign(() -> retainTicket(ticket), () -> !ticket.isClosed()); }
        interrupted(() -> { var input = record(); callbackRecord(input, borrowed -> { pauseAfterMove(input); return borrowed; }); });
        return observations;
    }
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); bindings = new _OwnedBindings(symbols, () -> { }); var linker = Linker.nativeLinker();
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            handoffs = linker.downcallHandle(symbols.find("probe_handoffs").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            fail = linker.downcallHandle(symbols.find("probe_fail").orElseThrow(), FunctionDescriptor.ofVoid(JAVA_LONG));
            exits = linker.downcallHandle(symbols.find("probe_exits").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            exitErrors = linker.downcallHandle(symbols.find("probe_exit_errors").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current().require(); long baseline = count(live), owners = count(identities);
            int[] javaFaults = exercise(); check(count(live) == baseline && count(identities) == owners, "Java explicitly releases all owners"); int javaChecks = checks;
            int[] kotlinFaults = KotlinTransferProbe.INSTANCE.run(); check(count(live) == baseline && count(identities) == owners, "Kotlin explicitly releases all owners"); int kotlinChecks = checks - javaChecks;
            bindings.runtime.current().close(); check(count(live) == 0 && count(identities) == 0, "no tracked allocations or identities remain");
            java.lang.ref.Reference.reachabilityFence(retainedFailures); java.lang.ref.Reference.reachabilityFence(abandoned);
            System.out.println("{\"javaChecks\":" + javaChecks + ",\"kotlinChecks\":" + kotlinChecks + ",\"javaFaults\":" + Arrays.toString(javaFaults) + ",\"kotlinFaults\":" + Arrays.toString(kotlinFaults) + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + ",\"threadExits\":" + count(exits) + ",\"threadExitErrors\":" + count(exitErrors) + "}");
        }
    }
}
