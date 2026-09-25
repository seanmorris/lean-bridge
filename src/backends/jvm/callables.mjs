/**
 * Typed JVM upcalls and thread-bound owned Lean functions over the private C ABI.
 *
 * @file
 */
import { readJvmValue } from "./copied-conversions.mjs";

/**
 * Resolve a checked primitive/copy or callable reference.
 *
 * @param model - Closed JVM projection.
 * @param ref - Binding IR reference.
 */
export const jvmValue = (model, ref) => model.surface.callbacks.get(ref.id) ?? model.surface.copy(ref);
const callable = value => Boolean(value.type?.callable);
const unit = value => value.scalarName === "unit";
/**
 * Spell a public result without exposing FFM segments.
 *
 * @param model - Closed JVM projection.
 * @param value - Admitted value.
 */
export const jvmResult = (model, value) => callable(value) ? `${value.publicName}.LeanClosure` : unit(value) ? "void" : model.publicType(value);

/** Private process, callback and cleanup state, also compiled by the contract test. */
export const jvmCallableState = `
    static final class ProcessGuard {
        private static final MethodHandle PID = Linker.nativeLinker().downcallHandle(
            Linker.nativeLinker().defaultLookup().find("getpid").orElseThrow(), FunctionDescriptor.of(JAVA_INT));
        private static int pid() {
            try { return (int)PID.invokeExact(); } catch (Throwable error) { throw new ExceptionInInitializerError(error); }
        }
        private static final int PROCESS = pid();
        static boolean isCurrent() { return PROCESS == pid(); }
        static void ensure() {
            if (!isCurrent()) throw new IllegalStateException("Start a fresh process after fork to use Lean");
        }
        static void platformThread() {
            ensure();
            if (Thread.currentThread().isVirtual()) throw new IllegalStateException("Lean callables require a platform thread");
        }
    }
    @SuppressWarnings("unchecked")
    static <E extends Throwable> RuntimeException rethrow(Throwable error) throws E { throw (E)error; }
    private static final java.lang.ref.Cleaner CLEANER = java.lang.ref.Cleaner.create();
    static final class CallbackFrame {
        Throwable failure;
        void check() { if (failure != null) throw rethrow(failure); }
    }
    static final class ClosureLease implements Runnable {
        private final MethodHandle release;
        private final Thread thread = Thread.currentThread();
        private long pointer;
        private int active;
        private boolean closed;
        ClosureLease(MethodHandle release) { ProcessGuard.platformThread(); this.release = release; }
        void adopt(MemorySegment output) { pointer = output.get(ADDRESS, 0).address(); output.set(ADDRESS, 0, MemorySegment.NULL); }
        boolean isClosed() { ProcessGuard.ensure(); synchronized (this) { return closed; } }
        long enter() {
            ProcessGuard.platformThread();
            synchronized (this) {
                if (closed || pointer == 0) throw new IllegalStateException("Lean closure is closed");
                if (thread != Thread.currentThread()) throw new IllegalStateException("Lean closure must be invoked on its creating thread");
                ++active; return pointer;
            }
        }
        synchronized void leave() { --active; if (closed && active == 0) drop(); }
        void close() {
            ProcessGuard.ensure();
            synchronized (this) { closed = true; if (active == 0) drop(); }
        }
        private void drop() {
            if (pointer == 0) return;
            try (Arena arena = Arena.ofConfined()) {
                var output = arena.allocate(ADDRESS); output.set(ADDRESS, 0, MemorySegment.ofAddress(pointer));
                release.invokeExact(output); pointer = 0;
            } catch (Throwable error) { throw rethrow(error); }
        }
        @Override public void run() {
            // A Cleaner must not enter an inherited native mutex after fork.
            try { if (ProcessGuard.isCurrent()) close(); } catch (Throwable ignored) { }
        }
    }
    static java.lang.ref.Cleaner.Cleanable register(Object owner, ClosureLease lease) { return CLEANER.register(owner, lease); }
`;

