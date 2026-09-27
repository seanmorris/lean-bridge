package org.leanbridge.owned_aggregates;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.util.*;
import java.util.function.*;
import static java.lang.foreign.ValueLayout.*;

@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class OwnedConversionProbe {
    private static _OwnedRuntime runtime;
    private static SymbolLookup symbols;
    private static MethodHandle live, identities, fail;
    private static int checks, managedFailures, nativeFailures, remaining = -1;
    private static final Map<String, Integer> types = new HashMap<>();
    static void allocation() {
        if (remaining == 0) throw new OutOfMemoryError("injected managed failure");
        if (remaining > 0) --remaining;
    }
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    private static void reject(Class<? extends Throwable> expected, Runnable action) {
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
    private static void drop(Object root) {
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
                }
            } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
        }
    }
    private static <T extends Record> T with(T value, String fieldName, Object replacement) {
        var fields = value.getClass().getRecordComponents();
        var arguments = new Object[fields.length]; var types = new Class<?>[fields.length];
        boolean found = false;
        try {
            for (int i = 0; i < fields.length; i++) {
                types[i] = fields[i].getType(); arguments[i] = fields[i].getAccessor().invoke(value);
                if (fields[i].getName().equals(fieldName)) { arguments[i] = replacement; found = true; }
            }
            if (!found) throw new AssertionError(fieldName);
            return (T)value.getClass().getDeclaredConstructor(types).newInstance(arguments);
        } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
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
    private static void failures(Supplier<Object> action) {
        runtime.current().require(); long allocations = count(live), resources = count(identities);
        for (boolean nativeFailure : new boolean[] { false, true }) {
            boolean finished = false;
            for (int index = 0; index < 3000; index++) {
                finished = attempt(action, index, nativeFailure); runtime.current().require();
                check(count(live) == allocations, "allocation rollback " + nativeFailure + "/" + index + ": " + count(live) + " != " + allocations);
                check(count(identities) == resources, "identity rollback " + nativeFailure + "/" + index);
                if (finished) break;
            }
            check(finished, "fault injection reaches a successful call");
        }
    }
    private static void bad(_OwnedTypes.Node node, Class<? extends Throwable> failure, BiConsumer<MemorySegment, Arena> fill) {
        reject(failure, () -> {
            try (var arena = Arena.ofConfined(); var scope = new _OwnedConvert.Scope(runtime.current(), false, null, null)) {
                var raw = arena.allocate(node.layout()); raw.fill((byte)0); fill.accept(raw, arena);
                _OwnedConvert.read(node.id(), raw, scope);
            }
        });
    }
    private static void malformed() {
        for (var node : _OwnedTypes.NODES) {
            if (node.kind() == 2) bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> raw.set(JAVA_INT, 0, -1));
            if (node.kind() == 3) bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> raw.set(JAVA_BYTE, 0, (byte)2));
            if (node.kind() == 1 || node.scalar() == 15 || node.scalar() == 16) {
                bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> raw.set(JAVA_LONG, 8, 1));
                bad(node, _OwnedConvert.Limit.class, (raw, arena) -> raw.set(JAVA_LONG, 8, -1));
            }
            if (node.scalar() == 0 || node.scalar() == 1)
                bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> raw.set(JAVA_BYTE, 0, (byte)2));
            if (node.scalar() == 2) for (int value : new int[] { -1, 0xd800, 0x110000 })
                bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> raw.set(JAVA_INT, 0, value));
            if (node.scalar() == 15) for (byte[] bytes : new byte[][] {
                { (byte)0xff }, { (byte)0xc0, (byte)0x80 }, { (byte)0xe2, (byte)0x82 },
                { (byte)0xed, (byte)0xa0, (byte)0x80 }, { (byte)0xf4, (byte)0x90, (byte)0x80, (byte)0x80 }
            }) bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> {
                var data = arena.allocate(bytes.length);
                MemorySegment.copy(bytes, 0, data, JAVA_BYTE, 0, bytes.length);
                raw.set(ADDRESS, 0, data); raw.set(JAVA_LONG, 8, bytes.length);
            });
            if (node.scalar() == 17 || node.scalar() == 18) {
                for (int[] values : new int[][] { { -1, 0 }, { 0, Integer.MIN_VALUE }, { 0, 1 }, { 1, 1 } })
                    bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> {
                        var mpz = arena.allocate(16, 8); mpz.fill((byte)0);
                        mpz.set(JAVA_INT, 0, values[0]); mpz.set(JAVA_INT, 4, values[1]); raw.set(ADDRESS, 0, mpz);
                    });
                bad(node, _OwnedConvert.InvalidNative.class, (raw, arena) -> {
                    var mpz = arena.allocate(16, 8); var data = arena.allocate(8, 8); data.fill((byte)0);
                    mpz.set(JAVA_INT, 0, 1); mpz.set(JAVA_INT, 4, 1); mpz.set(ADDRESS, 8, data); raw.set(ADDRESS, 0, mpz);
                });
                bad(node, _OwnedConvert.Limit.class, (raw, arena) -> {
                    var mpz = arena.allocate(16, 8);
                    mpz.set(JAVA_INT, 0, Integer.MAX_VALUE); mpz.set(JAVA_INT, 4, Integer.MAX_VALUE); raw.set(ADDRESS, 0, mpz);
                });
            }
        }
        reject(_OwnedConvert.InvalidNative.class, () -> _OwnedConvert.checked(MemorySegment.ofAddress(1), 1, 8, 8));
        reject(_OwnedConvert.InvalidNative.class, () -> _OwnedConvert.checked(MemorySegment.ofAddress(-8), 2, 8, 8));
        if (types.containsKey("Tree")) {
            var tree = _OwnedTypes.NODES[types.get("Tree")]; var edge = tree.branches()[1][0];
            bad(tree, _OwnedConvert.InvalidNative.class, (raw, arena) -> {
                var sequence = arena.allocate(_OwnedTypes.NODES[edge.type()].layout());
                sequence.set(ADDRESS, 0, raw); sequence.set(JAVA_LONG, 8, 1);
                raw.set(JAVA_INT, 0, 1); raw.set(ADDRESS, edge.offset(), sequence);
            });
        }
    }
    private static void lifetimes() {
        var ticket = newTicket(BigInteger.valueOf(9), "pins");
        var state = runtime.current(); int id = types.get("Ticket");
        long before = count(identities);
        try (var inputs = new _OwnedConvert.Scope(state, false, null, null)) {
            _OwnedConvert.write(id, ticket, inputs); ticket.close();
            check(ticket.isClosed() && count(identities) == before, "input lease pin survives closing the source wrapper");
        }
        check(count(identities) < before, "input pin is released at scope exit");
        try (var original = newTicket(BigInteger.TEN, "borrow"); var arena = Arena.ofConfined()) {
            Ticket escaped, retained;
            try (var frame = new _OwnedRuntime.BorrowFrame(state);
                 var scope = new _OwnedConvert.Scope(state, false, OwnedConversionProbe::factory, () -> frame.lease)) {
                var raw = arena.allocate(ADDRESS);
                raw.set(ADDRESS, 0, MemorySegment.ofAddress(original.handle.raw(state)));
                escaped = (Ticket)_OwnedConvert.read(id, raw, scope); retained = escaped.retain(); scope.complete();
            }
            check(escaped.isClosed() && !retained.isClosed(), "borrow expiration and independent retain");
            reject(LeanBridgeException.class, escaped::retain); escaped.close(); retained.close();
        }
    }
    /* FACTORY */
    /* METHODS */
    /* EXERCISE */
    public static void main(String[] args) {
        /* TYPE IDS */
        try (var library = Arena.ofShared()) {
            symbols = SymbolLookup.libraryLookup(args[0], library); runtime = new _OwnedRuntime(symbols);
            var linker = Linker.nativeLinker();
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            fail = linker.downcallHandle(symbols.find("probe_fail").orElseThrow(), FunctionDescriptor.ofVoid(JAVA_LONG));
            lifetimes(); exercise(); malformed(); runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all native allocations and identities released");
            System.out.println("{\"checks\":" + checks + ",\"managedFailures\":" + managedFailures +
                ",\"nativeFailures\":" + nativeFailures + ",\"live\":" + count(live) + ",\"identities\":" + count(identities) + "}");
        }
    }
}
