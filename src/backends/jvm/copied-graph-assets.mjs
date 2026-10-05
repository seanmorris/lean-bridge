/**
 * Authenticated, lazy native loading for both recursive JVM value projections.
 *
 * @file
 */
import { verifiedJvmAssets } from "./verified-assets.mjs";

/**
 * Use the process-wide JVM registry and keep FFM names private.
 *
 * @param model - Validated recursive package model.
 * @param evidence - Verified native asset identities, or null for inspection.
 * @param callable - Resolve graph callback entry points and generation-checked tokens.
 */
export const jvmGraphAssets = (model, evidence, callable = false) => {
	const className = callable ? "_CallableGraphNative" : "_GraphNative";
	const resultType = callable ? "Links" : "_GraphRuntime.Target[]";
	const links = callable ? "    record Links(java.lang.invoke.MethodHandle[] exports, java.lang.invoke.MethodHandle[] invokes,\n        java.lang.invoke.MethodHandle[] drops, java.lang.invoke.MethodHandle clear, _GraphRuntime.Lifecycle lifecycle) { }\n" : "";
	const address = "java.lang.foreign.ValueLayout.ADDRESS", long = "java.lang.foreign.ValueLayout.JAVA_LONG";
	const descriptor = (arity, lease = false) => "java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, " + [...lease ? [long] : [], ...Array(arity + 1).fill(address)].join(", ") + ")";
	const lookup = (symbol, desc) => "downcall(lookup, " + JSON.stringify(symbol) + ", " + desc + ")";
	const array = items => "new java.lang.invoke.MethodHandle[] { " + items.join(", ") + " }";
	const resolved = callable ? "                var resolved = new Links("
		+ array(model.functions.map(fn => lookup(fn.native, descriptor(fn.parameters.length)))) + ", "
		+ array([...model.callbacks.values()].map(cb => lookup(cb.call, descriptor(cb.parameters.length, true)))) + ", "
		+ array([...model.callbacks.values()].map(cb => lookup(cb.dispose, "java.lang.foreign.FunctionDescriptor.ofVoid(" + long + ")")))
		+ ", clear, lifecycle);" : `                var resolved = new _GraphRuntime.Target[${model.functions.length}];
${model.functions.map((fn, index) => `                resolved[${index}] = new _GraphRuntime.Target(downcall(lookup, "${fn.name}_graph", java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, ${Array.from({ length: fn.parameters.length + 1 }, () => "java.lang.foreign.ValueLayout.ADDRESS").join(", ")})), clear, lifecycle);`).join("\n")}`;
	if(evidence === null) return `package ${model.namespace};
final class ${className} {
${links}    private ${className}() { }
    static boolean loaded() { return false; }
    static ${resultType} resolve() { throw new IllegalStateException("Build a prepared Maven release before calling this API"); }
}
`;
	if(evidence.componentId !== model.ir.component.id || evidence.library !== `lib${model.prefix}.so`
		|| Object.keys(evidence.libraries ?? {}).length < 4)
		throw new TypeError("JVM graph loading evidence differs from the component");
	const assets = verifiedJvmAssets(evidence, "_Assets", true);
	return `package ${model.namespace};

final class ${className} {
${links}    private ${className}() { }
    private static volatile ${resultType} targets;
    // Cold input validation must not initialize FFM or the native registry.
    static boolean loaded() { return targets != null; }
    static ${resultType} resolve() {
        _Assets.ensureProcess();
        var ready = targets; if (ready != null) return ready;
        // Resolve shared dependencies before entering a package-local lock.
        var lookup = _Assets.lookup();
        synchronized (${className}.class) {
            _Assets.ensureProcess(); ready = targets; if (ready != null) return ready;
            try {
                var clear = downcall(lookup, ${JSON.stringify(model.nativeReleaseSymbol)}, java.lang.foreign.FunctionDescriptor.ofVoid(java.lang.foreign.ValueLayout.ADDRESS));
                var initialize = downcall(lookup, "${model.prefix}_graph_initialize", java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
                var available = downcall(lookup, "${model.prefix}_graph_ready", java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT));
                var retire = downcall(lookup, "${model.prefix}_graph_retire", java.lang.foreign.FunctionDescriptor.ofVoid());
                var lifecycle = new _GraphRuntime.Lifecycle() {
                    public void before() {
                        _Assets.ensureProcess();
                        try { _GraphRuntime.status((int)initialize.invokeExact()); } catch (Throwable error) { throw propagate(error); }
                    }
                    public void after() {
                        _Assets.ensureProcess();
                        try { if ((int)available.invokeExact() != 1) _GraphRuntime.status(5); } catch (Throwable error) { throw propagate(error); }
                    }
                    public void poison() {
                        _Assets.ensureProcess();
                        try { retire.invokeExact(); } catch (Throwable error) { throw propagate(error); }
                    }
                };
${resolved}
                targets = resolved; return resolved;
            } catch (Throwable error) {
                System.getProperties().setProperty("lean.bridge.jvm.native-library-v1.failed", "true");
                throw propagate(error);
            }
        }
    }
    private static java.lang.invoke.MethodHandle downcall(java.lang.foreign.SymbolLookup lookup, String name, java.lang.foreign.FunctionDescriptor descriptor) {
        return java.lang.foreign.Linker.nativeLinker().downcallHandle(lookup.find(name).orElseThrow(), descriptor);
    }
    private static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) return runtime;
        if (error instanceof Error fatal) throw fatal;
        return new LeanBridgeException(4, "Cannot load or call the prepared Lean component", error);
    }
    private static final class _Assets {
${assets}
    }
}
`;
};
