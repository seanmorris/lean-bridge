// Independently typed Kotlin caller; uses the prepared Java JAR directly.
import org.leanbridge.compounds.*
import org.leanbridge.compounds.Unit as LeanUnit
import org.leanbridge.compounds.Pair
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicInteger

typealias Choice = Option<Result<Pair<BigInteger, LeanUnit>, String>>
typealias Row = Option<Result<Pair<String, BigInteger>, Pair<ByteArray, BigInteger>>>
typealias Nested = Result<Option<Result<Pair<Long, LeanUnit>, String>>, Option<BigInteger>>
val checks = AtomicInteger()
fun verify(value: Boolean) { val n = checks.incrementAndGet(); if (!value) error("check $n") }
fun reject(type: Class<out Throwable>, action: () -> kotlin.Unit) {
    try { action() } catch (error: Throwable) { verify(type.isInstance(error)); return }
    error("Expected ${type.name}")
}
fun equal(a: Any, b: Any) {
    verify(a.javaClass == b.javaClass)
    if (a is Float && b is Float) verify(a.isNaN() && b.isNaN() || a.toRawBits() == b.toRawBits())
    else if (a is Double && b is Double) verify(a.isNaN() && b.isNaN() || a.toRawBits() == b.toRawBits())
    else if (a.javaClass.isArray) {
        val size = java.lang.reflect.Array.getLength(a); verify(size == java.lang.reflect.Array.getLength(b))
        repeat(size) { equal(java.lang.reflect.Array.get(a, it), java.lang.reflect.Array.get(b, it)) }
    } else if (a.javaClass.isRecord) for (field in a.javaClass.recordComponents) equal(field.accessor.invoke(a), field.accessor.invoke(b))
    else verify(a == b)
}
fun allBytes() = ByteArray(256) { it.toByte() }
fun <T> exercise(option: (Option<T>) -> Option<T>, result: (Result<T, T>) -> Result<T, T>, tuple: (Pair<T, T>) -> Pair<T, T>, values: List<T>) {
    equal(option(Option.none()), Option.none<T>())
    repeat(32) { i ->
        val a = values[i % values.size]; val b = values[(i + 1) % values.size]
        equal(option(Option.some(a)), Option.some(a))
        equal(result(Result.ok(a)), Result.err<T, T>(a)); equal(result(Result.err(a)), Result.ok<T, T>(a))
        equal(tuple(Pair(a, b)), Pair(b, a))
    }
}
fun deep() {
    var type = "org.leanbridge.compounds.Result<org.leanbridge.compounds.Pair<java.lang.Long, org.leanbridge.compounds.Unit>, java.lang.String>"
    repeat(24) { type = "org.leanbridge.compounds.Option<$type>" }
    val method = Api::class.java.getMethod("deep", Option::class.java)
    verify(method.genericReturnType.typeName == type); verify(method.genericParameterTypes[0].typeName == type)
    for (depth in 0..24) {
        var value: Any = if (depth == 24) Result.ok<Pair<Long, LeanUnit>, String>(Pair(42L, LeanUnit.INSTANCE)) else Option.none<Any>()
        repeat(depth) { value = Option.some(value) }
        equal(method.invoke(null, value), value)
    }
    var failure: Any = Result.err<Pair<Long, LeanUnit>, String>("deep\u0000λ")
    repeat(24) { failure = Option.some(failure) }
    equal(method.invoke(null, failure), failure)
}
fun main() {
    val huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.ONE.shiftLeft(255)).add(BigInteger.valueOf(17))
