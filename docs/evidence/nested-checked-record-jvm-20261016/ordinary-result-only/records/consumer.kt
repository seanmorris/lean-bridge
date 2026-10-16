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

}
