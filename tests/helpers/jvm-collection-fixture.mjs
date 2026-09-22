/**
 * Independent Java/Kotlin collection signatures, inputs and typed rejections.
 *
 * @file
 */
import { readFileSync } from "node:fs";

/**
 * Read the exact collection example that installed consumers execute.
 *
 * @param profile - Java or Kotlin documentation.
 */
export const jvmCollectionDocumentation = (profile = "java") => {
	const document = readFileSync(new URL(`../../docs/consume/${profile}.md`, import.meta.url), "utf8");
	const section = document.split("### Arrays and records\n")[1]?.split("\n### ")[0];
	const source = section?.match(new RegExp("```" + profile + "\\n([^]*?)\\n```"))?.[1];
	if(!source) throw new Error(`${profile} arrays and records documentation example is missing`);
	return { source: `${source}\n`, stdout: "[[], [3, 2, 1]]\n3\n42\n" };
};

const primitives = [
	["Unit", "Unit", "Unit", "Unit.INSTANCE, Unit.INSTANCE", "arrayOf(Unit.INSTANCE, Unit.INSTANCE)"]
	, ["Bool", "boolean", "Boolean", "true, false, true", "booleanArrayOf(true, false, true)"]
	, ["Uint8", "int", "Int", "0, 255, 17, 17", "intArrayOf(0, 255, 17, 17)"]
	, ["Uint16", "int", "Int", "0, 65535, 256, 256", "intArrayOf(0, 65535, 256, 256)"]
	, ["Uint32", "long", "Long", "0, 4294967295L, 65536, 65536", "longArrayOf(0, 4294967295L, 65536, 65536)"]
	, ["Uint64", "BigInteger", "BigInteger", "BigInteger.ZERO, max, max", "arrayOf(BigInteger.ZERO, max, max)"]
	, ["Int8", "byte", "Byte", "-128, 127, 0, -1", "byteArrayOf(-128, 127, 0, -1)"]
	, ["Int16", "short", "Short", "-32768, 32767, 0, -1", "shortArrayOf(-32768, 32767, 0, -1)"]
	, ["Int32", "int", "Int", "Integer.MIN_VALUE, Integer.MAX_VALUE, 0, -1", "intArrayOf(Int.MIN_VALUE, Int.MAX_VALUE, 0, -1)"]
	, ["Int64", "long", "Long", "Long.MIN_VALUE, Long.MAX_VALUE, 0, -1", "longArrayOf(Long.MIN_VALUE, Long.MAX_VALUE, 0, -1)"]
	, ["Nat", "BigInteger", "BigInteger", "BigInteger.ZERO, huge, huge", "arrayOf(BigInteger.ZERO, huge, huge)"]
	, ["Int", "BigInteger", "BigInteger", "huge.negate(), BigInteger.ZERO, huge", "arrayOf(huge.negate(), BigInteger.ZERO, huge)"]
	, ["Float32", "float", "Float", "0f, -0f, Float.MIN_VALUE, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY, Float.NaN, 1.25f", "floatArrayOf(0f, -0f, Float.MIN_VALUE, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY, Float.NaN, 1.25f)"]
	, ["Float64", "double", "Double", "0d, -0d, Double.MIN_VALUE, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NaN, -1.25", "doubleArrayOf(0.0, -0.0, Double.MIN_VALUE, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NaN, -1.25)"]
	, ["String", "String", "String", '"", "🌱\\u0000", "\\uFEFF雪", "repeat", "repeat"', 'arrayOf("", "🌱\\u0000", "\\uFEFF雪", "repeat", "repeat")']
	, ["Bytes", "byte[]", "ByteArray", "new byte[0], new byte[] {0, -1, 42}, new byte[] {0, -1, 42}", "arrayOf(byteArrayOf(), byteArrayOf(0, -1, 42), byteArrayOf(0, -1, 42))"]
	, ["Char", "int", "Int", "0, 0xd7ff, 0xe000, 0x1f331, 0x10ffff", "intArrayOf(0, 0xd7ff, 0xe000, 0x1f331, 0x10ffff)"]
	, ["Usize", "BigInteger", "BigInteger", "BigInteger.ZERO, max, max", "arrayOf(BigInteger.ZERO, max, max)"]
	, ["Isize", "long", "Long", "Long.MIN_VALUE, Long.MAX_VALUE, 0, -1", "longArrayOf(Long.MIN_VALUE, Long.MAX_VALUE, 0, -1)"]
];
const kotlinType = type => {
	if(type.endsWith("[]"))
	{
		const element = type.slice(0, -2);
		return ({ boolean: "BooleanArray", byte: "ByteArray", short: "ShortArray", int: "IntArray", long: "LongArray", float: "FloatArray", double: "DoubleArray" })[element] ?? `Array<${kotlinType(element)}>`;
	}
	return ({ boolean: "Boolean", byte: "Byte", short: "Short", int: "Int", long: "Long", float: "Float", double: "Double" })[type] ?? type;
};
const cls = (type, java) => java ? `${type}.class` : `${kotlinType(type)}::class.java`;
const methods = [
	...primitives.map(([name, type]) => [`arrayReverse${name}`, `${type}[][]`, `${type}[][]`])
	, ["arrayAdd", "BigInteger[][]", "BigInteger", "BigInteger[][]"]
	, ["arrayTotal", "BigInteger", "BigInteger[][]"]
	, ["arrayWords", "String[][]"]
	, ["arrayDuplicate", "byte[][]", "byte[][]"]
	, ["arraySize", "BigInteger", "Unit[]"]
	, ["arrayCheckElements", "boolean", ...primitives.map(([, type]) => `${type}[]`)]
	, ["recordInspect", "boolean", "Primitives"]
	, ["recordShuffle", "Packet", "Packet"]
	, ["recordReverse", "Primitives[]", "Primitives[]"]
	, ["recordEmpty", "Empty", "Empty"]
	, ["recordSingle", "Single", "Single"]
	, ["recordCount", "Count", "Count"]
	, ["recordMake", "Pair"]
	, ["recordDuplicate", "Packet[]", "Packet"]
	, ["deep", "long" + "[]".repeat(24), "long" + "[]".repeat(24)]
	, ["generate", "Unit[]", "BigInteger"]
];
const records = {
	Primitives: ["unit:Unit", "flag:boolean", "u8:int", "u16:int", "u32:long", "u64:BigInteger", "i8:byte", "i16:short", "i32:int", "i64:long", "natural:BigInteger", "integer:BigInteger", "f32:float", "f64:double", "text:String", "bytes:byte[]", "char_:int", "usize:BigInteger", "isize:long"]
	, Empty: []
	, Single: ["value:BigInteger"]
	, Count: ["value:BigInteger"]
	, Pair: ["first:long", "second:String"]
	, Reversed: ["second:String", "first:long"]
	, Packet: ["label:String", "values:Primitives[][]", "empty:Empty", "single:Single", "count:Count", "pair:Pair", "reversed:Reversed"]
};

