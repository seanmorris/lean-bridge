import java.math.BigInteger
import org.leanbridge.collections.Empty
import org.leanbridge.collections.Single
import org.leanbridge.collections.Count
import org.leanbridge.collections.Primitives
import org.leanbridge.collections.Unit as LeanUnit
import org.leanbridge.compounds.Option
import org.leanbridge.compounds.Result
import org.leanbridge.compounds.Pair as LeanPair

private var checks = 0
private fun verify(condition: Boolean) { checks++; check(condition) { "check $checks" } }
private fun equal(a: Any, b: Any) {
    verify(a !== b); verify(a == b); verify(b == a); verify(a.hashCode() == b.hashCode())
    verify(hashSetOf(a, b).size == 1); verify(hashMapOf(a to "value")[b] == "value")
}
private fun different(a: Any, b: Any) { verify(a != b); verify(b != a) }
private fun primitives(n: Int, x: Float, y: Double): Primitives = Primitives(
    LeanUnit.INSTANCE, true, n, 65535, 0xffffffffL, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE),
    (-128).toByte(), (-32768).toShort(), Int.MIN_VALUE, Long.MIN_VALUE, BigInteger.ONE.shiftLeft(256),
    BigInteger.valueOf(-n.toLong()), x, y, "雪\u0000$n", byteArrayOf(0, n.toByte(), -1), 0x1f680,
    BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Long.MIN_VALUE)

fun main() {
    for (n in 0 until 256) {
        equal(primitives(n, Float.NaN, Double.NaN), primitives(n, Float.fromBits(0x7f800001), Double.fromBits(0x7ff0000000000001L)))
        different(primitives(n, 0.0f, 0.0), primitives(n, -0.0f, 0.0))
        different(primitives(n, 0.0f, 0.0), primitives(n, 0.0f, -0.0))
        verify(primitives(n, 0.0f, 0.0).char_() == 0x1f680)
        fun arrays(): Array<Any> = arrayOf(byteArrayOf(n.toByte()), intArrayOf(n), longArrayOf(n.toLong()),
            floatArrayOf(Float.NaN), doubleArrayOf(Double.NaN), arrayOf(arrayOf("$n"), emptyArray<String>()))
        equal(Option.some(arrays()), Option.some(arrays()))
        equal(Result.ok<Any, Any>(arrays()), Result.ok<Any, Any>(arrays()))
        equal(Result.err<Any, Any>(arrays()), Result.err<Any, Any>(arrays()))
        equal(LeanPair(arrays(), Option.some(arrays())), LeanPair(arrays(), Option.some(arrays())))
        different(Result.ok<Any, Any>(arrays()), Result.err<Any, Any>(arrays()))
        different(Option.none<Any>(), Option.some(Option.none<Any>()))
        different(Option.some(Option.none<Any>()), Option.some(emptyArray<Any>()))
        fun list() = org.leanbridge.lists.Packet(arrayOf(longArrayOf(n.toLong()), longArrayOf()),
            arrayOf(org.leanbridge.lists.Option.none()), arrayOf(byteArrayOf(n.toByte())),
            arrayOf(arrayOf(org.leanbridge.lists.Pair(true, n))))
        equal(list(), list())
        fun alias() = org.leanbridge.aliases.Packet(n.toLong(), "alias", arrayOf(longArrayOf(n.toLong())),
            org.leanbridge.aliases.Option.some(org.leanbridge.aliases.Option.none()),
            org.leanbridge.aliases.Result.ok(org.leanbridge.aliases.Pair(n.toLong(), byteArrayOf(n.toByte()))))
        equal(alias(), alias())
        equal(org.leanbridge.variants.BuffersPair(byteArrayOf(n.toByte()), byteArrayOf()),
            org.leanbridge.variants.BuffersPair(byteArrayOf(n.toByte()), byteArrayOf()))
        val a = Option.some(arrays()); val b = Option.some(arrays())
        (b.value()[0] as ByteArray)[0] = (n + 1).toByte(); different(a, b)
    }
    equal(Empty(), Empty()); equal(Single(BigInteger.ONE), Single(BigInteger.ONE))
    different(Single(BigInteger.ONE), Count(BigInteger.ONE))
    different(org.leanbridge.variants.SignalIdle(), org.leanbridge.variants.SignalStopped())
    var a: Any = longArrayOf(1, 2); var b: Any = longArrayOf(1, 2)
    repeat(23) {
        val nextA = java.lang.reflect.Array.newInstance(a.javaClass, 1)
        val nextB = java.lang.reflect.Array.newInstance(b.javaClass, 1)
        java.lang.reflect.Array.set(nextA, 0, a); java.lang.reflect.Array.set(nextB, 0, b)
        a = nextA; b = nextB
    }
    equal(Option.some(a), Option.some(b))
    different(Option.some(doubleArrayOf(0.0)), Option.some(doubleArrayOf(-0.0)))
    verify(byteArrayOf(1) != byteArrayOf(1)); verify(byteArrayOf(1).contentEquals(byteArrayOf(1)))
    println("{\"checks\":$checks,\"generatedProfiles\":5,\"fixedArrayDepth\":24,\"nativeCalls\":0}")
}
