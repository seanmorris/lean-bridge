/**
 * Typed synchronous JVM upcalls and explicit callback recovery.
 *
 * @file
 */
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const boxes = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" };

export const ownedJvmCallFrame = `final class _OwnedCallFrame implements AutoCloseable {
    final _OwnedBindings bindings;
    final _OwnedRuntime.State state;
    final _OwnedConvert.Budget budget;
    private final java.util.concurrent.atomic.AtomicReference<Throwable> failure = new java.util.concurrent.atomic.AtomicReference<>();
    private final java.util.ArrayList<Object> roots = new java.util.ArrayList<>();
    private volatile boolean active = true;
    _OwnedCallFrame(_OwnedBindings bindings, _OwnedConvert.Scope scope) {
        this.bindings = bindings; state = scope.state; budget = scope.budget;
    }
    boolean failed() { return failure.get() != null; }
    void before(java.lang.foreign.MemorySegment session) {
        if (!active) _OwnedRuntime.check(4);
        if (state.require() != session.address())
            throw new _OwnedConvert.InvalidNative("Callback session differs from initiating call");
        bindings.ready();
    }
    void keep(Object value) { _OwnedRuntime.checkpoint(); roots.add(value); }
    void fail(Throwable error) { failure.compareAndSet(null, error); }
    void finish(int status) {
        var error = failure.get(); if (error != null) throw _OwnedRuntime.rethrow(error);
        _OwnedRuntime.check(status);
    }
    @Override public void close() {
        active = false; java.lang.ref.Reference.reachabilityFence(roots); roots.clear();
    }
}
`;

/**
 * The C adapter owns callback output slots, including failed publication.
 * Copy host replies before borrowed arguments and temporary buffers expire.
 *
 * @param model - Checked JVM values and native C callback contracts.
 * @param calls - Resolved native functions in binding order.
 * @param type - Java spelling for the selected nominal value family.
 */
