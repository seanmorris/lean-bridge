import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.*
import org.leanbridge.feedback.kotlin.Api
import org.leanbridge.relay.kotlin.Api as Relay

private suspend fun terminal(call: suspend () -> Long): Boolean =
    try { call(); false } catch (e: IllegalStateException) {
        check(e.message.orEmpty().contains("unavailable")); true
    }

// Two independent packages, using their public Kotlin suspend projections.
// No call to the broker's retire function: the callback itself initiates retirement.
fun main(args: Array<String>) = runBlocking {
    val (mode, order) = args
    withTimeout(60_000) {
        if (order == "peer-first") check(Relay.direct(1) == 2L)
        check(Api.once(3) { it + 1 } == 4L)
        check(Relay.direct(4) == 5L)
        Observe.drained()
        check(Observe.snapshot().contentEquals(intArrayOf(1, 2, 2, 0)))
        val baseline = Observe.descriptors()
        val marker = LinkageError("injected Kotlin linkage failure")
        val entered = AtomicInteger()
        if (mode == "active") {
            val failure = try {
                Api.once(1) { entered.incrementAndGet(); throw marker }
                null
            } catch (e: LinkageError) { e }
            check(failure === marker)
        } else {
            check(mode == "after-cancel")
            val inside = CompletableDeferred<Unit>()
            val release = CompletableFuture<Unit>()
            val completions = AtomicInteger()
            val successes = AtomicInteger()
            val operation = launch(start = CoroutineStart.UNDISPATCHED) {
                Api.once(1) {
                    entered.incrementAndGet()
                    inside.complete(Unit)
                    release.join()
                    throw marker
                }
                successes.incrementAndGet()
            }
            operation.invokeOnCompletion { cause ->
                if (cause is CancellationException) completions.incrementAndGet()
            }
            try {
                inside.await()
                operation.cancelAndJoin()
                check(completions.get() == 1 && operation.isCancelled)
                check(Relay.direct(6) == 7L) // Cancellation alone did not retire the peer.
            } finally { release.complete(Unit) }
            while (!terminal { Relay.direct(7) }) delay(8)
            check(completions.get() == 1 && successes.get() == 0 && operation.isCancelled)
        }
        check(entered.get() == 1)
        check(terminal { Relay.direct(8) })
        check(terminal { Api.once(9) { entered.incrementAndGet(); it } })
        check(entered.get() == 1)
        Observe.drained()
        Observe.until { Observe.descriptors() == baseline }
        check(Observe.snapshot().last() == 0)
        println("Kotlin " + mode + " " + order + ": one callback, both packages retired, zero live identities, descriptor delta zero")
    }
}
