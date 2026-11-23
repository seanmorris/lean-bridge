package __PACKAGE__;

import java.lang.invoke.*;
import static java.lang.invoke.MethodType.methodType;

/** Component-private. A peer borrows only a live resource of the exact Lean kind and ledger. */
final class ResourcePort<T> {
    private final Class<T> type;
    private final int index, tag;
    private final String ledger;
    private final MethodHandle create, key, domain, dispatch;
    ResourcePort(Class<T> type, String ledger, int index, int tag) {
        this.type = type; this.ledger = ledger; this.index = index; this.tag = tag;
        try {
            var self = MethodHandles.lookup();
            var access = MethodHandles.privateLookupIn(type, self);
            create = access.findConstructor(type, methodType(void.class, String.class, long.class, long.class, MethodHandle.class))
                .asType(methodType(Object.class, String.class, long.class, long.class, MethodHandle.class));
            key = access.findVirtual(type, "key", methodType(long.class, String.class)).asType(methodType(long.class, Object.class, String.class));
            domain = access.findGetter(type, "domain", long.class).asType(methodType(long.class, Object.class));
            dispatch = self.findVirtual(ResourcePort.class, "operation", methodType(Object.class, int.class, long.class, long.class, Object.class)).bindTo(this);
        } catch (ReflectiveOperationException e) { throw new IllegalStateException("Incompatible generated Lean resource class", e); }
    }
    void borrow(Wire f, int slot, T value) {
        Object v = type.cast(java.util.Objects.requireNonNull(value));
        try { f.leaseWords(slot, (long)key.invokeExact(v, ledger), (long)domain.invokeExact(v)); }
        catch (RuntimeException | Error e) { throw e; }
        catch (Throwable t) { throw new IllegalStateException("Cannot borrow Lean resource", t); }
    }
    // Until the constructor succeeds, the native result slot still owns the lease.
    T take(Wire f) {
        long id = f.leaseId(tag), scope = f.leaseDomain();
        try {
            T value = type.cast((Object)create.invokeExact(ledger, id, scope, dispatch));
            f.disownLease(); return value;
        } catch (RuntimeException | Error e) { throw e; }
        catch (Throwable t) { throw new IllegalStateException("Cannot construct Lean resource", t); }
    }
    private Object operation(int op, long id, long scope, Object other) {
        try (var f = new Wire(op == 2 ? 2 : 1, 1)) {
            f.leaseWords(0, id, scope);
            if (op == 2) borrow(f, 1, type.cast(other));
            Wire.success(f.call(-1 - 3 * index - op));
            return switch (op) { case 0 -> null; case 1 -> take(f); case 2 -> f.tag(0); default -> throw new AssertionError(); };
        }
    }
}