/**
 * Assert the independently declared public methods and record fields.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCollectionPublicChecks = profile => {
	const java = profile === "java", lines = methods.map(([name, result, ...parameters]) => `    Wire.method(${cls("Api", java)}, "${name}", ${[result, ...parameters].map(type => cls(type, java)).join(", ")})${java ? ";" : ""}`);
	for(const [name, fields] of Object.entries(records))
	{
		const names = fields.map(field => JSON.stringify(field.split(":")[0])).join(", ");
		const types = fields.map(field => cls(field.split(":")[1], java)).join(", ");
		lines.push(java ? `    Wire.record(${name}.class, new String[] {${names}}, new Class<?>[] {${types}});` : `    kotlinRecord(${name}::class.java, arrayOf<String>(${names}), arrayOf<Class<*>>(${types}))`);
	}
	return lines.join("\n");
};

/**
 * Render direct typed calls without using generator metadata for expectations.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCollectionConsumer = profile => {
	const java = profile === "java";
	const arrays = primitives.map(([name, type, , values, kotlin]) => java
		? `            { ${type}[][] rows = new ${type.replace("[]", "")}[3]${type === "byte[]" ? "[][]" : "[]"}; rows[0] = new ${type} {${values}}; rows[1] = new ${type.replace("[]", "")}[0]${type === "byte[]" ? "[]" : ""}; rows[2] = rows[0]; reverse(rows, call(() -> Api.arrayReverse${name}(rows))); }`.replace(`new ${type} {`, `new ${type}[] {`)
		: `        run { val row = ${kotlin}; val rows = arrayOf(row, row.copyOfRange(0, 0), row); reverse(rows, call { Api.arrayReverse${name}(rows) }) }`).join("\n");
	const deepType = "long" + "[]".repeat(24);
	const kotlinDeep = Array.from({ length: 24 }, (_, i) => {
		const type = kotlinType("long" + "[]".repeat(i + 1));
		return `    val deep${i + 1}: ${type} = ${i ? `arrayOf(deep${i})` : "longArrayOf(0, 42, 4294967295L)"}`;
	}).join("\n");
	const deep = java
		? `        ${deepType} deep = new ${deepType} ${"{".repeat(24)}0, 42, 4294967295L${"}".repeat(24)};\n        var deepCopy = call(() -> Api.deep(deep)); equal(deepCopy, deep); check(deepCopy != deep); deepCopy${"[0]".repeat(24)} = 1; check(deep${"[0]".repeat(24)} == 0);`
		: `${kotlinDeep}\n    calls.incrementAndGet()\n    val deepCopy: ${kotlinType(deepType)} = Api.deep(deep24)\n    equal(deepCopy, deep24); verify(deepCopy !== deep24); deepCopy${"[0]".repeat(24)} = 1; verify(deep24${"[0]".repeat(24)} == 0L)`;
	let source = readFileSync(new URL(`../fixtures/collection-consumers/${java ? "java.java" : "kotlin.kt"}`, import.meta.url), "utf8")
		.replace("/* SIGNATURES */", jvmCollectionPublicChecks(profile)).replace("/* ARRAYS */", arrays).replace("/* DEEP */", deep);
	if(java)
	{
		const documentation = jvmCollectionDocumentation();
		source = source.replace("public final class Consumer", `${documentation.source}\npublic final class Consumer`)
			.replace("/* DOCUMENTATION */", `        var documentationBytes = new java.io.ByteArrayOutputStream();
        var originalOutput = System.out;
        try (var output = new java.io.PrintStream(documentationBytes, true, java.nio.charset.StandardCharsets.UTF_8)) {
            System.setOut(output);
            try { Example.main(new String[0]); } finally { System.setOut(originalOutput); }
        }
        var documentationOutput = documentationBytes.toString(java.nio.charset.StandardCharsets.UTF_8);
        check(documentationOutput.equals(${JSON.stringify(documentation.stdout)}));
        calls.addAndGet(2);
        Wire.result("collections/documentation", Wire.text(documentationOutput), true);`);
	}
	else
	{
		const documentation = jvmCollectionDocumentation(profile), imports = documentation.source.match(/^import .+$/gm) ?? [];
		const body = documentation.source.replace(/^import .+\n/gm, "").replace("fun main()", "fun documentationExample()");
		for(const line of imports) if(!source.includes(`${line}\n`)) source = `${line}\n${source}`;
		source = source.replace("/* DOCUMENTATION_DECLARATION */", body)
			.replace("/* DOCUMENTATION */", `    val documentationBytes = java.io.ByteArrayOutputStream()
    val originalOutput = System.out
    java.io.PrintStream(documentationBytes, true, java.nio.charset.StandardCharsets.UTF_8).use { output ->
        System.setOut(output)
        try { documentationExample() } finally { System.setOut(originalOutput) }
    }
    val documentationOutput = documentationBytes.toString(java.nio.charset.StandardCharsets.UTF_8)
    verify(documentationOutput == ${JSON.stringify(documentation.stdout)})
    calls.addAndGet(2)
    Wire.result("collections/documentation", Wire.text(documentationOutput), true)`);
	}
	return source;
};

