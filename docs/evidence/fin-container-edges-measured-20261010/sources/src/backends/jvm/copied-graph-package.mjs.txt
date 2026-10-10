/**
 * Typed Java and Kotlin APIs over a shared authenticated native graph runtime.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateCopiedKotlinGraphValues } from "./copied-graph-kotlin.mjs";
import { jvmGraphAssets } from "./copied-graph-assets.mjs";

const quoted = name => name.split(".").map(part => `\`${part}\``).join(".");
const keywords = new Set("_ abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield _GraphCalls _GraphTypes kotlin org".split(" "));

/**
 * Validate both consumer projections before native compilation and packaging.
 *
 * @param ir - Compiler-checked copied graph contract.
 */
export const compileCopiedJvmGraphPackageModel = ir => {
	const kotlin = generateCopiedKotlinGraphValues(ir), model = kotlin.model, prefix = model.layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("JVM graph component name collides with a dependency or exceeds its name limit");
	const declarations = new Map(ir.declarations.map(item => [item.id, item]));
	const functions = model.functions.map(fn => {
		const declaration = declarations.get(fn.bindingId);
		const parameterNames = declaration.parameters.map(site => keywords.has(site.name) ? `${site.name}_` : site.name);
		if(parameterNames.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) || new Set(parameterNames).size !== parameterNames.length)
			throw new TypeError("JVM graph parameter names must be distinct ASCII identifiers after keyword escaping");
		return { ...fn, declaration, parameterNames };
	});
	return { ...model, ir, prefix, functions, kotlin, layoutSha256: sha256(canonicalJson(model.layout)) };
};

/**
 * Emit a source bundle for genuine Kotlin metadata and Java classes. Native
 * admission and installed Maven acceptance authenticate the compiled outputs.
 *
 * @param ir - Compiler-checked copied graph contract.
 * @param evidence - Verified native asset identities, or null for inspection.
 */
