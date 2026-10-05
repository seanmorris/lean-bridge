package org.leanbridge.ownedtest;

import java.lang.foreign.*;
import java.lang.invoke.*;
import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicReference;
import static java.lang.foreign.ValueLayout.*;

public final class OwnedRuntimeProbe {
    private OwnedRuntimeProbe() { }
    private static SymbolLookup symbols;
    private static _OwnedRuntime runtime;
    private static MethodHandle create, retain, serial, closure, nativeFail, invalidProcess;
    private static final ThreadLocal<Integer> remaining = ThreadLocal.withInitial(() -> -1);
    private static int checks;
    private static _OwnedRuntime.Handle activeHandle;
    private static _OwnedRuntime.State activeState;
    private static Throwable activeFailure;
    @FunctionalInterface private interface Action { void run() throws Throwable; }
    static void allocation() {
        int value = remaining.get();
        if (value == 0) throw new OutOfMemoryError("injected managed failure");
        if (value > 0) remaining.set(value - 1);
    }
    private static void check(boolean value, String message) {
        ++checks; if (!value) throw new AssertionError(message);
    }
    private static void rejected(int status, Action action) throws Throwable {
        try { action.run(); } catch (LeanBridgeException error) {
            check(error.status() == status, "unexpected status " + error.status()); return;
        }
        throw new AssertionError("expected status " + status);
    }
    private static MethodHandle bind(String name, FunctionDescriptor descriptor) {
        return Linker.nativeLinker().downcallHandle(symbols.find(name).orElseThrow(), descriptor);
    }
    private static long metric(String name) throws Throwable { return (long)bind("owned_test_" + name, FunctionDescriptor.of(JAVA_LONG)).invokeExact(); }
    private static void awaitZero() throws Throwable {
        for (int i = 0; i < 1000 && (metric("live") != 0 || metric("identities") != 0); ++i) Thread.sleep(5);
        check(metric("live") == 0, "native allocations survive thread exit");
        check(metric("identities") == 0, "native identities survive thread exit");
        check(metric("exit_errors") == 0, "native thread cleanup failed");
    }
    private static Thread worker(Action action) throws Throwable {
        var failure = new AtomicReference<Throwable>();
        Thread thread = Thread.ofPlatform().unstarted(() -> { try { action.run(); } catch (Throwable error) { failure.set(error); } });
        thread.start(); thread.join();
        if (failure.get() != null) throw failure.get();
        return thread;
    }
    private static _OwnedRuntime.Handle make(long number) throws Throwable {
        var state = runtime.current();
        try (var arena = Arena.ofConfined(); var result = new _OwnedRuntime.Result(state)) {
            var out = arena.allocate(JAVA_LONG);
            _OwnedRuntime.check((int)create.invokeExact(MemorySegment.ofAddress(state.require()), number, out, result.output()));
            var handle = new _OwnedRuntime.Handle(result.adopt(), out.get(JAVA_LONG, 0));
            result.complete(); return handle;
        }
    }
    private static _OwnedRuntime.Handle retained(_OwnedRuntime.Handle handle) throws Throwable {
        var state = runtime.current();
        try (var arena = Arena.ofConfined(); var result = new _OwnedRuntime.Result(state)) {
            var out = arena.allocate(JAVA_LONG);
            _OwnedRuntime.check((int)retain.invokeExact(MemorySegment.ofAddress(state.require()), MemorySegment.ofAddress(handle.raw(state)), out, result.output()));
            var copy = new _OwnedRuntime.Handle(result.adopt(), out.get(JAVA_LONG, 0));
            result.complete(); return copy;
        } finally { java.lang.ref.Reference.reachabilityFence(handle); }
    }
    private static long number(_OwnedRuntime.Handle handle) throws Throwable {
        var state = runtime.current();
        try (var arena = Arena.ofConfined(); var result = new _OwnedRuntime.Result(state)) {
            var out = arena.allocate(JAVA_LONG);
            _OwnedRuntime.check((int)serial.invokeExact(MemorySegment.ofAddress(state.require()), MemorySegment.ofAddress(handle.raw(state)), out, result.output()));
            return out.get(JAVA_LONG, 0);
        } finally { java.lang.ref.Reference.reachabilityFence(handle); }
    }
    private static _OwnedRuntime.Handle function() throws Throwable {
        var state = runtime.current();
        try (var arena = Arena.ofConfined(); var result = new _OwnedRuntime.Result(state)) {
            var out = arena.allocate(JAVA_LONG);
            _OwnedRuntime.check((int)closure.invokeExact(MemorySegment.ofAddress(state.require()), out, result.output()));
            var handle = new _OwnedRuntime.Handle(result.adopt(), out.get(JAVA_LONG, 0));
            result.complete(); return handle;
        }
    }
    private static WeakReference<_OwnedRuntime.Handle> abandoned() throws Throwable { return new WeakReference<>(make(99)); }
    private static void initialization() throws Throwable {
        for (int point = 0; point < 2; ++point) {
            var fresh = new _OwnedRuntime(symbols); remaining.set(point);
            try { fresh.current(); throw new AssertionError("registration fault was not reached"); }
            catch (OutOfMemoryError expected) { check(expected.getMessage().equals("injected managed failure"), "unrelated registration failure"); }
            finally { remaining.set(-1); }
            check(metric("live") == 0 && metric("identities") == 0, "registration failure opened a native owner");
            var state = fresh.current(); state.close();
            check(metric("live") == 0 && metric("identities") == 0, "failed registration left a poisoned ThreadLocal");
        }
        var fresh = new _OwnedRuntime(symbols); nativeFail.invokeExact(0L);
        try { rejected(3, fresh::current); } finally { nativeFail.invokeExact(-1L); }
        check(metric("live") == 0 && metric("identities") == 0, "failed native session leaked");
        fresh.current().close();
    }
    private static void values() throws Throwable {
        initialization();
        var state = runtime.current(); long baseline = metric("live"), baselineIdentities = metric("identities");
        check(baseline == 1 && baselineIdentities == 1, "initial session accounting");
        var original = make(42); var copy = retained(original);
        check(number(original) == 42 && number(copy) == 42, "retain changes value");
        var sibling = new _OwnedRuntime.Handle(original.lease, original.raw(state));
        original.close(); check(original.isClosed(), "close not visible");
        check(number(sibling) == 42, "one alias closes all peers");
        sibling.close(); check(number(copy) == 42, "retained owner invalidated");
        copy.close(); copy.close(); rejected(4, () -> number(copy));
        check(metric("live") == baseline && metric("identities") == baselineIdentities, "ordinary owner leak");
        try (var owner = make(73)) {
            _OwnedRuntime.Handle borrowed, survivor;
            try (var frame = new _OwnedRuntime.BorrowFrame(state)) {
                borrowed = new _OwnedRuntime.Handle(frame.lease, owner.raw(state));
                check(number(borrowed) == 73, "borrowed value changes"); survivor = retained(borrowed);
            }
            check(borrowed.isClosed(), "expired borrow looks open");
            rejected(4, () -> number(borrowed)); borrowed.close();
            check(number(survivor) == 73, "retained borrow expires"); survivor.close();
            worker(() -> rejected(5, () -> owner.raw(state)));
            var other = new _OwnedRuntime(symbols).current();
            rejected(1, () -> owner.raw(other)); other.close();
            worker(owner::close); check(owner.isClosed(), "foreign close not visible");
            state.drain();
        }
        for (int i = 0; i < 32; ++i) {
            try (var value = make(i)) { check(number(value) == i, "repeated values differ"); }
            check(metric("identities") == baselineIdentities, "repeated identity leak");
        }
        for (int point = 0; point < 5; ++point) {
            remaining.set(point);
            try { make(80); throw new AssertionError("allocation fault was not reached"); }
            catch (OutOfMemoryError expected) { check(expected.getMessage().equals("injected managed failure"), "unrelated allocation failure"); }
            finally { remaining.set(-1); }
            check(metric("identities") == baselineIdentities && metric("live") == baseline, "partial managed conversion leaked");
        }
        boolean success = false; int faults = 0;
        for (long point = 0; point < 128; ++point) {
            nativeFail.invokeExact(point);
            try (var owner = make(81)) { check(number(owner) == 81, "native fault recovery"); success = true; }
            catch (LeanBridgeException error) { check(error.status() == 3, "native fault status"); ++faults; }
            finally { nativeFail.invokeExact(-1L); }
            check(metric("identities") == baselineIdentities && metric("live") == baseline, "partial native call leaked");
            if (success) break;
        }
        check(success && faults > 0, "native allocation scan incomplete");
        try (var value = make(7)) {
            invalidProcess.invokeExact(1);
            rejected(6, runtime::current); rejected(6, value::close); rejected(6, () -> value.raw(state));
            invalidProcess.invokeExact(0); check(number(value) == 7, "process rejection damaged owner");
        }
        var weak = abandoned();
        for (int i = 0; i < 500 && (weak.get() != null || metric("identities") != baselineIdentities); ++i) { System.gc(); Thread.sleep(5); state.drain(); }
        check(weak.get() == null && metric("identities") == baselineIdentities, "Cleaner did not queue release");
        check(metric("live") == baseline, "Cleaner left allocations");
        state.close(); state.close(); rejected(4, state::require);
    }
    private static int closeActive() {
        try { activeHandle.close(); activeState.close(); return 0; }
        catch (Throwable error) { activeFailure = error; return 10; }
    }
    private static void active() throws Throwable {
        activeState = runtime.current(); activeHandle = make(91);
        try (var arena = Arena.ofConfined()) {
            var callback = MethodHandles.lookup().findStatic(OwnedRuntimeProbe.class, "closeActive", MethodType.methodType(int.class));
            var stub = Linker.nativeLinker().upcallStub(callback, FunctionDescriptor.of(JAVA_INT), arena);
            var call = bind("owned_test_close_during_call", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
            int status = (int)call.invokeExact(MemorySegment.ofAddress(activeState.require()), MemorySegment.ofAddress(activeHandle.raw(activeState)), stub);
            if (activeFailure != null) throw activeFailure;
            check(status == 0, "active native close failed");
            check(activeHandle.isClosed(), "active close not visible");
        }
    }
    public static void main(String[] args) throws Throwable {
        symbols = SymbolLookup.libraryLookup(args[0], Arena.global()); runtime = new _OwnedRuntime(symbols);
        create = bind("owned_test_new", FunctionDescriptor.of(JAVA_INT, ADDRESS, JAVA_LONG, ADDRESS, ADDRESS));
        retain = bind("owned_test_retain", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
        serial = bind("owned_test_serial", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS));
        closure = bind("owned_test_closure", FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS));
        nativeFail = bind("owned_test_fail_after", FunctionDescriptor.ofVoid(JAVA_LONG));
        invalidProcess = bind("owned_test_invalid_process", FunctionDescriptor.ofVoid(JAVA_INT));
        if (args[1].equals("ordinary")) {
            var failure = new AtomicReference<Throwable>();
            var virtual = Thread.ofVirtual().start(() -> {
                try { runtime.current(); failure.set(new AssertionError("virtual thread admitted")); }
                catch (IllegalStateException expected) { if (!expected.getMessage().contains("platform thread")) failure.set(expected); }
            });
            virtual.join(); if (failure.get() != null) throw failure.get();
            check(metric("live") == 0, "virtual rejection opened a session");
            Thread first = worker(OwnedRuntimeProbe::values); awaitZero();
            var retained = new AtomicReference<_OwnedRuntime.Handle[]>();
            Thread abandoned = worker(() -> retained.set(new _OwnedRuntime.Handle[] {make(15), function()}));
            awaitZero(); check(!first.isAlive() && !abandoned.isAlive(), "threads still alive");
            for (var value : retained.get()) { check(value.isClosed(), "dead-thread owner looks open"); value.close(); }
            worker(OwnedRuntimeProbe::active); awaitZero();
            check((int)bind("owned_test_fork", FunctionDescriptor.of(JAVA_INT)).invokeExact() == 1, "native inherited-lock guard");
        } else if (args[1].equals("retirement")) {
            var owners = new AtomicReference<_OwnedRuntime.Handle[]>();
            worker(() -> {
                owners.set(new _OwnedRuntime.Handle[] {make(31), function()});
                bind("owned_test_retire", FunctionDescriptor.ofVoid()).invokeExact();
                rejected(7, () -> number(owners.get()[0]));
            });
            awaitZero(); for (var owner : owners.get()) check(owner.isClosed(), "retired dead-thread owner remains usable");
        } else throw new AssertionError("unknown mode");
        long expectedExits = args[1].equals("ordinary") ? 3 : 1;
        for (int i = 0; i < 1000 && metric("exits") < expectedExits; ++i) Thread.sleep(5);
        check(metric("exits") == expectedExits, "native TLS destructor count differs");
        System.out.println("{\"mode\":\"" + args[1] + "\",\"checks\":" + checks + ",\"live\":" + metric("live")
            + ",\"identities\":" + metric("identities") + ",\"exits\":" + metric("exits") + ",\"exitErrors\":" + metric("exit_errors") + "}");
    }
}
