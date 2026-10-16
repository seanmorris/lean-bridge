// Independent Kotlin caller for proof-free nested checked records.
import java.lang.reflect.InvocationTargetException
import java.math.BigInteger
import org.leanbridge.nestedcheckedrecords.kotlin.*

private var checks = 0
private var rejections = 0
private var hostRejections = 0
private var recoveries = 0
private var snapshots = 0
private const val ROUNDS = 256
private const val PREFIX = "arg"

private fun n(value: Long) = BigInteger.valueOf(value)
private fun huge() = BigInteger.ONE.shiftLeft(100)
private fun packet(digit: Long, word: Long) = Packet(n(digit), n(word))
private fun snap(value: Packet?): String = if (value == null) "null" else "${value.digit}:${value.word}"
private fun snap(values: Array<out Packet?>?): String = values?.joinToString("|") { snap(it) } ?: "null"
private fun snap(value: Option<Packet>): String = if (value.isSome()) "some:${snap(value.value())}" else "none"
private fun snap(value: Result<Packet, Packet>): String = if (value.isOk()) "ok:${snap(value.value())}" else "error:${snap(value.error())}"
private fun snap(value: Pair<Packet, Packet>): String = "(${snap(value.first)},${snap(value.second)})"

private fun snap(value: Holder): String = "${snap(value.packet)}:${value.tag}"
private fun snap(value: Choice): String = when (value) {
    is ChoiceEmpty -> "empty"
    is ChoicePacket -> "packet:${snap(value.value)}"
}

private fun refused(invoke: () -> kotlin.Unit, expected: String, snapshot: () -> String) {
    val before = snapshot()
    try {
        invoke()
        throw IllegalStateException("accepted invalid checked record")
    } catch (error: IllegalArgumentException) {
        check(error::class.java == IllegalArgumentException::class.java && error.message == expected,
            "exact checked-record rejection: $error")
    }
    same(before, snapshot(), "refused input snapshot")
    rejections++
}

private fun recover(condition: Boolean) {
    check(condition, "valid call recovers after rejection")
    recoveries++
}

private fun constructor(path: String, name: String) =
    "$path was rejected by NestedCheckedRecords.$name"
private fun fin(path: String) = "$path is not below its Fin 10 bound"

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("failed: $label")
    checks++
}

private fun same(before: String, after: String, label: String) {
    check(before == after, label)
    snapshots++
}

private fun <I, O> accepted(input: I, invoke: (I) -> O, snapshot: (I) -> String,
    expected: (O) -> Boolean, label: String): O {
    val before = snapshot(input)
    val output = invoke(input)
    check(expected(output), label)
    same(before, snapshot(input), "$label input snapshot")
    return output
}

private fun refusedHost(invoke: () -> kotlin.Unit, expected: Class<out Throwable>,
    snapshot: () -> String) {
    val before = snapshot()
    try {
        invoke()
        throw IllegalStateException("accepted invalid managed value")
    } catch (error: Throwable) {
        val observed = if (error is InvocationTargetException) error.cause ?: error else error
        check(observed::class.java == expected, "managed rejection type: $observed")
    }
    same(before, snapshot(), "managed-refused input snapshot")
    hostRejections++
}

private fun inactive(read: () -> kotlin.Unit, expected: String) {
    try {
        read()
        throw IllegalStateException("read inactive union payload")
    } catch (error: IllegalStateException) {
        check(error.message == expected, "exact inactive payload diagnostic")
    }
    hostRejections++
}

fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"checks\":$checks,\"rejections\":$rejections,\"hostRejections\":$hostRejections,"
        + "\"recoveries\":$recoveries,\"snapshots\":$snapshots,\"rounds\":$ROUNDS,\"wordBits\":64}")
}

