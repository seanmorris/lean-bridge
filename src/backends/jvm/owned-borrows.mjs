/**
 * Whole JVM values preserve original native owners, including empty results.
 *
 * @file
 */
import { ownedJvmOwnerName } from "./owned-receivers.mjs";

export const ownedJvmWholeValue = `/** A complete Lean value with an explicitly checked original owner. */
public final class Value<T> implements AutoCloseable {
    private static final java.lang.ref.Cleaner CLEANER = java.lang.ref.Cleaner.create();
    final _OwnedRuntime.WholeGuard<T> guard;
    private final java.lang.ref.Cleaner.Cleanable cleanable;
    private final java.util.function.Function<T, Value<T>> retain;
    private final java.util.function.BiPredicate<Object, Object> equal;
    private final boolean kotlin;
    Value(_OwnedRuntime.Lease lease, T value,
          java.util.function.Function<T, Value<T>> retain,
          java.util.function.BiPredicate<Object, Object> equal, boolean kotlin) {
        this.retain = java.util.Objects.requireNonNull(retain);
        this.equal = java.util.Objects.requireNonNull(equal); this.kotlin = kotlin;
        guard = new _OwnedRuntime.WholeGuard<>(lease, value);
        try { _OwnedRuntime.checkpoint(); cleanable = CLEANER.register(this, guard); }
        catch (Throwable error) { guard.close(false); throw error; }
    }
    public T get() {
        try { return guard.get(); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
    public boolean isClosed() { return guard.isClosed(); }
    public Value<T> share() {
        try { return new Value<>(guard.lease, get(), retain, equal, kotlin); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
    public Value<T> retain() {
        try { return retain.apply(get()); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
    @Override public void close() {
        guard.lease.state.runtime.ensureProcess(); guard.close(false); cleanable.clean();
    }
    @Override public boolean equals(Object other) {
        try {
            T value = get();
            if (!(other instanceof Value<?> owner)) return false;
            Object candidate = owner.get();
            return kotlin == owner.kotlin && equal.test(value, candidate);
        } finally { java.lang.ref.Reference.reachabilityFence(this); java.lang.ref.Reference.reachabilityFence(other); }
    }
    @Override public int hashCode() { throw new UnsupportedOperationException("Lean owners cannot be dictionary keys"); }
}
`;

export const ownedJvmWholeGuard = `
    static final class WholeGuard<T> implements Runnable {
        final Lease lease;
        private volatile T value;
        private final AtomicBoolean closed = new AtomicBoolean();
        private boolean acquired;
        WholeGuard(Lease lease, T value) {
            this.lease = lease; this.value = value;
            checkpoint(); lease.acquire(); acquired = true;
        }
        boolean isClosed() { return closed.get() || lease.isClosed(); }
        T get() { T snapshot = value; lease.require(); if (closed.get()) check(4); return snapshot; }
        Lease require(State state) {
            get(); if (lease.state != state) check(1); return lease;
        }
        void close(boolean cleaning) {
            if (!closed.compareAndSet(false, true)) return;
            value = null; if (acquired) lease.release(cleaning);
        }
        @Override public void run() { close(true); }
    }
`;

export const ownedJvmOriginalTransfers = `import java.lang.foreign.Arena;
import java.lang.foreign.MemorySegment;
import static java.lang.foreign.ValueLayout.JAVA_LONG;

final class _OwnedInputTransfers implements AutoCloseable {
    static final class Signal {
        private MemorySegment owner;
        private boolean consumed;
        Signal(MemorySegment owner) { this.owner = owner; }
        synchronized boolean consumed() { return owner == null ? consumed : owner.get(JAVA_LONG, 0) == 0; }
        synchronized void finish() {
            if (owner != null) { consumed = owner.get(JAVA_LONG, 0) == 0; owner = null; }
        }
    }
    private final _OwnedRuntime.State state;
    private final Arena arena;
    private final _OwnedRuntime.Lease[] leases;
    private final Signal[] signals;
    private final MemorySegment[] owners;
    private boolean armed, finished;
    _OwnedInputTransfers(_OwnedRuntime.State state, int count, _OwnedConvert.Scope scope) {
        this.state = state;
        scope.storage(count, 256); _OwnedRuntime.checkpoint();
        leases = new _OwnedRuntime.Lease[count]; signals = new Signal[count];
        owners = new MemorySegment[count]; arena = Arena.ofShared();
        try {
            for (int index = 0; index < count; ++index) {
                _OwnedRuntime.checkpoint(); owners[index] = arena.allocate(JAVA_LONG);
                owners[index].set(JAVA_LONG, 0, 0);
                _OwnedRuntime.checkpoint(); signals[index] = new Signal(owners[index]);
            }
        } catch (Throwable error) { arena.close(); throw error; }
    }
    private void ready(_OwnedRuntime.Lease lease) {
        lease.require();
        if (lease.state != state || lease.scope != null || lease.borrowedResult || lease.slot == null)
            _OwnedRuntime.check(1);
        if (lease.inputMove != null) _OwnedRuntime.check(8);
    }
    void add(_OwnedRuntime.Lease lease, int group) {
        ready(lease); if (leases[group] != null) _OwnedRuntime.check(1);
        for (var previous : leases) if (previous == lease) _OwnedRuntime.check(1);
        leases[group] = lease;
    }
    MemorySegment owner(int group) { return owners[group]; }
    void arm() {
        state.require(); for (var lease : leases) ready(lease);
        for (int index = 0; index < leases.length; ++index) owners[index].set(JAVA_LONG, 0, leases[index].slot.value);
        armed = true;
        for (int index = 0; index < leases.length; ++index) leases[index].inputMove = signals[index];
    }
    void finish() {
        if (!armed || finished) return;
        for (var signal : signals) signal.finish();
        for (int index = 0; index < leases.length; ++index) {
            var lease = leases[index]; lease.slot.value = owners[index].get(JAVA_LONG, 0);
            if (lease.slot.value == 0) lease.slot.pending.set(true);
            lease.inputMove = null;
        }
        finished = true; state.drain();
    }
    @Override public void close() {
        try { finish(); }
        finally { java.util.Arrays.fill(leases, null); arena.close(); }
    }
}
`;