/* PRIMITIVE_CASES */
    val states = listOf<Option<Option<LeanUnit>>>(Option.none(), Option.some(Option.none()), Option.some(Option.some(LeanUnit.INSTANCE)))
    var state = states[0]
    repeat(30) { i -> equal(state, states[i % 3]); verify(Api.classify(state) == (i % 3).toLong()); state = Api.next(state) }
    equal(Api.make(), Option.some(Result.ok<Pair<BigInteger, LeanUnit>, String>(Pair(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), LeanUnit.INSTANCE))))
    equal(Api.flip(Result.ok(Pair(42L, Option.some(LeanUnit.INSTANCE)))), Result.err<Option<String>, Pair<Long, Option<LeanUnit>>>(Pair(42L, Option.some(LeanUnit.INSTANCE))))
    equal(Api.flip(Result.err(Option.some("error\u0000λ"))), Result.ok<Option<String>, Pair<Long, Option<LeanUnit>>>(Option.some("error\u0000λ")))
    equal(Api.flip(Result.err(Option.none())), Result.ok<Option<String>, Pair<Long, Option<LeanUnit>>>(Option.none()))
    val choices = listOf<Choice>(Option.none(), Option.some(Result.ok(Pair(huge, LeanUnit.INSTANCE))), Option.some(Result.err("oops\u0000")))
    val nestedCases = listOf<Nested>(Result.ok(Option.none()), Result.ok(Option.some(Result.ok(Pair(42L, LeanUnit.INSTANCE)))), Result.ok(Option.some(Result.err("bad"))), Result.err(Option.none()), Result.err(Option.some(huge)))
    for (choice in choices) for (nested in nestedCases) {
        val rows = arrayOf<Row>(Option.none(), Option.some(Result.ok(Pair("row\u0000🌿", BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)))), Option.some(Result.err(Pair(byteArrayOf(0, -1), huge.negate()))))
        val packet = Packet(choice, Pair(Pair(4L, "a\u0000"), Pair(true, 0x1f331)), rows, nested)
        val copied = Api.transform(packet)
        val expected: Choice = if (!choice.isSome()) Option.none() else if (choice.value().isOk()) Option.some(Result.ok(Pair(huge.add(BigInteger.ONE), LeanUnit.INSTANCE))) else Option.some(Result.err("oops\u0000!"))
        equal(copied.choice(), expected); equal(copied.products(), Pair(Pair(5L, "a\u0000!"), Pair(false, 0x1f331)))
        equal(copied.rows()[0], rows[2]); equal(copied.rows()[1], rows[1]); equal(copied.rows()[2], rows[0]); equal(copied.nested(), nested)
        copied.rows()[0].value().error().first()[0] = 7; verify(rows[2].value().error().first()[0] == 0.toByte())
    }
    deep()
    equal(Api.duplicate(Option.none()), Result.err<Option<Array<ByteArray>>, String>("empty"))
    val input = byteArrayOf(0, -1); val copies = Api.duplicate(Option.some(input)).value().value()
    equal(copies, arrayOf(byteArrayOf(0, -1), byteArrayOf(0, -1))); copies[0][0] = 7; verify(copies[1][0] == 0.toByte() && input[0] == 0.toByte())
    verify(Option.none<LeanUnit>() == Option.None<LeanUnit>()); verify(Option.none<LeanUnit>() != Option.some(LeanUnit.INSTANCE))
    verify(Result.ok<LeanUnit, LeanUnit>(LeanUnit.INSTANCE) != Result.err<LeanUnit, LeanUnit>(LeanUnit.INSTANCE))
    verify(Option.none<LeanUnit>().toString().startsWith("None")); verify(Option.some(LeanUnit.INSTANCE).toString().startsWith("Some"))
    verify(Result.ok<LeanUnit, String>(LeanUnit.INSTANCE).toString().startsWith("Ok")); verify(Result.err<LeanUnit, String>("error").toString().startsWith("Err"))
    // Java sealed hierarchies support exhaustive Kotlin when expressions.
    verify(when (val option = Option.some(LeanUnit.INSTANCE)) { is Option.None -> false; is Option.Some -> option.value() == LeanUnit.INSTANCE })
    verify(when (val result = Result.err<LeanUnit, String>("error")) { is Result.Ok -> false; is Result.Err -> result.error() == "error" })
    reject(IllegalStateException::class.java) { Option.none<LeanUnit>().value() }
    reject(IllegalStateException::class.java) { Result.ok<LeanUnit, String>(LeanUnit.INSTANCE).error() }
    reject(IllegalStateException::class.java) { Result.err<LeanUnit, String>("error").value() }
    reject(NullPointerException::class.java) { Option.some<String>(null) }
    reject(NullPointerException::class.java) { Result.ok<String, String>(null) }; reject(NullPointerException::class.java) { Result.err<String, String>(null) }
    reject(NullPointerException::class.java) { Pair("allocated", null) }
    reject(NullPointerException::class.java) { Api.optionString(null) }; reject(NullPointerException::class.java) { Api.resultString(null) }
    reject(NullPointerException::class.java) { Api.tupleString(null) }; reject(NullPointerException::class.java) { Api.transform(null) }
    reject(IllegalArgumentException::class.java) { Api.optionNat(Option.some(BigInteger.valueOf(-1))) }
    reject(IllegalArgumentException::class.java) { Api.resultNat(Result.err(BigInteger.valueOf(-1))) }
    reject(IllegalArgumentException::class.java) { Api.optionUint8(Option.some(256)) }
    reject(IllegalArgumentException::class.java) { Api.optionUint16(Option.some(-1)) }
    reject(IllegalArgumentException::class.java) { Api.optionUint32(Option.some(4294967296L)) }
    reject(IllegalArgumentException::class.java) { Api.optionUint64(Option.some(BigInteger.ONE.shiftLeft(64))) }
    reject(IllegalArgumentException::class.java) { Api.optionChar(Option.some(0xd800)) }
    reject(IllegalArgumentException::class.java) { Api.optionString(Option.some("\ud800")) }
    reject(IllegalArgumentException::class.java) { Api.optionBytes(Option.some(ByteArray(16 * 1024 * 1024))) }
    reject(IllegalArgumentException::class.java) { Api.duplicate(Option.some(ByteArray(6 * 1024 * 1024))) }
    equal(Api.duplicate(Option.some(input)), Result.ok<Option<Array<ByteArray>>, String>(Option.some(arrayOf(byteArrayOf(0, -1), byteArrayOf(0, -1)))))
    java.util.concurrent.Executors.newFixedThreadPool(4).use { workers ->
        val tasks = (0..3).map { workers.submit { repeat(64) { i -> equal(Api.optionNat(Option.some(huge.add(BigInteger.valueOf(i.toLong())))), Option.some(huge.add(BigInteger.valueOf(i.toLong())))) } } }
        tasks.forEach { it.get() }
    }
    Wire.result("compounds/assertions", Wire.integer(checks.get()), true)
    Wire.finish("kotlin", "Compounds", KotlinVersion.CURRENT.toString(), Api::class.java)
}
