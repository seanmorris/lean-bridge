// Independent Kotlin caller for proof-free inherited checked records.
// Generated value equality is deliberately not used as an oracle.
import java.math.BigInteger
import org.leanbridge.inheritedcheckedrecords.kotlin.*

private var checks = 0
private var rejections = 0
private var recoveries = 0
private var snapshots = 0
private var snapshotControls = 0
private const val ROUNDS = 256
private const val PREFIX = "value"

private data class TicketPair(val first: Ticket, val second: Ticket)

private fun n(value: Long) = BigInteger.valueOf(value)
private fun huge() = BigInteger.ONE.shiftLeft(100)
private fun span(lo: Long, hi: Long) = Span(n(lo), n(hi))
private fun ticket(lo: Long, hi: Long, word: Long) = Ticket(span(lo, hi), n(word))
private fun bigTicket(value: BigInteger, offset: Long) =
    Ticket(Span(value, value), value + n(offset))
private fun stamped(lo: Long, hi: Long, word: Long, mark: Long) =
    Stamped(ticket(lo, hi, word), n(mark))
private fun bigStamped(value: BigInteger) = Stamped(bigTicket(value, 1), BigInteger.ZERO)

private fun snapNat(value: BigInteger) = "Nat($value)"
private fun snapSpan(value: Span) = "Span(${snapNat(value.lo)},${snapNat(value.hi)})"
private fun snapTicket(value: Ticket) =
    "Ticket(${snapSpan(value.toSpan)},${snapNat(value.word)})"
private fun snapStamped(value: Stamped) =
    "Stamped(${snapTicket(value.toTicket)},${snapNat(value.mark)})"
private fun snapPair(value: TicketPair) =
    "Tuple(${snapTicket(value.first)},${snapTicket(value.second)})"

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("failed: $label")
    checks++
}

private fun unchanged(before: String, after: String) {
    snapshots++
    check(before == after, "complete caller inputs unchanged")
}

private fun <I, O> call(input: I, invoke: (I) -> O,
    inputSnapshot: (I) -> String, outputSnapshot: (O) -> String,
    expected: String): O {
    val before = inputSnapshot(input)
    val output = invoke(input)
    check(outputSnapshot(output) == expected, "exact independent result")
    unchanged(before, inputSnapshot(input))
    return output
}


private fun distinct(left: String, right: String) {
    check(left != right, "independent snapshot mutation control")
    snapshotControls++
}

fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"checks\":$checks,\"rejections\":$rejections,\"recoveries\":$recoveries,"
        + "\"snapshots\":$snapshots,\"snapshotControls\":$snapshotControls,\"rounds\":$ROUNDS}")
}

private fun runChecks() {
    distinct(snapTicket(ticket(0, 0, 1)), snapTicket(ticket(0, 0, 2)))
    distinct(snapTicket(ticket(0, 0, 1)), snapTicket(ticket(0, 1, 1)))
    distinct(snapStamped(stamped(0, 0, 1, 0)), snapStamped(stamped(0, 0, 1, 1)))
    distinct(snapNat(BigInteger.ZERO), snapNat(huge()))
    distinct(snapSpan(span(0, 1)), snapTicket(ticket(0, 1, 1)))
    distinct(snapTicket(ticket(0, 1, 1)), snapStamped(stamped(0, 1, 1, 0)))

    val zero = BigInteger.ZERO
    call(zero, Api::produce, ::snapNat, ::snapTicket, snapTicket(ticket(0, 0, 1)))
    call(zero, Api::produceStamped, ::snapNat, ::snapStamped,
        snapStamped(stamped(0, 0, 1, 0)))
    repeat(ROUNDS) { round ->
        val value = huge() + n(round.toLong())
        val produced = call(value, Api::produce, ::snapNat, ::snapTicket,
            snapTicket(bigTicket(value, 1)))
        val marked = call(value, Api::produceStamped, ::snapNat, ::snapStamped,
            snapStamped(bigStamped(value)))
        check(produced !== marked.toTicket, "returned tickets own independent managed storage")
        check(produced.toSpan !== marked.toTicket.toSpan,
            "returned inherited fields own independent managed storage")
    }
}

