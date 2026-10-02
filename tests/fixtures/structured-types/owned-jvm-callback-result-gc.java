package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import java.math.BigInteger;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

public final class OwnedCallbackResultGcProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities;
    private static int checks, rounds, originalCollections, replyCollections, publications;
    private static boolean collectInReply;
    private static WeakReference<Value<?>> source;
    private static volatile _OwnedRuntime.WholeGuard<?> sourceGuard;
    private static volatile boolean sourceReleased;

    public static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    public static void expired(Runnable action) {
        try { action.run(); }
        catch (LeanBridgeException error) { check(error.status() == 4, "expired callback-result status"); return; }
        throw new AssertionError("collected callback original remained usable");
    }
    public static void pump() { bindings.runtime.current().require(); }
    private static void collect() {
        System.gc();
        try { Thread.sleep(5); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
        pump(); rounds++;
    }
    private static long count(MethodHandle method) {
        try { return (long)method.invokeExact(); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static long liveCount() { return count(live); }
    public static long identityCount() { return count(identities); }
    public static void baseline(long allocations, long owners, String stage) {
        for (int round = 0; round < 600 && (count(live) != allocations || count(identities) != owners); round++) collect();
        check(count(live) == allocations && count(identities) == owners,
            stage + " restores native counters: " + count(live) + "/" + count(identities)
                + ", expected " + allocations + "/" + owners);
    }

    public static synchronized void watch(Value<?> owner) {
        // The guard is observable without retaining the Value or acquiring its lease.
        sourceGuard = owner.guard;
        sourceReleased = false;
        source = new WeakReference<>(owner);
        Reference.reachabilityFence(owner);
    }
    static synchronized void released(_OwnedRuntime.WholeGuard<?> guard) {
        // The emitted test hook runs after release, not merely after guard.closed changes.
        if (guard == sourceGuard) sourceReleased = true;
    }
    public static void forceAtReply(boolean enabled) { collectInReply = enabled; }
    static void beforeReplyWrite() {
        if (!collectInReply) return;
        for (int round = 0; round < 600 && (source.get() != null || !sourceReleased); round++) collect();
        check(source.get() == null && sourceReleased,
            "temporary whole callback source is collected after its checked read");
        check(!sourceGuard.lease.isClosed(),
            "temporary whole callback owner remains pinned through reply conversion");
        replyCollections++;
    }
    static void afterPublication() {
        if (!collectInReply) return;
        check(source.get() == null && sourceReleased && !sourceGuard.lease.isClosed(),
            "temporary callback lease stays pinned until C publishes its independent result");
        publications++;
    }
    public static void afterReply() {
        check(source.get() == null && sourceReleased && sourceGuard.lease.isClosed(),
            "temporary source lease releases when callback conversion ends");
    }

    public record Scenario(WeakReference<? extends Value<?>> original, Object raw,
            Value<?> result, Value<?> descendant, Value<?> retained, Runnable dead, Runnable alive) { }
    public static void run(Scenario scenario) {
        scenario.alive().run();
        for (int round = 0; round < 600; round++) {
            collect();
            if (scenario.original().get() == null && scenario.result().isClosed() && scenario.descendant().isClosed()) break;
        }
        check(scenario.original().get() == null, "callback original owner collected"); originalCollections++;
        check(scenario.result().isClosed() && scenario.descendant().isClosed(),
            "callback result descendants expire transitively after original collection");
        expired(scenario.result()::get); expired(scenario.descendant()::get);
        scenario.dead().run(); scenario.alive().run();
        scenario.descendant().close(); scenario.result().close(); scenario.retained().close(); pump();
        Reference.reachabilityFence(scenario.raw());
        Reference.reachabilityFence(scenario);
    }

    private static void shape(Tree tree, boolean populated) {
        check(tree instanceof TreeBranch, "callback result keeps tree constructor");
        var children = ((TreeBranch)tree).children();
        check(children.length == (populated ? 1 : 0), "callback result preserves empty or populated shape");
        if (populated) check(Api.serial(((TreeLeaf)children[0]).ticket()).intValueExact() == 77,
            "callback result keeps live nested resource after source collection");
    }
    private static Scenario abandonedJava(boolean populated) {
        try (var seed = Api.newTicket(BigInteger.valueOf(77), "Java collected original")) {
            Tree raw = new TreeBranch(populated ? new Tree[] { new TreeLeaf(seed.get()) } : new Tree[0]);
            var original = Api.echoRecursive(raw);
            try (var closure = Api.makeRecursive(raw)) {
                var result = closure.get().invoke(false, original);
                var descendant = closure.get().invoke(true, result);
                var retained = descendant.retain();
                var escaped = original.get();
                return new Scenario(new WeakReference<>(original), escaped, result, descendant, retained,
                    () -> {
                        if (populated) {
                            var ticket = ((TreeLeaf)((TreeBranch)escaped).children()[0]).ticket();
                            check(ticket.isClosed(), "escaped raw ticket expires with collected callback original");
                            expired(() -> Api.serial(ticket));
                        }
                    }, () -> shape(retained.get(), populated));
            }
        }
    }
    private static Value<Tree> nativeJavaCall(MakeRecursiveResultClosure closure, Value<Tree> original) {
        return closure.invoke(false, original);
    }
    private static CallbackResult<Tree> temporaryJavaReply(Tree value) {
        var owner = Api.echoRecursive(value);
        watch(owner);
        return CallbackResult.owner(owner);
    }
    private static Value<Tree> temporaryJavaCall(Tree value) {
        return Api.callbackRecursive(value, (CallbackRecursiveArgument1ClosureCallback)OwnedCallbackResultGcProbe::temporaryJavaReply);
    }
    private static void javaOwners() {
        Tree empty = new TreeBranch(new Tree[0]);
        try (var original = Api.echoRecursive(empty); var closure = Api.makeRecursive(empty)) {
            for (int index = 0; index < 1500; index++) {
                try (var result = nativeJavaCall(closure.get(), original)) { shape(result.get(), false); }
            }
        }
        run(abandonedJava(false)); run(abandonedJava(true));
    }
    private static void javaReplies() {
        for (boolean populated : new boolean[] { false, true }) {
            try (var seed = Api.newTicket(BigInteger.valueOf(77), "Java temporary reply")) {
                Tree value = new TreeBranch(populated ? new Tree[] { new TreeLeaf(seed.get()) } : new Tree[0]);
                long allocations = count(live), owners = count(identities);
                for (int index = 0; index < 1500; index++) {
                    try (var result = temporaryJavaCall(value)) { shape(result.get(), populated); }
                }
                baseline(allocations, owners, "Java warm callback replies");
                forceAtReply(true);
                try {
                    for (int index = 0; index < 2; index++) {
                        try (var result = temporaryJavaCall(value)) { afterReply(); shape(result.get(), populated); }
                    }
                } finally { forceAtReply(false); }
                baseline(allocations, owners, "Java collected callback replies");
                Reference.reachabilityFence(value);
            }
        }
    }

    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            pump(); long allocations = count(live), owners = count(identities);
            boolean java = args.length == 1 || args[1].equals("java");
            boolean kotlin = args.length == 1 || args[1].equals("kotlin");
            if (java) { javaOwners(); javaReplies(); baseline(allocations, owners, "Java callback GC"); }
            int javaChecks = checks, javaOriginals = originalCollections, javaReplies = replyCollections;
            if (kotlin) { KotlinCallbackResultGcProbe.INSTANCE.run(); baseline(allocations, owners, "Kotlin callback GC"); }
            int kotlinChecks = checks - javaChecks, kotlinOriginals = originalCollections - javaOriginals;
            int kotlinReplies = replyCollections - javaReplies;
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "callback GC releases all native owners");
            System.out.println("{\"javaChecks\":" + javaChecks + ",\"kotlinChecks\":" + kotlinChecks
                + ",\"javaOriginals\":" + javaOriginals + ",\"kotlinOriginals\":" + kotlinOriginals
                + ",\"javaReplies\":" + javaReplies + ",\"kotlinReplies\":" + kotlinReplies
                + ",\"publications\":" + publications + ",\"rounds\":" + rounds
                + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + "}");
        }
    }
}
