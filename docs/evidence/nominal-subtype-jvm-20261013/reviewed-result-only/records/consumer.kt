// Independent public caller. Generated equality and serialization are not oracles.
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.math.BigInteger
import org.leanbridge.nominalsubtypes.kotlin.*
import org.leanbridge.nominalsubtypes.kotlin.Pair

private typealias Item = Option<Envelope>
private typealias Branch = Result<BigInteger, BigInteger>
private typealias Choice = Option<Branch>
private var checks = 0
private var rejections = 0
private var hostRejections = 0
private var snapshotControls = 0
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private fun wrap(value: Long) = Envelope(n(value), n(2))
private fun good(value: BigInteger): Branch = Result.ok(value)
private fun bad(value: BigInteger): Branch = Result.err(value)
private fun items(value: BigInteger): Array<Item> = arrayOf(Option.none(), Option.some(Envelope(value + n(1), n(2))))
private fun check(condition: Boolean, message: String) {
    if (!condition) throw AssertionError("failed: $message")
    checks++
}
private fun writeSnapshot(out: DataOutputStream, value: Any?) {
    if (value == null) { out.writeUTF("null"); return }
    out.writeUTF(value.javaClass.name)
    when (value) {
        is BigInteger -> { val bytes = value.toByteArray(); out.writeInt(bytes.size); out.write(bytes) }
        is Envelope -> { writeSnapshot(out, value.payload()); writeSnapshot(out, value.digit()) }
        is AliasPair -> { writeSnapshot(out, value.left()); writeSnapshot(out, value.right()) }
        is EventEmpty -> out.writeUTF("empty")
        is EventBox -> writeSnapshot(out, value.value())
        is EventChoices -> writeSnapshot(out, value.values())
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
private fun <I, O> call(input: I, action: (I) -> O, expected: O): O {
    val before = snapshot(input)
    val result = action(input)
    check(snapshot(result).contentEquals(snapshot(expected)), "exact copied result")
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
fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw AssertionError("Unexpected caller arguments")
    val huge = BigInteger.ONE.shiftLeft(100)
    val original = EventChoices(arrayOf(Option.none(), Option.some(good(huge))))
    val mutations: Array<Event> = arrayOf(
        EventChoices(arrayOf(Option.none(), Option.some(good(huge + n(1))))),
        EventChoices(arrayOf(Option.none(), Option.some(bad(huge)))),
        EventChoices(arrayOf(Option.some(good(huge)), Option.none())),
        EventChoices(arrayOf(Option.none(), Option.none())),
        EventChoices(arrayOf(Option.none(), Option.some(good(huge)), Option.none())),
        EventBox(Envelope(huge, n(2))),
        EventEmpty(),
        EventChoices(arrayOf(Option.none(), Option.some(good(BigInteger.ONE.shiftLeft(99)))))
    )
    for (changed in mutations) {
        check(!snapshot(changed).contentEquals(snapshot(original)), "independent snapshot mutation control")
        snapshotControls++
    }
    refusedHost(n(-1), Api::scalar, IllegalArgumentException::class.java)
    for (value in arrayOf(n(0), n(40), huge)) {
        val one = value + n(1); val two = value + n(2)
        call(value, Api::scalar, one)
        call(value, Api::produceEnvelope, Envelope(one, n(2)))
        call(value, Api::arrayValues, arrayOf(one, two))
        call(value, Api::listValues, arrayOf(one, two))
        call(value, Api::optional, if (value.signum() == 0) Option.none() else Option.some(one))
        call(value, Api::product, Pair(one, two))
        call(value, Api::branch, if (value.signum() == 0) bad(one) else good(one))
        call(value, Api::groupValues, items(value))
        call(value, Api::pairValues, AliasPair(items(value), items(one)))
        call<BigInteger, Event>(value, Api::eventValue, EventBox(Envelope(one, n(2))))
        call<BigInteger, Event>(value, Api::eventEmpty, EventEmpty())
        call<BigInteger, Event>(value, Api::eventChoices,
            EventChoices(arrayOf(Option.none(), Option.some(good(one)), Option.some(bad(two)))))
        call(value, Api::noItems, emptyArray<BigInteger>())
    }
    repeat(1000) { round ->
        val value = huge + n(round.toLong())
        call(value, Api::pairValues, AliasPair(items(value), items(value + n(1))))
    }
    println("{\"checks\":$checks,\"rejections\":$rejections,\"hostRejections\":$hostRejections,\"snapshotControls\":$snapshotControls}")
}
