package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.util.*;
import java.util.function.*;
import static java.lang.foreign.ValueLayout.*;

@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class OwnedCallProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities, fail, exits, exitErrors, retired;
    private static int checks, managedFailures, nativeFailures, remaining = -1;
    static void allocation() {
        if (remaining == 0) throw new OutOfMemoryError("injected managed failure");
        if (remaining > 0) --remaining;
    }
    public static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    public static void reject(Class<? extends Throwable> expected, Runnable action) {
        try { action.run(); }
        catch (Throwable error) {
            if (!expected.isInstance(error)) throw new AssertionError("Expected " + expected.getName(), error);
            checks++; return;
        }
        throw new AssertionError("Expected " + expected.getName());
    }
    private static long count(MethodHandle call) {
        try { return (long)call.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static void failAfter(long value) {
        try { fail.invokeExact(value); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static void retireRuntime() {
        try { retired.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static void status(int expected, Runnable action) {
        try { action.run(); }
        catch (LeanBridgeException error) { check(error.status() == expected, "native status " + expected); return; }
        throw new AssertionError("Expected native status " + expected);
    }
    private static void awaitExit(long expected, long allocations, long owners) {
        for (int index = 0; index < 1000 && count(exits) < expected; index++) {
            try { Thread.sleep(5); } catch (InterruptedException error) { throw new AssertionError(error); }
        }
        check(count(exits) == expected && count(exitErrors) == 0, "native TLS cleanup completed successfully");
        check(count(live) == allocations && count(identities) == owners,
            "native TLS releases reachable callback owners: " + count(live) + "/" + allocations + ", " + count(identities) + "/" + owners);
    }
    public static void drop(Object root) {
        var pending = new ArrayDeque<Object>(); pending.push(root);
        var seen = new IdentityHashMap<Object, Boolean>();
        while (!pending.isEmpty()) {
            Object value = pending.pop();
            if (seen.put(value, Boolean.TRUE) != null) continue;
            try {
                if (value instanceof _OwnedValue) ((AutoCloseable)value).close();
                else if (value instanceof Object[] array) Collections.addAll(pending, array);
                else if (value.getClass().isRecord()) {
                    for (var field : value.getClass().getRecordComponents()) pending.push(field.getAccessor().invoke(value));
                } else if (value.getClass().getPackageName().endsWith(".kotlin")) {
                    for (var field : value.getClass().getFields())
                        if (!java.lang.reflect.Modifier.isStatic(field.getModifiers())) pending.push(field.get(value));
                }
            } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
        }
    }
    private static boolean attempt(Supplier<Object> action, int index, boolean nativeFailure) {
        try {
            if (nativeFailure) failAfter(index); else remaining = index;
            Object result = action.get(); remaining = -1; failAfter(-1); drop(result); return true;
        } catch (OutOfMemoryError error) {
            if (nativeFailure) throw error;
            managedFailures++; return false;
        } catch (LeanBridgeException error) {
            if (!nativeFailure || error.status() != 3) throw error;
            nativeFailures++; return false;
        } finally { remaining = -1; failAfter(-1); }
    }
    public static void failures(Supplier<Object> action) {
        bindings.runtime.current().require(); long allocations = count(live), resources = count(identities);
        for (boolean nativeFailure : new boolean[] { false, true }) {
            boolean finished = false;
            for (int index = 0; index < 4000; index++) {
                finished = attempt(action, index, nativeFailure); bindings.runtime.current().require();
                check(count(live) == allocations, "allocation rollback " + nativeFailure + "/" + index + ": " + count(live) + " != " + allocations);
                check(count(identities) == resources, "identity rollback " + nativeFailure + "/" + index + ": " + count(identities) + " != " + resources);
                if (finished) break;
            }
            check(finished, "fault injection reaches a successful call");
        }
    }
    /* METHODS */
    /* EXERCISE */
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library);
            bindings = new _OwnedBindings(symbols, () -> { });
            var linker = Linker.nativeLinker();
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            fail = linker.downcallHandle(symbols.find("probe_fail").orElseThrow(), FunctionDescriptor.ofVoid(JAVA_LONG));
            exits = linker.downcallHandle(symbols.find("probe_exits").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            exitErrors = linker.downcallHandle(symbols.find("probe_exit_errors").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            retired = linker.downcallHandle(symbols.find("lean_bridge_native_runtime_retire").orElseThrow(), FunctionDescriptor.ofVoid());
            if (args.length > 1) {
                Object target = args[1].equals("java") ? null : KotlinCallProbe.INSTANCE;
                Class<?> type = target == null ? OwnedCallProbe.class : KotlinCallProbe.class;
                try { type.getDeclaredMethod("retirement").invoke(target); }
                catch (ReflectiveOperationException error) {
                    throw _OwnedRuntime.rethrow(error.getCause() == null ? error : error.getCause());
                }
                bindings.runtime.current().close();
                check(count(live) == 0 && count(identities) == 0, "retired callback leaves no owners");
                System.out.println("{\"checks\":" + checks + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + "}");
                return;
            }
            bindings.runtime.current().require(); long baseline = count(live), owners = count(identities);
            exercise();
            check(count(live) == baseline && count(identities) == owners, "Java releases every owner before session shutdown");
            int javaChecks = checks;
            KotlinCallProbe.INSTANCE.run();
            check(count(live) == baseline && count(identities) == owners, "Kotlin releases every owner before session shutdown");
            int kotlinChecks = checks - javaChecks;
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all native allocations and identities released");
            System.out.println("{\"javaChecks\":" + javaChecks + ",\"kotlinChecks\":" + kotlinChecks + ",\"managedFailures\":" + managedFailures +
                ",\"nativeFailures\":" + nativeFailures + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) +
                ",\"threadExits\":" + count(exits) + ",\"threadExitErrors\":" + count(exitErrors) + "}");
        }
    }
}