export const generateCopiedJvmGraphPackage = (ir, evidence = null) => {
	const model = compileCopiedJvmGraphPackageModel(ir), nodes = new Map(model.types.map(node => [node.id, node]));
	const java = `src/main/java/${model.namespace.replaceAll(".", "/")}`, kotlin = `src/main/kotlin/${model.namespace.replaceAll(".", "/")}`;
	const unit = id => nodes.get(id).ref.name === "unit";
	const api = `${java}/Api.java`, kotlinApi = `${kotlin}/kotlin/Api.kt`;
	const files = { ...model.files, ...model.kotlin.files };
	files[api] = `package ${model.namespace};

/** The functions selected by the Lean package author. */
public final class Api {
    private Api() { }
${model.functions.map((fn, index) => `    @SuppressWarnings("unchecked")
    public static ${unit(fn.result) ? "void" : nodes.get(fn.result).publicType} ${fn.publicName}(${fn.parameters.map((id, n) => `${nodes.get(id).publicType} ${fn.parameterNames[n]}`).join(", ")}) {
        ${unit(fn.result) ? "" : `return (${nodes.get(fn.result).publicType})`}_GraphCalls.call(_GraphTypes.CATALOG, ${index}, new Object[] { ${fn.parameterNames.join(", ")} });
    }`).join("\n")}
}
`;
	files[kotlinApi] = `package ${quoted(model.kotlin.namespace)}

class Api private constructor() {
    companion object {
${model.functions.map((fn, index) => {
		const call = `${quoted(model.namespace)}._KotlinGraphApiCalls.call(${index}, kotlin.arrayOf<kotlin.Any>(${fn.parameterNames.map(quoted).join(", ")}))`;
		return `        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun ${quoted(fn.publicName)}(${fn.parameters.map((id, n) => `${quoted(fn.parameterNames[n])}: ${model.kotlin.publicTypes[id]}`).join(", ")})${unit(fn.result) ? `: kotlin.Unit { ${call} }` : ` =\n            ${call} as ${model.kotlin.publicTypes[fn.result]}`}`;
}).join("\n")}
    }
}
`;
	files[`${java}/_GraphNative.java`] = jvmGraphAssets(model, evidence);
	files[`${java}/_GraphCalls.java`] = `package ${model.namespace};

final class _GraphCalls {
    private _GraphCalls() { }
    static Object call(_GraphTypes.Catalog catalog, int function, Object[] arguments) {
        if (!_GraphNative.loaded()) _GraphRuntime.validate(catalog, function, arguments);
        return _GraphRuntime.call(catalog, function, _GraphNative.resolve()[function], arguments);
    }
}
`;
	files[`${kotlin}/_KotlinGraphApiCalls.kt`] = `package ${quoted(model.namespace)}

internal object _KotlinGraphApiCalls {
    @kotlin.jvm.JvmSynthetic fun call(function: kotlin.Int, arguments: kotlin.Array<kotlin.Any>): kotlin.Any =
        _GraphCalls.call(_KotlinGraphTypes.CATALOG, function, arguments)
}
`;
	files["README.md"] = `# ${model.namespace}

Install the prepared Maven release and call ${model.namespace}.Api from Java or ${model.kotlin.namespace}.Api from Kotlin. The JAR includes the native Lean component and shared runtime, verifies their hashes, and loads them automatically. Consumers need Java 22 or newer with --enable-native-access=ALL-UNNAMED on Linux x86-64 with the declared glibc floor. Lean, C compilers and native-path settings are not needed. Maven resolves Kotlin's standard library from the POM.

Java records and sealed cases have separate Kotlin classes with immutable val fields and genuine Kotlin metadata. Kotlin signatures retain nested array types and non-null payloads. Constructors that exceed the JVM argument-slot limit use typed builders; every field must be assigned before build(). Arrays and Lists use typed arrays and results own independent copied storage. Unit arguments use Unit.INSTANCE. Unit results return Java void or Kotlin Unit. Kotlin's Unit and LeanBridgeException names alias the shared Java definitions. UInt8/UInt16 use checked int/Int, UInt32 uses checked long/Long, UInt64/USize/Nat/Int use BigInteger, and ISize is a signed 64-bit value. Char is a Unicode scalar stored in int/Int, not a UTF-16 Char. Strings preserve NUL and Unicode scalar text.

Option.none(), some(Unit.INSTANCE), and some(Option.none()) are distinct. Result.ok(value) and err(error) preserve the active branch. Pair retains binary product nesting. Generated values have bounded structural equality, matching hash codes and formatting. Arrays remain mutable; do not mutate values while a call uses them or while they are map keys or set members. Concrete aliases retain metadata without extra JVM wrappers.

Both languages use the same layouts, scalar codecs and iterative native conversion engine. Inputs and outputs share a maximum depth of 128, 262,144 visited values, a 16 MiB native-copy budget and a separate 16 MiB accounted scratch/output budget. These do not measure Lean working memory or every JVM allocation overhead. Null payloads, invalid UTF-16, negative Nat, cycles, uninhabited values and malformed branches reject. All arguments validate before native scratch allocation or Lean initialization. Invalid cold calls do not load native libraries. Each call owns its scratch arena and clears native output in finally. Allocation and limit failures are recoverable. Malformed native output retires the shared runtime; retirement during copying prevents publishing a result.

Native libraries remain loaded for the process lifetime. Extracted private files are removed at normal JVM shutdown. Calls after fork require a fresh process. Structured callbacks, closures, resources and asynchronous values remain outside this recursive copied profile.
`;
	const publicFiles = [...model.publicFiles, ...model.kotlin.publicFiles, api, kotlinApi];
	const internalFiles = [...model.internalFiles, ...model.kotlin.internalFiles, `${java}/_GraphNative.java`, `${java}/_GraphCalls.java`, `${kotlin}/_KotlinGraphApiCalls.kt`];
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, generator: "jvm-copied-graph-v1", target: "jvm"
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, namespace: model.namespace, files: Object.keys(files)
		, publicFiles, internalFiles, packageFiles: []
		, aliases: model.aliases
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, kotlin: { namespace: model.kotlin.namespace, metadataVersion: "2.2.0"
			, publicFiles: [...model.kotlin.publicFiles, kotlinApi]
			, internalFiles: [...model.kotlin.internalFiles, `${kotlin}/_KotlinGraphApiCalls.kt`] }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "deterministic-close"]
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive JVM packages support finite copied values, not callable, resource or asynchronous payloads." }
			, { feature: "additional-platforms", reason: "Compiled releases target Java 22 on Linux x86-64 with glibc." }] }, null, 2)}\n`;
	return Object.freeze(files);
};
