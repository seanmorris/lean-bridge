import java.math.BigInteger
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.*
import org.leanbridge.feedback.Result
import org.leanbridge.feedback.RetainedCallback
import org.leanbridge.feedback.kotlin.Api
import org.leanbridge.relay.kotlin.Api as Relay

private suspend fun exercise(peer: Boolean) = coroutineScope {
    if (peer) check(Relay.run("") { it + "!" } == "!!") else check(Api.once(1L) { it + 1 } == 2L)
    check(Api.plain(5L) == 6L && Relay.direct(4L) == 5L)
    Observe.drained(); val baseline = Observe.descriptors()
    val nested: String = Api.duringStart({ s -> runBlocking { Relay.run(s) { it + "!" } } }, { it + "?" }, "α\u0000")
    check(nested == "α\u0000!!?!!")
    val mark = java.io.IOException("same object")
    try { Api.once(3L) { throw mark }; error("lost callback error") } catch (e: java.io.IOException) { check(e === mark) }
    val recovered: Result<BigInteger,String> = Api.recover({ throw mark }, BigInteger.ZERO)
    check(recovered == Result.Err<BigInteger,String>("caught in Lean"))
    try { Api.replaceError { throw mark }; error("lost terminal error") }
    catch (e: org.leanbridge.feedback.TaskIOException) { check(e.declaration() == "Retained.replaceError") }
    try { Api.typedStart({ it }, true, byteArrayOf()); error("lost factory error") }
    catch (e: org.leanbridge.feedback.TypedStartError) { val error: String = e.payload(); check(error == "factory refused") }
    val bytes = byteArrayOf(0, -128, -1)
    val value: ByteArray = Api.typedStart({ received -> check(received !== bytes && received.contentEquals(bytes)); received }, false, bytes)
    check(value !== bytes && value.contentEquals(bytes))
    val count = AtomicInteger()
    Api.action { check(Thread.currentThread().isVirtual); count.incrementAndGet() }
    check(count.get() == 1)
    RetainedCallback.function<String,String> { it + "x" }.use { registration ->
        check(Api.repeatCall("a", registration.callback()::apply) == "axx")
        check(Relay.run("b", registration.callback()::apply) == "bxx")
        registration.close()
        try { Relay.run("later", registration.callback()::apply); error("revoked callback ran") }
        catch (e: IllegalStateException) { check(e.message == "Retained Lean callback is closed") }
    }
    val entered = CompletableDeferred<Unit>(); val release = CompletableFuture<Unit>(); val returned = CompletableDeferred<Unit>()
    val pending = launch(start = CoroutineStart.UNDISPATCHED) {
        Api.once(7L) { n -> entered.complete(Unit); release.join(); returned.complete(Unit); n }
        error("cancelled coroutine resumed normally")
    }
    entered.await(); pending.cancelAndJoin(); Observe.drained()
    check(Relay.run("c") { it + "!" } == "c!!"); release.complete(Unit); returned.await()
    Observe.drained(); Observe.until { Observe.descriptors() == baseline }
    check(Observe.snapshot().contentEquals(intArrayOf(1,2,2,0)))
    // Runtime retirement must settle the host waiter independently of a blocked callback.
    val active = CompletableDeferred<Unit>(); val unblock = CompletableFuture<Unit>(); val left = CompletableDeferred<Unit>()
    val retired = async(start = CoroutineStart.UNDISPATCHED) {
        try { Api.once(8L) { n -> active.complete(Unit); unblock.join(); left.complete(Unit); n }; false }
        catch (e: IllegalStateException) { true }
    }
    active.await(); Observe.retire(); check(retired.await()); Observe.drained()
    unblock.complete(Unit); left.await(); Observe.until { Observe.descriptors() == baseline }
    try { Relay.direct(1L); error("peer reused retired runtime") } catch (e: IllegalStateException) { check(e.message!!.contains("unavailable")) }
}

fun main(args: Array<String>) = runBlocking {
    withTimeout(90_000) { exercise(args.single() == "peer-first") }
    println("Kotlin: suspend callbacks, nested reentry, checked exception identity, revocation, cancellation and retirement during a blocked callback; 2 components, 0 live identities, descriptor delta 0")
}
