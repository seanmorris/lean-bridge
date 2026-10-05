// Independently typed Kotlin caller; uses the prepared Java JAR directly.
import org.leanbridge.lists.*
import org.leanbridge.lists.Unit as LeanUnit
import org.leanbridge.lists.Pair
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicInteger

typealias Choice = Option<Result<Pair<BigInteger, LeanUnit>, String>>
typealias Nested = Option<Array<Result<Array<LeanUnit>, String>>>
typealias SwapInput = Result<Pair<Array<BigInteger>, LongArray>, Array<String>>
typealias SwapOutput = Result<Array<String>, Pair<Array<BigInteger>, LongArray>>
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
@Suppress("UNCHECKED_CAST")
fun <T : Any> exercise(reverse: (T) -> T, values: T) {
    val type = values.javaClass.componentType; val size = java.lang.reflect.Array.getLength(values)
    val empty = java.lang.reflect.Array.newInstance(type, 0) as T; equal(reverse(empty), empty)
    repeat(32) { i ->
        val input = java.lang.reflect.Array.newInstance(type, 4) as T; val expected = java.lang.reflect.Array.newInstance(type, 4) as T
        val positions = intArrayOf(i % size, (i + 1) % size, i % size, (i + 2) % size)
        for (j in 0..3) {
            val value = java.lang.reflect.Array.get(values, positions[j]); java.lang.reflect.Array.set(input, j, value); java.lang.reflect.Array.set(expected, 3 - j, value)
        }
        equal(reverse(input), expected)
    }
    val singleton = java.lang.reflect.Array.newInstance(type, 1) as T; java.lang.reflect.Array.set(singleton, 0, java.lang.reflect.Array.get(values, 0))
    equal(reverse(singleton), singleton)
}
fun deep() {
    val types = mutableListOf<Class<*>>(java.lang.Long.TYPE)
    repeat(24) { types.add(java.lang.reflect.Array.newInstance(types.last(), 0).javaClass) }
    val method = Api::class.java.getMethod("deep", types[24]); verify(method.returnType == types[24])
    for (depth in 0..24) {
        var value: Any = if (depth == 24) 42L else java.lang.reflect.Array.newInstance(types[23 - depth], 0)
        for (level in (25 - depth)..24) {
            val next = java.lang.reflect.Array.newInstance(types[level - 1], 1); java.lang.reflect.Array.set(next, 0, value); value = next
        }
        equal(method.invoke(null, value), value)
    }
}
fun main() {
    val huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.ONE.shiftLeft(255)).add(BigInteger.valueOf(17))