/**
 * Generate a SAM interface and its owned, directly invocable returned function.
 *
 * @param model - Closed JVM projection.
 * @param callback - Admitted primitive signature.
 */
export const jvmCallablePublic = (model, callback) => {
	const { parameters, result } = callback.type.callable;
	const name = callback.publicName.split(".").at(-1);
	const runtime = model.runtimeName ?? "Runtime", state = model.callableStateRuntime ?? runtime;
	const output = jvmValue(model, result.type), type = jvmResult(model, output);
	const args = parameters.map((_, i) => `arg${i}`).join(", ");
	const signature = parameters.map((site, i) => `${model.publicType(jvmValue(model, site.type))} arg${i}`).join(", ");
	return `package ${model.namespace};
/** A synchronous ${callback.structured ? "copied-value" : "primitive"} function. Arguments and results are copied. */
@FunctionalInterface
public interface ${name} {
    ${type} invoke(${signature});
    /** An owned Lean function. Invoke on its creating platform thread; close after use. */
    final class LeanClosure implements ${name}, AutoCloseable {
        private final ${state}.ClosureLease lease;
        private final java.lang.ref.Cleaner.Cleanable cleanable;
        LeanClosure(${state}.ClosureLease lease) { this.lease = lease; cleanable = ${state}.register(this, lease); }
        @Override public ${type} invoke(${signature}) {
            try { ${unit(output) ? "" : "return "}${runtime}.invoke${callback.index}(lease, ${args}); }
            finally { java.lang.ref.Reference.reachabilityFence(this); }
        }
        public boolean isClosed() { return lease.isClosed(); }
        @Override public void close() { lease.close(); cleanable.clean(); }
    }
}
`;
};

/**
 * Generate a typed downcall with scoped upcalls, exact exception recovery and cleanup.
 *
 * @param model - Closed JVM projection.
 * @param options - Managed call and native entry point.
 * @param options.name - Java method name.
 * @param options.native - Native method handle.
 * @param options.parameters - Binding IR argument sites.
 * @param options.result - Binding IR result site.
 * @param options.closure - Invoke an existing owned lease.
 */
export const jvmNativeCall = (model, { name, native, parameters, result, closure = false }) => {
	const inputs = parameters.map(site => jvmValue(model, site.type)), output = jvmValue(model, result.type);
	const owner = model.callableRuntime ? `${model.callableRuntime}.` : "";
	const hasCallbacks = inputs.some(callable), scope = hasCallbacks || inputs.some(value => value.aggregate);
	const args = [...closure ? ["MemorySegment.ofAddress(token)"] : [], ...inputs.map((_, i) => `input${i}`), ...unit(output) ? [] : ["output"], "error"];
	return `    static ${jvmResult(model, output)} ${name}(${[...closure ? ["ClosureLease lease"] : [], ...inputs.map((value, i) => `${model.publicType(value)} arg${i}`)].join(", ")}) {
        ${model.surface.callbacks.size ? `${owner}ProcessGuard.${hasCallbacks || closure || callable(output) ? "platformThread" : "ensure"}();` : ""}
        ${closure ? "long token = lease.enter();" : ""}
        try (Arena arena = Arena.ofConfined()) {
            ${scope ? "var scope = new Scope(arena);" : ""}
            ${hasCallbacks ? `var callbacks = new ${owner}CallbackFrame();` : ""}
${inputs.map((value, i) => `            ${value.nativeType} input${i} = ${callable(value) ? `${owner}borrow${value.index}(arg${i}, scope, callbacks)` : `to${value.index}(arg${i}${value.aggregate ? ", scope" : ""})`};`).join("\n")}
            ${unit(output) ? "" : `var output = arena.allocate(${output.size}, ${output.alignment});`}
            var error = arena.allocate(24, 8);
            try {
                int status = (int)${native}.invokeExact(${args.join(", ")});
                ${hasCallbacks ? "callbacks.check();" : ""}
                check(status, error);
                ${unit(output) ? "" : `return ${callable(output) ? `${owner}own${output.index}(output)` : `from${output.index}(${output.aggregate ? "output" : readJvmValue(output, "output")})`};`}
            } finally { ${callable(output) ? `${owner}DROP${output.index}.invokeExact(output);` : output.aggregate ? `CLEAR${output.index}.invokeExact(output);` : ""} }
        } catch (Throwable error) { throw ${model.surface.callbacks.size ? `${owner}rethrow` : "propagate"}(error); }
        ${closure ? "finally { lease.leave(); }" : ""}
    }`;
};

