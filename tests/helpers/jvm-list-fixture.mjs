/**
 * Independent Java/Kotlin List callers and compile-time rejection cases.
 *
 * @file
 */
import { readFileSync } from "node:fs";

const values = {
	Unit: ["Unit", "LeanUnit", "Array", ["Unit.INSTANCE"]]
	, Bool: ["boolean", "Boolean", "BooleanArray", ["false", "true"]]
	, Uint8: ["int", "Int", "IntArray", ["0", "1", "255"]]
	, Uint16: ["int", "Int", "IntArray", ["0", "1", "65535"]]
	, Uint32: ["long", "Long", "LongArray", ["0L", "1L", "4294967295L"]]
	, Uint64: ["BigInteger", "BigInteger", "Array", ["BigInteger.ZERO", "BigInteger.ONE.shiftLeft(53).add(BigInteger.ONE)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, Int8: ["byte", "Byte", "ByteArray", ["Byte.MIN_VALUE", "(byte)-1", "(byte)0", "Byte.MAX_VALUE"]]
	, Int16: ["short", "Short", "ShortArray", ["Short.MIN_VALUE", "(short)-1", "(short)0", "Short.MAX_VALUE"]]
	, Int32: ["int", "Int", "IntArray", ["Integer.MIN_VALUE", "-1", "0", "Integer.MAX_VALUE"]]
	, Int64: ["long", "Long", "LongArray", ["Long.MIN_VALUE", "-1L", "0L", "9007199254740993L", "Long.MAX_VALUE"]]
	, Nat: ["BigInteger", "BigInteger", "Array", ["BigInteger.ZERO", "huge"]]
	, Int: ["BigInteger", "BigInteger", "Array", ["BigInteger.ZERO", "huge", "huge.negate()"]]
	, Float32: ["float", "Float", "FloatArray", ["0f", "-0f", "1f / 3", "Float.MIN_VALUE", "-Float.MIN_VALUE", "Float.MAX_VALUE", "Float.NaN", "Float.POSITIVE_INFINITY", "Float.NEGATIVE_INFINITY"]]
	, Float64: ["double", "Double", "DoubleArray", ["0d", "-0d", "1d / 3", "Double.MIN_VALUE", "-Double.MIN_VALUE", "Double.MAX_VALUE", "Double.NaN", "Double.POSITIVE_INFINITY", "Double.NEGATIVE_INFINITY"]]
	, String: ["String", "String", "Array", ['""', '"a\\0λ🌿"', '"e\\u0301"', '"\\udbff\\udfff"']]
	, Bytes: ["byte[]", "ByteArray", "Array", ["new byte[0]", "new byte[] { 0, -1, -128 }", "allBytes()"]]
	, Char: ["int", "Int", "IntArray", ["0", "0x7f", "0xd7ff", "0xe000", "0xffff", "0x10000", "0x10ffff"]]
	, Usize: ["BigInteger", "BigInteger", "Array", ["BigInteger.ZERO", "BigInteger.ONE.shiftLeft(32)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, Isize: ["long", "Long", "LongArray", ["Long.MIN_VALUE", "-1L", "0L", "Long.MAX_VALUE"]]
};
const kotlinValue = value => value.replaceAll("Unit.INSTANCE", "LeanUnit.INSTANCE").replaceAll("Integer.", "Int.").replaceAll("BigInt.", "BigInteger.")
	.replace(/\(byte\)(-?\d+)/g, "($1).toByte()").replace(/\(short\)(-?\d+)/g, "($1).toShort()")
	.replaceAll("new byte[0]", "byteArrayOf()").replaceAll("new byte[] { 0, -1, -128 }", "byteArrayOf(0, -1, -128)")
	.replaceAll("\\0", "\\u0000").replace(/\b(\d+)d\b/g, "$1.0");

/**
 * Typed function references and arrays check every primitive mapping.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmListPublicChecks = profile => Object.entries(values).map(([name, [java, kotlin, array, cases]]) => profile === "java"
	? `        Consumer.<${java}[]>exercise(Api::reverse${name}, new ${java}[] { ${cases.join(", ")} });`
	: `    exercise<${array === "Array" ? `Array<${kotlin}>` : array}>(Api::reverse${name}, ${array === "Array" ? `arrayOf<${kotlin}>` : `${array[0].toLowerCase()}${array.slice(1)}Of`}(${cases.map(kotlinValue).join(", ")}))`).join("\n");

/**
 * Materialize the independent consumer with its primitive test catalog.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmListConsumer = profile => readFileSync(new URL(`../fixtures/list-consumers/${profile === "java" ? "java.java" : "kotlin.kt"}`, import.meta.url), "utf8")
	.replace("/* PRIMITIVE_CASES */", jvmListPublicChecks(profile));

/**
 * Invalid callers must fail with expected source-located type errors.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmListRejections = profile => {
	const java = profile === "java";
	const cases = java ? {
		"element-type": "Api.reverseUint32(new boolean[] { true });"
		, "unit-element": "Api.reverseUnit(new byte[] { 0 });"
		, "scalar-container": "Api.reverseUint32(1L);"
		, "wrong-nesting": "Api.mix(new long[] { 1 });"
		, "option-presence": "Api.nest(new Unit[0]);"
		, "product-type": "Api.swap(Result.ok(new Pair<>(new String[0], new long[0])));"
		, "boxed-array": "Api.reverseUint32(new Long[] { 1L });"
		, "collection-container": "Api.reverseUint32(java.util.List.of(1L));"
		, "scalar-result": "long value = Api.reverseUint32(new long[] { 1 });"
		, "fixed-overflow": "Api.reverseInt8(new byte[] { 256 });"
		, "signed-width": "Api.reverseInt32(new long[] { 1 });"
		, "exact-integer": "Api.reverseNat(new long[] { 1 });"
	} : {
		"element-type": "Api.reverseUint32(booleanArrayOf(true))"
		, "unit-element": "Api.reverseUnit(byteArrayOf(0))"
		, "scalar-container": "Api.reverseUint32(1L)"
		, "wrong-nesting": "Api.mix(longArrayOf(1))"
		, "option-presence": "Api.nest(emptyArray<LeanUnit>())"
		, "product-type": "Api.swap(Result.ok<Pair<Array<String>, LongArray>, Array<String>>(Pair(emptyArray<String>(), longArrayOf())))"
		, "boxed-array": "Api.reverseUint32(arrayOf(1L))"
		, "collection-container": "Api.reverseUint32(listOf(1L))"
		, "scalar-result": "val value: Long = Api.reverseUint32(longArrayOf(1)); println(value)"
		, "fixed-overflow": "Api.reverseInt8(byteArrayOf(256))"
		, "signed-width": "Api.reverseInt32(longArrayOf(1))"
		, "exact-integer": "Api.reverseNat(longArrayOf(1))"
	};
	return Object.entries(cases).map(([name, expression]) => ({ id: `lists/${name}`
		, expectation: { kind: "compile-rejection"
			, diagnostic: java ? name === "scalar-result" || name === "fixed-overflow" ? "compiler.err.prob.found.req" : "compiler.err.cant.apply.symbol"
				: name === "scalar-result" ? ["INITIALIZER_TYPE_MISMATCH", "TYPE_MISMATCH"] : "ARGUMENT_TYPE_MISMATCH" }
		, source: `import org.leanbridge.lists.*;\n${java ? "import org.leanbridge.lists.Unit;" : "import org.leanbridge.lists.Unit as LeanUnit;\nimport org.leanbridge.lists.Pair;"}\n${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${expression}\n}${java ? " }" : ""}\n` }));
};
