/**
 * Probe callback-result creator threads and runtime retirement through public APIs.
 *
 * @file
 */
import assert from "node:assert/strict";

const java = (namespace, combined) => `package ${namespace};

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.ref.Reference;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import static java.lang.foreign.ValueLayout.*;

@SuppressWarnings("try")
public final class CallbackResultProcessProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities, exits, exitErrors${combined ? ", retire" : ""};
    private static int checks;
    private static final ArrayList<Thread> threads = new ArrayList<>();
    private static final ArrayList<Held> kept = new ArrayList<>();
    public record Held(Object[] wrappers, BooleanSupplier closed, Runnable read) { }
    public static synchronized void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message); checks++;
    }
    public static void status(int expected, Runnable action) {
        try { action.run(); }
        catch (LeanBridgeException error) { check(error.status() == expected, "native status " + expected); return; }
        throw new AssertionError("Missing native status " + expected);
    }
    private static long count(MethodHandle handle) {
        try { return (long)handle.invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
${combined ? `    public static void retireRuntime() {
        try { retire.invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
` : ""}\
    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-17), new byte[] { 0, -1, 3 }));
    }
    private static Held createJavaOwners() {
        var seed = Api.newTicket(BigInteger.valueOf(71), "java-thread");
        var original = Api.echoRecord(bundle(seed.get()));
        var closureOwner = Api.makeRecord(original.get());
        var callback = closureOwner.get();
        var borrowed = callback.invoke(true, original);
        var descendant = callback.invoke(false, borrowed);
        var independent = descendant.retain();
        var ticket = descendant.get().primary();
        var peer = descendant.get().peers()[0];
        check(Api.serial(ticket).intValueExact() == 71, "Java anchored descendant is live on creator thread");
        check(Api.serial(independent.get().primary()).intValueExact() == 71, "Java independent retain is live");
        return new Held(new Object[] { seed, original, closureOwner, callback, borrowed, descendant, independent, ticket, peer },
            () -> seed.isClosed() && original.isClosed() && closureOwner.isClosed() && callback.isClosed()
                && borrowed.isClosed() && descendant.isClosed() && independent.isClosed() && ticket.isClosed() && peer.isClosed(),
            () -> original.get());
    }
    private static void awaitExit(long expected, long allocations, long owners) throws InterruptedException {
        // Thread.join can return before the C++ TLS destructor releases native owners.
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (count(exits) < expected && System.nanoTime() < deadline) Thread.sleep(5);
        check(count(exits) == expected, "native TLS destructor completed");
        check(count(exitErrors) == 0, "native TLS destructor succeeded");
        check(count(live) == allocations && count(identities) == owners,
            "native callback owners restored: " + count(live) + "/" + count(identities)
                + ", expected " + allocations + "/" + owners);
    }
    private static void creatorThreads() throws InterruptedException {
        bindings.runtime.current().require();
        long allocations = count(live), owners = count(identities), expectedExits = count(exits);
        for (boolean kotlin : new boolean[] { false, true }) {
            var ready = new CountDownLatch(1); var release = new CountDownLatch(1);
            var failure = new AtomicReference<Throwable>(); var retained = new AtomicReference<Held>();
            var worker = new Thread(() -> {
                try {
                    var held = kotlin ? KotlinCallbackResultProcessProbe.INSTANCE.createOwners() : createJavaOwners();
                    retained.set(held); kept.add(held); ready.countDown();
                    if (!release.await(10, TimeUnit.SECONDS)) throw new AssertionError("worker release timeout");
                } catch (Throwable error) { failure.set(error); ready.countDown(); }
            }, kotlin ? "kotlin-callback-owner" : "java-callback-owner");
            threads.add(worker); worker.start();
            try {
                check(ready.await(10, TimeUnit.SECONDS), "creator thread published owners");
                if (failure.get() != null) throw new AssertionError(failure.get());
                check(count(live) > allocations && count(identities) > owners,
                    "reachable worker wrappers have live native allocations and identities");
                status(5, retained.get().read());
            } finally { release.countDown(); worker.join(10000); }
            check(!worker.isAlive(), "creator thread exited while Thread object remains reachable");
            if (failure.get() != null) throw new AssertionError(failure.get());
            awaitExit(++expectedExits, allocations, owners);
            check(retained.get().closed().getAsBoolean(), "all strongly reachable callback wrappers are closed");
            status(4, retained.get().read());
            check(retained.get().wrappers().length == 9, "all original, callback, descendant and retained wrappers remain reachable");
        }
        check(threads.size() == 2 && kept.size() == 2, "both language families retain Thread objects and wrappers");
        Reference.reachabilityFence(threads); Reference.reachabilityFence(kept);
    }
${combined ? `    private static void retirement(boolean wholeReply) {
        try (var seed = Api.newTicket(BigInteger.valueOf(72), "java-retirement")) {
            var input = bundle(seed.get());
            try (var original = Api.echoRecord(input); var callbackOwner = original.makeRecord();
                 var borrowed = callbackOwner.get().invoke(false, original);
                 var descendant = callbackOwner.get().invoke(false, borrowed); var independent = descendant.retain();
                 var receiver = Api.echoRecord(input); var alias = receiver.share()) {
                var entered = new boolean[1];
                status(7, () -> receiver.moveRecord((ApplyTwiceArgument1ClosureCallback)value -> {
                    entered[0] = true; retireRuntime();
                    return wholeReply ? CallbackResult.owner(independent) : CallbackResult.value(value);
                }));
                check(entered[0], "Java retirement occurs inside anchored host callback before reply copying");
                check(receiver.isClosed() && alias.isClosed(), "Java retirement after handoff leaves receiver consumed");
                status(7, () -> Api.serial(seed.get()));
            }
        }
    }
` : ""}\
    public static void main(String[] args) throws Exception {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            exits = linker.downcallHandle(symbols.find("probe_exits").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            exitErrors = linker.downcallHandle(symbols.find("probe_exit_errors").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
${combined ? `            retire = linker.downcallHandle(symbols.find("lean_bridge_native_runtime_retire").orElseThrow(), FunctionDescriptor.ofVoid());
` : ""}\
            String mode = args[1];
            if (mode.equals("threads")) creatorThreads();
${combined ? `            else if (mode.startsWith("java-")) retirement(mode.endsWith("whole"));
            else KotlinCallbackResultProcessProbe.INSTANCE.retirement(mode.endsWith("whole"));
` : `            else throw new IllegalArgumentException("Native-only probe supports creator threads");
`}\
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all callback-result native allocations and identities released");
            check(count(exitErrors) == 0, "no native thread-exit errors");
            Reference.reachabilityFence(threads); Reference.reachabilityFence(kept);
            System.out.println("{\\"mode\\":\\"" + mode + "\\",\\"checks\\":" + checks
                + ",\\"live\\":" + count(live) + ",\\"identities\\":" + count(identities)
                + ",\\"threadExits\\":" + count(exits) + ",\\"threadExitErrors\\":" + count(exitErrors) + "}");
        }
    }
}
`;

const kotlin = (namespace, combined) => `package ${namespace}

import java.math.BigInteger
import ${namespace}.kotlin.Api
import ${namespace}.kotlin.Bundle
import ${namespace}.kotlin.Ticket
import ${namespace}.kotlin.Option
import ${namespace}.kotlin.Payload
${combined ? `import ${namespace}.kotlin.ApplyTwiceArgument1ClosureCallback\n` : ""}\

internal object KotlinCallbackResultProcessProbe {
    private fun check(value: Boolean, message: String) = CallbackResultProcessProbe.check(value, message)
    private fun bundle(ticket: Ticket) = Bundle(ticket, Option.some(ticket), arrayOf(ticket), emptyArray(),
        Payload(BigInteger.valueOf(-17), byteArrayOf(0, -1, 3)))
    fun createOwners(): CallbackResultProcessProbe.Held {
        val seed = Api.newTicket(BigInteger.valueOf(71), "kotlin-thread")
        val original = Api.echoRecord(bundle(seed.get()))
        val closureOwner = Api.makeRecord(original.get())
        val callback = closureOwner.get()
        val borrowed = callback.invoke(true, original)
        val descendant = callback.invoke(false, borrowed)
        val independent = descendant.retain()
        val ticket = descendant.get().primary
        val peer = descendant.get().peers[0]
        check(Api.serial(ticket).intValueExact() == 71, "Kotlin anchored descendant is live on creator thread")
        check(Api.serial(independent.get().primary).intValueExact() == 71, "Kotlin independent retain is live")
        return CallbackResultProcessProbe.Held(arrayOf(seed, original, closureOwner, callback, borrowed, descendant, independent, ticket, peer),
            { seed.isClosed && original.isClosed && closureOwner.isClosed && callback.isClosed
                && borrowed.isClosed && descendant.isClosed && independent.isClosed && ticket.isClosed && peer.isClosed },
            { original.get() })
    }
${combined ? `    fun retirement(wholeReply: Boolean) {
        Api.newTicket(BigInteger.valueOf(72), "kotlin-retirement").use { seed ->
            val input = bundle(seed.get())
            Api.echoRecord(input).use { original ->
                original.makeRecord().use { callbackOwner ->
                    callbackOwner.get().invoke(false, original).use { borrowed ->
                        callbackOwner.get().invoke(false, borrowed).use { descendant ->
                            descendant.retain().use { independent ->
                                Api.echoRecord(input).use { receiver ->
                                    receiver.share().use { alias ->
                                        var entered = false
                                        CallbackResultProcessProbe.status(7) {
                                            receiver.moveRecord(ApplyTwiceArgument1ClosureCallback { value ->
                                                entered = true; CallbackResultProcessProbe.retireRuntime()
                                                if (wholeReply) CallbackResult.owner(independent) else CallbackResult.value(value)
                                            })
                                        }
                                        check(entered, "Kotlin retirement occurs inside anchored host callback before reply copying")
                                        check(receiver.isClosed && alias.isClosed, "Kotlin retirement after handoff leaves receiver consumed")
                                        CallbackResultProcessProbe.status(7) { Api.serial(seed.get()) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
` : ""}\
}
`;

/**
 * Substitute only the package loader; public Java/Kotlin operations remain intact.
 *
 * @param model - Generated callback-result package.
 * @param combined - Include host replies and consuming-receiver retirement probes.
 */
export const ownedJvmCallbackResultProcessSources = (model, combined = true) => {
	const loader = `src/main/java/${model.namespace.replaceAll(".", "/")}/_OwnedLoader.java`;
	assert.ok(Object.hasOwn(model.files, loader));
	assert.equal(Boolean(model.contract.receiverExports), combined);
	return { ...model.files
		, [loader]: `package ${model.namespace};\nfinal class _OwnedLoader {\n    private _OwnedLoader() { }\n    static _OwnedBindings bindings() { return CallbackResultProcessProbe.bindings; }\n}\n`
		, "CallbackResultProcessProbe.java": java(model.namespace, combined)
		, "KotlinCallbackResultProcessProbe.kt": kotlin(model.namespace, combined) };
};
