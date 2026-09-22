// Independently typed Kotlin calls to the original installed Maven JAR.
import org.leanbridge.collections.kotlin.*
import org.leanbridge.collections.kotlin.Unit
import org.leanbridge.collections.kotlin.Pair
import java.math.BigInteger
import java.lang.reflect.Array as JArray
import java.util.concurrent.atomic.AtomicInteger

/* DOCUMENTATION_DECLARATION */

private val checks = AtomicInteger()
private val calls = AtomicInteger()
private var rejected = 0
private val recordFields = mutableMapOf<Class<*>, List<java.lang.reflect.Field>>()
private fun verify(value: Boolean) { val n = checks.incrementAndGet(); if (!value) throw AssertionError("collection check $n") }
private fun kotlinRecord(type: Class<*>, names: Array<String>, types: Array<Class<*>>) {
    verify(java.lang.reflect.Modifier.isFinal(type.modifiers)); verify(type.getAnnotation(Metadata::class.java) != null)
    verify(type.constructors.size == 1); verify(type.constructors[0].parameterTypes.contentEquals(types))
    verify(type.declaredFields.size == names.size)
    val fields = names.mapIndexed { index, name ->
        val field = type.getDeclaredField(name)
        verify(field.type == types[index]); verify(java.lang.reflect.Modifier.isFinal(field.modifiers))
        verify(java.lang.reflect.Modifier.isPublic(field.modifiers))
        val accessor = type.getDeclaredMethod(name)
        verify(accessor.returnType == types[index] && java.lang.reflect.Modifier.isPublic(accessor.modifiers))
        field
    }
    recordFields[type] = fields
}
// Only malformed foreign inputs use an erased cast. Every valid call stays typed.
@Suppress("UNCHECKED_CAST") private fun <T> foreign(value: Any?): T = value as T
private fun <T> call(action: () -> T): T { calls.incrementAndGet(); return action() }
private fun equal(actual: Any, expected: Any) {
    verify(actual.javaClass == expected.javaClass)
    when {
        expected is Float -> verify(if (expected.isNaN()) (actual as Float).isNaN() else expected.toRawBits() == (actual as Float).toRawBits())
        expected is Double -> verify(if (expected.isNaN()) (actual as Double).isNaN() else expected.toRawBits() == (actual as Double).toRawBits())
        expected.javaClass.isArray -> {
            verify(JArray.getLength(actual) == JArray.getLength(expected))
            for (i in 0 until JArray.getLength(expected)) equal(JArray.get(actual, i), JArray.get(expected, i))
        }
        recordFields.containsKey(expected.javaClass) -> {
            for (field in recordFields.getValue(expected.javaClass)) equal(field.get(actual), field.get(expected))
            verify(actual == expected); verify(actual.hashCode() == expected.hashCode())
        }
        else -> verify(actual == expected)
    }
}
private fun reverse(input: Any, result: Any) {
    verify(input !== result); verify(input.javaClass == result.javaClass); verify(JArray.getLength(input) == JArray.getLength(result))
    for (i in 0 until JArray.getLength(input)) {
        val row = JArray.get(input, i); val reversed = JArray.get(result, JArray.getLength(input) - 1 - i)
        verify(row !== reversed); verify(JArray.getLength(row) == JArray.getLength(reversed))
        for (j in 0 until JArray.getLength(row)) equal(JArray.get(reversed, JArray.getLength(row) - 1 - j), JArray.get(row, j))
    }
}
private fun reject(type: Class<out Throwable>, action: () -> Any?) {
    var failed = false
    try { action() } catch (error: Throwable) { verify(type.isInstance(error)); failed = true; rejected++ }
    verify(failed); equal(call { Api.recordMake() }, Pair(42, "\uFEFF🌱\u0000"))
}
private fun change(value: Primitives, index: Int, replacement: Any?): Primitives {
    val fields = recordFields.getValue(Primitives::class.java)
    val values = fields.map { it.get(value) }.toTypedArray(); values[index] = replacement
    try { return Primitives::class.java.getConstructor(*fields.map { it.type }.toTypedArray()).newInstance(*values) }
    catch (error: java.lang.reflect.InvocationTargetException) { throw error.targetException }
}
fun main() {
/* SIGNATURES */
    val max = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE); val huge = BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(31))
    val scalar = Primitives(Unit.INSTANCE, true, 255, 65535, 4294967295L, max, Byte.MIN_VALUE, Short.MIN_VALUE,
        Int.MIN_VALUE, Long.MIN_VALUE, BigInteger.ONE.shiftLeft(200), BigInteger.ONE.shiftLeft(200).negate(),
        -0f, 3.25, "🌱\u0000", byteArrayOf(-1, 0, 1), 0x1f331, max, -2147483648L)
    verify(call { Api.recordInspect(scalar) })
    verify(call { Api.arrayCheckElements(arrayOf(Unit.INSTANCE), booleanArrayOf(true), intArrayOf(255), intArrayOf(65535), longArrayOf(4294967295L), arrayOf(max),
        byteArrayOf(-128), shortArrayOf(-32768), intArrayOf(Int.MIN_VALUE), longArrayOf(Long.MIN_VALUE),
        arrayOf(BigInteger.ONE.shiftLeft(200)), arrayOf(BigInteger.ONE.shiftLeft(200).negate()),
        floatArrayOf(-0f), doubleArrayOf(3.25), arrayOf("🌱\u0000"), arrayOf(byteArrayOf(-1, 0, 1)), intArrayOf(0x1f331), arrayOf(max), longArrayOf(-2147483648L)) })
    val different = arrayOf<Any>(Unit.INSTANCE, false, 0, 0, 0L, BigInteger.ZERO, 0.toByte(), 0.toShort(), 0, 0L,
        BigInteger.ZERO, BigInteger.ZERO, 0f, 0.0, "", byteArrayOf(), 0, BigInteger.ZERO, 0L)
    for (i in 1 until different.size) { val changed = change(scalar, i, different[i]); verify(!call { Api.recordInspect(changed) }) }
    repeat(128) {
/* ARRAYS */
        val input = Packet("packet", arrayOf(arrayOf(scalar, scalar), emptyArray<Primitives>(), arrayOf(scalar)), Empty(), Single(max), Count(huge), Pair(4294967295L, "pair"), Reversed("reverse", 4294967295L))
        val expected = Packet("packet!", arrayOf(arrayOf(scalar), emptyArray<Primitives>(), arrayOf(scalar, scalar)), Empty(), Single(BigInteger.ZERO), Count(huge.add(BigInteger.valueOf(7))), Pair(0, "pairp"), Reversed("reverser", 1))
        equal(call { Api.recordShuffle(input) }, expected)
        val copied = call { Api.recordDuplicate(input) }; equal(copied, arrayOf(input, input))
        verify(copied[0] !== copied[1] && copied[0].values() !== copied[1].values())
        copied[0].values()[0][0].bytes()[0] = 7; verify(copied[1].values()[0][0].bytes()[0] == (-1).toByte()); verify(scalar.bytes()[0] == (-1).toByte())
        verify(copied[0] != input); verify(copied[1] == input)
        equal(call { Api.recordReverse(arrayOf(scalar, change(scalar, 14, "changed"))) }, arrayOf(change(scalar, 14, "changed"), scalar))
        equal(call { Api.recordEmpty(Empty()) }, Empty())
        equal(call { Api.recordSingle(Single(max)) }, Single(BigInteger.ZERO))
        equal(call { Api.recordCount(Count(huge)) }, Count(huge.add(BigInteger.ONE)))
        equal(call { Api.recordMake() }, Pair(42, "\uFEFF🌱\u0000"))
        equal(call { Api.arrayAdd(huge, arrayOf(arrayOf(huge.negate(), BigInteger.ONE), emptyArray<BigInteger>())) }, arrayOf(arrayOf(BigInteger.ZERO, huge.add(BigInteger.ONE)), emptyArray<BigInteger>()))
        equal(call { Api.arrayTotal(arrayOf(arrayOf(huge, huge), emptyArray<BigInteger>())) }, huge.shiftLeft(1))
        equal(call { Api.arrayWords() }, arrayOf(arrayOf("\uFEFFLean", "🌱\u0000"), emptyArray<String>()))
        val bytes = byteArrayOf(0, -1, 42); val duplicates = call { Api.arrayDuplicate(arrayOf(bytes)) }
        equal(duplicates, arrayOf(bytes, bytes)); verify(duplicates[0] !== duplicates[1]); duplicates[0][0] = 1; verify(duplicates[1][0] == 0.toByte() && bytes[0] == 0.toByte())
        equal(call { Api.arraySize(arrayOf(Unit.INSTANCE, Unit.INSTANCE)) }, BigInteger.TWO)
        equal(call { Api.generate(BigInteger.valueOf(3)) }, arrayOf(Unit.INSTANCE, Unit.INSTANCE, Unit.INSTANCE))
    }
