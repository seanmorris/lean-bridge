/**
 * Generate source-named Java APIs and private FFM copied-value calls.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { compileCopiedJvmModel } from "./copied-model.mjs";
import { copiedJvmAssets } from "./copied-assets.mjs";
import { copiedJvmConversions, copiedJvmHelpers, copiedJvmScope, readJvmValue } from "./copied-conversions.mjs";

const parameters = (model, fn) => fn.declaration.parameters.map((site, index) => `${model.publicType(model.surface.copy(site.type))} arg${index}`).join(", ");
const resultType = (model, fn) => fn.resultType === "void" ? "void" : model.publicType(model.surface.copy(fn.declaration.result.type));
const runtime = model => `package ${model.namespace};
import static java.lang.foreign.ValueLayout.*;
import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.util.Objects;

final class Runtime {
    private Runtime() { }
    private static final SymbolLookup LOOKUP = NativeAssets.lookup();
    private static MethodHandle downcall(String name, FunctionDescriptor descriptor) {
        return Linker.nativeLinker().downcallHandle(LOOKUP.find(name).orElseThrow(), descriptor);
    }
${model.surface.functions.map((fn, index) => `    private static final MethodHandle CALL${index} = downcall("${fn.name}", FunctionDescriptor.of(JAVA_INT, ${fn.declaration.parameters.map(site => model.surface.copy(site.type).layout).concat(fn.resultType === "void" ? [] : ["ADDRESS"]).concat("ADDRESS").join(", ")}));`).join("\n")}
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `    private static final MethodHandle CLEAR${copy.index} = downcall("${copy.name}_clear", FunctionDescriptor.ofVoid(ADDRESS));`).join("\n")}
${copiedJvmHelpers}
${copiedJvmConversions(model)}
${model.surface.functions.map((fn, index) => {
	const copy = model.surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
	return `    static ${resultType(model, fn)} call${index}(${parameters(model, fn)}) {
        try (Arena arena = Arena.ofConfined()) {
            ${fn.declaration.parameters.some(site => model.surface.copy(site.type).aggregate) ? "var scope = new Scope(arena);" : ""}
${fn.declaration.parameters.map((site, n) => { const value = model.surface.copy(site.type); return `            ${value.nativeType} input${n} = to${value.index}(arg${n}${value.aggregate ? ", scope" : ""});`; }).join("\n")}
            ${unit ? "" : `var output = arena.allocate(${copy.size}, ${copy.alignment});`}
            var error = arena.allocate(24, 8);
            try {
                int status = (int)CALL${index}.invokeExact(${fn.declaration.parameters.map((_, n) => `input${n}`).concat(unit ? [] : ["output"]).concat("error").join(", ")});
                check(status, error);
                ${unit ? "" : `return from${copy.index}(${copy.aggregate ? "output" : readJvmValue(copy, "output")});`}
            } finally { ${copy.aggregate ? `CLEAR${copy.index}.invokeExact(output);` : ""} }
        } catch (Throwable error) { throw propagate(error); }
    }`;
}).join("\n")}
}
`;

/**
 * Render public Java types, private conversions and binding evidence.
 *
 * @param model - Closed JVM projection.
 * @param evidence - Optional compiled library evidence.
 */
export const renderCopiedJvmPackage = (model, evidence = null) => {
	const prefix = `src/main/java/${model.namespace.replaceAll(".", "/")}`;
	const files = {
		[`${prefix}/Unit.java`]: `package ${model.namespace};\npublic enum Unit { INSTANCE }\n`
		, [`${prefix}/LeanBridgeException.java`]: `package ${model.namespace};\npublic final class LeanBridgeException extends RuntimeException {\n    private static final long serialVersionUID = 1L;\n    LeanBridgeException(String message, Throwable cause) { super(message, cause); }\n}\n`
		, [`${prefix}/Api.java`]: `package ${model.namespace};\npublic final class Api {\n    private Api() { }\n${model.surface.functions.map((fn, index) => `    public static ${resultType(model, fn)} ${fn.publicName}(${parameters(model, fn)}) { ${fn.resultType === "void" ? "" : "return "}Runtime.call${index}(${fn.declaration.parameters.map((_, n) => `arg${n}`).join(", ")}); }`).join("\n")}\n}\n`
	};
	for(const copy of model.surface.copies.filter(copy => copy.record))
		files[`${prefix}/${copy.publicName}.java`] = `package ${model.namespace};\npublic record ${copy.publicName}(${copy.fields.map(field => `${model.publicType(field.type)} ${field.publicName}`).join(", ")}) { }\n`;
	const publicFiles = Object.keys(files), internalFiles = [`${prefix}/Runtime.java`, `${prefix}/NativeAssets.java`, `${prefix}/Scope.java`];
	files[internalFiles[0]] = runtime(model); files[internalFiles[1]] = copiedJvmAssets(model, evidence);
	files[internalFiles[2]] = `package ${model.namespace};\nimport java.lang.foreign.*;\n${copiedJvmScope}\n`;
	files["README.md"] = `# ${model.namespace}\n\nCall ${model.namespace}.Api from Java or Kotlin. Requires Java 22 or newer with --enable-native-access=ALL-UNNAMED on Linux x86-64. Prepared Maven JARs contain their native adapter, component and shared Lean runtime. No compiler, JNI declarations or runtime-path settings are needed by the consumer.\n\nUInt8/UInt16 use checked int, UInt32 uses checked long, and UInt64/Nat/Int use java.math.BigInteger. Signed values use corresponding JVM primitives. Unit parameters use Unit.INSTANCE; Unit results return void. Arrays, byte arrays and record contents are copied on calls. Null, invalid unsigned ranges and malformed UTF-16 are rejected. Pure acyclic copied values are bounded to 32 type levels and a 16 MiB native input/output conversion budget. Native assets are verified and extracted into private process-lifetime temporary directories, removed at normal JVM shutdown.\n`;
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: "jvm-copied-v1", target: "jvm", component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), namespace: model.namespace, files: Object.keys(files), publicFiles, internalFiles, packageFiles: [], supportedFeatures: ["direct-functions", "copied-values", "deterministic-close"], capabilityGaps: [{ feature: "identity-and-effects", reason: "Ordinary Maven currently admits pure copied values only." }, { feature: "additional-platforms", reason: "The compiled native profile is Linux x86-64 with glibc." }] }, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generate a copied-value Java package from its canonical model.
 *
 * @param ir - Canonical Binding IR.
 * @param evidence - Optional compiled library evidence.
 */
export const generateCopiedJvmPackage = (ir, evidence = null) => renderCopiedJvmPackage(compileCopiedJvmModel(ir), evidence);
