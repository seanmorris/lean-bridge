/**
 * Render private FFM calls for Java or Kotlin copied-value projections.
 *
 * @file
 */
import { copiedJvmConversions, copiedJvmHelpers } from "./copied-conversions.mjs";
import { jvmValue, jvmNativeCall, jvmCallableState, jvmCallableRuntime } from "./callables.mjs";

/**
 * Share native assets and optionally the original Java callable ownership state.
 *
 * @param model - Closed JVM projection with optional private runtime names.
 */
export const renderCopiedJvmRuntime = model => `package ${model.namespace};
import static java.lang.foreign.ValueLayout.*;
import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.util.Objects;
${model.callableStateRuntime ? `import ${model.namespace}.${model.callableStateRuntime}.ProcessGuard;
import ${model.namespace}.${model.callableStateRuntime}.CallbackFrame;
import ${model.namespace}.${model.callableStateRuntime}.ClosureLease;
import static ${model.namespace}.${model.callableStateRuntime}.rethrow;
` : ""}
final class ${model.runtimeName ?? "Runtime"} {
    private ${model.runtimeName ?? "Runtime"}() { }
    private static final SymbolLookup LOOKUP = NativeAssets.lookup();
    private static MethodHandle downcall(String name, FunctionDescriptor descriptor) {
        return Linker.nativeLinker().downcallHandle(LOOKUP.find(name).orElseThrow(), descriptor);
    }
${model.surface.functions.map((fn, index) => `    private static final MethodHandle CALL${index} = downcall("${fn.name}", FunctionDescriptor.of(JAVA_INT, ${fn.declaration.parameters.map(site => jvmValue(model, site.type).layout).concat(fn.resultType === "void" ? [] : ["ADDRESS"]).concat("ADDRESS").join(", ")}));`).join("\n")}
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `    private static final MethodHandle CLEAR${copy.index} = downcall("${copy.name}_clear", FunctionDescriptor.ofVoid(ADDRESS));`).join("\n")}
${copiedJvmHelpers}
${copiedJvmConversions(model)}
${model.surface.callbacks.size && !model.callableRuntime && !model.callableStateRuntime ? jvmCallableState : ""}
${model.callableRuntime ? "" : jvmCallableRuntime(model)}
${model.surface.functions.map((fn, index) => jvmNativeCall(model, { name: `call${index}`, native: `CALL${index}`, parameters: fn.declaration.parameters, result: fn.declaration.result })).join("\n")}
}
`;
