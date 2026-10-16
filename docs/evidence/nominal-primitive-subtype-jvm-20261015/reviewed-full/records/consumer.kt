// Independent nineteen-base Kotlin caller. Generated equality and serialization are not oracles.
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.math.BigInteger
import org.leanbridge.nominalprimitivesubtypes.Unit
import org.leanbridge.nominalprimitivesubtypes.kotlin.*
import org.leanbridge.nominalprimitivesubtypes.kotlin.Pair

private typealias Item = Option<Packet>
private const val ROUNDS = 256
private var checks = 0
private var rejections = 0
private var hostRejections = 0
private var snapshotControls = 0
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private val huge: BigInteger = BigInteger.ONE.shiftLeft(100)
private fun octets(vararg items: Int): ByteArray = ByteArray(items.size) { items[it].toByte() }
// Every primitive base of one packet, mutable before it becomes an immutable value.
private class Fields {
    var unitValue: Unit = Unit.INSTANCE; var boolValue = true
    var uint8Value = 42; var uint16Value = 42; var uint32Value = 42L; var uint64Value: BigInteger = n(42)
    var int8Value: Byte = -42; var int16Value: Short = -42; var int32Value = -42; var int64Value = -42L
    var natValue: BigInteger = n(42); var intValue: BigInteger = n(-42)
    var float32Value = 1.5f; var float64Value = 1.5
    var textValue = "a"; var bytesValue = octets(0, 128, 255); var charValue = 'a'.code
    var usizeValue: BigInteger = n(42); var isizeValue = -42L; var digit: BigInteger = n(2)
    fun bool(value: Boolean) = apply { boolValue = value }
    fun uint8(value: Int) = apply { uint8Value = value }
    fun uint16(value: Int) = apply { uint16Value = value }
    fun uint32(value: Long) = apply { uint32Value = value }
    fun uint64(value: BigInteger) = apply { uint64Value = value }
    fun int8(value: Int) = apply { int8Value = value.toByte() }
    fun int16(value: Int) = apply { int16Value = value.toShort() }
    fun int32(value: Int) = apply { int32Value = value }
    fun int64(value: Long) = apply { int64Value = value }
    fun nat(value: BigInteger) = apply { natValue = value }
    fun integer(value: BigInteger) = apply { intValue = value }
    fun float32(value: Float) = apply { float32Value = value }
    fun float64(value: Double) = apply { float64Value = value }
    fun text(value: String) = apply { textValue = value }
    fun bytes(value: ByteArray) = apply { bytesValue = value }
    fun character(value: Int) = apply { charValue = value }
    fun usize(value: BigInteger) = apply { usizeValue = value }
    fun isize(value: Long) = apply { isizeValue = value }
    fun digit(value: BigInteger) = apply { digit = value }
    fun packet() = Packet(unitValue, boolValue, uint8Value, uint16Value, uint32Value, uint64Value, int8Value, int16Value, int32Value, int64Value,
        natValue, intValue, float32Value, float64Value, textValue, bytesValue, charValue, usizeValue, isizeValue, digit)
    fun raw() = RawPacket(unitValue, boolValue, uint8Value, uint16Value, uint32Value, uint64Value, int8Value, int16Value, int32Value, int64Value,
        natValue, intValue, float32Value, float64Value, textValue, bytesValue, charValue, usizeValue, isizeValue, digit)
}
private fun base() = Fields()
// The B constructors normalize every base differently from the A constructors.
private fun normalized() = base().uint8(44).uint16(44).uint32(44).uint64(n(44)).int8(-40).int16(-40).int32(-40).int64(-40)
    .nat(n(44)).integer(n(-40)).float32(-1.5f).float64(-1.5).text("a!").bytes(octets(0, 128, 255, 255))
    .character('b'.code).usize(n(44)).isize(-40)
// Producers never call the A/B selections; their outputs exceed every input limit.
private fun produced() = base().uint8(200).uint16(200).uint32(200).uint64(n(200)).int8(120).int16(120).int32(120).int64(120)
    .nat(huge).integer(huge.negate()).float32(12.5f).float64(12.5).text("long λ text")
    .bytes(octets(0, 1, 2, 3, 4, 5, 128, 254, 255)).character(0x3bb).usize(n(200)).isize(200)
