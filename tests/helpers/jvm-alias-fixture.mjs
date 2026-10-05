/**
 * Independently typed Java/Kotlin alias callers and rejection programs.
 *
 * @file
 */
import { readFileSync } from "node:fs";

const values = {
	Bool: ["Boolean", "Boolean", "boolean", ["false", "true"]]
	, Uint8: ["Integer", "Int", "int", ["0", "1", "255"]]
	, Uint16: ["Integer", "Int", "int", ["0", "1", "65535"]]
	, Uint32: ["Long", "Long", "long", ["0L", "1L", "4294967295L"]]
	, Uint64: ["BigInteger", "BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE.shiftLeft(53).add(BigInteger.ONE)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, Int8: ["Byte", "Byte", "byte", ["Byte.MIN_VALUE", "(byte)-1", "(byte)0", "Byte.MAX_VALUE"]]
	, Int16: ["Short", "Short", "short", ["Short.MIN_VALUE", "(short)-1", "(short)0", "Short.MAX_VALUE"]]
	, Int32: ["Integer", "Int", "int", ["Integer.MIN_VALUE", "-1", "0", "Integer.MAX_VALUE"]]
	, Int64: ["Long", "Long", "long", ["Long.MIN_VALUE", "-1L", "0L", "9007199254740993L", "Long.MAX_VALUE"]]
	, Usize: ["BigInteger", "BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE.shiftLeft(32)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, Isize: ["Long", "Long", "long", ["Long.MIN_VALUE", "-1L", "0L", "Long.MAX_VALUE"]]
	, Float32: ["Float", "Float", "float", ["0f", "-0f", "1f / 3", "Float.MIN_VALUE", "-Float.MIN_VALUE", "Float.MAX_VALUE", "Float.NaN", "Float.POSITIVE_INFINITY", "Float.NEGATIVE_INFINITY"]]
	, Float64: ["Double", "Double", "double", ["0d", "-0d", "1d / 3", "Double.MIN_VALUE", "-Double.MIN_VALUE", "Double.MAX_VALUE", "Double.NaN", "Double.POSITIVE_INFINITY", "Double.NEGATIVE_INFINITY"]]
	, String: ["String", "String", "String", ['""', '"A\\0🌱"', '"\\0"', '"\\udbff\\udfff"', '"e\\u0301"']]
	, Bytes: ["byte[]", "ByteArray", "byte[]", ["new byte[0]", "new byte[] {0, -1, 1}", "allBytes()"]]
	, Char: ["Integer", "Int", "int", ["0", "0x7f", "0xd7ff", "0xe000", "0xffff", "0x10000", "0x10ffff"]]
	, Nat: ["BigInteger", "BigInteger", "BigInteger", ["BigInteger.ZERO", "huge"]]
	, Int: ["BigInteger", "BigInteger", "BigInteger", ["BigInteger.ZERO", "huge", "huge.negate()"]]
};
const kotlinValue = value => value.replaceAll("Integer.", "Int.").replaceAll("BigInt.", "BigInteger.")
	.replace(/\(byte\)(-?\d+)/g, "($1).toByte()").replace(/\(short\)(-?\d+)/g, "($1).toShort()")
	.replaceAll("new byte[0]", "byteArrayOf()").replaceAll("new byte[] {0, -1, 1}", "byteArrayOf(0, -1, 1)")
	.replaceAll("\\0", "\\u0000").replace(/\b(\d+)d\b/g, "$1.0");

/**
 * Check primitive method references and exact reflected JVM signatures.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmAliasPublicChecks = profile => Object.entries(values).map(([name, [java, kotlin, primitive, cases]]) => profile === "java"
	? `        Consumer.<${java}>exercise(Api::echo${name}, new ${java}[] {${cases.join(", ")}});\n        check(Api.class.getMethod("echo${name}", ${primitive}.class).getReturnType() == ${primitive}.class);`
	: `    exercise<${kotlin}>(Api::echo${name}, arrayOf(${cases.map(kotlinValue).join(", ")}))\n    verify(Api::class.java.getMethod("echo${name}", ${kotlin}::class.java).returnType == ${kotlin}::class.java)`).join("\n");

/**
 * Materialize the independent downstream source.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmAliasConsumer = profile => readFileSync(new URL(`../fixtures/alias-consumers/${profile === "java" ? "java.java" : "kotlin.kt"}`, import.meta.url), "utf8")
	.replace("/* PRIMITIVE_CASES */", jvmAliasPublicChecks(profile));

/**
 * Invalid programs must fail at the precise source with type diagnostics.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmAliasRejections = profile => {
	const java = profile === "java";
	const cases = java ? {
		"scalar-type": "Api.increment(\"1\");", "exact-integer": "Api.echoNat(1L);"
		, "unit-type": "Api.echoUnit((byte)0);", "char-type": "Api.echoChar(\"🌱\");"
		, "array-nesting": "Api.reverseRows(new long[] {1});"
		, "array-element": "Api.reverseRows(new int[][] {{1}});"
		, "boxed-array": "Api.reverseRows(new Long[][] {{1L}});"
		, "option-type": "Api.echoMaybe(Option.some(true));"
		, "result-type": "Api.echoOutcome(Result.ok(\"bad\"));"
		, "record-type": "Api.changePacket(\"packet\");"
		, "result-value": "String value = Api.make();"
		, "fixed-overflow": "Api.echoInt8(256);"
	} : {
		"scalar-type": "Api.increment(\"1\")", "exact-integer": "Api.echoNat(1L)"
		, "unit-type": "Api.echoUnit(0.toByte())", "char-type": "Api.echoChar(\"🌱\")"
		, "array-nesting": "Api.reverseRows(longArrayOf(1))"
		, "array-element": "Api.reverseRows(arrayOf(intArrayOf(1)))"
		, "boxed-array": "Api.reverseRows(arrayOf(arrayOf(1L)))"
		, "option-type": "Api.echoMaybe(Option.some(true))"
		, "result-type": "Api.echoOutcome(Result.ok<String, String>(\"bad\"))"
		, "record-type": "Api.changePacket(\"packet\")"
		, "result-value": "val value: String = Api.make(); println(value)"
		, "fixed-overflow": "Api.echoInt8(256)"
	};
	return Object.entries(cases).map(([name, expression]) => ({ id: `aliases/${name}`
		, expectation: { kind: "compile-rejection"
			, diagnostic: java ? name === "result-value" ? "compiler.err.prob.found.req" : "compiler.err.cant.apply.symbol"
				: name === "result-value" ? ["INITIALIZER_TYPE_MISMATCH", "TYPE_MISMATCH"] : "ARGUMENT_TYPE_MISMATCH" }
		, source: `import org.leanbridge.aliases.*;\n${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${expression}\n}${java ? " }" : ""}\n` }));
};