/* DEEP */
    for (i in 0 until 19) if (!recordFields.getValue(Primitives::class.java)[i].type.isPrimitive) {
        reject(NullPointerException::class.java) { call { Api.recordReverse(arrayOf(scalar, change(scalar, i, null))) } }
    }
    for (field in intArrayOf(2, 3, 16)) for (value in when (field) { 2 -> intArrayOf(-1, 256); 3 -> intArrayOf(-1, 65536); else -> intArrayOf(-1, 0xd800, 0xdfff, 0x110000) })
        reject(IllegalArgumentException::class.java) { call { Api.recordReverse(arrayOf(scalar, change(scalar, field, value))) } }
    for (value in longArrayOf(-1, 4294967296L)) reject(IllegalArgumentException::class.java) { call { Api.arrayReverseUint32(arrayOf(longArrayOf(0, value))) } }
    for (field in intArrayOf(5, 17)) for (value in arrayOf(BigInteger.valueOf(-1), BigInteger.ONE.shiftLeft(64)))
        reject(IllegalArgumentException::class.java) { call { Api.recordReverse(arrayOf(change(scalar, field, value))) } }
    reject(IllegalArgumentException::class.java) { call { Api.arrayReverseNat(arrayOf(arrayOf(BigInteger.valueOf(-1)))) } }
    reject(IllegalArgumentException::class.java) { call { Api.arrayReverseString(arrayOf(arrayOf("ok", "\ud800"))) } }
    reject(NullPointerException::class.java) { call { Api.arrayReverseUint32(foreign(null)) } }
    reject(NullPointerException::class.java) { call { Api.arrayReverseUint32(arrayOf(longArrayOf(1), foreign<LongArray>(null))) } }
    reject(NullPointerException::class.java) { call { Api.recordDuplicate(foreign(null)) } }
    reject(NullPointerException::class.java) { call { Api.recordShuffle(Packet("ok", foreign(null), Empty(), Single(max), Count(huge), Pair(0, ""), Reversed("", 0))) } }
    reject(IllegalArgumentException::class.java) { call { Api.arrayReverseString(arrayOf(arrayOf("x".repeat(17 * 1024 * 1024)))) } }
    reject(IllegalArgumentException::class.java) { call { Api.arrayDuplicate(arrayOf(ByteArray(9 * 1024 * 1024))) } }
    reject(IllegalArgumentException::class.java) { call { Api.generate(BigInteger.valueOf(17L * 1024 * 1024)) } }
    java.util.concurrent.Executors.newFixedThreadPool(4).use { workers ->
        val tasks = (0 until 4).map { workers.submit { repeat(64) { equal(call { Api.arrayReverseInt(arrayOf(arrayOf(huge, huge.negate()))) }, arrayOf(arrayOf(huge.negate(), huge))) } } }
        tasks.forEach { it.get() }
    }
/* DOCUMENTATION */
    Wire.result("collections/assertions", Wire.integer(checks.get()), true)
    Wire.result("collections/calls", Wire.integer(calls.get()), true)
    Wire.result("collections/rejections", Wire.integer(rejected), true)
    Wire.finish("kotlin", "Collections", KotlinVersion.CURRENT.toString(), Api::class.java)
}
