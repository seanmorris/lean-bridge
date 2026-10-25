// Independent installed-Maven Kotlin consumer for checked owned aggregates.
import java.math.BigInteger
import org.leanbridge.owned_subtypes.kotlin.*

private var checks = 0

private fun check(value: Boolean, message: String) {
    checks++
    if (!value) throw AssertionError("owned Subtype Kotlin check $checks: $message")
}

private fun rejected(operation: () -> Unit) {
    try { operation() }
    catch (error: LeanBridgeException) {
        check(error.status() == 1, "expected invalid argument, got status ${error.status()}")
        return
    }
    throw AssertionError("expected checked-constructor rejection")
}

private fun bundle(ticket: Ticket, count: Long) = Bundle(
    ticket,
    Option.none(),
    arrayOf(ticket),
    arrayOf(ticket),
    Payload(BigInteger.valueOf(count), byteArrayOf(0, -1))
)

private fun release(value: Bundle) {
    value.primary.close()
    if (value.spare.isSome()) value.spare.value().close()
    value.peers.forEach { it.close() }
    value.history.forEach { it.close() }
}

private fun serialIs(ticket: Ticket, expected: Long, message: String) =
    check(Api.serial(ticket) == BigInteger.valueOf(expected), message)

private data class Abandoned(val weak: java.lang.ref.WeakReference<Ticket>, val retained: Ticket)

private fun abandon(): Abandoned {
    val abandoned = Api.newTicket(BigInteger.valueOf(61), "finalized")
    return Abandoned(java.lang.ref.WeakReference(abandoned), abandoned.retain())
}

private fun collect(weak: java.lang.ref.WeakReference<*>) {
    repeat(100) {
        if (weak.get() == null) return
        System.gc(); Thread.sleep(5)
    }
    check(false, "garbage collection reaches the abandoned owner")
}

fun main() {
    val ticket = Api.newTicket(BigInteger.valueOf(41), "kotlin\u0000checked")
    val retained = ticket.retain()
    serialIs(ticket, 41, "fresh resource is usable")
    serialIs(retained, 41, "explicit retain is independent")

    val valid = bundle(ticket, 7)
    repeat(25) {
        val echoed = Api.echoRecord(valid)
        check(echoed.payload.count == BigInteger.valueOf(7), "selected constructor accepts a valid value")
        serialIs(echoed.primary, 41, "selected constructor preserves the resource")
        val alternate = Api.echoRecordAlternate(valid)
        check(alternate.payload.bytes.contentEquals(byteArrayOf(0, -1)), "alternate constructor preserves bytes")
        serialIs(alternate.primary, 41, "alternate constructor preserves the resource")
        release(echoed)
        release(alternate)
    }
    check(!ticket.isClosed(), "borrowed calls do not consume the input owner")

    val invalid = bundle(ticket, -1)
    rejected { Api.echoRecord(invalid) }
    rejected { Api.echoRecordAlternate(invalid) }
    check(!ticket.isClosed(), "borrowed rejection preserves the input owner")
    serialIs(ticket, 41, "borrowed rejection leaves the resource usable")

    val moving = Api.newTicket(BigInteger.valueOf(51), "moving")
    val kept = moving.retain()
    rejected { Api.transferRecord(bundle(moving, -1)) }
    check(!moving.isClosed(), "transfer rejection happens before ownership movement")
    serialIs(moving, 51, "rejected transfer leaves the original usable")
    serialIs(kept, 51, "rejected transfer leaves the retain usable")

    val moved = Api.transferRecord(bundle(moving, 9))
    check(moving.isClosed(), "successful transfer consumes the selected owner")
    serialIs(kept, 51, "successful transfer preserves an independent retain")
    check(moved.payload.count == BigInteger.valueOf(9), "successful transfer preserves the checked field")
    serialIs(moved.primary, 51, "successful transfer returns a usable resource")

    var foreignFailure: Throwable? = null
    val foreign = Thread {
        try { Api.serial(ticket) }
        catch (error: Throwable) { foreignFailure = error }
    }
    foreign.start(); foreign.join(10_000)
    check(!foreign.isAlive, "worker completed")
    check(foreignFailure is LeanBridgeException && (foreignFailure as LeanBridgeException).status() == 5,
        "foreign-thread use rejects without closing the owner")
    serialIs(ticket, 41, "owner remains usable after foreign-thread rejection")

    val abandoned = abandon()
    collect(abandoned.weak)
    serialIs(abandoned.retained, 61, "Cleaner cleanup preserves an independent retain")
    abandoned.retained.close()
    serialIs(ticket, 41, "runtime remains usable after Cleaner cleanup")

    release(moved)
    ticket.close(); retained.close(); moving.close(); kept.close()
    check(ticket.isClosed() && retained.isClosed() && moving.isClosed() && kept.isClosed(),
        "cleanup is explicit and idempotent")
    println("owned-subtype-kotlin:$checks")
}