/**
 * Render FFM descriptors, contained upcalls and ownership transfer for every signature.
 *
 * @param model - Closed JVM projection.
 */
export const jvmCallableRuntime = model => [...model.surface.callbacks.values()].map(callback => {
	const i = callback.index, { parameters, result } = callback.type.callable;
	const inputs = parameters.map(site => jvmValue(model, site.type)), output = jvmValue(model, result.type);
	const layout = ["ADDRESS", ...inputs.map(value => value.layout), ...unit(output) ? [] : ["ADDRESS"], "ADDRESS"].join(", ");
	const signature = ["MemorySegment context", ...inputs.map((value, n) => `${value.nativeType} arg${n}`), ...unit(output) ? [] : ["MemorySegment output"], "MemorySegment error"].join(", ");
	const conversion = `to${output.index}(result${output.aggregate ? ", state.scope" : ""})`;
	const write = output.aggregate ? `MemorySegment.copy(${conversion}, 0, output.reinterpret(${output.size}), 0, ${output.size});` : `output.reinterpret(${output.size}).set(${output.layout}, 0, ${conversion});`;
	return `    private static final FunctionDescriptor DESC${i} = FunctionDescriptor.of(JAVA_INT, ${layout});
    private static final MethodHandle OWNED${i} = downcall("${model.surface.prefix}_owned_${callback.field}_call", DESC${i});
    static final MethodHandle DROP${i} = downcall("${model.surface.prefix}_owned_${callback.field}_dispose", FunctionDescriptor.ofVoid(ADDRESS));
    private static final MethodHandle UPCALL${i} = upcall${i}();
    private static MethodHandle upcall${i}() {
        try { return java.lang.invoke.MethodHandles.lookup().findStatic(${model.runtimeName ?? "Runtime"}.class, "callback${i}", DESC${i}.toMethodType().insertParameterTypes(0, Host${i}.class)); }
        catch (ReflectiveOperationException error) { throw new ExceptionInInitializerError(error); }
    }
    private record Host${i}(${callback.publicName} callback, Scope scope, CallbackFrame frame) { }
    private static int callback${i}(Host${i} state, ${signature}) {
        try {
            error.reinterpret(24).fill((byte)0);
            if (state.frame.failure != null) return 4;
            ${unit(output) ? "" : "var result = "}state.callback.invoke(${inputs.map((value, n) => `from${value.index}(arg${n}${value.aggregate ? `.reinterpret(${value.size})` : ""})`).join(", ")});
            ${unit(output) ? "" : write}
            return 0;
        } catch (Throwable failure) { if (state.frame.failure == null) state.frame.failure = failure; return 4; }
    }
    static MemorySegment borrow${i}(${callback.publicName} callback, Scope scope, CallbackFrame frame) {
        Objects.requireNonNull(callback);
        var stub = Linker.nativeLinker().upcallStub(UPCALL${i}.bindTo(new Host${i}(callback, scope, frame)), DESC${i}, scope.arena);
        var result = scope.arena.allocate(16, 8); result.set(ADDRESS, 0, stub); return result;
    }
    static ${callback.publicName}.LeanClosure own${i}(MemorySegment output) {
        if (output.get(ADDRESS, 0).equals(MemorySegment.NULL)) throw new IllegalStateException("Missing returned Lean closure");
        var lease = new ClosureLease(DROP${i});
        var result = new ${callback.publicName}.LeanClosure(lease);
        lease.adopt(output); return result;
    }
${jvmNativeCall(model, { name: `invoke${i}`, native: `OWNED${i}`, parameters, result, closure: true })}`;
}).join("\n");