/**
 * Bind every invalid caller to its expected source-located compiler diagnostic.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCollectionRejections = profile => {
	const java = profile === "java";
	const cases = [
		["nominal-record", "Api.recordSingle(new Count(BigInteger.ONE));", "Api.recordSingle(Count(BigInteger.ONE))"]
		, ["array-element", "Api.arrayReverseUint32(new int[][] {{1}});", "Api.arrayReverseUint32(arrayOf(intArrayOf(1)))"]
		, ["array-depth", "Api.arrayReverseUint32(new long[] {1});", "Api.arrayReverseUint32(longArrayOf(1))"]
		, ["bytes-text", 'Api.arrayDuplicate(new String[] {"x"});', 'Api.arrayDuplicate(arrayOf("x"))']
		, ["uint64-narrowing", "Api.recordSingle(new Single(1L));", "Api.recordSingle(Single(1L))"]
		, ["record-fields", 'Api.recordMake().first().length();', 'Api.recordMake().first().length']
		, ["product-order", 'new Pair("x", 1L);', 'org.leanbridge.collections.kotlin.Pair("x", 1L)']
		, ["deep-leaf", "Api.deep(new long[][] {{1}});", "Api.deep(arrayOf(longArrayOf(1)))"]
	];
	return cases.map(([name, j, k]) => ({ id: `collections/${name}`
		, expectation: { kind: "compile-rejection"
			, diagnostic: java ? name === "record-fields" ? "compiler.err.cant.deref" : "compiler.err.cant.apply.symbol"
				: name === "record-fields" ? "UNRESOLVED_REFERENCE" : name === "product-order" ? ["ARGUMENT_TYPE_MISMATCH", "ARGUMENT_TYPE_MISMATCH"] : "ARGUMENT_TYPE_MISMATCH" }
		, source: `import org.leanbridge.collections${java ? "" : ".kotlin"}.*;\n${java ? "" : "import org.leanbridge.collections.kotlin.Pair;\n"}import java.math.BigInteger;\n${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${java ? j : k}\n}${java ? " }" : ""}\n` }));
};
