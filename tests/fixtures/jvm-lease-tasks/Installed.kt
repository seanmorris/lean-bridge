import java.util.concurrent.CompletableFuture
import java.util.concurrent.Flow as JFlow
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import org.leanbridge.depot.kotlin.Api as Depot
import org.leanbridge.desk.kotlin.Api as Desk
import org.leanbridge.depot.CheckedError
import org.leanbridge.depot.TicketsStepError

private class Queue : CoroutineDispatcher() {
    private val jobs = LinkedBlockingQueue<Runnable>()
    override fun dispatch(context: CoroutineContext, block: Runnable) { jobs.add(block) }
    fun next(): Runnable = checkNotNull(jobs.poll(20, TimeUnit.SECONDS))
}
private class Demand<T : Any>(val source: JFlow.Publisher<T>) : JFlow.Publisher<T> {
    private val demand = LinkedBlockingQueue<Long>()
    private lateinit var up: JFlow.Subscription
    override fun subscribe(s: JFlow.Subscriber<in T>) {
        source.subscribe(object : JFlow.Subscriber<T> {
            override fun onSubscribe(actual: JFlow.Subscription) {
                up = actual
                s.onSubscribe(object : JFlow.Subscription {
                    override fun request(n: Long) { demand.add(n) }
                    override fun cancel() { actual.cancel() }
                })
            }
            override fun onNext(value: T) = s.onNext(value)
            override fun onError(e: Throwable) = s.onError(e)
            override fun onComplete() = s.onComplete()
        })
    }
    fun advance() { up.request(checkNotNull(demand.poll(20, TimeUnit.SECONDS))) }
}
private suspend fun <T : Any> fromGate(f: CompletableFuture<T>): T =
    suspendCoroutineUninterceptedOrReturn { k -> DeliveryAccess.await(f, k) }

private suspend fun <T : AutoCloseable> cancelFuture(factory: () -> CompletableFuture<T>) = coroutineScope {
    val q = Queue()
    val gate = CompletableFuture<T>()
    val job = launch(q, start = CoroutineStart.UNDISPATCHED) { fromGate(gate).use { error("cancelled result reached caller") } }
    factory().whenComplete { v, e -> if (e == null) gate.complete(v) else gate.completeExceptionally(e) }
    val dispatch = q.next() // Completion was accepted, but not yet dispatched to the coroutine.
    job.cancel(); dispatch.run(); job.join(); check(job.isCancelled)
}

private suspend fun <T : AutoCloseable> cancelStream(source: JFlow.Publisher<T>, inError: Boolean) = coroutineScope {
    val q = Queue(); val gate = Demand(source); var accepted = 0
    val job = launch(q, start = CoroutineStart.UNDISPATCHED) {
        DeliveryAccess.flow(gate).collect { it.use { accepted++ } }
    }
    gate.advance()
    if (inError) { q.next().run(); check(accepted == 1); gate.advance() }
    val dispatch = q.next() // A real native item or step-error payload is now undelivered.
    job.cancel(); dispatch.run(); job.join(); check(job.isCancelled && accepted == (if (inError) 1 else 0))
}

fun main(args: Array<String>) = runBlocking {
    (if (args.first() == "depot-first") Depot.make(0, "warm") else Desk.issue(0)).close()
    val base = Installed.files()
    Desk.issue(41).use { ticket ->
        Depot.revisit(ticket) { n -> check(Desk.count(ticket) == n); n + 1 }.use {
            check(it.sameResource(ticket) && Desk.count(it) == 42L)
        }
        Depot.checked(false, ticket).use { check(it.sameResource(ticket)) }
        try { Depot.checked(true, ticket); error("expected EIO") }
        catch (e: CheckedError) { e.payload().use { check(it.sameResource(ticket)) } }
        Depot.tickets(ticket, false).first().use { check(!it.isClosed && it.sameResource(ticket)) }
        try { Depot.tickets(ticket, true).collect { it.close() }; error("expected step EIO") }
        catch (e: TicketsStepError) { e.payload().use { check(it.sameResource(ticket)) } }
        fun onlyTicket() = Observe.until { Observe.snapshot()[3] == 1 && Installed.files() == base + 1 && Observe.reactors() == 0L }
        cancelFuture { org.leanbridge.depot.Api.checked(false, ticket) }; onlyTicket()
        cancelFuture { org.leanbridge.depot.Api.checked(true, ticket) }; onlyTicket()
        for (stepError in listOf(false, true)) {
            cancelStream(org.leanbridge.depot.Api.tickets(ticket, stepError), stepError); onlyTicket()
        }
        // This typed exception is thrown by application callback code, not newly
        // created as the task's native error. Its original lease remains ours.
        val mine = try { Depot.checked(true, ticket); error("expected EIO") } catch (e: CheckedError) { e }
        mine.payload().use { owned ->
            cancelFuture { org.leanbridge.depot.Api.revisit(ticket) { throw mine } }
            check(!owned.isClosed && owned.sameResource(ticket))
        }
        onlyTicket()
    }
    Installed.drain(base)
    println("Kotlin: suspend, first and typed failure; prompt cancellation disposes unpublished success and error, preserves caller-owned callback errors; zero leaked leases or files")
}
