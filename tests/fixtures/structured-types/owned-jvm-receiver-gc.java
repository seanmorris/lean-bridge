package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.ref.Reference;
import java.lang.ref.WeakReference;
import java.math.BigInteger;
import java.util.function.Supplier;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

@SuppressWarnings("try")
public final class OwnedReceiverGcProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities;
    private static int checks, collected, rounds;
    private static int duringCalls;
    private static boolean collectInCall;
    private static WeakReference<Value<?>> watched;

    public static void watch(Value<?> owner) { watched = new WeakReference<>(owner); }
    public static void forceAtCall(boolean enabled) { collectInCall = enabled; }
    public static void beforeScalarCall() {
        if (collectInCall) {
            collect();
            check(watched != null && watched.get() != null, "receiver owner survives an optimized getter call");
            duringCalls++;
        }
    }

    public static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    public static void expired(Runnable call) {
        try { call.run(); }
        catch (LeanBridgeException error) {
            check(error.status() == 4, "expired receiver status"); return;
        }
        throw new AssertionError("Expected expired receiver");
    }
    public static void pump() {
        bindings.runtime.current().require();
    }
    private static void collect() {
        System.gc();
        try { Thread.sleep(5); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); }
        pump(); rounds++;
    }
    private static long count(MethodHandle method) {
        try { return (long)method.invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
    public record Scenario(WeakReference<? extends Value<?>> original, Object raw,
            Value<?>[] views, Value<?> retained, Runnable dead, Runnable alive) {
    }
    public static void run(Scenario scenario) {
        scenario.alive().run();
        for (int round = 0; round < 600; round++) {
            collect();
            boolean closed = true;
            for (Value<?> view : scenario.views()) closed &= view.isClosed();
            if (scenario.original().get() == null && closed) break;
        }
        check(scenario.original().get() == null, "nominal original collected"); collected++;
        for (Value<?> view : scenario.views()) {
            check(view.isClosed(), "descendant expires with collected original");
            expired(view::get);
        }
        scenario.dead().run(); scenario.alive().run();
        for (Value<?> view : scenario.views()) view.close();
        scenario.retained().close(); pump();
        Reference.reachabilityFence(scenario.raw());
    }
    public static final class Pinned {
        public Supplier<BigInteger> getter;
        public final Scenario scenario;
        public Pinned(Supplier<BigInteger> getter, Scenario scenario) {
            this.getter = getter; this.scenario = scenario;
        }
    }
    public static void runPinned(Pinned pinned) {
        for (int round = 0; round < 5; round++) {
            collect();
            check(pinned.scenario.original().get() != null, "bound method pins nominal receiver");
            check(pinned.getter.get().intValueExact() == 42, "bound method remains callable after GC");
            check(!pinned.scenario.views()[0].isClosed(), "pinned receiver preserves descendants");
        }
        pinned.getter = null;
        run(pinned.scenario);
    }
    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.none(), new Ticket[0], new Ticket[0],
            new Payload(BigInteger.valueOf(42), new byte[] {0, -1}));
    }
    private static Scenario ticketScenario(TicketValue original) {
        Ticket raw = original.get();
        TicketValue view = original.retainTicket(), deeper = view.retainTicket(), retained = original.retain();
        return new Scenario(new WeakReference<>(original), raw, new Value<?>[] {view, deeper}, retained,
            () -> { expired(view::getSerial); expired(raw::getSerial); },
            () -> check(retained.getSerial().intValueExact() == 42, "independent nominal retain survives GC"));
    }
    private static Scenario abandonedTicket() {
        return ticketScenario(Api.newTicket(BigInteger.valueOf(42), "gc"));
    }
    private static Pinned pinnedTicket() {
        TicketValue original = Api.newTicket(BigInteger.valueOf(42), "bound");
        return new Pinned(original::getSerial, ticketScenario(original));
    }
    private static Scenario abandonedParameter() {
        try (TicketValue receiver = Api.newTicket(BigInteger.ONE, "receiver")) {
            TicketValue parameter = Api.newTicket(BigInteger.valueOf(42), "parameter");
            TicketValue selected = receiver.chooseTicket(parameter), deeper = selected.retainTicket(), retained = selected.retain();
            Ticket raw = selected.get();
            receiver.close();
            check(selected.getSerial().intValueExact() == 42, "remaining parameter is the original anchor");
            return new Scenario(new WeakReference<>(parameter), raw, new Value<?>[] {selected, deeper}, retained,
                () -> expired(selected::getSerial),
                () -> check(retained.getSerial().intValueExact() == 42, "retained parameter result survives GC"));
        }
    }
    private static Scenario abandonedBundle() {
        try (TicketValue seed = Api.newTicket(BigInteger.valueOf(42), "bundle")) {
            BundleValue original = Api.copyEchoRecordResult(bundle(seed.get()));
            Bundle raw = original.get();
            BundleValue view = original.echoRecord(), retained = original.retain();
            TicketValue primary = original.getPrimary();
            Value<?> closure = original.makeRecord();
            return new Scenario(new WeakReference<>(original), raw, new Value<?>[] {view, primary, closure}, retained,
                () -> expired(primary::getSerial),
                () -> check(retained.getPayload().count().intValueExact() == 42, "retained aggregate member survives GC"));
        }
    }
    private static Scenario abandonedChoice(boolean empty) {
        try (TicketValue seed = Api.newTicket(BigInteger.valueOf(42), "choice")) {
            Choice raw = empty ? new ChoiceMany(new Ticket[0]) : new ChoiceOne(seed.get());
            ChoiceValue original = Api.copyEchoVariantResult(raw);
            ChoiceValue view = original.echoVariant(), retained = original.retain();
            return new Scenario(new WeakReference<>(original), original.get(), new Value<?>[] {view}, retained,
                () -> expired(view::echoVariant),
                () -> { try (ChoiceValue copy = retained.echoVariant()) { check(!copy.isClosed(), "retained variant member survives GC"); } });
        }
    }
    private static Scenario abandonedTree(boolean empty) {
        try (TicketValue seed = Api.newTicket(BigInteger.valueOf(42), "tree")) {
            Tree tree = new TreeBranch(empty ? new Tree[0] : new Tree[] {new TreeLeaf(seed.get())});
            TreeValue original = Api.copyEchoRecursiveResult(tree);
            Tree raw = original.get();
            TreeValue view = original.echoRecursive(), retained = original.retain();
            if (!empty) ((TreeBranch)raw).children()[0] = raw;
            return new Scenario(new WeakReference<>(original), raw, new Value<?>[] {view}, retained,
                () -> expired(view::echoRecursive),
                () -> { try (TreeValue copy = retained.echoRecursive()) { check(!copy.isClosed(), "retained recursive member survives GC"); } });
        }
    }
    private static void warm() {
        try (TicketValue ticket = Api.newTicket(BigInteger.valueOf(42), "warm");
             BundleValue record = Api.copyEchoRecordResult(bundle(ticket.get()))) {
            watch(ticket);
            for (int index = 0; index < 5000; index++) {
                forceAtCall(index % 200 == 0);
                check(ticket.getSerial().intValueExact() == 42, "warm Java property");
                check(record.getPayload().count().intValueExact() == 42, "warm Java aggregate property");
            }
        }
        for (int index = 0; index < 500; index++) {
            forceAtCall(index % 20 == 0);
            check(ephemeralJava().intValueExact() == 42, "ephemeral Java receiver property");
        }
        forceAtCall(false);
    }
    private static BigInteger ephemeralJava() {
        TicketValue owner = Api.newTicket(BigInteger.valueOf(42), "ephemeral");
        watch(owner);
        return owner.getSerial();
    }
    public static void main(String[] args) {
        try (Arena library = Arena.ofShared()) {
            SymbolLookup symbols = SymbolLookup.libraryLookup(args[0], library);
            Linker linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            pump(); long baseline = count(live), identityBaseline = count(identities);
            warm();
            run(abandonedTicket()); run(abandonedParameter()); run(abandonedBundle());
            run(abandonedChoice(true)); run(abandonedChoice(false));
            run(abandonedTree(true)); run(abandonedTree(false)); runPinned(pinnedTicket());
            check(count(live) == baseline && count(identities) == identityBaseline, "Java nominal GC drains native owners");
            int javaChecks = checks, javaCollected = collected;
            KotlinReceiverGcProbe.INSTANCE.run();
            check(count(live) == baseline && count(identities) == identityBaseline, "Kotlin nominal GC drains native owners");
            int kotlinChecks = checks - javaChecks, kotlinCollected = collected - javaCollected;
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all native allocations and identities released");
            System.out.println("{\"javaChecks\":" + javaChecks + ",\"kotlinChecks\":" + kotlinChecks
                + ",\"javaCollected\":" + javaCollected + ",\"kotlinCollected\":" + kotlinCollected
                + ",\"rounds\":" + rounds + ",\"duringCalls\":" + duringCalls
                + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + "}");
        }
    }
}
