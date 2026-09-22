/**
 * Generate source-named Java APIs and private FFM copied-value calls.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { compileCopiedJvmModel } from "./copied-model.mjs";
import { copiedJvmAssets } from "./copied-assets.mjs";
import { copiedJvmConversions, copiedJvmHelpers, copiedJvmScope } from "./copied-conversions.mjs";
import { jvmCopiedAliases, jvmAliasCatalogDocs, jvmAliasSiteDocs, jvmAliasReadme } from "./copied-aliases.mjs";
import { jvmValue, jvmResult, jvmNativeCall, jvmCallableState, jvmCallablePublic, jvmCallableRuntime } from "./callables.mjs";

const valueEquality = (name, fields, parameters = "") => `    @Override public boolean equals(Object candidate) {
        if (this == candidate) return true;
        return candidate instanceof ${name}${parameters} other${fields.map(field => `\n            && java.util.Objects.deepEquals(this.${field}, other.${field})`).join("")};
    }
    @Override public int hashCode() {
        return java.util.Arrays.deepHashCode(new Object[] { ${[`${name}.class`, ...fields.map(field => `this.${field}`)].join(", ")} });
    }`;

const parameters = (model, fn) => fn.declaration.parameters.map((site, index) => `${model.publicType(jvmValue(model, site.type))} arg${index}`).join(", ");
const resultType = (model, fn) => jvmResult(model, jvmValue(model, fn.declaration.result.type));
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
${model.surface.functions.map((fn, index) => `    private static final MethodHandle CALL${index} = downcall("${fn.name}", FunctionDescriptor.of(JAVA_INT, ${fn.declaration.parameters.map(site => jvmValue(model, site.type).layout).concat(fn.resultType === "void" ? [] : ["ADDRESS"]).concat("ADDRESS").join(", ")}));`).join("\n")}
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `    private static final MethodHandle CLEAR${copy.index} = downcall("${copy.name}_clear", FunctionDescriptor.ofVoid(ADDRESS));`).join("\n")}
${copiedJvmHelpers}
${copiedJvmConversions(model)}
${model.surface.callbacks.size ? jvmCallableState : ""}
${jvmCallableRuntime(model)}
${model.surface.functions.map((fn, index) => jvmNativeCall(model, { name: `call${index}`, native: `CALL${index}`, parameters: fn.declaration.parameters, result: fn.declaration.result })).join("\n")}
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
		, [`${prefix}/Api.java`]: `package ${model.namespace};\n${jvmAliasCatalogDocs(model)}public final class Api {\n    private Api() { }\n${model.surface.functions.map((fn, index) => `${jvmAliasSiteDocs(model, fn.declaration.parameters.map((site, n) => ({ name: `arg${n}`, type: site.type })), fn.declaration.result.type, fn.resultType === "void")}    public static ${resultType(model, fn)} ${fn.publicName}(${parameters(model, fn)}) { ${fn.resultType === "void" ? "" : "return "}Runtime.call${index}(${fn.declaration.parameters.map((_, n) => `arg${n}`).join(", ")}); }`).join("\n")}\n}\n`
	};
	for(const copy of model.surface.copies.filter(copy => copy.record))
		files[`${prefix}/${copy.publicName}.java`] = `package ${model.namespace};\n${jvmAliasSiteDocs(model, copy.record.fields.map((field, index) => ({ name: copy.fields[index].publicName, type: field.type })))}public record ${copy.publicName}(${copy.fields.map(field => `${model.publicType(field.type)} ${field.publicName}`).join(", ")}) {\n${valueEquality(copy.publicName, copy.fields.map(field => field.publicName))}\n}\n`;
	for(const copy of model.surface.copies.filter(copy => copy.variant))
	{
		files[`${prefix}/${copy.publicName}.java`] = `package ${model.namespace};\npublic sealed interface ${copy.publicName} permits ${copy.cases.map(branch => branch.publicName).join(", ")} { }\n`;
		for(const [index, branch] of copy.cases.entries())
			files[`${prefix}/${branch.publicName}.java`] = `package ${model.namespace};\n${jvmAliasSiteDocs(model, copy.variant.cases[index].fields.map((field, i) => ({ name: branch.fields[i].publicName, type: field.type })))}public record ${branch.publicName}(${branch.fields.map(field => `${model.publicType(field.type)} ${field.publicName}`).join(", ")}) implements ${copy.publicName} {\n${valueEquality(branch.publicName, branch.fields.map(field => field.publicName))}\n}\n`;
	}
	for(const callback of model.surface.callbacks.values())
		files[`${prefix}/${callback.publicName}.java`] = jvmCallablePublic(model, callback);
	if(model.surface.copies.some(copy => copy.compound))
		for(const [name, source] of Object.entries(compoundTypes)) files[`${prefix}/${name}.java`] = `package ${model.namespace};\n${source}`;
	const publicFiles = Object.keys(files), internalFiles = [`${prefix}/Runtime.java`, `${prefix}/NativeAssets.java`, `${prefix}/Scope.java`];
	files[internalFiles[0]] = runtime(model); files[internalFiles[1]] = copiedJvmAssets(model, evidence);
	files[internalFiles[2]] = `package ${model.namespace};\nimport java.lang.foreign.*;\n${copiedJvmScope}\n`;
	files["README.md"] = `# ${model.namespace}\n\nCall ${model.namespace}.Api from Java or Kotlin. Requires Java 22 or newer with --enable-native-access=ALL-UNNAMED on Linux x86-64. Prepared Maven JARs contain their native adapter, component and shared Lean runtime. No compiler, JNI declarations or runtime-path settings are needed by the consumer.\n\nUInt8/UInt16 use checked int, UInt32 uses checked long, and UInt64/Nat/Int use java.math.BigInteger. Signed values use corresponding JVM primitives. Unit parameters use Unit.INSTANCE; Unit results return void. Arrays, byte arrays and record contents are copied on calls. Null, invalid unsigned ranges and malformed UTF-16 are rejected. Pure acyclic copied values are bounded to 32 type levels and a 16 MiB native input/output conversion budget. Native assets are verified and extracted into private process-lifetime temporary directories, removed at normal JVM shutdown.\n`;
	files["README.md"] += "\nGenerated records compare nested arrays and records by contents and produce matching hash codes. Nominal record and constructor identities remain distinct. Floating-point equality follows Java: NaNs compare equal and signed zeros differ. Standalone arrays retain JVM reference equality; use Arrays.deepEquals/Arrays.equals in Java or contentDeepEquals/contentEquals in Kotlin. Nested arrays remain mutable. Do not mutate their contents while a containing value is a map key or set member. Record accessors preserve distinguishing trailing underscores and escape Java keywords.\n";
	if(model.surface.copies.some(copy => copy.compound)) files["README.md"] += "\nOption<T> is a sealed None/Some hierarchy with none()/some(value) factories and isSome()/value(). Result<T,E> preserves Lean Except through ok(value)/err(error), isOk()/value()/error(). Inactive payload access throws; null containers and payloads reject. Nested Unit options remain distinct. Domain errors return Err; bridge failures throw exceptions. Pair<A,B> retains binary product nesting. These generic types box primitive payloads and compose with copied arrays and records. Import the generated Pair explicitly in Kotlin; it is not kotlin.Pair. Equality and hashing compare active payloads by contents, including nested arrays.\n";
	files["README.md"] += jvmAliasReadme(model);
	if(model.surface.copies.some(copy => copy.variant))
		files["README.md"] += "\nConcrete copied Lean variants export a sealed interface and one named record per constructor. Java switch and Kotlin when expressions can match all cases without a numeric tag or native layout. Constructor names use PascalCase; payload accessors use camelCase, preserve distinguishing trailing underscores and escape Java keywords. Name collisions reject before compilation. Only the active payload is converted. Empty cases and Unit payloads remain distinct. Null cases, active null payloads and invalid native tags reject. Record components are final, while array elements remain mutable. Returned arrays contain independent copies. Recursive, callable and identity-bearing payloads remain unsupported.\n";
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: "jvm-copied-v1", target: "jvm", component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), namespace: model.namespace, files: Object.keys(files), publicFiles, internalFiles, packageFiles: [], supportedFeatures: ["direct-functions", "copied-values", "deterministic-close", ...model.surface.callbacks.size ? ["primitive-callbacks", "owned-closures"] : []], capabilityGaps: [{ feature: "identity-and-effects", reason: "Ordinary Maven admits copied values and synchronous primitive callables, not resources, compound callables or async delivery." }, { feature: "additional-platforms", reason: "The compiled native profile is Linux x86-64 with glibc." }] }, null, 2)}\n`;
	if(model.surface.copies.some(copy => copy.ref.kind === "apply" && copy.ref.constructor === "list"))
		files["README.md"] += "\nLean Lists use copied Java arrays and the corresponding Kotlin array types in inputs, results and record fields. Primitive arrays retain their primitive element type. Empty Lists, order, duplicates and nesting are preserved; returned arrays own independent storage. List and Array retain distinct IR/native identities. Native sequence lengths, missing buffers and alignment are checked before allocation or reads. List callback payloads remain unsupported.\n";
	if(model.surface.aliases.length)
		files["binding-manifest.json"] = `${JSON.stringify({ ...JSON.parse(files["binding-manifest.json"]), aliases: jvmCopiedAliases(model) }, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generate a copied-value Java package from its canonical model.
 *
 * @param ir - Canonical Binding IR.
 * @param evidence - Optional compiled library evidence.
 */
