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
private const val PREFIX = "ROUTE_PREFIX"

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

// BEGIN FULL_ONLY
private fun <I> refuse(input: I, invoke: (I) -> Any?,
    snapshot: (I) -> String, expected: String) {
    val before = snapshot(input)
    try {
        invoke(input)
        throw IllegalStateException("accepted invalid checked record: $expected")
    } catch (error: IllegalArgumentException) {
        check(error::class.java == IllegalArgumentException::class.java
            && error.message == expected, "exact checked-record rejection: $error")
    }
    unchanged(before, snapshot(input))
    rejections++
}

private fun rejected(path: String, constructor: String) =
    "$PREFIX$path was rejected by InheritedCheckedRecords.$constructor"
private fun fin(path: String) = "$PREFIX$path.mark is not below its Fin 8 bound"
// END FULL_ONLY

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
    // BEGIN FULL_ONLY
    distinct(snapTicket(ticket(1, 2, 3)), snapTicket(ticket(2, 2, 3)))
    distinct(snapStamped(stamped(1, 2, 3, 0)), snapStamped(stamped(1, 2, 3, 7)))
    // END FULL_ONLY

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
    // BEGIN FULL_ONLY
    full()
    // END FULL_ONLY
}

// BEGIN FULL_ONLY
private fun full() {
    call(ticket(2, 3, 4), Api::first, ::snapTicket, ::snapNat, snapNat(n(9)))
    call(ticket(4, 1, 0), Api::normalized, ::snapTicket, ::snapNat, snapNat(n(11)))
    var pair = TicketPair(ticket(2, 3, 4), ticket(4, 1, 999))
    call(pair, { Api.pair(it.first, it.second) }, ::snapPair, ::snapNat, snapNat(n(10)))
    call(ticket(4, 1, 4), Api::aliased, ::snapTicket, ::snapNat, snapNat(n(5)))
    call(stamped(1, 2, 4, 3), Api::nested, ::snapStamped, ::snapNat, snapNat(n(7)))
    call(ticket(1, 2, 0), Api::echo, ::snapTicket, ::snapTicket,
        snapTicket(ticket(1, 2, 3)))

    var invalidTicket = ticket(4, 1, 5)
    refuse(invalidTicket, Api::first, ::snapTicket, rejected("0.toSpan", "mkSpan"))
    invalidTicket = ticket(1, 2, 0)
    refuse(invalidTicket, Api::first, ::snapTicket, rejected("0.word", "mkWord"))
    invalidTicket = ticket(1, 5, 3)
    refuse(invalidTicket, Api::first, ::snapTicket, rejected("0", "mkTicket"))
    var invalidStamped = stamped(1, 2, 9, 8)
    refuse(invalidStamped, Api::nested, ::snapStamped, fin("0"))
    invalidStamped = stamped(1, 2, 4, 5)
    refuse(invalidStamped, Api::nested, ::snapStamped, rejected("0", "mkStamped"))
    invalidTicket = ticket(1, 5, 3)
    refuse(invalidTicket, Api::aliased, ::snapTicket, rejected("0", "mkTicket"))

    repeat(ROUNDS) { round ->
        val value = n(round + 10L)
        val valid = ticket(round + 10L, round + 11L, round + 12L)
        call(valid, Api::first, ::snapTicket, ::snapNat, snapNat(value * n(3) + n(3)))
        call(ticket(round + 12L, round + 10L, 0), Api::normalized,
            ::snapTicket, ::snapNat, snapNat(value * n(4) + n(5)))
        pair = TicketPair(valid, ticket(round + 12L, round + 10L, 0))
        call(pair, { Api.pair(it.first, it.second) }, ::snapPair, ::snapNat,
            snapNat(value * n(3) + n(5)))
        call(ticket(round + 12L, round + 10L, 2L * round + 21L), Api::aliased,
            ::snapTicket, ::snapNat, snapNat(value * n(2) + n(2)))
        val mark = round % 8
        call(stamped(mark.toLong(), mark.toLong(), mark + 1L, mark.toLong()), Api::nested,
            ::snapStamped, ::snapNat, snapNat(n(2L * mark + 1L)))

        invalidTicket = ticket(round + 11L, round + 10L, round + 12L)
        refuse(invalidTicket, Api::first, ::snapTicket, rejected("0.toSpan", "mkSpan"))
        invalidTicket = ticket(0, 1, 0)
        refuse(invalidTicket, Api::first, ::snapTicket, rejected("0.word", "mkWord"))
        invalidTicket = ticket(0, round + 12L, round + 11L)
        refuse(invalidTicket, Api::first, ::snapTicket, rejected("0", "mkTicket"))
        invalidStamped = stamped(0, 9, 9, 8)
        refuse(invalidStamped, Api::nested, ::snapStamped, fin("0"))
        invalidStamped = stamped(0, 6, 6, 7)
        refuse(invalidStamped, Api::nested, ::snapStamped, rejected("0", "mkStamped"))
        call(valid, Api::first, ::snapTicket, ::snapNat, snapNat(value * n(3) + n(3)))
        recoveries++
    }
}
// END FULL_ONLY