private fun check(condition: Boolean, message: String) {
    if (!condition) throw AssertionError("failed: $message")
    checks++
}
private fun writePacket(out: DataOutputStream, fields: List<Any?>) { for (value in fields) writeSnapshot(out, value) }
// Distinguish every host representation one Lean base keeps apart, including float signs and NaN payloads.
private fun writeSnapshot(out: DataOutputStream, value: Any?) {
    if (value == null) { out.writeUTF("null"); return }
    out.writeUTF(value.javaClass.name)
    when (value) {
        is BigInteger -> { val bytes = value.toByteArray(); out.writeInt(bytes.size); out.write(bytes) }
        is Boolean -> out.writeBoolean(value)
        is Byte -> out.writeByte(value.toInt())
        is Short -> out.writeShort(value.toInt())
        is Int -> out.writeInt(value)
        is Long -> out.writeLong(value)
        is Float -> out.writeInt(value.toRawBits())
        is Double -> out.writeLong(value.toRawBits())
        is String -> { out.writeInt(value.length); for (char in value) out.writeChar(char.code) }
        is ByteArray -> { out.writeInt(value.size); out.write(value) }
        is Unit -> out.writeUTF("unit")
        is Packet -> writePacket(out, listOf(value.unitValue, value.boolValue, value.uint8Value, value.uint16Value, value.uint32Value, value.uint64Value,
            value.int8Value, value.int16Value, value.int32Value, value.int64Value, value.natValue, value.intValue, value.float32Value, value.float64Value,
            value.textValue, value.bytesValue, value.charValue, value.usizeValue, value.isizeValue, value.digit))
        is RawPacket -> writePacket(out, listOf(value.unitValue, value.boolValue, value.uint8Value, value.uint16Value, value.uint32Value, value.uint64Value,
            value.int8Value, value.int16Value, value.int32Value, value.int64Value, value.natValue, value.intValue, value.float32Value, value.float64Value,
            value.textValue, value.bytesValue, value.charValue, value.usizeValue, value.isizeValue, value.digit))
        is PacketPair -> { writeSnapshot(out, value.left); writeSnapshot(out, value.right) }
        is EventEmpty -> out.writeUTF("empty")
        is EventBox -> writeSnapshot(out, value.value)
        is EventChoices -> writeSnapshot(out, value.values)
        is Option<*> -> { out.writeBoolean(value.isSome()); if (value.isSome()) writeSnapshot(out, value.value()) }
        is Result<*, *> -> { out.writeBoolean(value.isOk()); writeSnapshot(out, if (value.isOk()) value.value() else value.error()) }
        is Pair<*, *> -> { writeSnapshot(out, value.first()); writeSnapshot(out, value.second()) }
        is Array<*> -> { out.writeInt(value.size); for (item in value) writeSnapshot(out, item) }
        else -> throw AssertionError("Unknown snapshot type: " + value.javaClass)
    }
}
private fun snapshot(value: Any?): ByteArray {
    val bytes = ByteArrayOutputStream()
    DataOutputStream(bytes).use { writeSnapshot(it, value) }
    return bytes.toByteArray()
}
private fun same(left: Any?, right: Any?) = snapshot(left).contentEquals(snapshot(right))
private fun <I, O> call(input: I, action: (I) -> O, expected: O): O {
    val before = snapshot(input)
    val result = action(input)
    check(same(result, expected), "exact copied result")
    check(snapshot(input).contentEquals(before), "complete accepted input unchanged")
    return result
}
private fun <I, O> refusedHost(input: I, action: (I) -> O, expected: Class<out RuntimeException>) {
    val before = snapshot(input)
    try { action(input); throw AssertionError("accepted: invalid host input") }
    catch (error: RuntimeException) { check(error.javaClass == expected, "host rejection class: $error") }
    check(snapshot(input).contentEquals(before), "complete host-rejected input unchanged")
    hostRejections++
}
private fun <I, O> refused(input: I, action: (I) -> O, expected: String) {
    val before = snapshot(input)
    try { action(input); throw AssertionError("accepted: $expected") }
    catch (error: IllegalArgumentException) {
        check(error.javaClass == IllegalArgumentException::class.java && error.message == expected, "refusal: $expected; got $error")
    }
    check(snapshot(input).contentEquals(before), "complete rejected input unchanged")
    rejections++
}
private fun subtype(path: String, constructor: String) = "$path was rejected by NominalPrimitiveSubtypes.$constructor"
private fun fin(path: String) = "$path is not below its Fin 3 bound"
private fun group(out: Packet): Array<Item> = arrayOf(Option.none(), Option.some(out))
// One invalid value per base, the A constructor that refuses it, or the Fin digit.
private class Invalid(val packet: Fields, val field: String, val constructor: String?)
private fun invalid(): Array<Invalid> = arrayOf(
    Invalid(base().bool(false), "boolValue", "boolA"), Invalid(base().uint8(43), "uint8Value", "uint8A"),
    Invalid(base().uint16(43), "uint16Value", "uint16A"), Invalid(base().uint32(43), "uint32Value", "uint32A"),
    Invalid(base().uint64(n(43)), "uint64Value", "uint64A"), Invalid(base().int8(-43), "int8Value", "int8A"),
    Invalid(base().int16(-43), "int16Value", "int16A"), Invalid(base().int32(-43), "int32Value", "int32A"),
    Invalid(base().int64(-43), "int64Value", "int64A"), Invalid(base().nat(n(43)), "natValue", "natA"),
    Invalid(base().integer(n(-43)), "intValue", "intA"), Invalid(base().float32(Float.POSITIVE_INFINITY), "float32Value", "float32A"),
    Invalid(base().float64(Double.POSITIVE_INFINITY), "float64Value", "float64A"), Invalid(base().text(""), "textValue", "textA"),
    Invalid(base().bytes(octets()), "bytesValue", "bytesA"), Invalid(base().character(0), "charValue", "charA"),
    Invalid(base().usize(n(43)), "usizeValue", "usizeA"), Invalid(base().isize(-43), "isizeValue", "isizeA"),
    Invalid(base().digit(n(3)), "digit", null)
)
fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw AssertionError("Unexpected caller arguments")
    val out = produced().packet(); val rawOut = produced().raw()
    val controls: Array<kotlin.Pair<Any?, Any?>> = arrayOf(
        kotlin.Pair(null, false), kotlin.Pair(false, 0), kotlin.Pair(0, 0.0), kotlin.Pair(0.0, -0.0),
        kotlin.Pair(octets(0), octets(1)), kotlin.Pair("a\u0000λ😀", "aλ😀"),
        kotlin.Pair(arrayOf<Item>(Option.none(), Option.some(out)), arrayOf<Item>(Option.some(out), Option.none())),
        kotlin.Pair(EventBox(out), EventChoices(arrayOf(Option.some(Result.ok(out))))),
        kotlin.Pair(base().packet(), base().raw())
    )
    for (control in controls) {
        check(!same(control.first, control.second), "independent snapshot mutation control")
        snapshotControls++
    }
    // Host conversions refuse what the JVM types can express but Lean cannot receive; Kotlin nullability is probed separately.
    refusedHost(base().uint8(256).raw(), Api::produce, IllegalArgumentException::class.java)
    refusedHost(base().uint64(n(-1)).raw(), Api::produce, IllegalArgumentException::class.java)
    refusedHost(base().nat(n(-1)).raw(), Api::produce, IllegalArgumentException::class.java)
    refusedHost(base().character(0xd800).raw(), Api::produce, IllegalArgumentException::class.java)
    refusedHost(base().text("\ud83d").raw(), Api::produce, IllegalArgumentException::class.java)
    refusedHost(base().usize(n(-1)).raw(), Api::produce, IllegalArgumentException::class.java)
    call(Unit.INSTANCE, { Api.wordBits() }, 64L)
    call(rawOut, Api::produce, Option.some(out))
    call(rawOut, Api::produceGroup, group(out))
    call(rawOut, Api::producePair, PacketPair(group(out), group(out)))
    call<RawPacket, Event>(rawOut, Api::produceEvent, EventBox(out))
    call<RawPacket, Event>(rawOut, Api::produceChoices, EventChoices(arrayOf(Option.none(), Option.some(Result.ok(out)), Option.some(Result.err(out)))))
    for (item in invalid()) {
        call(item.packet.raw(), Api::produce, Option.none())
        refused(item.packet.packet(), Api::echoA, if (item.constructor == null) fin("value0." + item.field) else subtype("value0." + item.field, item.constructor))
    }
    val absent = base().nat(n(43)).raw()
    call(absent, Api::produceGroup, arrayOf<Item>(Option.none()))
    call(absent, Api::producePair, PacketPair(arrayOf(Option.none()), arrayOf(Option.none())))
    call<RawPacket, Event>(absent, Api::produceEvent, EventEmpty())
    call<RawPacket, Event>(absent, Api::produceChoices, EventChoices(arrayOf(Option.none())))
    full()
    println("{\"checks\":$checks,\"rejections\":$rejections,\"hostRejections\":$hostRejections,\"snapshotControls\":$snapshotControls,\"rounds\":$ROUNDS,\"wordBits\":64}")
}
private class Extreme(val packet: Fields, val expected: Fields)
private fun full() {
    val a = base().packet(); val b = base().bool(false).packet(); val n = normalized().packet()
    call(a, Api::echoA, a)
    call(b, Api::echoB, n)
    refused(a, Api::refuseUnit, subtype("value0.unitValue", "unitReject"))
    call(Pair(a, b), { Api.combine(it.first(), it.second()) }, Pair(a, n))
    call(PacketPair(arrayOf(Option.none(), Option.some(a)), arrayOf(Option.some(b))), Api::echoPair,
        PacketPair(arrayOf(Option.none(), Option.some(a)), arrayOf(Option.some(n))))
    val left = arrayOf<Item>(Option.none(), Option.some(a)); val right = arrayOf<Item>(Option.some(b), Option.none())
    call(Pair(left, right), { Api.aliases(it.first(), it.second()) }, arrayOf<Item>(Option.none(), Option.some(a), Option.some(n), Option.none()))
    call<Event, Event>(EventEmpty(), Api::echoEventA, EventEmpty())
    call<Event, Event>(EventEmpty(), Api::echoEventB, EventEmpty())
    call<Event, Event>(EventBox(a), Api::echoEventA, EventBox(a))
    call<Event, Event>(EventBox(b), Api::echoEventB, EventBox(n))
    call<Event, Event>(EventChoices(arrayOf(Option.none(), Option.some(Result.ok(a)), Option.some(Result.err(b)))), Api::echoEventA,
        EventChoices(arrayOf(Option.none(), Option.some(Result.ok(a)), Option.some(Result.err(n)))))
    call<Event, Event>(EventChoices(arrayOf(Option.none(), Option.some(Result.ok(b)), Option.some(Result.err(a)))), Api::echoEventB,
        EventChoices(arrayOf(Option.none(), Option.some(Result.ok(n)), Option.some(Result.err(a)))))
    // Each base's B normalization at its extreme host value: wrapping words, growing big integers, negated floats.
    val uint64Max = BigInteger.ONE.shiftLeft(64) - n(2)
    val extremes = arrayOf(
        Extreme(base().bool(false).uint8(254), normalized().uint8(0)), Extreme(base().bool(false).uint16(65534), normalized().uint16(0)),
        Extreme(base().bool(false).uint32(4294967294L), normalized().uint32(0)), Extreme(base().bool(false).uint64(uint64Max), normalized().uint64(n(0))),
        Extreme(base().bool(false).int8(126), normalized().int8(-128)), Extreme(base().bool(false).int16(32766), normalized().int16(-32768)),
        Extreme(base().bool(false).int32(2147483646), normalized().int32(-2147483648)),
        Extreme(base().bool(false).int64(9223372036854775806L), normalized().int64(Long.MIN_VALUE)),
        Extreme(base().bool(false).usize(uint64Max), normalized().usize(n(0))),
        Extreme(base().bool(false).isize(9223372036854775806L), normalized().isize(Long.MIN_VALUE)),
        Extreme(base().bool(false).nat(huge), normalized().nat(huge + n(2))), Extreme(base().bool(false).integer(huge.negate()), normalized().integer(huge.negate() + n(2))),
        Extreme(base().bool(false).float32(0.0f), normalized().float32(-0.0f)), Extreme(base().bool(false).float64(0.0), normalized().float64(-0.0)),
        Extreme(base().bool(false).float32(-0.0f), normalized().float32(0.0f)), Extreme(base().bool(false).float64(-0.0), normalized().float64(0.0)),
        Extreme(base().bool(false).text("a\u0000λ😀"), normalized().text("a\u0000λ😀!")),
        Extreme(base().bool(false).bytes(octets()), normalized().bytes(octets(255))),
        Extreme(base().bool(false).character(0x1f600), normalized().character(0x1f600))
    )
    for (item in extremes) call(item.packet.packet(), Api::echoB, item.expected.packet())
    val floats = floatArrayOf(Float.NaN, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY)
    val doubles = doubleArrayOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY)
    for (index in 0..2) {
        refused(base().bool(false).float32(floats[index]).packet(), Api::echoB, subtype("value0.float32Value", "float32B"))
        call(base().float32(floats[index]).raw(), Api::produce, Option.none())
        refused(base().bool(false).float64(doubles[index]).packet(), Api::echoB, subtype("value0.float64Value", "float64B"))
        call(base().float64(doubles[index]).raw(), Api::produce, Option.none())
    }
    // The late Fin error must win over the earlier refusing constructor.
    refused(Pair(base().nat(n(43)).packet(), base().bool(false).digit(n(3)).packet()), { Api.combine(it.first(), it.second()) }, fin("value1.digit"))
    repeat(ROUNDS) { round ->
        val position = round % 3
        val items = arrayOf<Item>(Option.some(b), Option.none(), Option.some(b))
        items[position] = Option.some(base().bool(false).nat(n(43)).packet())
        refused(PacketPair(arrayOf(Option.some(a)), items), Api::echoPair, subtype("value0.right[$position]?.natValue", "natB"))
        call(b, Api::echoB, n)
    }
}