export const generateCopiedJvmPackage = (ir, evidence = null) => renderCopiedJvmPackage(compileCopiedJvmModel(ir), evidence);

const compoundTypes = {
	Option: `/** A copied Lean Option. None and Some(Unit) are distinct. */
public sealed interface Option<T> permits Option.None, Option.Some {
    boolean isSome();
    T value();
    static <T> Option<T> none() { return new None<>(); }
    static <T> Option<T> some(T value) { return new Some<>(value); }
    record None<T>() implements Option<T> {
        public boolean isSome() { return false; }
        public T value() { throw new IllegalStateException("None has no value"); }
    }
    record Some<T>(T value) implements Option<T> {
        public Some { java.util.Objects.requireNonNull(value); }
        public boolean isSome() { return true; }
${valueEquality("Some", ["value"], "<?>")}
    }
}
`
	, Result: `/** A copied Lean Except. Domain errors are values; bridge failures throw. */
public sealed interface Result<T, E> permits Result.Ok, Result.Err {
    boolean isOk();
    T value();
    E error();
    static <T, E> Result<T, E> ok(T value) { return new Ok<>(value); }
    static <T, E> Result<T, E> err(E error) { return new Err<>(error); }
    record Ok<T, E>(T value) implements Result<T, E> {
        public Ok { java.util.Objects.requireNonNull(value); }
        public boolean isOk() { return true; }
        public E error() { throw new IllegalStateException("Ok has no error"); }
${valueEquality("Ok", ["value"], "<?, ?>")}
    }
    record Err<T, E>(E error) implements Result<T, E> {
        public Err { java.util.Objects.requireNonNull(error); }
        public boolean isOk() { return false; }
        public T value() { throw new IllegalStateException("Err has no success value"); }
${valueEquality("Err", ["error"], "<?, ?>")}
    }
}
`
	, Pair: `/** A copied binary Lean product. Nested products retain their structure. */
public record Pair<A, B>(A first, B second) {
    public Pair { java.util.Objects.requireNonNull(first); java.util.Objects.requireNonNull(second); }
${valueEquality("Pair", ["first", "second"], "<?, ?>")}
}
`
};