export const ownedJvmCallables = (model, calls, type) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const anchored = [...model.c.functions, ...model.c.callbacks].some(fn => fn.anchor !== undefined)
		|| model.c.functions.some(fn => fn.receiver === 0);
	const methods = [], wrappers = [], javaRecovery = [], kotlinRecovery = [], kotlinOps = [];
	const delegate = (node, kotlin) => `${model.namespace}${kotlin ? ".kotlin" : ""}.${node.delegateType}`;
	const layout = node => node.leaf ? node.valueLayout ?? `_OwnedLayouts.${node.layoutName}` : "ADDRESS";
	for(const kotlin of [false, true]) for(const callback of model.c.hostArgument ? model.callbacks : [])
	{
		const family = kotlin ? "Kotlin" : "Java", node = nodes.get(callback.id), id = node.index;
		const result = nodes.get(callback.result), unit = result.name === "unit";
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const borrowed = callback.anchor !== undefined;
		const automatic = ownedCallbackRecovery(model.c.native.model, node, id => id) !== null;
		const copy = calls.findIndex(fn => fn.id === result.id && ["retain", "copy"].includes(fn.operation));
		if(copy < 0) throw new TypeError("Missing owned callback result copy");
		const name = family + id, cbType = delegate(node, kotlin), valueType = type(node.id, kotlin);
		const resultType = type(result.id, kotlin);
		const replyType = borrowed ? `${model.namespace}.CallbackResult<${boxes[resultType] ?? resultType}>` : resultType;
		const returnType = unit ? "void" : replyType;
		const catalog = kotlin ? "_KotlinOwnedTypes.CATALOG" : "_OwnedTypes.CATALOG";
		const factory = kotlin ? "kotlinFactory" : "javaFactory";
		const signature = parameters.map((param, i) => `${type(param.id, kotlin)} arg${i}`).join(", ");
		const arguments_ = parameters.map((_, i) => `arg${i}`).join(", ");
		const rawSignature = parameters.map((param, i) => `${param.raw} arg${i}`).join(", ");
		const descriptor = `FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ${[...parameters.map(layout), "ADDRESS", "ADDRESS"].join(", ")})`;
		wrappers.push(`    static final class Recovery${name} implements ${cbType} {
        final ${cbType} function;
        final ${replyType} recovery;
        Recovery${name}(${cbType} function, ${replyType} recovery) {
            this.function = java.util.Objects.requireNonNull(function);
            this.recovery = java.util.Objects.requireNonNull(recovery);
        }
        @Override public ${returnType} invoke(${signature}) { ${unit ? "" : "return "}function.invoke(${arguments_}); }
    }${borrowed ? "" : `
    static final class Native${name} implements ${cbType} {
        final ${valueType} value;
${anchored ? `        final ${cbType} function;\n` : ""}\
        Native${name}(${valueType} value${anchored ? `, ${cbType} function` : ""}) { this.value = java.util.Objects.requireNonNull(value);${anchored ? " this.function = java.util.Objects.requireNonNull(function);" : ""} }
        @Override public ${returnType} invoke(${signature}) {
            ${unit ? "" : "return "}${anchored ? `function.invoke(${arguments_})` : `value.invoke(${parameters.map((param, i) => `arg${i}${param.kind === "callback" ? ".asCallback()" : ""}`).join(", ")})`};
        }
    }
    static ${cbType} native${name}(${valueType} value${anchored ? `, ${cbType} function` : ""}) { return new Native${name}(value${anchored ? ", function" : ""}); }`}
    static ${cbType} recover${name}(${cbType} function, ${replyType} recovery) { return new Recovery${name}(function, recovery); }`);
		if(!kotlin) javaRecovery.push(`    public static ${cbType} withRecovery(${cbType} function, ${replyType} recovery) {
        return _OwnedCallbacks.recover${name}(function, recovery);
    }`);
		else
		{
			const kotlinResult = model.kotlin.publicTypes[result.id];
			const kotlinCallback = `${model.namespace}.kotlin.${node.delegateType}`;
			const kotlinReply = borrowed ? `${model.namespace}.CallbackResult<${kotlinResult}>` : kotlinResult;
			kotlinOps.push(`    @kotlin.jvm.JvmSynthetic fun recover${id}(function: ${kotlinCallback}, recovery: ${kotlinReply}): ${kotlinCallback} =
        _OwnedCallbacks.recover${name}(function, recovery)`);
			kotlinRecovery.push(`        @kotlin.jvm.JvmStatic fun withRecovery(function: ${kotlinCallback}, recovery: ${kotlinReply}): ${kotlinCallback} =
            ${model.namespace}._KotlinOwnedCallbackOps.recover${id}(function, recovery)`);
		}
		methods.push(`    private static final FunctionDescriptor DESC${name} = ${descriptor};
    private static final MethodHandle UPCALL${name} = upcall${name}();
    private static MethodHandle upcall${name}() {
        try { return java.lang.invoke.MethodHandles.lookup().findStatic(_OwnedBindings.class, "callback${name}",
            DESC${name}.toMethodType().insertParameterTypes(0, Host${name}.class)); }
        catch (ReflectiveOperationException error) { throw new ExceptionInInitializerError(error); }
    }
    private record Host${name}(${cbType} function, _OwnedCallFrame frame) { }
    private static int callback${name}(Host${name} host, MemorySegment context, MemorySegment session,
        ${rawSignature ? rawSignature + ", " : ""}MemorySegment output, MemorySegment owner) {
        var frame = host.frame();
        if (frame.failed()) return 10;
        try {
            frame.before(session);
            _OwnedConvert.checked(output, 1, ${result.size}, ${result.alignment});
            var slot = _OwnedConvert.checked(owner, 1, 8, 8);
            if (slot.get(ADDRESS, 0).address() != 0)
                throw new _OwnedConvert.InvalidNative("Callback result slot is not empty");
            try (var borrowed = new _OwnedRuntime.BorrowFrame(frame.state);
                 var incoming = new _OwnedConvert.Scope(frame.state, false, frame.bindings.${factory}, () -> borrowed.lease, frame.budget);
                 var replies = new _OwnedConvert.Scope(frame.state, false, null, null, frame.budget)) {
${parameters.map((param, i) => `${param.aggregate ? "" : `                var raw${i} = incoming.allocate(${param.size}, ${param.alignment}); raw${i}.set(${param.valueLayout}, 0, arg${i});\n`}                var value${i} = (${type(param.id, kotlin)})_OwnedConvert.read(${catalog}, ${param.index}, ${param.aggregate ? "arg" : "raw"}${i}, incoming);`).join("\n")}
                ${unit ? "" : "var reply = "}host.function().invoke(${parameters.map((_, i) => `value${i}`).join(", ")});
                frame.bindings.ready();
                var converted = _OwnedConvert.write(${catalog}, ${result.index}, ${unit ? "Unit.INSTANCE" : borrowed ? "reply.read(replies)" : "reply"}, replies);
                // C owns this slot even if a later checkpoint throws.
                _OwnedRuntime.check((int)frame.bindings.symbols[${copy}].invokeExact(
                    MemorySegment.ofAddress(frame.state.require()), ${result.aggregate ? "converted" : `converted.get(${result.valueLayout}, 0)`}, output, owner));
                _OwnedRuntime.checkpoint(); return 0;
            }
        } catch (Throwable error) { frame.fail(error); return 10; }
    }
    private MemorySegment host${name}(${cbType} value, _OwnedConvert.Scope scope, _OwnedCallFrame frame) {
        scope.visit(0, ${catalog}.nodes()[${id}], true); scope.nativeBytes(24, 1);
        var function = java.util.Objects.requireNonNull(value);
        boolean wrapped = false; ${borrowed ? replyType : "Object"} recovery = null; int nesting = 0;
        while (function instanceof _OwnedCallbacks.Recovery${name} wrapper) {
            if (++nesting > 32) throw new _OwnedConvert.Limit("Callback recovery nesting exceeds its limit");
            if (!wrapped) { recovery = wrapper.recovery; wrapped = true; }
            function = wrapper.function;
        }
${borrowed ? "" : `        if (!wrapped && function instanceof _OwnedCallbacks.Native${name} closure) {
            long pointer = scope.root(closure.value.handle);
            var output = scope.allocate(32, 8);
            if (!scope.checkOnly) output.set(ADDRESS, 16, MemorySegment.ofAddress(pointer));
            return output;
        }
`}\
${automatic ? "" : '        if (!wrapped) throw new IllegalArgumentException("This callback requires OwnedCallbacks.withRecovery(function, value)");\n'}        var recoveryPointer = wrapped ? _OwnedConvert.write(${catalog}, ${result.index}, ${borrowed ? "recovery.read(scope)" : "recovery"}, scope) : MemorySegment.NULL;
        scope.storage(512, 1);
        if (scope.checkOnly) return MemorySegment.NULL;
        if (frame == null) throw new IllegalStateException("Callback construction requires an active call frame");
        _OwnedRuntime.checkpoint(); var host = new Host${name}(function, frame); frame.keep(host);
        var stub = Linker.nativeLinker().upcallStub(UPCALL${name}.bindTo(host), DESC${name}, scope.arena);
        _OwnedRuntime.checkpoint(); var output = scope.allocate(32, 8);
        output.set(ADDRESS, 0, stub); output.set(ADDRESS, 24, recoveryPointer); return output;
    }${borrowed ? `
    private MemorySegment host${name}(${valueType} value, _OwnedConvert.Scope scope, _OwnedCallFrame frame) {
        java.util.Objects.requireNonNull(value);
        scope.visit(0, ${catalog}.nodes()[${id}], true); scope.nativeBytes(24, 1);
        long pointer = scope.root(value.handle);
        var output = scope.allocate(32, 8);
        if (!scope.checkOnly) output.set(ADDRESS, 16, MemorySegment.ofAddress(pointer));
        return output;
    }` : ""}`);
	}
	return {
		methods: methods.join("\n")
		, wrappers: `final class _OwnedCallbacks {\n    private _OwnedCallbacks() { }\n${wrappers.join("\n")}\n}\n`
		, javaRecovery: `/** Recovery retains nominal callback types. Give ambiguous lambdas an explicit callback type. */
@SuppressWarnings("overloads")
public final class OwnedCallbacks {\n    private OwnedCallbacks() { }\n${javaRecovery.join("\n")}\n}\n`
		, kotlinRecovery: `class OwnedCallbacks private constructor() {\n    companion object {\n${kotlinRecovery.join("\n")}\n    }\n}\n`
		, kotlinOps: `internal object _KotlinOwnedCallbackOps {\n${kotlinOps.join("\n")}\n}\n`
	};
};
