package org.leanbridge.nominalsubtypes;
import java.lang.foreign.*;
final class Scope {
        final Arena arena;
        long remaining = 16 * 1024 * 1024;
        Scope(Arena arena) { this.arena = arena; }
        void charge(long bytes) {
            if (bytes < 0 || bytes > remaining) throw new IllegalArgumentException("Lean Bridge copy budget exceeded (16 MiB per call)");
            remaining -= bytes;
        }
        MemorySegment allocate(long bytes, long alignment) { charge(bytes); return arena.allocate(bytes, alignment); }
    }
