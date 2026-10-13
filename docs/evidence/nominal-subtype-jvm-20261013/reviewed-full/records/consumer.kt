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
        is EnvelopePair -> { writeSnapshot(out, value.left()); writeSnapshot(out, value.right()) }
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
    full()
    println("{\"checks\":$checks,\"rejections\":$rejections,\"hostRejections\":$hostRejections,\"snapshotControls\":$snapshotControls}")
}
private fun subtype(path: String, amount: Int) = "$path was rejected by NominalSubtypes." + if (amount == 1) "plusOne" else "plusTwo"
private fun fin(path: String) = "$path is not below its Fin 3 bound"
private fun <I, O> refused(input: I, action: (I) -> O, expected: String) {
    val before = snapshot(input)
    try { action(input); throw AssertionError("accepted: $expected") }
    catch (error: IllegalArgumentException) {
        check(error.javaClass == IllegalArgumentException::class.java && error.message == expected, "refusal: $expected; got $error")
    }
    check(snapshot(input).contentEquals(before), "complete rejected input unchanged")
    rejections++
}
private fun full() {
    refusedHost(Envelope(n(-1), n(2)), Api::first, IllegalArgumentException::class.java)
    refusedHost(Envelope(n(40), n(-1)), Api::first, IllegalArgumentException::class.java)
    // Java interop can put null in an otherwise typed Kotlin array.
    val malformed = arrayOf<Choice>(Option.none(), Option.some(good(n(40))))
    java.lang.reflect.Array.set(malformed, 1, null)
    refusedHost<Event, Event>(EventChoices(malformed), Api::echoEvent, NullPointerException::class.java)
    val item = wrap(40)
    call(item, Api::first, n(41))
    call(item, Api::second, n(42))
    call(Pair(item, item), { Api.combine(it.first(), it.second()) }, n(4142))
    call(EnvelopePair(wrap(40), wrap(40)), Api::nested, n(4142))
    call(wrap(99), Api::first, n(100))
    call(wrap(89), Api::second, n(91))
    call(wrap(90), Api::first, n(91))
    refused(wrap(100), Api::first, subtype("value0.payload", 1))
    refused(wrap(90), Api::second, subtype("value0.payload", 2))
    refused(Pair(wrap(100), wrap(40)), { Api.combine(it.first(), it.second()) }, subtype("value0.payload", 1))
    refused(Pair(wrap(40), wrap(90)), { Api.combine(it.first(), it.second()) }, subtype("value1.payload", 2))
    refused(EnvelopePair(wrap(100), wrap(40)), Api::nested, subtype("value0.left.payload", 1))
    refused(EnvelopePair(wrap(40), wrap(90)), Api::nested, subtype("value0.right.payload", 2))
    call(item, Api::echo, wrap(41))
    for (selected in 0..1) {
        val action: (Event) -> BigInteger = if (selected == 0) Api::eventFirst else Api::eventSecond
        val one = if (selected == 0) 1 else 2; val two = if (selected == 0) 2 else 1
        call<Event, BigInteger>(EventEmpty(), action, n(0))
        call<Event, BigInteger>(EventBox(wrap(40)), action, n(40L + one))
        call<Event, BigInteger>(EventChoices(emptyArray()), action, n(0))
        call<Event, BigInteger>(EventChoices(arrayOf(Option.none())), action, n(0))
        call<Event, BigInteger>(EventChoices(arrayOf(Option.none(), Option.some(good(n(40))))), action, n(40L + one))
        call<Event, BigInteger>(EventChoices(arrayOf(Option.some(bad(n(40))), Option.none())), action, n(40L + two))
        for (isOk in arrayOf(true, false)) for (position in 0..2) {
            val branches = arrayOf<Choice>(Option.some(good(n(40))), Option.none(), Option.some(bad(n(40))))
            branches[position] = Option.some(if (isOk) good(n(100)) else bad(n(100)))
            val label = if (isOk) "ok" else "error"
            refused<Event, BigInteger>(EventChoices(branches), action,
                subtype("value0.choices.values[$position]?.$label", if (isOk) one else two))
        }
    }
    val left = arrayOf<Item>(Option.none(), Option.some(wrap(40)), Option.some(Envelope(n(1), n(0))))
    val right = arrayOf<Item>(Option.some(Envelope(n(2), n(1))), Option.none())
    val normalizedLeft = arrayOf<Item>(Option.none(), Option.some(wrap(41)), Option.some(Envelope(n(2), n(0))))
    val normalizedRight = arrayOf<Item>(Option.some(Envelope(n(4), n(1))), Option.none())
    call(Pair(left, right), { Api.aliases(it.first(), it.second()) }, n(47))
    call(AliasPair(left, right), Api::inspectAliasPair, n(47))
    call(left, Api::echoGroups, normalizedLeft)
    val projected = call(AliasPair(left, right), Api::echoPair, AliasPair(normalizedLeft, normalizedRight))
    call(projected, Api::echoPair, AliasPair(
        arrayOf(Option.none(), Option.some(wrap(42)), Option.some(Envelope(n(3), n(0)))),
        arrayOf(Option.some(Envelope(n(6), n(1))), Option.none())))
    call<Event, Event>(EventChoices(arrayOf(Option.none(), Option.some(good(n(40))), Option.some(bad(n(40))))),
        Api::echoEvent, EventChoices(arrayOf(Option.none(), Option.some(good(n(41))), Option.some(bad(n(42))))))
    call<Event, Event>(EventEmpty(), Api::echoEvent, EventEmpty())
    call<Event, Event>(EventBox(wrap(40)), Api::echoEvent, EventBox(wrap(41)))
    call(emptyArray<Item>(), Api::echoGroups, emptyArray<Item>())
    call(AliasPair(emptyArray(), arrayOf(Option.none())), Api::echoPair, AliasPair(emptyArray(), arrayOf(Option.none())))
    for (position in 0..2) {
        val invalid = arrayOf<Item>(Option.some(wrap(40)), Option.none(), Option.some(wrap(40)))
        invalid[position] = Option.some(wrap(100))
        refused(invalid, Api::echoGroups, subtype("value0[$position]?.payload", 1))
        refused(AliasPair(invalid, right), Api::inspectAliasPair, subtype("value0.left[$position]?.payload", 1))
        refused(AliasPair(left, invalid), Api::inspectAliasPair, subtype("value0.right[$position]?.payload", 2))
    }
    // All Fin bounds precede even an earlier rejected Subtype constructor.
    refused(Pair(wrap(100), Envelope(n(40), n(3))), { Api.combine(it.first(), it.second()) }, fin("value1.digit"))
    refused(EnvelopePair(wrap(100), Envelope(n(40), n(3))), Api::nested, fin("value0.right.digit"))
    val invalid = Pair(arrayOf<Item>(Option.some(wrap(100))), arrayOf<Item>(Option.none(), Option.some(Envelope(n(40), n(3)))))
    refused(invalid, { Api.aliases(it.first(), it.second()) }, fin("value1[1]?.digit"))
    refused<Event, Event>(EventBox(Envelope(n(100), n(3))), Api::echoEvent, fin("value0.box.value.digit"))
    call(n(2), Api::plainFin, n(2))
    refused(n(3), Api::plainFin, fin("value0"))
    repeat(1000) { round ->
        val position = round % 3
        val late = arrayOf<Item>(Option.none(), Option.some(wrap(1)), Option.none())
        late[position] = Option.some(wrap(90))
        refused(AliasPair(left, late), Api::echoPair, subtype("value0.right[$position]?.payload", 2))
        call(AliasPair(left, right), Api::echoPair, AliasPair(normalizedLeft, normalizedRight))
    }
}
