package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import java.util.function.ToIntFunction;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

public final class OwnedCallbackResultFaultProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities, handoffs, fail;
    private static int remaining = -1, checks;
    private static long publications, returns;
    private static final List<Throwable> retainedFailures = new ArrayList<>();

    static void allocation() {
        if (remaining == 0) throw new OutOfMemoryError("injected callback-result allocation failure");
        if (remaining > 0) --remaining;
    }
    static void published() { publications++; }
    static void returned() { returns++; }
    public static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    private static long count(MethodHandle method) {
        try { return (long)method.invokeExact(); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static void failAfter(long count) {
        try { fail.invokeExact(count); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }

    public record Fixture<T>(Value<T> original, Value<T> alias, Value<T> descendant,
            Value<T> independent, Value<T> reply, Value<?> closure,
            Supplier<Value<T>> call, ToIntFunction<T> serial,
            BooleanSupplier entered, int expected) implements AutoCloseable {
        void verify(boolean consumed, Value<T> output) {
            check(original.isClosed() == consumed && alias.isClosed() == consumed
                && descendant.isClosed() == consumed, "original aliases follow the actual handoff");
            check(!independent.isClosed() && serial.applyAsInt(independent.get()) == 42,
                "independent input retain survives failed publication");
            check(!reply.isClosed() && serial.applyAsInt(reply.get()) == 53,
                "callback reply and whole recovery owner is never consumed");
            check(!closure.isClosed(), "native callback owner remains usable");
            if (!consumed) check(serial.applyAsInt(original.get()) == 42, "unconsumed original remains usable");
            if (output != null) check(serial.applyAsInt(output.get()) == expected, "published callback result preserves payload");
        }
        @Override public void close() {
            closure.close(); reply.close(); independent.close(); descendant.close(); alias.close(); original.close();
        }
    }

    public static <T> String sweep(String language, int kind, Supplier<Fixture<T>> make) {
        String name = new String[] { "native-anchored", "host-raw", "host-whole", "receiver-whole-recovery" }[kind];
        boolean moving = kind == 3, hosted = kind != 0;
        int[] faults = new int[4], enteredFaults = new int[2], publishedFaults = new int[2], returnedFaults = new int[2];
        int[] successes = new int[2];
        bindings.runtime.current().require();
        long baseline = count(live), identityBaseline = count(identities);
        for (int allocator = 0; allocator < 2; allocator++) {
            boolean nativeFailure = allocator == 1, completed = false;
            for (int index = 0; index < 2000; index++) {
                var fixture = make.get();
                long beforeHandoff = count(handoffs), beforePublication = publications, beforeReturn = returns;
                Value<T> output = null;
                Throwable failure = null;
                try {
                    if (nativeFailure) failAfter(index); else remaining = index;
                    output = fixture.call().get(); completed = true;
                } catch (OutOfMemoryError error) {
                    if (nativeFailure || !"injected callback-result allocation failure".equals(error.getMessage())) throw error;
                    failure = error;
                } catch (LeanBridgeException error) {
                    if (!nativeFailure || error.status() != 3) throw error;
                    failure = error;
                } finally { remaining = -1; failAfter(-1); }
                boolean consumed = count(handoffs) > beforeHandoff;
                boolean entered = fixture.entered().getAsBoolean();
                boolean published = publications > beforePublication, returned = returns > beforeReturn;
                try {
                    check(moving || !consumed, "non-consuming callback did not transfer an input");
                    if (moving && entered) check(consumed, "host callback starts only after the receiver handoff");
                    fixture.verify(consumed, output);
                    if (failure != null) {
                        retainedFailures.add(failure);
                        faults[allocator * 2 + (consumed ? 1 : 0)]++;
                        if (entered) enteredFaults[allocator]++;
                        if (published) publishedFaults[allocator]++;
                        if (returned) returnedFaults[allocator]++;
                    } else {
                        successes[allocator]++;
                        check(consumed == moving, "successful receiver call transfers exactly its original owner");
                        check(!hosted || entered && published, "successful host result passed the native copy boundary");
                    }
                } finally {
                    if (output != null) output.close();
                    fixture.close(); bindings.runtime.current().require();
                }
                check(count(live) == baseline && count(identities) == identityBaseline,
                    language + "/" + name + " allocation rollback " + allocator + "/" + index
                        + ": " + count(live) + "/" + count(identities) + ", expected " + baseline + "/" + identityBaseline);
                java.lang.ref.Reference.reachabilityFence(output);
                java.lang.ref.Reference.reachabilityFence(fixture);
                if (completed) break;
            }
            check(completed && successes[allocator] == 1, "allocation sweep reaches success");
            check(faults[allocator * 2] > 0, "pre-handoff allocation failures were observed");
            if (moving) check(faults[allocator * 2 + 1] > 0, "post-handoff allocation failures were observed");
            if (hosted) {
                check(enteredFaults[allocator] > 0, "faults reached the host callback");
                check(publishedFaults[allocator] > 0, "faults occurred after C copied the callback result");
            } else if (!nativeFailure) {
                check(returnedFaults[allocator] > 0, "managed faults occurred after native anchored-result publication");
            }
        }
        return "{\"language\":\"" + language + "\",\"case\":\"" + name
            + "\",\"faults\":" + java.util.Arrays.toString(faults)
            + ",\"enteredFaults\":" + java.util.Arrays.toString(enteredFaults)
            + ",\"publishedFaults\":" + java.util.Arrays.toString(publishedFaults)
            + ",\"returnedFaults\":" + java.util.Arrays.toString(returnedFaults)
            + ",\"successes\":" + java.util.Arrays.toString(successes) + "}";
    }

    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-17), new byte[] { 0, -1 }));
    }
    private static Fixture<Bundle> fixture(int kind) {
        try (var inputSeed = Api.newTicket(BigInteger.valueOf(42), "fault-input");
             var replySeed = Api.newTicket(BigInteger.valueOf(53), "fault-reply")) {
            var original = Api.echoRecord(bundle(inputSeed.get()));
            var alias = original.share(); var descendant = original.borrowRecord();
            var independent = original.retain(); var reply = Api.echoRecord(bundle(replySeed.get()));
            var closure = Api.makeRecordCallback(reply.get());
            var entered = new boolean[1];
            var callback = OwnedCallbacks.withRecovery((ApplyTwiceArgument1ClosureCallback)value -> {
                entered[0] = true;
                return kind == 1 ? CallbackResult.value(value) : CallbackResult.owner(reply);
            }, CallbackResult.owner(reply));
            Supplier<Value<Bundle>> call = () -> switch (kind) {
                case 0 -> closure.get().invoke(original);
                case 3 -> original.moveRecord(callback);
                default -> Api.callbackRecord(original.get(), callback);
            };
            return new Fixture<>(original, alias, descendant, independent, reply, closure, call,
                value -> Api.serial(value.primary()).intValueExact(), () -> entered[0], kind == 1 ? 42 : 53);
        }
    }

    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            handoffs = linker.downcallHandle(symbols.find("probe_handoffs").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            fail = linker.downcallHandle(symbols.find("probe_fail").orElseThrow(), FunctionDescriptor.ofVoid(JAVA_LONG));
            bindings.runtime.current().require();
            var observations = new ArrayList<String>();
            for (int kind = 0; kind < 4; kind++) {
                final int selected = kind;
                observations.add(sweep("java", kind, () -> fixture(selected)));
            }
            observations.addAll(KotlinCallbackResultFaultProbe.INSTANCE.run());
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all callback-result fault owners released");
            java.lang.ref.Reference.reachabilityFence(retainedFailures);
            System.out.println("{\"checks\":" + checks + ",\"live\":" + count(live)
                + ",\"identities\":" + count(identities) + ",\"cases\":[" + String.join(",", observations) + "]}");
        }
    }
}
