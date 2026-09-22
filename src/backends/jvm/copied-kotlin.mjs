/**
 * Generate Kotlin metadata-backed APIs without Java array platform-type expansion.
 *
 * @file
 */
import { compileCopiedJvmModel } from "./copied-model.mjs";
import { renderCopiedJvmRuntime } from "./copied-runtime.mjs";
import { jvmValue, jvmResult } from "./callables.mjs";
import { generateCopiedJvmPackage } from "./copied-values.mjs";

const quoted = name => name.split(".").map(part => `\`${part}\``).join(".");
const scalarTypes = {
	char: "Int", unit: null, bool: "Boolean", uint8: "Int", uint16: "Int"
	, uint32: "Long", uint64: "java.math.BigInteger", int8: "Byte", int16: "Short"
	, int32: "Int"
	, int64: "Long"
	, nat: "java.math.BigInteger"
	, int: "java.math.BigInteger"
	, float32: "Float", float64: "Double", string: "String", bytes: "ByteArray" };
const arrays = new Set(["Int", "Long", "Byte", "Short", "Float", "Double", "Boolean"]);
const boxed = type => ({
	boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer"
	, long: "Long", float: "Float", double: "Double" })[type] ?? type;

/**
 * Derive a separate copied-value projection while retaining native layouts and owners.
 *
 * @param ir - Compiler-authorized Binding IR.
 */
export const compileCopiedKotlinModel = ir => {
	const model = compileCopiedJvmModel(ir), namespace = `${model.namespace}.kotlin`;
	const occupied = new Set(model.surface.copies.flatMap(copy => [copy.publicName, ...copy.cases?.map(branch => branch.publicName) ?? []])
		.concat([...model.surface.callbacks.values()].map(callback => callback.publicName)));
	const fresh = base => {
		let name = base, suffix = 1;
		while(occupied.has(name)) name = `${base}${suffix++}`;
		occupied.add(name); return name;
	};
	const helpers = { runtime: fresh("KotlinRuntime"), calls: fresh("KotlinCalls"), bridge: fresh("KotlinBridge") };
	const primitiveType = model.publicType;
	for(const copy of model.surface.copies)
	{
		if(copy.record || copy.variant) copy.publicName = `${namespace}.${copy.publicName}`;
		for(const branch of copy.cases ?? []) branch.publicName = `${namespace}.${branch.publicName}`;
	}
	for(const callback of model.surface.callbacks.values()) callback.publicName = `${model.namespace}.${callback.publicName}`;
	const compoundNames = Object.fromEntries(Object.entries({ option: "Option", result: "Result", tuple: "Pair" }).map(([key, name]) => [key, `${namespace}.${name}`]));
	const publicType = copy => copy.type?.callable || copy.record || copy.variant ? copy.publicName
		: copy.compound ? `${compoundNames[copy.compound]}<${copy.fields.map(field => boxed(publicType(field.type))).join(", ")}>`
			: copy.element ? `${publicType(copy.element)}[]` : primitiveType(copy);
	const erasedType = copy => copy.compound ? compoundNames[copy.compound]
		: copy.element ? `${erasedType(copy.element)}[]` : publicType(copy);
	const kotlinType = copy => {
		if(copy.type?.callable || copy.record || copy.variant) return quoted(copy.publicName);
		if(copy.compound) return `${quoted(compoundNames[copy.compound])}<${copy.fields.map(field => kotlinType(field.type)).join(", ")}>`;
		if(copy.element)
		{
			const primitive = scalarTypes[copy.element.scalarName];
			return arrays.has(primitive) ? `kotlin.${primitive}Array` : `kotlin.Array<${kotlinType(copy.element)}>`;
		}
		const type = scalarTypes[copy.scalarName];
		return type === null ? `${quoted(model.namespace)}.Unit` : type.includes(".") ? type : `kotlin.${type}`;
	};
	return {
		...model, publicType, erasedType, kotlinType, kotlinNamespace: namespace
		, compoundNames
		, helpers
		, runtimeName: helpers.runtime
		, callableRuntime: "Runtime" };
};

const equality = (name, fields, parameters = "") => `    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is ${name}${parameters}${fields.map(field => `\n            && java.util.Objects.deepEquals(this.${quoted(field)}, other.${quoted(field)})`).join("")}
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(${[`${name}::class.java`, ...fields.map(field => `this.${quoted(field)}`)].join(", ")}))`;