private fun runChecks() {
    check(java.lang.Long.SIZE == 64, "native machine-word width")
    val huge = huge()
    repeat(ROUNDS) { round ->
        val input = huge + n(round.toLong())
        val option = Api.produceOption(input)
        check(option.isSome() && option.value() == Packet(BigInteger.ZERO, input + BigInteger.ONE),
            "projected optional packet")
        val values = Api.produceArray(input)
        check(values.size == 2, "projected packet array length")
        check(values[0] == Packet(BigInteger.ZERO, input + BigInteger.ONE), "first projected packet")
        check(values[1] == Packet(BigInteger.ZERO, input + n(2)), "second projected packet")
        check(values[0] !== values[1], "independent projected records")
    }

    val none = Option.none<Packet>()
    check(!none.isSome(), "absent option branch")
    inactive({ none.value() }, "None has no value")
    val ok = Result.ok<Packet, Packet>(packet(1, 2))
    val error = Result.err<Packet, Packet>(packet(2, 3))
    check(ok.isOk(), "success result branch")
    check(!error.isOk(), "error result branch")
    inactive({ ok.error() }, "Ok has no error")
    inactive({ error.value() }, "Err has no success value")
    val negative = BigInteger.ONE.negate()
    refusedHost({ Api.produceOption(negative) }, IllegalArgumentException::class.java) { negative.toString() }
    check(Api.produceOption(BigInteger.ZERO).value() == packet(0, 1),
        "result projection recovers after host rejection")
    recoveries++

    val first = packet(2, 3)
    val second = packet(7, 0)
    accepted(first, Api::first, ::snap, { it == n(3) }, "direct packet")
    accepted(second, Api::second, ::snap, { it == n(8) }, "normalized direct packet")
    accepted(Pair(first, second), { Api.pair(it.first, it.second) }, ::snap,
        { it == n(11) }, "repeated packet parameters")
    var rows = arrayOf(packet(1, 2), packet(3, 5))
    accepted(rows, Api::inArray, ::snap, { it == n(7) }, "array packets")
    rows = arrayOf(packet(1, 0), packet(3, 100))
    accepted(rows, Api::inList, ::snap, { it == n(6) }, "List packets")
    accepted(Option.none<Packet>(), Api::inOption, ::snap, { it == BigInteger.ZERO }, "absent packet option")
    accepted(Option.some(packet(1, 2)), Api::inOption, ::snap, { it == n(3) }, "present packet option")
    accepted(Pair(packet(1, 2), packet(3, 0)), Api::inProduct, ::snap,
        { it == n(6) }, "packet product")
    accepted(Result.ok<Packet, Packet>(packet(2, 9)), Api::inExcept, ::snap,
        { it == n(3) }, "success packet branch")
    accepted(Result.err<Packet, Packet>(packet(1, 2)), Api::inExcept, ::snap,
        { it == n(3) }, "error packet branch")
    accepted(Holder(packet(3, 1), n(9)), Api::inHolder, ::snap,
        { it == n(13) }, "enclosing record field")
    accepted<Choice, BigInteger>(ChoiceEmpty(), Api::inChoice, ::snap,
        { it == BigInteger.ZERO }, "empty variant case")
    accepted<Choice, BigInteger>(ChoicePacket(packet(2, 4)), Api::inChoice, ::snap,
        { it == n(5) }, "active variant field")
    rows = arrayOf(packet(2, 3), Packet(BigInteger.ONE, huge))
    val originalRows = rows
    val echoed = accepted(rows, Api::echoArray, ::snap,
        { it.size == 2 && it[0] == originalRows[0] && it[1] == originalRows[1] },
        "proof-free packet result")
    check(echoed !== rows && echoed[0] !== rows[0], "result owns independent managed storage")

    var invalid = packet(0, 0)
    refused({ Api.first(invalid) }, constructor(PREFIX + "0.word", "mkWord")) { snap(invalid) }
    recover(Api.first(first) == n(3))
    invalid = packet(4, 2)
    refused({ Api.first(invalid) }, constructor(PREFIX + "0", "mkPacket")) { snap(invalid) }
    recover(Api.first(first) == n(3))
    invalid = packet(10, 12)
    refused({ Api.first(invalid) }, fin(PREFIX + "0.digit")) { snap(invalid) }
    recover(Api.first(first) == n(3))

    rows = arrayOf(packet(2, 3), packet(1, 0))
    refused({ Api.inArray(rows) }, constructor(PREFIX + "0[1].word", "mkWord")) { snap(rows) }
    rows[1] = packet(2, 3)
    recover(Api.inArray(rows) == n(6))
    rows[1] = packet(5, 2)
    refused({ Api.inArray(rows) }, constructor(PREFIX + "0[1]", "mkPacket")) { snap(rows) }
    rows[1] = packet(2, 3)
    recover(Api.inArray(rows) == n(6))
    rows[1] = packet(10, 12)
    refused({ Api.inArray(rows) }, fin(PREFIX + "0[1].digit")) { snap(rows) }
    rows[1] = packet(2, 3)
    recover(Api.inArray(rows) == n(6))

    val maybe = Option.some(packet(5, 2))
    refused({ Api.inOption(maybe) }, constructor(PREFIX + "0?", "mkPacket")) { snap(maybe) }
    recover(Api.inOption(Option.some(packet(1, 2))) == n(3))
    val product = Pair(packet(1, 2), packet(10, 0))
    refused({ Api.inProduct(product) }, fin(PREFIX + "0.1.digit")) { snap(product) }
    recover(Api.inProduct(Pair(packet(1, 2), packet(3, 0))) == n(6))
    var branch = Result.ok<Packet, Packet>(packet(10, 0))
    refused({ Api.inExcept(branch) }, fin(PREFIX + "0.ok.digit")) { snap(branch) }
    recover(Api.inExcept(Result.ok(packet(2, 9))) == n(3))
    branch = Result.err(packet(3, 1))
    refused({ Api.inExcept(branch) }, constructor(PREFIX + "0.error", "mkPacket")) { snap(branch) }
    recover(Api.inExcept(Result.err(packet(1, 2))) == n(3))
    val holder = Holder(packet(10, 0), n(9))
    refused({ Api.inHolder(holder) }, fin(PREFIX + "0.packet.digit")) { snap(holder) }
    recover(Api.inHolder(Holder(packet(3, 1), n(9))) == n(13))
    val choice: Choice = ChoicePacket(packet(3, 1))
    refused({ Api.inChoice(choice) }, constructor(PREFIX + "0.packet.value", "mkPacket")) { snap(choice) }
    recover(Api.inChoice(ChoicePacket(packet(2, 4))) == n(5))

    val firstMethod = Api::class.java.getMethod("first", Packet::class.java)
    refusedHost({ firstMethod.invoke(null, null) }, NullPointerException::class.java) { "null" }
    recover(Api.first(first) == n(3))
    @Suppress("UNCHECKED_CAST")
    val nullRows = arrayOfNulls<Packet>(1) as Array<Packet>
    refusedHost({ Api.inArray(nullRows) }, NullPointerException::class.java) { snap(nullRows) }
    recover(Api.inArray(arrayOf(first)) == n(3))
    val negativePacket = Packet(BigInteger.ONE.negate(), BigInteger.ONE)
    refusedHost({ Api.first(negativePacket) }, IllegalArgumentException::class.java) { snap(negativePacket) }
    recover(Api.first(first) == n(3))

    repeat(ROUNDS) { round ->
        val input = n(round + 10L)
        val valid = Packet(n((round % 10).toLong()), input)
        accepted(valid, Api::first, ::snap, { it == input }, "round direct packet")
        val roundInvalid = packet(2, 1)
        refused({ Api.first(roundInvalid) }, constructor(PREFIX + "0", "mkPacket")) { snap(roundInvalid) }
        recover(Api.first(valid) == input)
        val normalized = packet((round % 10).toLong(), 0)
        accepted(normalized, Api::second, ::snap,
            { it == n((round % 10 + 1).toLong()) }, "round normalized packet")
        val roundRows = arrayOf(valid, packet(1, 0))
        refused({ Api.inArray(roundRows) }, constructor(PREFIX + "0[1].word", "mkWord")) { snap(roundRows) }
        roundRows[1] = packet(2, 3)
        recover(Api.inArray(roundRows) == n(round + 13L))
    }
}
