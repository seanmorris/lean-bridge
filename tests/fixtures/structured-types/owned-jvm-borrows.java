package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;
import static java.lang.foreign.ValueLayout.*;

@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class OwnedBorrowProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities, handoffs, fail, exits, exitErrors;
    private static int checks, remaining = -1;
    private static final List<Throwable> retainedFailures = new ArrayList<>();
    private static Runnable wholeReadHook;
    static void afterWholeReadCheck() {
        var hook = wholeReadHook; wholeReadHook = null;
        if (hook != null) hook.run();
    }
    static void allocation() {
        if (remaining == 0) throw new OutOfMemoryError("injected managed failure");
        if (remaining > 0) --remaining;
    }
    public static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    public static <T extends Throwable> T reject(Class<T> type, Runnable call) {
        try { call.run(); }
        catch (Throwable error) {
            if (!type.isInstance(error)) throw new AssertionError("Expected " + type.getName(), error);
            check(true, "expected exception"); return type.cast(error);
        }
        throw new AssertionError("Expected " + type.getName());
    }
    public static void status(int expected, Runnable call) {
        check(reject(LeanBridgeException.class, call).status() == expected, "status " + expected);
    }
    private static long count(MethodHandle function) {
        try { return (long)function.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static void failAfter(long value) {
        try { fail.invokeExact(value); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    /* METHODS */
    static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-17), new byte[] { 0, -1 }));
    }
    private static <T> void shape(T raw, Function<T, Value<T>> copy, Function<Value<T>, Value<T>> borrow) {
        try (var original = copy.apply(raw); var view = borrow.apply(original);
             var deeper = borrow.apply(view); var independent = view.retain()) {
            check(view.equals(original) && deeper.equals(view), "canonical whole-value equality");
            original.close();
            check(view.isClosed() && deeper.isClosed(), "transitive original-owner expiration");
            status(4, view::get); status(4, () -> deeper.equals(deeper));
            check(!independent.isClosed(), "independent retained owner"); independent.get();
        }
    }
    private static void shapes() {
        try (var seed = newTicket(BigInteger.valueOf(42), "whole\0🙂")) {
            var ticket = seed.get(); var bundle = bundle(ticket);
            shape(bundle, OwnedBorrowProbe::copyEchoRecordResult, OwnedBorrowProbe::echoRecord);
            shape(bundle, OwnedBorrowProbe::copyEchoAliasResult, OwnedBorrowProbe::echoAlias);
            shape(new Ticket[0], OwnedBorrowProbe::copyEchoArrayResult, OwnedBorrowProbe::echoArray);
            shape(new Ticket[] { ticket, ticket }, OwnedBorrowProbe::copyEchoArrayResult, OwnedBorrowProbe::echoArray);
            shape(new Ticket[0], OwnedBorrowProbe::copyEchoListResult, OwnedBorrowProbe::echoList);
            shape(new Ticket[] { ticket }, OwnedBorrowProbe::copyEchoListResult, OwnedBorrowProbe::echoList);
            shape(Option.<Ticket>none(), OwnedBorrowProbe::copyEchoOptionResult, OwnedBorrowProbe::echoOption);
            shape(Option.some(ticket), OwnedBorrowProbe::copyEchoOptionResult, OwnedBorrowProbe::echoOption);
            shape(Result.<Bundle, Ticket>ok(bundle), OwnedBorrowProbe::copyEchoResultResult, OwnedBorrowProbe::echoResult);
            shape(Result.<Bundle, Ticket>err(ticket), OwnedBorrowProbe::copyEchoResultResult, OwnedBorrowProbe::echoResult);
            shape(new Pair<>(ticket, new Pair<>(Option.<Ticket>none(), bundle.payload())), OwnedBorrowProbe::copyEchoTupleResult, OwnedBorrowProbe::echoTuple);
            for (Choice choice : new Choice[] { new ChoiceEmpty(), new ChoiceOne(ticket), new ChoicePair(ticket, ticket), new ChoiceMany(new Ticket[0]), new ChoiceMany(new Ticket[] { ticket }) })
                shape(choice, OwnedBorrowProbe::copyEchoVariantResult, OwnedBorrowProbe::echoVariant);
            shape(new Option[] { Option.none(), Option.some(ticket) }, OwnedBorrowProbe::copyEchoRowResult, OwnedBorrowProbe::echoRow);
            shape(new Option[0], OwnedBorrowProbe::copyEchoRowResult, OwnedBorrowProbe::echoRow);
            Tree tree = new TreeLeaf(ticket);
            for (int index = 0; index < 12; index++) tree = new TreeBranch(new Tree[] { tree });
            shape(tree, OwnedBorrowProbe::copyEchoRecursiveResult, OwnedBorrowProbe::echoRecursive);
            shape(new TreeBranch(new Tree[0]), OwnedBorrowProbe::copyEchoRecursiveResult, OwnedBorrowProbe::echoRecursive);
            shape(new Option[0][], OwnedBorrowProbe::copyEchoNestedResult, OwnedBorrowProbe::echoNested);
            shape(new Option[][] { new Option[0], { Option.some(Result.ok(bundle)) } }, OwnedBorrowProbe::copyEchoNestedResult, OwnedBorrowProbe::echoNested);
            try (var original = copyEchoRecordResult(bundle); var shared = original.share(); var view = echoRecord(original)) {
                var raw = original.get().primary();
                try (var kept = raw.retain()) {
                    check(raw.sameIdentity(kept) && raw.equals(kept), "resource equality uses native identity");
                    original.close(); check(!view.isClosed(), "shared guard keeps original owner live");
                    shared.close(); check(view.isClosed(), "last guard expires descendants");
                    status(4, () -> serial(raw)); status(4, () -> raw.equals(raw));
                    check(serial(kept).intValueExact() == 42, "independent resource survives");
                    reject(UnsupportedOperationException.class, kept::hashCode);
                    reject(UnsupportedOperationException.class, view::hashCode);
                }
            }
        }
    }
    private static void callbacks() {
        try (var seed = newTicket(BigInteger.valueOf(42), "callback"); var original = copyEchoRecordResult(bundle(seed.get()))) {
            var escaped = new Ticket[2];
            try (var reply = callbackRecord(original, value -> {
                escaped[0] = value.primary(); escaped[1] = escaped[0].retain(); return value;
            }); var closure = makeRecord(original); var kept = closure.retain();
                 var direct = closure.get().invoke(true, bundle(seed.get()))) {
                check(serial(reply.get().primary()).intValueExact() == 42 && escaped[0].isClosed(), "callback borrow expires");
                status(4, () -> serial(escaped[0]));
                check(serial(escaped[1]).intValueExact() == 42, "callback explicit retention");
                escaped[0].close(); escaped[1].close();
                check(serial(direct.get().primary()).intValueExact() == 42, "closure returns whole value");
                var rawReply = closure.get().asCallback().invoke(true, bundle(seed.get()));
                check(serial(rawReply.primary()).intValueExact() == 42, "host callback keeps its raw result signature");
                rawReply.primary().close(); rawReply.spare().value().close();
                for (var resource : rawReply.peers()) resource.close();
                for (var resource : rawReply.history()) resource.close();
                original.close(); status(4, closure::get); status(4, reply::get);
                try (var independent = kept.get().invoke(true, bundle(seed.get()))) {
                    check(serial(independent.get().primary()).intValueExact() == 42, "retained closure remains callable");
                }
            }
        }
    }
    private static void transfers() {
        try (var seed = newTicket(BigInteger.valueOf(42), "transfer"); var original = copyEchoRecordResult(bundle(seed.get()));
             var view = echoRecord(original); var alias = original.share(); var independent = original.retain()) {
            status(1, () -> moveRecord(view, value -> value));
            check(!original.isClosed() && !view.isClosed(), "rejected borrow preserves original");
            try (var received = moveRecord(original, value -> {
                check(original.isClosed() && view.isClosed() && alias.isClosed(), "reentrant original-owner consumption"); return value;
            })) {
                check(serial(received.get().primary()).intValueExact() == 42 && !independent.isClosed(), "original token transferred");
            }
            try (var empty = copyEchoArrayResult(new Ticket[0]); var emptyView = echoArray(empty); var moved = moveArray(empty)) {
                check(empty.isClosed() && emptyView.isClosed() && moved.get().length == 0, "empty owner participates in handoff");
            }
            try (var root = newTicket(BigInteger.valueOf(43), "conflict"); var borrowed = retainTicket(root)) {
                status(1, () -> mixedTicket(borrowed, root));
                check(!root.isClosed() && !borrowed.isClosed(), "ancestor conflict preserves owner");
            }
            try (var failing = copyEchoRecordResult(bundle(seed.get()))) {
                var sentinel = new IllegalStateException("same exception");
                var observed = reject(IllegalStateException.class, () -> moveRecord(failing, value -> { throw sentinel; }));
                check(observed == sentinel && failing.isClosed(), "post-handoff exception identity"); retainedFailures.add(observed);
            }
        }
    }
    public static <T> int[] faults(Supplier<Value<T>> make, Function<Value<T>, Value<T>> borrow, Function<Value<T>, Value<T>> move) {
        var counts = new int[4];
        {
            long baseline = count(live), owners = count(identities);
            for (boolean nativeFailure : new boolean[] { false, true }) {
                boolean completed = false;
                for (int index = 0; index < 2000; index++) {
                    var original = make.get(); var borrowed = borrow.apply(original);
                    long before = count(handoffs); Value<T> output = null; Throwable failure = null;
                    try {
                        if (nativeFailure) failAfter(index); else remaining = index;
                        output = move.apply(original); completed = true;
                    } catch (OutOfMemoryError error) { if (nativeFailure) throw error; failure = error; }
                    catch (LeanBridgeException error) { if (!nativeFailure || error.status() != 3) throw error; failure = error; }
                    finally { remaining = -1; failAfter(-1); }
                    boolean consumed = count(handoffs) > before;
                    check(original.isClosed() == consumed && borrowed.isClosed() == consumed, "fault follows actual handoff");
                    if (failure != null) { retainedFailures.add(failure); counts[(nativeFailure ? 2 : 0) + (consumed ? 1 : 0)]++; }
                    if (output != null) output.close(); borrowed.close(); original.close(); bindings.runtime.current().require();
                    check(count(live) == baseline && count(identities) == owners, "explicit cleanup without GC " + nativeFailure + "/" + index);
                    if (completed) break;
                }
                check(completed, "allocation sweep completed");
            }
        }
        return counts;
    }
    private static int[] javaFaults() {
        try (var seed = newTicket(BigInteger.valueOf(42), "fault")) {
            return faults(() -> copyEchoRecordResult(bundle(seed.get())), OwnedBorrowProbe::echoRecord,
                value -> moveRecord(value, reply -> reply));
        }
    }
    private static void join(Thread thread) {
        try { thread.join(10000); } catch (InterruptedException error) { throw new AssertionError(error); }
        check(!thread.isAlive(), "worker completed");
    }
    private static void pause() {
        try { Thread.sleep(5); } catch (InterruptedException error) { throw new AssertionError(error); }
    }
    private record Abandoned<T>(java.lang.ref.WeakReference<Value<T>> weak, Value<T> borrowed, T raw) { }
    private static <T> Abandoned<T> abandon(Supplier<Value<T>> make, Function<Value<T>, Value<T>> borrow) {
        var original = make.get();
        return new Abandoned<>(new java.lang.ref.WeakReference<>(original), borrow.apply(original), original.get());
    }
    public static <T> void lifetimes(Supplier<Value<T>> make, Function<Value<T>, Value<T>> borrow) {
        try (var original = make.get()) {
            var failure = new java.util.concurrent.atomic.AtomicReference<Throwable>();
            var thread = new Thread(() -> { try { original.get(); } catch (Throwable error) { failure.set(error); } });
            thread.start(); join(thread);
            check(failure.get() instanceof LeanBridgeException error && error.status() == 5 && !original.isClosed(), "foreign-thread access rejects without closing owner");
        }
        long completed = count(exits);
        var escaped = new java.util.concurrent.atomic.AtomicReference<Value<T>>();
        var creator = new Thread(() -> escaped.set(make.get())); creator.start(); join(creator);
        check(escaped.get().isClosed(), "creator-thread exit expires owner"); status(4, escaped.get()::get); escaped.get().close();
        for (int index = 0; index < 1000 && count(exits) == completed; index++) pause();
        check(count(exits) == completed + 1 && count(exitErrors) == 0, "native TLS cleanup completed");
        java.lang.ref.Reference.reachabilityFence(creator);
        var abandoned = abandon(make, borrow);
        for (int index = 0; index < 1000; index++) {
            System.gc(); bindings.runtime.current().require();
            if (abandoned.weak().get() == null && abandoned.borrowed().isClosed()) break;
            pause();
        }
        check(abandoned.weak().get() == null && abandoned.borrowed().isClosed(), "raw views and descendants do not keep whole owners alive");
        status(4, abandoned.borrowed()::get); abandoned.borrowed().close();
        java.lang.ref.Reference.reachabilityFence(abandoned.raw());
        try (var original = make.get(); var view = borrow.apply(original)) {
            var closer = new Thread(original::close); closer.start(); join(closer); bindings.runtime.current().require();
            check(view.isClosed(), "foreign-thread close queues creator-thread release");
        }
    }
    public static void closeDuringWholeRead(Value<?> owner) {
        try (owner) {
            wholeReadHook = () -> {
                var closer = new Thread(owner::close); closer.start(); join(closer);
            };
            var snapshot = owner.get();
            check(snapshot != null && java.lang.reflect.Array.getLength(snapshot) == 0,
                "whole read remains a snapshot during foreign-thread close");
            status(4, owner::get); bindings.runtime.current().require();
        } finally { wholeReadHook = null; }
    }
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            handoffs = linker.downcallHandle(symbols.find("probe_handoffs").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            fail = linker.downcallHandle(symbols.find("probe_fail").orElseThrow(), FunctionDescriptor.ofVoid(JAVA_LONG));
            exits = linker.downcallHandle(symbols.find("probe_exits").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            exitErrors = linker.downcallHandle(symbols.find("probe_exit_errors").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current().require(); long baseline = count(live), owners = count(identities);
            shapes(); callbacks(); transfers(); var faults = javaFaults();
            lifetimes(() -> newTicket(BigInteger.valueOf(44), "lifetime"), OwnedBorrowProbe::retainTicket);
            closeDuringWholeRead(copyEchoArrayResult(new Ticket[0]));
            check(count(live) == baseline && count(identities) == owners, "Java explicit owner cleanup"); int javaChecks = checks;
            var kotlinFaults = KotlinBorrowProbe.INSTANCE.run();
            check(count(live) == baseline && count(identities) == owners, "Kotlin explicit owner cleanup"); int kotlinChecks = checks - javaChecks;
            bindings.runtime.current().close(); check(count(live) == 0 && count(identities) == 0, "all owners released");
            java.lang.ref.Reference.reachabilityFence(retainedFailures);
            System.out.println("{\"javaChecks\":" + javaChecks + ",\"kotlinChecks\":" + kotlinChecks + ",\"faults\":" + Arrays.toString(faults) + ",\"kotlinFaults\":" + Arrays.toString(kotlinFaults) + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + ",\"threadExits\":" + count(exits) + ",\"threadExitErrors\":" + count(exitErrors) + "}");
        }
    }
}
