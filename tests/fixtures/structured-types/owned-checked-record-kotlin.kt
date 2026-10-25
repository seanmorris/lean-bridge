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
private fun close(value: Grant) = value.holder.close()
private data class Abandoned(val weak: java.lang.ref.WeakReference<Ticket>, val retained: Ticket)
private fun abandon(): Abandoned {
    val value = Api.newTicket(n(62), "finalized")
    return Abandoned(java.lang.ref.WeakReference(value), value.retain())
}
private fun collect(weak: java.lang.ref.WeakReference<*>) {
    repeat(100) { if (weak.get() == null) return; System.gc(); Thread.sleep(5) }
    check(false, "Cleaner reaches abandoned owner")
}

private fun postTransfer(throwsError: Boolean) {
    Api.newTicket(n(91), "post-transfer").use { input -> input.retain().use { independent ->
        val transferred = claim(input, 7)
        var entered = 0; var output: Claim? = null
        val sentinel = IllegalStateException("post-transfer callback")
        val reply = TransferWithClaimCallbackArgument1ClosureCallback { incoming ->
            entered++; check(incoming.quota == n(7), "post-transfer callback input")
            if (throwsError) throw sentinel
            claim(incoming.holder, 99)
        }
        val callback = OwnedCallbacks.withRecovery(reply, claim(independent, 7))
        if (throwsError)
            check(reject<IllegalStateException> { output = Api.transferWithClaimCallback(transferred, callback) } === sentinel,
                "post-transfer callback exception identity")
        else
            check(reject<LeanBridgeException> { output = Api.transferWithClaimCallback(transferred, callback) }.status() == 1,
                "post-transfer invalid callback reply rejects")
        check(output == null && entered == 1 && input.isClosed && transferred.holder.isClosed,
            "post-transfer failure consumes input without publishing output")
        check(Api.serial(independent) == n(91), "post-transfer failure preserves independent retain")
        val recovered = Api.transferWithClaimCallback(claim(independent, 7), OwnedCallbacks.withRecovery(
            TransferWithClaimCallbackArgument1ClosureCallback { incoming -> claim(incoming.holder, 9) }, claim(independent, 7)))
        check(independent.isClosed && recovered.quota == n(9), "post-transfer failure recovers")
        check(Api.serial(recovered.holder) == n(91), "recovered transfer resource"); close(recovered)
    } }
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
            val invalidBooking = booking(ticket, 8, 3)
            repeat(10) {
                reject<LeanBridgeException> { Api.echoBooking(invalidBooking) }
                check(invalidBooking.window.lo == n(8) && invalidBooking.window.hi == n(3), "nested copied rejection preserves input fields")
                check(Api.serial(invalidBooking.holder) == n(41), "nested copied rejection preserves owner")
            }
            val equalBooking = Api.echoBooking(booking(ticket, 3, 3))
            check(equalBooking.window.lo == n(3) && equalBooking.window.hi == n(3), "nested copied equality and recovery")
            check(Api.serial(equalBooking.holder) == n(41), "nested copied recovery resource"); close(equalBooking)
            check(Api.bookingSpan(validBooking) == n(5), "copied payload consumed")
            check(Api.claimQuota(valid) == n(7), "owned payload consumed")
            val grant = Api.echoGrant(Grant(ticket, n(7), n(8)))
            check(grant.weight == n(7) && grant.limit == n(8), "nested Subtype and outer record accepted")
            check(Api.serial(grant.holder) == n(41), "grant resource"); close(grant)
            reject<LeanBridgeException> { Api.echoGrant(Grant(ticket, n(0), n(8))) }
            reject<LeanBridgeException> { Api.echoGrant(Grant(ticket, n(7), n(3))) }
            check(Api.serial(ticket) == n(41), "both grant rejections preserve owner")
            val claims = Api.echoClaims(arrayOf(valid, valid))
            check(claims.size == 2 && claims[0].quota == n(7) && claims[1].quota == n(7), "owned array")
            close(claims[0]); check(Api.serial(claims[1].holder) == n(41), "array element owners are independent"); close(claims[1])
            repeat(10) {
                var partial: Array<Claim>? = null
                reject<LeanBridgeException> { partial = Api.echoClaims(arrayOf(valid, claim(ticket, 99))) }
                check(partial == null && !ticket.isClosed, "late array rejection publishes no partial result")
            }
            check(Api.echoClaims(emptyArray()).isEmpty(), "empty owned array")
            val arrayRecovery = Api.echoClaims(arrayOf(valid))
            check(arrayRecovery.size == 1 && arrayRecovery[0].quota == n(7), "array recovery"); close(arrayRecovery[0])
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

            Api.newTicket(n(71), "first").use { first -> Api.newTicket(n(81), "second").use { second ->
                first.retain().use { firstKept -> second.retain().use { secondKept ->
                    val firstInput = booking(first, 3, 8); val secondInput = claim(second, 99)
                    reject<LeanBridgeException> { Api.transferPairClaim(firstInput, secondInput) }
                    check(!first.isClosed && !second.isClosed, "late failure aborts both transfers")
                    check(Api.serial(first) == n(71) && Api.serial(second) == n(81), "both rejected transfers intact")
                    val pair = Api.transferPairClaim(firstInput, claim(second, 7))
                    check(first.isClosed && second.isClosed && pair.quota == n(7), "both transfers commit")
                    check(Api.serial(pair.holder) == n(81), "pair transfer result")
                    check(Api.serial(firstKept) == n(71) && Api.serial(secondKept) == n(81), "both independent retains survive"); close(pair)
                } }
            } }
            postTransfer(false); postTransfer(true)

            var calls = 0
            val reply = TransferWithClaimCallbackArgument1ClosureCallback { incoming -> calls++; claim(incoming.holder, 10) }
            var output = Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, valid))
            check(calls == 1 && output.quota == n(10), "callback result"); close(output)
            output = Api.withClaimCallback(valid, reply); check(calls == 2, "bare callback"); close(output)
            reject<LeanBridgeException> { Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, invalid)) }
            check(calls == 2, "invalid recovery prevents callback")
            reject<LeanBridgeException> { Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(TransferWithClaimCallbackArgument1ClosureCallback { claim(ticket, 99) }, valid)) }
            val sentinel = IllegalStateException("kotlin callback")
            check(reject<IllegalStateException> { Api.withClaimCallback(valid, OwnedCallbacks.withRecovery(TransferWithClaimCallbackArgument1ClosureCallback { throw sentinel }, valid)) } === sentinel, "exception identity")

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