export const ownedJvmWholeScope = `
        <T> T whole(Value<T> value) {
            java.util.Objects.requireNonNull(value);
            var lease = value.guard.require(state);
            storage(64, 1); checkpoint(); lease.acquire();
            try { roots.add(lease); }
            catch (Throwable error) { lease.release(false); throw error; }
            return value.get();
        }
`;

/**
 * Keep whole owners, rather than fresh snapshots, across the native boundary.
 *
 * @param context - Checked types, symbols and language-family names.
 * @param fn - Export, closure invocation or typed copy.
 * @param index - Native symbol position.
 * @param kotlin - Select the Kotlin nominal family.
 */
export const ownedJvmAnchoredCall = (context, fn, index, kotlin) => {
	const { model, nodes, calls, type, parameterType, returnType, name } = context;
	const { c } = model, family = kotlin ? "Kotlin" : "Java";
	const catalog = kotlin ? "_KotlinOwnedTypes.CATALOG" : "_OwnedTypes.CATALOG";
	const factory = kotlin ? "kotlinFactory" : "javaFactory";
	const equality = kotlin ? "_KotlinOwnedValues" : "GraphValues";
	const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
	const moving = fn.transfers ?? [], wraps = i => moving.includes(i) || fn.anchor === i;
	const whole = result.representation !== "copied" && !fn.rawResult;
	const ownerName = ownedJvmOwnerName(result, kotlin);
	const copy = calls.find(call => call.wholeCopy && call.id === result.id);
	if(whole && !copy) throw new TypeError(`Missing JVM whole-value copy for ${result.id}`);
	const borrowed = fn.anchor !== undefined;
	const write = (node, i, scope, check) => fn.handle && i === 0
		? `MemorySegment.ofAddress(${scope}.root(arg${i}))`
		: c.hostArgument?.(fn, i) ? `host${family}${node.index}(arg${i}, ${scope}, ${check ? "null" : "frame"})`
			: `_OwnedConvert.write(${catalog}, ${node.index}, ${wraps(i) ? `${scope}.whole(arg${i})` : `arg${i}`}, ${scope})`;
	const arguments_ = ["session"
		, ...parameters.flatMap((node, i) => [
			fn.handle && i === 0 || c.hostArgument?.(fn, i) || node.aggregate ? `input${i}` : `input${i}.get(${node.valueLayout}, 0)`
			, ...moving.includes(i) ? [`moves.owner(${moving.indexOf(i)})`] : []
			, ...fn.anchor === i ? ["anchor"] : []
		])
		, "output", "resultOwner"].join(", ");
	const invoke = moving.length ? `            moves.arm();
            int status;
            try { status = (int)symbols[${index}].invokeExact(${arguments_}); }
            finally { moves.finish(); }
            frame.finish(status);` : `            frame.finish((int)symbols[${index}].invokeExact(${arguments_}));`;
	return `    @SuppressWarnings("unchecked")
    ${returnType(fn, kotlin)} ${name(fn, family)}(${parameters.map((_, i) => `${parameterType(fn, i, kotlin)} arg${i}`).join(", ")}) {
        var state = runtime.current(); ready();
        try (var check = new _OwnedConvert.Scope(state, true, null, null)) {
${parameters.map((node, i) => `            ${write(node, i, "check", true)};`).join("\n") || "            check.require();"}
        }
        try (var inputs = new _OwnedConvert.Scope(state, false, null, null);
             var frame = new _OwnedCallFrame(this, inputs);${moving.length ? `
             var moves = new _OwnedInputTransfers(state, ${moving.length}, inputs);` : ""}
             var owner = new _OwnedRuntime.Result(state);
             var outputs = new _OwnedConvert.Scope(state, false, ${factory}, () -> owner.adopt(${borrowed}, ${whole}), inputs.budget)) {
${parameters.map((node, i) => `            var input${i} = ${write(node, i, "inputs", false)};`).join("\n")}
${moving.map((i, group) => `            moves.add(arg${i}.guard.require(state), ${group});`).join("\n")}
            var output = outputs.allocate(${result.size}, ${result.alignment});
            var session = MemorySegment.ofAddress(state.require());
            var resultOwner = owner.output();
${borrowed ? `            var anchor = MemorySegment.ofAddress(arg${fn.anchor}.guard.require(state).owner(state));\n` : ""}\
${invoke}
            ready();
            var result = (${type(result.id, kotlin)})_OwnedConvert.read(${catalog}, ${result.index}, output, outputs);
${whole ? `            _OwnedRuntime.checkpoint();
            var value = new ${ownerName ? `${ownerName}(this, ` : "Value<>("}owner.adopt(${borrowed}, true), result, this::${name(copy, family)}, ${equality}::equal${ownerName ? "" : `, ${kotlin}`});
            try { _OwnedRuntime.checkpoint(); ready(); outputs.complete(); owner.complete(); return value; }
            catch (Throwable error) { value.close(); throw error; }` : "            _OwnedRuntime.checkpoint(); ready(); outputs.complete(); owner.complete(); return result;"}
        } catch (_OwnedConvert.InvalidNative error) {
            retire();
            var failure = new LeanBridgeException(9, error.getMessage()); failure.initCause(error); throw failure;
        } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }`;
};