const record = (model, name, fields, parent = null) => {
	const simple = name.split(".").at(-1), members = fields.map(field => field.publicName);
	return `class ${quoted(simple)}(${fields.map(field => `@kotlin.jvm.JvmField val ${quoted(field.publicName)}: ${model.kotlinType(field.type)}`).join(", ")})${parent ? ` : ${quoted(parent)}` : ""} {
${fields.map(field => `    fun ${quoted(field.publicName)}(): ${model.kotlinType(field.type)} = ${quoted(field.publicName)}`).join("\n")}
${equality(quoted(simple), members)}
}
`;
};

/**
 * Render typed Kotlin values and private calls sharing the Java native asset loader.
 *
 * @param ir - Compiler-authorized Binding IR.
 */
export const renderCopiedKotlinPackage = ir => {
	const model = compileCopiedKotlinModel(ir), base = model.namespace.replaceAll(".", "/");
	const prefix = `src/main/kotlin/${base}/kotlin`, java = `src/main/java/${base}`;
	const header = `package ${quoted(model.kotlinNamespace)}\n\n`;
	const files = {}, publicFiles = [], internalFiles = [];
	const add = (name, source) => { const path = `${prefix}/${name}.kt`; files[path] = header + source; publicFiles.push(path); };
	const resultType = value => value.type?.callable ? `${quoted(value.publicName)}.LeanClosure`
		: value.scalarName === "unit" ? "kotlin.Unit" : model.kotlinType(value);
	add("Api", `class Api private constructor() {
    companion object {
${model.surface.functions.map((fn, index) => {
		const output = jvmValue(model, fn.declaration.result.type), type = resultType(output);
		const inputs = fn.declaration.parameters.map(site => jvmValue(model, site.type));
		return `        @kotlin.jvm.JvmStatic @kotlin.Suppress("UNCHECKED_CAST")
        fun ${quoted(fn.publicName)}(${inputs.map((value, n) => `arg${n}: ${model.kotlinType(value)}`).join(", ")}): ${type} {
            ${output.scalarName === "unit" ? "" : "return "}${quoted(model.namespace)}.${model.helpers.calls}.call${index}(${inputs.map((_, n) => `arg${n}`).join(", ")})${output.scalarName === "unit" ? "" : ` as ${type}`}
        }`;
}).join("\n")}
    }
}
`);
	add("Unit", `typealias Unit = ${quoted(model.namespace)}.Unit\n`);
	add("LeanBridgeException", `typealias LeanBridgeException = ${quoted(model.namespace)}.LeanBridgeException\n`);
	for(const copy of model.surface.copies)
	{
		if(copy.record) add(copy.publicName.split(".").at(-1), record(model, copy.publicName, copy.fields));
		if(copy.variant)
		{
			add(copy.publicName.split(".").at(-1), `sealed interface ${quoted(copy.publicName.split(".").at(-1))}\n`);
			for(const branch of copy.cases) add(branch.publicName.split(".").at(-1), record(model, branch.publicName, branch.fields, copy.publicName));
		}
	}
	if(model.surface.copies.some(copy => copy.compound))
		for(const [name, source] of Object.entries(compounds)) add(name, source);
	for(const callback of model.surface.callbacks.values())
		add(callback.publicName.split(".").at(-1), `typealias ${quoted(callback.publicName.split(".").at(-1))} = ${quoted(callback.publicName)}\n`);
	const bridgePath = `${java}/${model.helpers.bridge}.java`, callsPath = `src/main/kotlin/${base}/${model.helpers.calls}.kt`;
	files[bridgePath] = `package ${model.namespace};
@SuppressWarnings("unchecked")
final class ${model.helpers.bridge} {
    private ${model.helpers.bridge}() { }
${model.surface.functions.map((fn, index) => {
		const output = jvmValue(model, fn.declaration.result.type), inputs = fn.declaration.parameters.map(site => jvmValue(model, site.type));
		return `    static Object call${index}(${inputs.map((_, n) => `Object arg${n}`).join(", ")}) {
        ${jvmResult(model, output) === "void" ? "" : "return "}${model.helpers.runtime}.call${index}(${inputs.map((value, n) => `(${model.publicType(value)})arg${n}`).join(", ")});${output.scalarName === "unit" ? " return null;" : ""}
    }`;
}).join("\n")}
}
`;
	files[callsPath] = `package ${quoted(model.namespace)}
internal object ${model.helpers.calls} {
${model.surface.functions.map((fn, index) => `    @kotlin.jvm.JvmSynthetic fun call${index}(${fn.declaration.parameters.map((_, n) => `arg${n}: kotlin.Any?`).join(", ")}): kotlin.Any? = ${model.helpers.bridge}.call${index}(${fn.declaration.parameters.map((_, n) => `arg${n}`).join(", ")})`).join("\n")}
}
`;
	const runtimePath = `${java}/${model.helpers.runtime}.java`;
	files[runtimePath] = renderCopiedJvmRuntime(model);
	internalFiles.push(bridgePath, callsPath, runtimePath);
	return { files, publicFiles, internalFiles, namespace: model.kotlinNamespace };
};

