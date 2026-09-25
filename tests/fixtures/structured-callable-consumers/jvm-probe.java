// Private instrumentation only. These classes never enter the release JAR.
package org.leanbridge.structured;

import java.lang.foreign.*;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import static java.lang.foreign.ValueLayout.*;

final class StructuredProbe {
    private StructuredProbe() { }
    static int count, target, checks, calls, clears, disposals;
    static boolean active;
    static Throwable failure;
    static Runnable deferred;
    static final List<Arena> arenas = new ArrayList<>();
    static final List<WeakReference<Object>> hosts = new ArrayList<>();

    @SuppressWarnings("unchecked")
    static <E extends Throwable> RuntimeException raise(Throwable error) throws E { throw (E)error; }
    static void check(boolean value) {
        ++checks;
        if (!value) throw new AssertionError("structured JVM fault check " + checks);
    }
    static void tick() {
        if (!active) return;
        ++count;
        if (deferred != null) { var action = deferred; deferred = null; action.run(); }
        if (count == target) throw raise(failure);
    }
    static Arena arena() {
        var arena = Arena.ofConfined();
        try { arenas.add(arena); return arena; }
        catch (Throwable error) { arena.close(); throw error; }
    }
    static MemorySegment allocate(Arena arena, long size, long alignment) {
        tick(); var value = arena.allocate(size, alignment); tick(); return value;
    }
    static <T> T host(T value) {
        tick(); hosts.add(new WeakReference<>(value)); tick(); return value;
    }
    static int openArenas() {
        int result = 0;
        for (var arena : arenas) if (arena.scope().isAlive()) ++result;
        return result;
    }
    static void reset() {
        check(openArenas() == 0); arenas.clear();
        count = target = 0; deferred = null; failure = null;
    }
    static void zero(MemorySegment value) {
        for (long offset = 0; offset < value.byteSize(); ++offset) check(value.get(JAVA_BYTE, offset) == 0);
    }
    static void cleared(MemorySegment value) { ++clears; zero(value); }
    static void disposed(MemorySegment value) { ++disposals; zero(value); }
    private static int liveHosts() {
        int result = 0;
        for (var host : hosts) if (host.get() != null) ++result;
        return result;
    }
    static int releasedHosts() {
        check(openArenas() == 0); arenas.clear();
        for (int attempt = 0; attempt < 20 && liveHosts() != 0; ++attempt) {
            System.gc(); Thread.yield();
        }
        return liveHosts();
    }
}
