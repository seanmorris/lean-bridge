/**
 * Java and Kotlin leases follow the native snapshot-owner handoff slots.
 *
 * @file
 */

/** Consume only the identities visited while preparing each transferred input. */
export const ownedJvmTransfers = `import java.lang.foreign.MemorySegment;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

final class _OwnedInputTransfers implements AutoCloseable {
    // isClosed() is observable on other threads. Shared arenas and this monitor
    // keep those reads valid while the creator thread detaches the native slot.
    static final class Signal {
        private MemorySegment out;
        private boolean consumed;
        Signal(MemorySegment out) { this.out = out; }
        synchronized boolean consumed() { return out == null ? consumed : out.get(JAVA_LONG, 0) == 0; }
        synchronized void finish() {
            if (out != null) { consumed = out.get(JAVA_LONG, 0) == 0; out = null; }
        }
    }
    private record Entry(_OwnedRuntime.Lease lease, int group) { }
    private final _OwnedRuntime.State state;
    final _OwnedRuntime.Result[] owners;
    private final Signal[] signals;
    private final ArrayList<Entry> entries;
    private final IdentityHashMap<_OwnedRuntime.Lease, Entry> leases;
    private boolean finished;
    _OwnedInputTransfers(_OwnedRuntime.State state, int count, _OwnedConvert.Scope scope) {
        this.state = state;
        scope.storage(count, 256); _OwnedRuntime.checkpoint();
        owners = new _OwnedRuntime.Result[count];
        _OwnedRuntime.checkpoint(); signals = new Signal[count];
        _OwnedRuntime.checkpoint(); entries = new ArrayList<>();
        _OwnedRuntime.checkpoint(); leases = new IdentityHashMap<>();
        try {
            for (int index = 0; index < count; index++) {
                _OwnedRuntime.checkpoint(); owners[index] = new _OwnedRuntime.Result(state, true);
                _OwnedRuntime.checkpoint(); signals[index] = new Signal(owners[index].output());
            }
        } catch (Throwable error) { close(); throw error; }
    }
    private void ready(_OwnedRuntime.Lease lease) {
        lease.require();
        if (lease.state != state || lease.scope != null) _OwnedRuntime.check(1);
        if (lease.inputMove != null) _OwnedRuntime.check(8);
    }
    void add(_OwnedRuntime.Lease lease, int group, _OwnedConvert.Scope scope) {
        ready(lease); var previous = leases.get(lease);
        if (previous != null) {
            if (previous.group() != group) _OwnedRuntime.check(1);
            return;
        }
        scope.storage(256, 1); _OwnedRuntime.checkpoint(); var entry = new Entry(lease, group);
        _OwnedRuntime.checkpoint(); entries.add(entry);
        _OwnedRuntime.checkpoint(); leases.put(lease, entry);
    }
    void arm() {
        state.require();
        for (int index = 0; index < signals.length; index++) if (signals[index].consumed()) _OwnedRuntime.check(9);
        for (int index = 0; index < entries.size(); index++) ready(entries.get(index).lease());
        for (int index = 0; index < entries.size(); index++) {
            var entry = entries.get(index); entry.lease().inputMove = signals[entry.group()];
        }
    }
    void finish() {
        if (finished) return;
        for (int index = 0; index < signals.length; index++) if (signals[index] != null) signals[index].finish();
        // Mark all original owners before a release can invoke a user finalizer.
        for (int index = 0; index < entries.size(); index++) {
            var entry = entries.get(index); var signal = signals[entry.group()];
            if (entry.lease().inputMove == signal && signal.consumed()) entry.lease().slot.pending.set(true);
        }
        for (int index = 0; index < entries.size(); index++) {
            var entry = entries.get(index);
            if (entry.lease().inputMove == signals[entry.group()]) entry.lease().inputMove = null;
        }
        finished = true; state.drain();
    }
    @Override public void close() {
        Throwable failure = null;
        try { finish(); } catch (Throwable error) { failure = error; }
        for (int index = owners.length - 1; index >= 0; index--) if (owners[index] != null) {
            try { owners[index].close(); } catch (Throwable error) { if (failure == null) failure = error; }
        }
        entries.clear(); leases.clear();
        if (failure != null) throw _OwnedRuntime.rethrow(failure);
    }
}
`;
