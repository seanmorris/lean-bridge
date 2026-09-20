/**
 * Independent Java/Kotlin compound callers and compile-time rejection cases.
 *
 * @file
 */
import { readFileSync } from "node:fs";

const values = {
	Unit: ["Unit", "LeanUnit", ["Unit.INSTANCE"]]
	, Bool: ["Boolean", "Boolean", ["false", "true"]]
	, Uint8: ["Integer", "Int", ["0", "1", "255"]]
	, Uint16: ["Integer", "Int", ["0", "1", "65535"]]
	, Uint32: ["Long", "Long", ["0L", "1L", "4294967295L"]]
	, Uint64: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE.shiftLeft(53).add(BigInteger.ONE)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, Int8: ["Byte", "Byte", ["Byte.MIN_VALUE", "(byte)-1", "(byte)0", "Byte.MAX_VALUE"]]
	, Int16: ["Short", "Short", ["Short.MIN_VALUE", "(short)-1", "(short)0", "Short.MAX_VALUE"]]
	, Int32: ["Integer", "Int", ["Integer.MIN_VALUE", "-1", "0", "Integer.MAX_VALUE"]]
	, Int64: ["Long", "Long", ["Long.MIN_VALUE", "-1L", "0L", "9007199254740993L", "Long.MAX_VALUE"]]
	, Nat: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "huge"]]
	, Int: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "huge", "huge.negate()"]]
	, Float32: ["Float", "Float", ["0f", "-0f", "1f / 3", "Float.MIN_VALUE", "-Float.MIN_VALUE", "Float.MAX_VALUE", "Float.NaN", "Float.POSITIVE_INFINITY", "Float.NEGATIVE_INFINITY"]]
	, Float64: ["Double", "Double", ["0d", "-0d", "1d / 3", "Double.MIN_VALUE", "-Double.MIN_VALUE", "Double.MAX_VALUE", "Double.NaN", "Double.POSITIVE_INFINITY", "Double.NEGATIVE_INFINITY"]]
	, String: ["String", "String", ['""', '"a\\0λ🌿"', '"e\\u0301"', '"\\udbff\\udfff"']]
	, Bytes: ["byte[]", "ByteArray", ["new byte[0]", "new byte[] { 0, -1, -128 }", "allBytes()"]]
	, Char: ["Integer", "Int", ["0", "0x7f", "0xd7ff", "0xe000", "0xffff", "0x10000", "0x10ffff"]]
	, Usize: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE.shiftLeft(32)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, Isize: ["Long", "Long", ["Long.MIN_VALUE", "-1L", "0L", "Long.MAX_VALUE"]]
};
const kotlinValue = value => value.replaceAll("Unit.INSTANCE", "LeanUnit.INSTANCE").replaceAll("Integer.", "Int.").replaceAll("BigInt.", "BigInteger.")
	.replace(/\(byte\)(-?\d+)/g, "($1).toByte()").replace(/\(short\)(-?\d+)/g, "($1).toShort()")
	.replaceAll("new byte[0]", "byteArrayOf()").replaceAll("new byte[] { 0, -1, -128 }", "byteArrayOf(0, -1, -128)")
	.replaceAll("\\0", "\\u0000").replace(/\b(\d+)d\b/g, "$1.0");

/**
 * Typed function references check every primitive payload independently of the generator.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCompoundPublicChecks = profile => Object.entries(values).map(([name, [java, kotlin, cases]]) => profile === "java"
	? `        exercise(Api::option${name}, Api::result${name}, Api::tuple${name}, java.util.List.<${java}>of(${cases.join(", ")}));`
	: `    exercise(Api::option${name}, Api::result${name}, Api::tuple${name}, listOf<${kotlin}>(${cases.map(kotlinValue).join(", ")}))`).join("\n");

/**
 * Materialize the independently written downstream source with its typed primitive cases.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCompoundConsumer = profile => readFileSync(new URL(`../fixtures/compound-consumers/${profile === "java" ? "java.java" : "kotlin.kt"}`, import.meta.url), "utf8")
	.replace("/* PRIMITIVE_CASES */", jvmCompoundPublicChecks(profile));

/**
 * Invalid callers must produce source-located type errors, not infrastructure failures.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCompoundRejections = profile => {
	const java = profile === "java";
	const cases = java ? {
		"option-payload": 'Api.optionUint32(Option.some("wrong"));'
		, "result-payload": 'Api.resultString(Result.<Long, Long>ok(1L));'
		, "bare-option": 'Api.optionUnit(Unit.INSTANCE);'
		, "bare-result": 'String value = Api.resultString(Result.ok("x"));'
		, "product-type": 'Api.tupleUint32(new Pair<>("x", "y"));'
		, "product-array": 'Api.tupleUint32(new long[] { 1, 2 });'
		, "product-arity": 'new Pair<Long, Long>(1L, 2L, 3L);'
		, "nested-option": 'Api.classify(Option.<Unit>some(Unit.INSTANCE));'
		, "boxed-width": 'Api.optionUint32(Option.<Integer>some(1));'
		, "fixed-width": 'Api.optionInt8(Option.<Byte>some(256));'
	} : {
		"option-payload": 'Api.optionUint32(Option.some("wrong"))'
		, "result-payload": 'Api.resultString(Result.ok<Long, Long>(1L))'
		, "bare-option": 'Api.optionUnit(LeanUnit.INSTANCE)'
		, "bare-result": 'val value: String = Api.resultString(Result.ok("x")); println(value)'
		, "product-type": 'Api.tupleUint32(Pair("x", "y"))'
		, "product-array": 'Api.tupleUint32(longArrayOf(1, 2))'
		, "product-arity": 'Pair(1L, 2L, 3L)'
		, "nested-option": 'Api.classify(Option.some<LeanUnit>(LeanUnit.INSTANCE))'
		, "boxed-width": 'Api.optionUint32(Option.some<Int>(1))'
		, "fixed-width": 'Api.optionInt8(Option.some<Byte>(256))'
		, "kotlin-pair": 'Api.tupleUint32(kotlin.Pair(1L, 2L))'
	};
	const diagnostics = java ? { "bare-result": "compiler.err.prob.found.req", "product-arity": "compiler.err.cant.apply.symbol" }
		: { "bare-result": ["INITIALIZER_TYPE_MISMATCH", "TYPE_MISMATCH"], "product-arity": "TOO_MANY_ARGUMENTS", "fixed-width": "ARGUMENT_TYPE_MISMATCH" };
	return Object.entries(cases).map(([name, expression]) => ({ id: `compounds/${name}`
		, expectation: { kind: "compile-rejection", diagnostic: diagnostics[name] ?? (java ? "compiler.err.cant.apply.symbol" : "ARGUMENT_TYPE_MISMATCH") }
		, source: `import org.leanbridge.compounds.*;\n${java ? "import org.leanbridge.compounds.Unit;" : "import org.leanbridge.compounds.Unit as LeanUnit;\nimport org.leanbridge.compounds.Pair;"}\n${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${expression}\n}${java ? " }" : ""}\n` }));
};
