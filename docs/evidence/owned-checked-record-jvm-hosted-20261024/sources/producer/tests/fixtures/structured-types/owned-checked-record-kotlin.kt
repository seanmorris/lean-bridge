import java.math.BigInteger
import org.leanbridge.owned_checked_records.kotlin.*

private var checks = 0
private fun n(value: Long) = BigInteger.valueOf(value)
private fun check(value: Boolean, message: String) { checks++; if (!value) error("owned checked-record Kotlin check $checks: $message") }
private fun claim(holder: Ticket, quota: Long) = Claim(holder, n(quota))
private fun booking(holder: Ticket, lo: Long, hi: Long) = Booking(holder, Window(n(lo), n(hi)))
private inline fun <reified T : Throwable> reject(block: () -> Unit): T = try { block(); error("expected ${T::class.java.name}") } catch (error: Throwable) { if (error is T) error else throw error }
private fun close(value: Claim) = value.holder.close()
private fun close(value: Booking) = value.holder.close()
private data class Abandoned(val weak: java.lang.ref.WeakReference<Ticket>, val retained: Ticket)
private fun abandon(): Abandoned {
    val value = Api.newTicket(n(62), "finalized")
    return Abandoned(java.lang.ref.WeakReference(value), value.retain())
}
private fun collect(weak: java.lang.ref.WeakReference<*>) {
    repeat(100) { if (weak.get() == null) return; System.gc(); Thread.sleep(5) }
    check(false, "Cleaner reaches abandoned owner")
}

private fun exercise() {
    Api.newTicket(n(41), "kotlin\u0000checked").use { ticket ->
        ticket.retain().use { retained ->
            check(Api.serial(ticket) == n(41), "fresh resource"); check(Api.serial(retained) == n(41), "retained resource")
            val valid = claim(ticket, 7); val validBooking = booking(ticket, 3, 8)
            repeat(25) {
                val echoed = Api.echoClaim(valid); check(echoed.quota == n(7), "claim field"); check(Api.serial(echoed.holder) == n(41), "claim resource"); close(echoed)
                val nested = Api.echoBooking(validBooking); check(nested.window.hi == n(8), "nested field"); check(Api.serial(nested.holder) == n(41), "nested resource"); close(nested)
            }
            val invalid = claim(ticket, 99)
            reject<LeanBridgeException> { Api.echoClaim(invalid) }
            reject<LeanBridgeException> { Api.pairClaim(validBooking, invalid) }
            check(!ticket.isClosed, "borrowed rejection preserves input"); check(Api.serial(ticket) == n(41), "rejection recovery")

            Api.newTicket(n(51), "moving").use { moving -> moving.retain().use { kept ->
                val refused = claim(moving, 99); reject<LeanBridgeException> { Api.transferClaim(refused) }
                check(!moving.isClosed && !refused.holder.isClosed, "prevalidate transfer")
                val accepted = claim(moving, 9); val moved = Api.transferClaim(accepted)
                check(moving.isClosed && accepted.holder.isClosed, "consume transfer")
                check(Api.serial(moved.holder) == n(51) && Api.serial(kept) == n(51), "retained and moved resources"); close(moved)
            } }

            var calls = 0
            val reply = WithClaimCallbackArgument1ClosureCallback { incoming -> calls++; claim(incoming.holder, 10) }
            var output = Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, valid))
            check(calls == 1 && output.quota == n(10), "callback result"); close(output)
            output = Api.withClaimCallback(valid, reply); check(calls == 2, "bare callback"); close(output)
            reject<LeanBridgeException> { Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, invalid)) }
            check(calls == 2, "invalid recovery prevents callback")
            reject<LeanBridgeException> { Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(WithClaimCallbackArgument1ClosureCallback { claim(ticket, 99) }, valid)) }
            val sentinel = IllegalStateException("kotlin callback")
            check(reject<IllegalStateException> { Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(WithClaimCallbackArgument1ClosureCallback { throw sentinel }, valid)) } === sentinel, "exception identity")

            Api.claimClosure().use { closure ->
                var value = closure.invoke(valid); check(value.quota == n(7), "closure result"); close(value)
                reject<LeanBridgeException> { closure.invoke(invalid) }
                value = closure.invoke(claim(ticket, 6)); check(value.quota == n(6), "closure recovery"); close(value)
                closure.close(); closure.close(); check(closure.isClosed, "idempotent close")
            }
            val produced = Api.claimFor(retained)
            check(produced.isSome() && produced.value().quota == BigInteger.ZERO, "Lean-produced checked record")
            check(Api.serial(produced.value().holder) == n(41), "produced resource"); close(produced.value())

            var foreignFailure: Throwable? = null
            val foreign = Thread { try { Api.serial(ticket) } catch (error: Throwable) { foreignFailure = error } }
            foreign.start(); foreign.join()
            check(foreignFailure is LeanBridgeException && (foreignFailure as LeanBridgeException).status() == 5, "foreign thread rejects without closing owner")
            check(Api.serial(ticket) == n(41), "owner survives foreign-thread rejection")

            val abandoned = abandon(); collect(abandoned.weak)
            check(Api.serial(abandoned.retained) == n(62), "Cleaner preserves independent retain")
            abandoned.retained.close()
        }
    }
}

fun main() {
    var failure: Throwable? = null
    val worker = Thread { try { exercise() } catch (error: Throwable) { failure = error } }
    worker.start(); worker.join(); failure?.let { throw AssertionError("worker failed", it) }
    println("owned-checked-record-kotlin:$checks")
}