/**
 * Combine the unchanged Java API and the metadata-backed Kotlin API in one artifact.
 *
 * @param ir - Compiler-authorized Binding IR.
 * @param evidence - Optional compiled native library evidence.
 */
export const generateCopiedJvmKotlinPackage = (ir, evidence = null) => {
	const java = generateCopiedJvmPackage(ir, evidence), kotlin = renderCopiedKotlinPackage(ir);
	const manifest = JSON.parse(java["binding-manifest.json"]);
	for(const path of Object.keys(kotlin.files)) if(Object.hasOwn(java, path)) throw new Error(`Kotlin source collides with Java: ${path}`);
	const files = { ...java, ...kotlin.files };
	files["README.md"] += `\nKotlin callers can import ${kotlin.namespace}.Api and its generated copied value classes. These signatures carry Kotlin metadata, including deeply nested arrays. Fields expose immutable val references and named accessors; equality and hashing compare nested contents. Empty classes retain nominal identity. This API shares the Java native asset loader and callable ownership state. Maven resolves kotlin-stdlib 2.2.0 through the package POM. The original Java API remains available in ${kotlin.namespace.slice(0, -7)}.\n`;
	files["binding-manifest.json"] = `${JSON.stringify({ ...manifest
		, files: [...manifest.files, ...Object.keys(kotlin.files)]
		, publicFiles: [...manifest.publicFiles, ...kotlin.publicFiles]
		, internalFiles: [...manifest.internalFiles, ...kotlin.internalFiles]
		, kotlin: { namespace: kotlin.namespace, metadataVersion: "2.2.0"
			, publicFiles: kotlin.publicFiles, internalFiles: kotlin.internalFiles }
	}, null, 2)}\n`;
	return Object.freeze(files);
};

const compounds = {
	Option: `sealed interface Option<out T : kotlin.Any> {
    fun isSome(): kotlin.Boolean
    fun value(): T
    companion object {
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any> none(): Option<T> = None()
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any> some(value: T): Option<T> = Some(value)
    }
    class None<out T : kotlin.Any> : Option<T> {
        override fun isSome(): kotlin.Boolean = false
        override fun value(): T = throw IllegalStateException("None has no value")
${equality("None", [], "<*>")}
    }
    class Some<out T : kotlin.Any>(@kotlin.jvm.JvmField val value: T) : Option<T> {
        init { java.util.Objects.requireNonNull(value) }
        override fun isSome(): kotlin.Boolean = true
        override fun value(): T = value
${equality("Some", ["value"], "<*>")}
    }
}
`
	, Result: `sealed interface Result<out T : kotlin.Any, out E : kotlin.Any> {
    fun isOk(): kotlin.Boolean
    fun value(): T
    fun error(): E
    companion object {
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any, E : kotlin.Any> ok(value: T): Result<T, E> = Ok(value)
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any, E : kotlin.Any> err(error: E): Result<T, E> = Err(error)
    }
    class Ok<out T : kotlin.Any, out E : kotlin.Any>(@kotlin.jvm.JvmField val value: T) : Result<T, E> {
        init { java.util.Objects.requireNonNull(value) }
        override fun isOk(): kotlin.Boolean = true
        override fun value(): T = value
        override fun error(): E = throw IllegalStateException("Ok has no error")
${equality("Ok", ["value"], "<*, *>")}
    }
    class Err<out T : kotlin.Any, out E : kotlin.Any>(@kotlin.jvm.JvmField val error: E) : Result<T, E> {
        init { java.util.Objects.requireNonNull(error) }
        override fun isOk(): kotlin.Boolean = false
        override fun value(): T = throw IllegalStateException("Err has no success value")
        override fun error(): E = error
${equality("Err", ["error"], "<*, *>")}
    }
}
`
	, Pair: `class Pair<out A : kotlin.Any, out B : kotlin.Any>(@kotlin.jvm.JvmField val first: A, @kotlin.jvm.JvmField val second: B) {
    init { java.util.Objects.requireNonNull(first); java.util.Objects.requireNonNull(second) }
    fun first(): A = first
    fun second(): B = second
${equality("Pair", ["first", "second"], "<*, *>")}
}
`
};
