/**
 * Metadata-backed recursive Kotlin values over the shared JVM graph engine.
 *
 * @file
 */
import { generateCopiedJvmGraphConversions, jvmGraphDescriptorSource } from "./copied-graph-conversions.mjs";
import { jvmGraphEquality } from "./copied-graph-equality.mjs";

const quoted = name => name.split(".").map(part => `\`${part}\``).join(".");
const primitives = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Int", long: "Long", float: "Float", double: "Double", String: "String" };
const arrays = new Set(["Boolean", "Byte", "Short", "Int", "Long", "Float", "Double"]);

/**
 * Render separate public Kotlin classes; keep layouts, scalar codecs, ownership
 * and iterative conversion in the same Java implementation.
 *
 * @param ir - Compiler-authorized copied graph contract.
 */
export const generateCopiedKotlinGraphValues = ir => {
	const model = generateCopiedJvmGraphConversions(ir), namespace = `${model.namespace}.kotlin`;
	const nodes = new Map(model.types.map(node => [node.id, node])), names = new Map();
	const type = id => {
		if(names.has(id)) return names.get(id);
		const node = nodes.get(id);
		let value;
		if(node.ref.kind === "named") value = quoted(`${namespace}.${node.publicType}`);
		else if(node.kind === "primitive") value = node.ref.name === "unit" ? quoted(`${model.namespace}.Unit`)
			: node.ref.name === "bytes" ? "kotlin.ByteArray" : primitives[node.publicType] ? `kotlin.${primitives[node.publicType]}` : node.publicType;
		else if(node.element)
		{
			const element = nodes.get(node.element), primitive = element.kind === "primitive" ? primitives[element.publicType] : null;
			value = arrays.has(primitive) ? `kotlin.${primitive}Array` : `kotlin.Array<${type(node.element)}>`;
		} else value = `${quoted(namespace)}.${{ option: "Option", result: "Result", tuple: "Pair" }[node.kind]}<${node.fields.map(field => type(field.type)).join(", ")}>`;
		if(value.length > 65536) throw new TypeError("Expanded Kotlin graph type exceeds 65536 characters");
		names.set(id, value); return value;
	};
	const java = `src/main/java/${model.namespace.replaceAll(".", "/")}`;
	const kotlin = `src/main/kotlin/${model.namespace.replaceAll(".", "/")}`;
	const files = {}, publicFiles = [], internalFiles = [];
	const add = (name, source) => {
		const path = `${kotlin}/kotlin/${name}.kt`;
		files[path] = `package ${quoted(namespace)}\n\n${source}`; publicFiles.push(path);
	};
	const operations = `${quoted(model.namespace)}._KotlinGraphValueOps`;
	const equality = `    override fun equals(other: kotlin.Any?): kotlin.Boolean =
        other != null && other.javaClass == javaClass && ${operations}.equal(this, other)
    override fun hashCode(): kotlin.Int = ${operations}.hash(this)
    override fun toString(): kotlin.String = ${operations}.format(this)`;
	add("Unit", `typealias Unit = ${quoted(model.namespace)}.Unit\n`);
	add("LeanBridgeException", `typealias LeanBridgeException = ${quoted(model.namespace)}.LeanBridgeException\n`);
	for(const node of model.types.filter(node => node.kind === "variant"))
		add(node.publicType, `sealed interface ${quoted(node.publicType)}\n`);
	for(const record of model.records)
	{
		const { name, fields, parent, builder } = record, implements_ = parent ? ` : ${quoted(`${namespace}.${parent}`)}` : "";
		const fieldType = field => type(field.type);
		// Inferred typed accessors avoid Kotlin checking independently expanded
		// invariant array spellings against each other, which costs 2^depth.
		// Private builder slots erase storage only; public fields and setters
		// retain their complete types in bytecode and Kotlin metadata.
		const declaration = builder ? `@kotlin.Suppress("UNCHECKED_CAST")
class ${quoted(name)} private constructor(source: Builder)${implements_} {
${fields.map((field, index) => `    @kotlin.jvm.JvmField val ${quoted(field.publicName)} = source.slot${index} as ${fieldType(field)}`).join("\n")}
    companion object { @kotlin.jvm.JvmStatic fun builder(): Builder = Builder() }
    class Builder {
        private val assigned = java.util.BitSet(${fields.length})
${fields.map((_, index) => `        @get:kotlin.jvm.JvmSynthetic internal var slot${index}: kotlin.Any? = null\n            private set`).join("\n")}
${fields.map((field, index) => `        fun ${quoted(field.publicName)}(value: ${fieldType(field)}): Builder { slot${index} = value; assigned.set(${index}); return this }`).join("\n")}
        fun build(): ${quoted(name)} {
            if (assigned.cardinality() != ${fields.length}) throw kotlin.IllegalStateException("Every copied field must be assigned")
            return ${quoted(name)}(this)
        }
    }` : `class ${quoted(name)}(${fields.map(field => `@kotlin.jvm.JvmField val ${quoted(field.publicName)}: ${fieldType(field)}`).join(", ")})${implements_} {`;
		add(name, `${declaration}
${fields.map(field => `    fun ${quoted(field.publicName)}() = ${quoted(field.publicName)}`).join("\n")}
${equality}
}
`);
	}
	add("Option", `sealed interface Option<T : kotlin.Any> {
    fun isSome(): kotlin.Boolean
    fun value(): T
    class None<T : kotlin.Any> : Option<T> {
        override fun isSome(): kotlin.Boolean = false
        override fun value(): T = throw kotlin.IllegalStateException("None has no value")
${equality}
    }
    class Some<T : kotlin.Any>(@kotlin.jvm.JvmField val value: T) : Option<T> {
        override fun isSome(): kotlin.Boolean = true
        override fun value(): T = value
${equality}
    }
    companion object {
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any> none(): Option<T> = None()
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any> some(value: T): Option<T> = Some(value)
    }
}
`);
	add("Result", `sealed interface Result<T : kotlin.Any, E : kotlin.Any> {
    fun isOk(): kotlin.Boolean
    fun value(): T
    fun error(): E
    class Ok<T : kotlin.Any, E : kotlin.Any>(@kotlin.jvm.JvmField val value: T) : Result<T, E> {
        override fun isOk(): kotlin.Boolean = true
        override fun value(): T = value
        override fun error(): E = throw kotlin.IllegalStateException("Ok has no error")
${equality}
    }
    class Err<T : kotlin.Any, E : kotlin.Any>(@kotlin.jvm.JvmField val error: E) : Result<T, E> {
        override fun isOk(): kotlin.Boolean = false
        override fun value(): T = throw kotlin.IllegalStateException("Err has no success value")
        override fun error(): E = error
${equality}
    }
    companion object {
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any, E : kotlin.Any> ok(value: T): Result<T, E> = Ok(value)
        @kotlin.jvm.JvmStatic fun <T : kotlin.Any, E : kotlin.Any> err(error: E): Result<T, E> = Err(error)
    }
}
`);
	add("Pair", `class Pair<A : kotlin.Any, B : kotlin.Any>(@kotlin.jvm.JvmField val first: A, @kotlin.jvm.JvmField val second: B) {
    fun first(): A = first
    fun second(): B = second
${equality}
}
`);
	files[`${java}/_KotlinGraphValues.java`] = `package ${model.namespace};\n\n${jvmGraphEquality(model.records, namespace, { className: "_KotlinGraphValues", compoundsNamespace: namespace, accessors: true })}`;
	files[`${java}/_KotlinGraphTypes.java`] = jvmGraphDescriptorSource(model, { kotlin: true });
	files[`${kotlin}/_KotlinGraphValueOps.kt`] = `package ${quoted(model.namespace)}

internal object _KotlinGraphValueOps {
    @kotlin.jvm.JvmSynthetic fun equal(left: kotlin.Any, right: kotlin.Any): kotlin.Boolean = _KotlinGraphValues.equal(left, right)
    @kotlin.jvm.JvmSynthetic fun hash(value: kotlin.Any): kotlin.Int = _KotlinGraphValues.hash(value)
    @kotlin.jvm.JvmSynthetic fun format(value: kotlin.Any): kotlin.String = _KotlinGraphValues.format(value)
}
`;
	internalFiles.push(`${java}/_KotlinGraphValues.java`, `${java}/_KotlinGraphTypes.java`, `${kotlin}/_KotlinGraphValueOps.kt`);
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 4 * 1024 * 1024)
		throw new TypeError("Generated Kotlin graph projection exceeds 4 MiB");
	const publicTypes = Object.fromEntries(model.types.map(node => [node.id, type(node.id)]));
	return { model, namespace, files, publicFiles, internalFiles, publicTypes };
};