/* PRIMITIVE_CASES */
    val join: (Array<String>) -> String = Api::join
    val mix: (Array<LongArray>) -> Array<LongArray> = Api::mix
    equal(join(arrayOf("a\u0000", "", "🌿")), "a\u0000🌱🌱🌿"); equal(join(emptyArray()), "")
    equal(mix(arrayOf(longArrayOf(1, 2, 3), longArrayOf(), longArrayOf(4))), arrayOf(longArrayOf(4), longArrayOf(), longArrayOf(3, 2, 1)))
    repeat(20) { index ->
        val branches = arrayOf<Choice>(Option.none(), Option.some(Result.ok(Pair(huge, LeanUnit.INSTANCE))), Option.some(Result.err("oops\u0000")))
        val packet = Packet(arrayOf(longArrayOf(1, 2, 3), longArrayOf(), longArrayOf(index.toLong())), branches, arrayOf(byteArrayOf(0, -1), byteArrayOf()), arrayOf(arrayOf(Pair(true, 0x1f33f), Pair(false, 0)), emptyArray()))
        val copied = Api.transform(packet)
        equal(copied.sequences(), arrayOf(longArrayOf(index.toLong()), longArrayOf(), longArrayOf(3, 2, 1)))
        equal(copied.branches()[0], Option.some(Result.err<Pair<BigInteger, LeanUnit>, String>("oops\u0000!")))
        equal(copied.branches()[1], Option.some(Result.ok<Pair<BigInteger, LeanUnit>, String>(Pair(huge.add(BigInteger.ONE), LeanUnit.INSTANCE))))
        equal(copied.branches()[2], Option.none<Result<Pair<BigInteger, LeanUnit>, String>>())
        equal(copied.buffers(), arrayOf(byteArrayOf(), byteArrayOf(0, -1)))
        equal(copied.arrays(), arrayOf(emptyArray<Pair<Boolean, Int>>(), arrayOf(Pair(false, 0), Pair(true, 0x1f33f))))
        verify(copied !== packet); copied.buffers()[1][0] = 9; verify(packet.buffers()[0][0] == 0.toByte())
        packet.sequences()[0][0] = 99; packet.arrays()[0][0] = Pair(false, 1); packet.branches()[1] = Option.none()
        equal(copied.sequences()[2], longArrayOf(3, 2, 1)); verify(copied.branches()[1].isSome()); equal(copied.arrays()[1][1], Pair(true, 0x1f33f))
    }
    val nest: (Nested) -> Nested = Api::nest
    val swap: (SwapInput) -> SwapOutput = Api::swap
    equal(nest(Option.none()), Option.none<Array<Result<Array<LeanUnit>, String>>>())
    equal(nest(Option.some(emptyArray())), Option.some(emptyArray<Result<Array<LeanUnit>, String>>()))
    val nested = arrayOf<Result<Array<LeanUnit>, String>>(Result.ok(arrayOf(LeanUnit.INSTANCE, LeanUnit.INSTANCE)), Result.err("bad\u0000"), Result.ok(emptyArray()))
    equal(nest(Option.some(nested)), Option.some(arrayOf<Result<Array<LeanUnit>, String>>(Result.ok(emptyArray()), Result.err("bad\u0000!"), Result.ok(arrayOf(LeanUnit.INSTANCE, LeanUnit.INSTANCE)))))
    equal(swap(Result.err(arrayOf("first", "last"))), Result.ok<Array<String>, Pair<Array<BigInteger>, LongArray>>(arrayOf("last", "first")))
    equal(swap(Result.ok(Pair(arrayOf(huge, BigInteger.valueOf(42)), longArrayOf(1, 2, 3)))), Result.err<Array<String>, Pair<Array<BigInteger>, LongArray>>(Pair(arrayOf(BigInteger.valueOf(42), huge), longArrayOf(3, 2, 1))))
    deep()
    val input = byteArrayOf(0, -1); val copies = Api.duplicate(input); equal(copies, arrayOf(byteArrayOf(0, -1), byteArrayOf(0, -1)))
    copies[0][0] = 7; verify(copies[1][0] == 0.toByte() && input[0] == 0.toByte()); equal(Api.duplicate(byteArrayOf()), arrayOf(byteArrayOf(), byteArrayOf()))
    reject(IllegalArgumentException::class.java) { Api.reverseNat(arrayOf(huge, BigInteger.valueOf(-1))) }
    reject(IllegalArgumentException::class.java) { Api.reverseUint8(intArrayOf(1, 256)) }; reject(IllegalArgumentException::class.java) { Api.reverseUint16(intArrayOf(1, -1)) }
    reject(IllegalArgumentException::class.java) { Api.reverseUint32(longArrayOf(1, 4294967296L)) }; reject(IllegalArgumentException::class.java) { Api.reverseUint64(arrayOf(huge)) }
    reject(IllegalArgumentException::class.java) { Api.reverseUsize(arrayOf(BigInteger.valueOf(-1))) }; reject(IllegalArgumentException::class.java) { Api.reverseChar(intArrayOf(1, 0xd800)) }
    reject(IllegalArgumentException::class.java) { Api.reverseString(arrayOf("copied first", "\ud800")) }
    reject(NullPointerException::class.java) { Api.reverseString(arrayOf("copied first", null)) }
    reject(NullPointerException::class.java) { Api.reverseBytes(arrayOf(byteArrayOf(0), null)) }
    reject(NullPointerException::class.java) { Api.reverseUnit(arrayOf(LeanUnit.INSTANCE, null)) }
    reject(NullPointerException::class.java) { Api.mix(arrayOf(longArrayOf(1), null)) }
    reject(NullPointerException::class.java) { Api.nest(Option.some(arrayOf(Result.ok<Array<LeanUnit>, String>(emptyArray()), null))) }
    reject(NullPointerException::class.java) { Api.transform(null) }; reject(NullPointerException::class.java) { Api.reverseUint32(null) }
    reject(IllegalArgumentException::class.java) { Api.reverseUnit(arrayOfNulls<LeanUnit>((1 shl 21) + 1)) }
    reject(IllegalArgumentException::class.java) { Api.reverseBytes(arrayOf(ByteArray(16 * 1024 * 1024))) }
    repeat(3) { reject(IllegalArgumentException::class.java) { Api.duplicate(ByteArray(6 * 1024 * 1024)) }; equal(Api.duplicate(input), arrayOf(byteArrayOf(0, -1), byteArrayOf(0, -1))) }
    reject(IllegalArgumentException::class.java) { Api.generate(BigInteger.valueOf(2097153)) }
    equal(Api.generate(BigInteger.ONE), longArrayOf(7)); equal(Api.generate(BigInteger.valueOf(30000)), LongArray(30000) { 7 })
    java.util.concurrent.Executors.newFixedThreadPool(4).use { workers ->
        val tasks = (0..3).map { workers.submit { repeat(64) { i ->
            val n = huge.add(BigInteger.valueOf(i.toLong())); equal(Api.reverseNat(arrayOf(n, BigInteger.ONE)), arrayOf(BigInteger.ONE, n))
        } } }
        tasks.forEach { it.get() }
    }
    Wire.result("lists/assertions", Wire.integer(checks.get()), true)
    Wire.finish("kotlin", "Lists", KotlinVersion.CURRENT.toString(), Api::class.java)
}
