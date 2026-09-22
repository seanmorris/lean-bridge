/**
 * Independent installed checks of the companion Kotlin API alongside Java interop.
 *
 * @file
 */
import { jvmCompoundPublicChecks } from "./jvm-compound-fixture.mjs";
import { jvmListPublicChecks } from "./jvm-list-fixture.mjs";
import { jvmAliasPublicChecks } from "./jvm-alias-fixture.mjs";

const primitives = [
	["Unit", "LeanUnit", "LeanUnit.INSTANCE"]
	, ["Bool", "Boolean", "true"], ["Uint8", "Int", "255"]
	, ["Uint16", "Int", "65535"], ["Uint32", "Long", "4294967295L"]
	, ["Uint64", "BigInteger", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]
	, ["Int8", "Byte", "Byte.MIN_VALUE"], ["Int16", "Short", "Short.MIN_VALUE"]
	, ["Int32", "Int", "Int.MIN_VALUE"], ["Int64", "Long", "Long.MIN_VALUE"]
	, ["Nat", "BigInteger", "huge"], ["Int", "BigInteger", "huge.negate()"]
	, ["Float32", "Float", "-0f"], ["Float64", "Double", "Double.NaN"]
	, ["String", "String", '"🌱\\u0000雪"'], ["Bytes", "ByteArray", "allBytes()"]
	, ["Char", "Int", "0x10ffff"]
	, ["Usize", "BigInteger", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]
	, ["Isize", "Long", "Long.MIN_VALUE"]
];
const deepOptionType = depth => "Option<".repeat(depth) + "Result<Pair<Long, LeanUnit>, String>" + ">".repeat(depth);
const deepArrays = () => Array.from({ length: 24 }, (_, n) => `    val deep${n + 1}: ${"Array<".repeat(n)}LongArray${">".repeat(n)} = ${n ? `arrayOf(deep${n})` : "longArrayOf(42L)"}`).join("\n")
	+ "\n    val copied: " + "Array<".repeat(23) + "LongArray" + ">".repeat(23) + " = Api.deep(deep24)\n    equal(copied, deep24); verify(copied !== deep24)";
