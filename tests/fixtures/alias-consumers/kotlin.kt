// Independently typed Kotlin caller using the prepared Java API.
import org.leanbridge.aliases.*
import org.leanbridge.aliases.Unit as LeanUnit
import org.leanbridge.aliases.Pair
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicInteger

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
fun <T : Any> exercise(echo: (T) -> T, values: Array<T>) { for (value in values) equal(echo(value), value) }
fun main() {
    val huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(19))
/* PRIMITIVE_CASES */
    val unit: (LeanUnit) -> kotlin.Unit = Api::echoUnit; unit(LeanUnit.INSTANCE)
    verify(Api::class.java.getMethod("echoUnit", LeanUnit::class.java).returnType == Void.TYPE)
    val increment: (Long) -> Long = Api::increment
    verify(Api.make() == 41L); equal(Api.label(), "alias🌱"); verify(increment(4294967295L) == 0L)
    for (i in 0L..511L) verify(increment(i) == i + 1)
    for (bit in intArrayOf(0, 7, 31, 32, 53, 64, 255, 1024, 5120)) {
        val value = BigInteger.ONE.shiftLeft(bit).add(BigInteger.valueOf(19))
        equal(Api.echoNat(value), value); equal(Api.echoInt(value), value); equal(Api.echoInt(value.negate()), value.negate())
    }
    val fields = Scalars(LeanUnit.INSTANCE, true, 255, 65535, 4294967295L,
        BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Byte.MIN_VALUE, Short.MIN_VALUE, Int.MIN_VALUE, Long.MIN_VALUE,
        huge, BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(31)).negate(), 1.5f, -2.25,
        "A\u0000🌱", byteArrayOf(0, -1, 1), 0x1f331, BigInteger.valueOf(4294967295L), -2147483648L)
    verify(Api.inspect(fields)); val copied = Api.echoScalars(fields); equal(copied, fields)
    verify(copied !== fields); verify(copied.vBytes() !== fields.vBytes())
    val components = Scalars::class.java.recordComponents; verify(components.size == 19)
    val constructor = Scalars::class.java.getConstructor(*components.map { it.type }.toTypedArray())
    val original = components.map { it.accessor.invoke(fields) }.toTypedArray()
    val different = arrayOf<Any>(LeanUnit.INSTANCE, false, 0, 0, 0L, BigInteger.ZERO, 0.toByte(), 0.toShort(), 0, 0L,
        BigInteger.ZERO, BigInteger.ZERO, 0f, 0.0, "", byteArrayOf(), 0, BigInteger.ZERO, 0L)
    for (i in 1..18) { val changed = original.copyOf(); changed[i] = different[i]; verify(!Api.inspect(constructor.newInstance(*changed))) }
    copied.vBytes()[0] = 17; verify(Api.inspect(fields))
    equal(Api.reverseRows(emptyArray()), emptyArray<LongArray>()); equal(Api.reversePackets(emptyArray()), emptyArray<Packet>())
    for (maybe in listOf<Option<Option<LeanUnit>>>(Option.none(), Option.some(Option.none()), Option.some(Option.some(LeanUnit.INSTANCE)))) {
        equal(Api.echoMaybe(maybe), maybe)
        for (outcome in listOf<Result<Pair<Long, ByteArray>, String>>(Result.ok(Pair(7L, byteArrayOf(0, -1, 1))),
            Result.ok(Pair(0L, byteArrayOf())), Result.err(""), Result.err("no\u0000🌱"))) {
            equal(Api.echoOutcome(outcome), outcome)
            val packet = Packet(41, "packet\u0000🌱", arrayOf(longArrayOf(1, 2, 3), longArrayOf(), longArrayOf(1, 1)), maybe, outcome)
            val changed = Api.changePacket(packet); equal(changed, Packet(42, packet.text(), packet.rows(), maybe, outcome))
            verify(changed !== packet && changed.rows() !== packet.rows()); changed.rows()[0][0] = 99; verify(packet.rows()[0][0] == 1L)
            val result = Api.reversePackets(arrayOf(packet, changed)); equal(result, arrayOf(changed, packet))
            result[1].rows()[0][0] = 17; verify(packet.rows()[0][0] == 1L)
            val reversed = Api.reverseRows(packet.rows()); equal(reversed, arrayOf(longArrayOf(3, 2, 1), longArrayOf(), longArrayOf(1, 1)))
            reversed[0][0] = 77; verify(packet.rows()[0][0] == 1L)
        }
    }
    reject(IllegalArgumentException::class.java) { Api.echoNat(BigInteger.valueOf(-1)) }; equal(Api.echoInt(BigInteger.valueOf(-1)), BigInteger.valueOf(-1))
    for (value in intArrayOf(-1, 256)) reject(IllegalArgumentException::class.java) { Api.echoUint8(value) }
    for (value in intArrayOf(-1, 65536)) reject(IllegalArgumentException::class.java) { Api.echoUint16(value) }
    for (value in longArrayOf(-1, 4294967296L)) { reject(IllegalArgumentException::class.java) { Api.echoUint32(value) }; reject(IllegalArgumentException::class.java) { Api.increment(value) } }
    for (value in arrayOf(BigInteger.valueOf(-1), BigInteger.ONE.shiftLeft(64))) { reject(IllegalArgumentException::class.java) { Api.echoUint64(value) }; reject(IllegalArgumentException::class.java) { Api.echoUsize(value) } }
    for (value in intArrayOf(-1, 0xd800, 0xdfff, 0x110000)) reject(IllegalArgumentException::class.java) { Api.echoChar(value) }
    reject(IllegalArgumentException::class.java) { Api.echoString("\ud800") }
    reject(IllegalArgumentException::class.java) { Api.reverseRows(arrayOf(longArrayOf(1), longArrayOf(4294967296L))) }
    reject(IllegalArgumentException::class.java) { Api.echoOutcome(Result.ok(Pair(4294967296L, byteArrayOf()))) }
    val negative = original.copyOf(); negative[10] = BigInteger.valueOf(-1)
    val invalid = constructor.newInstance(*negative); reject(IllegalArgumentException::class.java) { Api.echoScalars(invalid) }
    reject(NullPointerException::class.java) { Api.echoUnit(null) }; reject(NullPointerException::class.java) { Api.echoString(null) }
    reject(NullPointerException::class.java) { Api.echoNat(null) }; reject(NullPointerException::class.java) { Api.echoBytes(null) }
    reject(NullPointerException::class.java) { Api.echoScalars(null) }; reject(NullPointerException::class.java) { Api.changePacket(null) }
    reject(NullPointerException::class.java) { Api.reverseRows(arrayOf(longArrayOf(1), null)) }
    reject(NullPointerException::class.java) { Api.reversePackets(arrayOf<Packet?>(null)) }
    reject(NullPointerException::class.java) { Api.echoMaybe(null) }; reject(NullPointerException::class.java) { Api.echoOutcome(null) }
    reject(NullPointerException::class.java) { Api.echoMaybe(Option.some(null)) }
    reject(NullPointerException::class.java) { Api.echoOutcome(Result.ok(Pair(1L, null))) }
    reject(NullPointerException::class.java) { Api.echoOutcome(Result.err(null)) }
    reject(IllegalStateException::class.java) { Option.none<LeanUnit>().value() }; reject(IllegalStateException::class.java) { Result.ok<Long, String>(1L).error() }
    reject(IllegalStateException::class.java) { Result.err<Long, String>("error").value() }
    repeat(3) {
        reject(IllegalArgumentException::class.java) { Api.echoBytes(ByteArray(16 * 1024 * 1024 + 1)) }
        reject(IllegalArgumentException::class.java) { Api.duplicate(ByteArray(9 * 1024 * 1024)) }
        reject(IllegalArgumentException::class.java) { Api.produce(BigInteger.valueOf(16L * 1024 * 1024 + 1)) }
        equal(Api.duplicate(byteArrayOf(0, -1)), Result.ok<Pair<Long, ByteArray>, String>(Pair(7L, byteArrayOf(0, -1, 0, -1))))
        equal(Api.produce(BigInteger.valueOf(3)), byteArrayOf(7, 7, 7)); verify(Api.make() == 41L)
    }
    java.util.concurrent.Executors.newFixedThreadPool(4).use { workers ->
        val tasks = (0..3).map { workers.submit { repeat(64) { i ->
            val n = huge.add(BigInteger.valueOf(i.toLong())); equal(Api.echoNat(n), n); verify(Api.inspect(fields))
        } } }
        tasks.forEach { it.get() }
    }
    Wire.result("aliases/assertions", Wire.integer(checks.get()), true)
    Wire.finish("kotlin", "Aliases", System.getProperty("java.version"), Api::class.java)
}
