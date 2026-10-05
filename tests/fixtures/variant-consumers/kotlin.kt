// Independent Kotlin calls to the Java API in an installed prepared Maven JAR.
import org.leanbridge.variants.*
import org.leanbridge.variants.Unit
import org.leanbridge.variants.Pair
import java.math.BigInteger
import java.lang.reflect.Array as JArray
import java.util.concurrent.atomic.AtomicInteger

private val checks = AtomicInteger()
private val calls = AtomicInteger()
private var rejected = 0
private fun verify(value: Boolean) { val n = checks.incrementAndGet(); if (!value) throw AssertionError("variant check $n") }
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
        expected.javaClass.isRecord -> for (field in expected.javaClass.recordComponents) equal(field.accessor.invoke(actual), field.accessor.invoke(expected))
        else -> verify(actual == expected)
    }
}
private fun reject(type: Class<out Throwable>, action: () -> Any?) {
    var failed = false
    try { action() } catch (error: Throwable) { verify(type.isInstance(error)); failed = true; ++rejected }
    verify(failed); equal(call { Api.next(SignalIdle()) }, SignalStopped())
}
private fun change(value: ScalarsAll, index: Int, replacement: Any?): ScalarsAll {
    val components = ScalarsAll::class.java.recordComponents
    val types = components.map { it.type }.toTypedArray()
    val values = components.map { it.accessor.invoke(value) }.toTypedArray()
    values[index] = replacement
    return ScalarsAll::class.java.getConstructor(*types).newInstance(*values)
}
private fun describe(value: Signal): String = when (value) {
    is SignalIdle -> "idle"
    is SignalStopped -> "stopped"
    is SignalData -> "${value.count()}:${value.label()}"
    is SignalMarker -> "marker"
}
fun main() {
/* SIGNATURES */
    val scalar = ScalarsAll(Unit.INSTANCE, true, 255, 65535, 4294967295L,
        BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Byte.MIN_VALUE, Short.MIN_VALUE, Int.MIN_VALUE, Long.MIN_VALUE,
        BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(19)), BigInteger.ONE.shiftLeft(5120).add(BigInteger.valueOf(31)).negate(),
        1.5f, -2.25, "A\u0000🌱", byteArrayOf(0, -1, 1), 0x1f331, BigInteger.valueOf(4294967295L), -2147483648L)
    verify(call { Api.inspect(scalar) })
    val different = arrayOf<Any>(Unit.INSTANCE, false, 0, 0, 0L, BigInteger.ZERO, 0.toByte(), 0.toShort(), 0, 0L,
        BigInteger.ZERO, BigInteger.ZERO, 0f, 0.0, "", byteArrayOf(), 0, BigInteger.ZERO, 0L)
    for (i in 1 until different.size) { val changed = change(scalar, i, different[i]); verify(!call { Api.inspect(changed) }) }
    val cases = arrayOf<Signal>(SignalIdle(), SignalStopped(), SignalData(42, "A\u0000🌱"), SignalMarker(Unit.INSTANCE))
    for (repeat in 0 until 128) {
        for (value in cases) { val result = call { Api.echo(value) }; equal(result, value); verify(result !== value) }
        equal(call { Api.next(cases[0]) }, SignalStopped())
        equal(call { Api.next(cases[1]) }, SignalMarker(Unit.INSTANCE))
        equal(call { Api.next(cases[2]) }, SignalData(43, "A\u0000🌱!"))
        equal(call { Api.next(cases[3]) }, SignalData(42, "ready"))
        val codes = longArrayOf(7, 13, 48, 29)
        for (i in cases.indices) equal(call { Api.code(cases[i]) }, codes[i])
        for (value in arrayOf<Mode>(ModeFirst(), ModeSecond(), ModeThird())) equal(call { Api.echoMode(value) }, value)
        val events = cases.copyOf()
        val packet = Packet(cases[2], events, Option.some(cases[3]), arrayOf<Mode>(ModeFirst(), ModeThird()))
        val nested = NestedPacket(packet); val copied = call { Api.echoNested(nested) } as NestedPacket
        equal(copied, nested); events[0] = SignalData(99, "changed"); equal(copied.value().events()[0], SignalIdle())
        verify(copied.value().events() !== packet.events()); verify(copied.value().modes() !== packet.modes())
        for (value in arrayOf<Nested>(NestedEmpty(),
            NestedPacket(Packet(SignalIdle(), emptyArray<Signal>(), Option.none(), emptyArray<Mode>())),
            NestedOutcome(Result.ok(Pair<Signal, Mode>(SignalMarker(Unit.INSTANCE), ModeSecond()))),
            NestedOutcome(Result.err("A\u0000🌱")))) equal(call { Api.echoNested(value) }, value)
        val rows = arrayOf(emptyArray<Signal>(), cases, arrayOf(cases[2], cases[2]))
        val resultRows = call { Api.signals(rows) }; equal(resultRows, arrayOf(emptyArray<Signal>(), cases.reversedArray(), rows[2]))
        resultRows[1][0] = SignalStopped(); equal(cases[3], SignalMarker(Unit.INSTANCE))
        equal(call { Api.echoScalars(scalar) }, scalar); equal(call { Api.echoScalars(ScalarsAbsent()) }, ScalarsAbsent())
        for (value in arrayOf<Anonymous>(AnonymousNumber(13), AnonymousPair(17, "A\u0000🌱"), AnonymousCollision(19, "A\u0000🌱"))) equal(call { Api.echoAnonymous(value) }, value)
        equal(call { Api.echoOne(OneOnly(repeat.toLong())) }, OneOnly(repeat.toLong() + 1))
        for (value in arrayOf<Buffers>(BuffersEmpty(), BuffersPair(byteArrayOf(), byteArrayOf()), BuffersPair(byteArrayOf(0, -1), byteArrayOf(1)))) equal(call { Api.echoBuffers(value) }, value)
        val duplicate = call { Api.duplicate(byteArrayOf(0, -1, 1)) } as BuffersPair
        equal(duplicate, BuffersPair(byteArrayOf(0, -1, 1), byteArrayOf(0, -1, 1)))
        verify(duplicate.first() !== duplicate.second()); duplicate.first()[0] = 42; equal(duplicate.second()[0], 0.toByte())
    }
    for (value in doubleArrayOf(0.0, -0.0, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NaN, 1.0 / 3, Double.MIN_VALUE)) {
        val input = change(change(change(change(scalar, 12, value.toFloat()), 13, value), 17, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)), 18, Long.MIN_VALUE)
        equal(call { Api.echoScalars(input) }, input)
    }
    for (value in intArrayOf(0, 0xd7ff, 0xe000, 0x10ffff)) { val input = change(scalar, 16, value); equal(call { Api.echoScalars(input) }, input) }
    equal(call { Api.echoOne(OneOnly(4294967295L)) }, OneOnly(0))
    equal(call { Api.next(SignalData(4294967295L, "")) }, SignalData(0, "!"))
    reject(NullPointerException::class.java) { call { Api.echo(null) } }
    reject(NullPointerException::class.java) { call { Api.echo(SignalData(1, null)) } }
    reject(NullPointerException::class.java) { call { Api.echo(SignalMarker(null)) } }
    reject(IllegalArgumentException::class.java) { call { Api.echo(SignalData(1, "\ud800")) } }
    for (value in longArrayOf(-1, 4294967296L)) reject(IllegalArgumentException::class.java) { call { Api.echo(SignalData(value, "range")) } }
    for (field in intArrayOf(2, 3, 16)) for (value in when (field) { 2 -> intArrayOf(-1, 256); 3 -> intArrayOf(-1, 65536); else -> intArrayOf(-1, 0xd800, 0xdfff, 0x110000) })
        reject(IllegalArgumentException::class.java) { call { Api.echoScalars(change(scalar, field, value)) } }
    for (field in intArrayOf(5, 17)) for (value in arrayOf(BigInteger.valueOf(-1), BigInteger.ONE.shiftLeft(64)))
        reject(IllegalArgumentException::class.java) { call { Api.echoScalars(change(scalar, field, value)) } }
    reject(IllegalArgumentException::class.java) { call { Api.echoScalars(change(scalar, 10, BigInteger.valueOf(-1))) } }
    reject(NullPointerException::class.java) { call { Api.echoScalars(change(scalar, 15, null)) } }
    reject(NullPointerException::class.java) { call { Api.echoNested(NestedPacket(null)) } }
    reject(NullPointerException::class.java) { call { Api.signals(arrayOf(cases, null)) } }
    reject(NullPointerException::class.java) { call { Api.echoNested(NestedOutcome(Result.ok(Pair<Signal, Mode>(null, ModeFirst())))) } }
    reject(NullPointerException::class.java) { call { Api.echoNested(NestedOutcome(null)) } }
    for (i in 0 until 3) {
        reject(IllegalArgumentException::class.java) { call { Api.echo(SignalData(0, "x".repeat(17 * 1024 * 1024))) } }
        reject(IllegalArgumentException::class.java) { call { Api.duplicate(ByteArray(9 * 1024 * 1024)) } }
        reject(IllegalArgumentException::class.java) { call { Api.produce(BigInteger.valueOf(17L * 1024 * 1024)) } }
        equal(call { Api.make(0) }, SignalIdle()); equal(call { Api.make(7) }, SignalData(7, "made"))
        equal(call { Api.produce(BigInteger.valueOf(30000)) }, BuffersPair(ByteArray(30000) { 17 }, byteArrayOf(1)))
    }
    equal(cases.map(::describe).toTypedArray(), arrayOf("idle", "stopped", "42:A\u0000🌱", "marker"))
    java.util.concurrent.Executors.newFixedThreadPool(4).use { workers ->
        val tasks = (0 until 4).map { workers.submit { for (i in 0 until 64) equal(call { Api.next(SignalData(i.toLong(), "thread")) }, SignalData(i.toLong() + 1, "thread!")) } }
        tasks.forEach { it.get() }
    }
    verify(rejected == 33); verify(calls.get() > 4000)
    Wire.result("variants/assertions", Wire.integer(checks.get()), true)
    Wire.result("variants/calls", Wire.integer(calls.get()), true)
    Wire.result("variants/rejections", Wire.integer(rejected), true)
    Wire.finish("kotlin", "Variants", KotlinVersion.CURRENT.toString(), Api::class.java)
}