const common = `
private var metadataChecks = 0
private fun verify(value: Boolean) { ++metadataChecks; check(value) { "Kotlin metadata check $metadataChecks" } }
private fun equal(a: Any, b: Any) { verify(java.util.Objects.deepEquals(a, b)) }
private fun allBytes() = ByteArray(256) { it.toByte() }
private inline fun <reified T : Throwable> metadataReject(action: () -> kotlin.Unit) {
    try { action() } catch (error: Throwable) { verify(error is T); return }
    error("Accepted malformed Kotlin metadata input")
}
`;
const helpers = {
	compounds: `private fun <T : Any> exercise(option: (Option<T>) -> Option<T>, result: (Result<T, T>) -> Result<T, T>, tuple: (Pair<T, T>) -> Pair<T, T>, values: List<T>) {
    equal(option(Option.none()), Option.none<T>())
    for (a in values) for (b in values) {
        equal(option(Option.some(a)), Option.some(a))
        equal(result(Result.ok(a)), Result.err<T, T>(a))
        equal(result(Result.err(b)), Result.ok<T, T>(b))
        equal(tuple(Pair(a, b)), Pair(b, a))
    }
}
`
	, lists: `private fun <T : Any> exercise(reverse: (T) -> T, values: T) {
    val result: T = reverse(values)
    verify(result !== values && result.javaClass == values.javaClass)
    val length = java.lang.reflect.Array.getLength(values)
    verify(java.lang.reflect.Array.getLength(result) == length)
    for (i in 0 until length) equal(java.lang.reflect.Array.get(result, i), java.lang.reflect.Array.get(values, length - i - 1))
}
`
	, aliases: `private fun <T : Any> exercise(echo: (T) -> T, values: Array<T>) { for (value in values) equal(echo(value), value) }
`
};
const bodies = {
	compounds: () => `${jvmCompoundPublicChecks("kotlin")}
    val states = listOf<Option<Option<LeanUnit>>>(Option.none(), Option.some(Option.none()), Option.some(Option.some(LeanUnit.INSTANCE)))
    for ((index, state) in states.withIndex()) { verify(Api.classify(state) == index.toLong()); equal(Api.next(state), states[(index + 1) % 3]) }
    for ((index, state) in states.withIndex()) verify(when (state) { is Option.None -> index == 0; is Option.Some -> state.value().isSome() == (index == 2) })
    val deep0: ${deepOptionType(0)} = Result.ok(Pair(42L, LeanUnit.INSTANCE))
${Array.from({ length: 24 }, (_, n) => `    val deep${n + 1}: ${deepOptionType(n + 1)} = Option.some<${deepOptionType(n)}>(deep${n})`).join("\n")}
    val output: ${deepOptionType(24)} = Api.deep(deep24)
    equal(output, deep24)
    val pair: Pair<Long, Option<LeanUnit>> = Pair(42L, Option.some(LeanUnit.INSTANCE))
    equal(Api.flip(Result.ok(pair)), Result.err<Option<String>, Pair<Long, Option<LeanUnit>>>(pair))
    val bytes = byteArrayOf(0, -1); val duplicated = Api.duplicate(Option.some(bytes)).value().value()
    equal(duplicated, arrayOf(bytes, bytes)); duplicated[0][0] = 8; verify(duplicated[1][0] == 0.toByte() && bytes[0] == 0.toByte())
    metadataReject<IllegalStateException> { Option.none<LeanUnit>().value() }
    metadataReject<IllegalArgumentException> { Api.optionNat(Option.some(BigInteger.valueOf(-1))) }
    metadataReject<IllegalArgumentException> { Api.optionChar(Option.some(0xd800)) }
`
	, lists: () => `${jvmListPublicChecks("kotlin")}
    equal(Api.mix(arrayOf(longArrayOf(1, 2), longArrayOf())), arrayOf(longArrayOf(), longArrayOf(2, 1)))
    val input = Packet(arrayOf(longArrayOf(1, 2)), arrayOf(Option.some(Result.ok<Pair<BigInteger, LeanUnit>, String>(Pair(huge, LeanUnit.INSTANCE)))), arrayOf(byteArrayOf(0, -1)), arrayOf(arrayOf(Pair(true, 0x1f33f))))
    val output = Api.transform(input)
    equal(output.sequences, arrayOf(longArrayOf(2, 1)))
    equal(output.branches[0].value().value().first, huge.add(BigInteger.ONE))
    output.buffers[0][0] = 7; verify(input.buffers[0][0] == 0.toByte())
${deepArrays()}
    metadataReject<IllegalArgumentException> { Api.reverseUint32(longArrayOf(4294967296L)) }
`
	, aliases: () => `${jvmAliasPublicChecks("kotlin")}
    Api.echoUnit(LeanUnit.INSTANCE)
    val value: Long = Api.make(); verify(value == 41L && Api.increment(value) == 42L)
    val maybe: Option<Option<LeanUnit>> = Option.some(Option.none())
    val outcome: Result<Pair<Long, ByteArray>, String> = Result.ok(Pair(42L, byteArrayOf(0, -1)))
    val packet = Packet(41, "🌱", arrayOf(longArrayOf(1, 2)), maybe, outcome)
    val copied = Api.changePacket(packet)
    verify(copied.count == 42L); equal(copied.maybe, maybe); equal(copied.outcome, outcome)
    copied.rows[0][0] = 7; verify(packet.rows[0][0] == 1L)
    equal(Api.echoMaybe(maybe), maybe); equal(Api.echoOutcome(outcome), outcome)
    metadataReject<IllegalArgumentException> { Api.echoNat(BigInteger.valueOf(-1)) }
`
	, variants: () => `    val cases: Array<Signal> = arrayOf(SignalIdle(), SignalStopped(), SignalData(42, "🌱\\u0000"), SignalMarker(LeanUnit.INSTANCE))
    for (value in cases) {
        val output: Signal = Api.echo(value); equal(output, value); verify(output !== value)
        verify(when (output) { is SignalIdle -> true; is SignalStopped -> true; is SignalData -> output.count == 42L; is SignalMarker -> output.value == LeanUnit.INSTANCE })
    }
    equal(Api.signals(arrayOf(cases)), arrayOf(cases.reversedArray()))
    for (mode in arrayOf<Mode>(ModeFirst(), ModeSecond(), ModeThird())) equal(Api.echoMode(mode), mode)
    val outcome: Nested = NestedOutcome(Result.ok(Pair<Signal, Mode>(cases[2], ModeSecond())))
    equal(Api.echoNested(outcome), outcome)
    equal(Api.echoScalars(ScalarsAbsent()), ScalarsAbsent())
    equal(Api.echoAnonymous(AnonymousCollision(3, "collision")), AnonymousCollision(3, "collision"))
    equal(Api.echoOne(OneOnly(4294967295L)), OneOnly(0))
    when (val buffers = Api.duplicate(byteArrayOf(0, -1))) {
        is BuffersEmpty -> error("Expected two copied buffers")
        is BuffersPair -> { equal(buffers.first, buffers.second); verify(buffers.first !== buffers.second); buffers.first[0] = 7; verify(buffers.second[0] == 0.toByte()) }
    }
    metadataReject<IllegalArgumentException> { Api.echo(SignalData(4294967296L, "range")) }
`
	, callables: () => primitives.map(([kind, type, value]) => {
		const name = kind === "Float64" ? "Float" : kind;
		return `    run {
        val value: ${type} = ${value}
        ${name === "Unit" ? "Api.callUnit(value) { }; verify(true)" : `val copy: ${type} = Api.call${name}(value) { it }; equal(copy, value)`}
        var calls = 0
        ${name === "Unit" ? "Api.twiceUnit(value) { ++calls }" : `equal(Api.twice${name}(value) { ++calls; it }, value)`}
        verify(calls == 2)
        Api.make${name}(value).use { closure ->
            ${name === "Unit" ? "closure.invoke(true, value); verify(true)" : "equal(closure.invoke(true, value), value)"}
            closure.close(); verify(closure.isClosed()); metadataReject<IllegalStateException> { closure.invoke(true, value) }
        }
    }`;
	}).join("\n") + `
    org.leanbridge.callables.Api.makeAdder(2).use { verify(Api.twiceUint32(40, it) == 44L) }
    Api.makeAdder(2).use { verify(org.leanbridge.callables.Api.twiceUint32(40, it) == 44L) }
    val marker = Error("same callback error"); var caught: Throwable? = null
    try { Api.twiceUint32(0) { throw marker } } catch (error: Throwable) { caught = error }
    verify(caught === marker)
    metadataReject<IllegalArgumentException> { Api.callUint32(1) { 4294967296L } }
`
};

/**
 * Return independent typed checks for a known original installed JVM fixture.
 *
 * @param name - Collection family whose prepared artifact is under test.
 */
export const jvmKotlinMetadataConsumer = name => {
	if(!Object.hasOwn(bodies, name)) throw new Error(`No Kotlin metadata fixture for ${name}`);
	return `import org.leanbridge.${name}.kotlin.*
import org.leanbridge.${name}.kotlin.Api
import org.leanbridge.${name}.kotlin.Unit as LeanUnit
${name === "callables" ? "" : `import org.leanbridge.${name}.kotlin.Pair`}
import java.math.BigInteger
${common}
${helpers[name] ?? ""}
fun checkKotlinMetadata() {
    val huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(17))
    verify(Api::class.java.getAnnotation(Metadata::class.java) != null)
${bodies[name]()}
    Wire.result("kotlin-metadata/assertions", Wire.integer(metadataChecks), true)
}
`.replace(/\b(verify|equal|allBytes|exercise)\b/g, name => `metadata${name[0].toUpperCase()}${name.slice(1)}`);
};
