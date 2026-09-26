package org.leanbridge.structured;

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.lang.ref.WeakReference;
import java.util.*;
import static java.lang.foreign.ValueLayout.*;

final class GraphFaultProbe {
    private GraphFaultProbe() { }
    static int points, allocations, target, mode, checks, faults, frames, roots, scopes, clears, disposals;
    static boolean active;
    static Throwable failure;
    static Runnable during;
    static final List<Arena> arenas = new ArrayList<>();
    static final List<WeakReference<Object>> hosts = new ArrayList<>();
    static SymbolLookup symbols;
    @SuppressWarnings("unchecked")
    static <E extends Throwable> RuntimeException raise(Throwable error) throws E { throw (E)error; }
    static void check(boolean value) { ++checks; if (!value) throw new AssertionError("JVM graph fault check " + checks); }
    static void tick() {
        var action = during; during = null; if (action != null) action.run();
        if (active && ++points == target && mode == 1) throw raise(failure);
    }
    static Arena arena() {
        tick(); var arena = Arena.ofConfined();
        try { arenas.add(arena); return arena; }
        catch (Throwable error) { arena.close(); throw error; }
    }
    static MemorySegment allocate(Arena arena, long size, long alignment) {
        if (active && ++allocations == target && mode == 2) throw new OutOfMemoryError("native host arena allocation");
        return arena.allocate(size, alignment);
    }
    static void host(Object value) { hosts.add(new WeakReference<>(value)); }
    static void clear(MemorySegment value, MethodHandle clear) throws Throwable {
        boolean owned = value.get(ADDRESS, 0).address() != 0;
        clear.invokeExact(value);
        if (owned) { ++clears; check(value.get(ADDRESS, 0).address() == 0); check(value.get(ADDRESS, 8).address() == 0); }
    }
    static void clean() {
        check(scopes == 0 && frames == 0 && roots == 0);
        for (var arena : arenas) check(!arena.scope().isAlive());
        arenas.clear(); check(nativeCount("live") == 0);
    }
    static MethodHandle symbol(String name, FunctionDescriptor descriptor) {
        return Linker.nativeLinker().downcallHandle(symbols.find(name).orElseThrow(), descriptor);
    }
    static long nativeCount(String name) {
        try { return (long)symbol("fixture_fault_" + name, FunctionDescriptor.of(JAVA_LONG)).invokeExact(); }
        catch (Throwable error) { throw raise(error); }
    }
    static long identities() {
        try { return Integer.toUnsignedLong((int)symbol("fixture_live", FunctionDescriptor.of(JAVA_INT)).invokeExact()); }
        catch (Throwable error) { throw raise(error); }
    }
    static void nativeReset(long target) {
        try { symbol("fixture_fault_reset", FunctionDescriptor.ofVoid(JAVA_LONG)).invokeExact(target); }
        catch (Throwable error) { throw raise(error); }
    }
    static void poison() {
        try { symbol("fixture_fault_poison", FunctionDescriptor.ofVoid()).invokeExact(); }
        catch (Throwable error) { throw raise(error); }
    }
    static int remainingHosts() {
        int live = 0;
        for (int attempt = 0; attempt < 200; ++attempt) {
            System.gc(); Thread.yield(); live = 0;
            for (var value : hosts) if (value.get() != null) ++live;
            if (live == 0) return 0;
        }
        return live;
    }
}
