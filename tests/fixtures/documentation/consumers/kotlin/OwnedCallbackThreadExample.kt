import java.lang.ref.Reference
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicReference
import org.leanbridge.owned_aggregates.kotlin.*

fun main() {
    val held = AtomicReference<Array<Value<*>>>()
    val failure = AtomicReference<Throwable>()
    val worker = Thread {
        try {
            val seed = Api.newTicket(BigInteger.valueOf(42), "callback-thread")
            val input = Bundle(seed.get(), Option.none(), emptyArray(), emptyArray(),
                Payload(BigInteger.ZERO, byteArrayOf()))
            val original = Api.echoRecord(input)
            val closureOwner = Api.makeRecordCallback(input)
            val borrowed = closureOwner.get().invoke(original)
            val descendant = closureOwner.get().invoke(borrowed)
            val independent = descendant.retain()
            held.set(arrayOf(seed, original, closureOwner, borrowed, descendant, independent))
        } catch (error: Throwable) { failure.set(error) }
    }
    worker.start(); worker.join(10000)
    check(!worker.isAlive)
    failure.get()?.let { throw AssertionError(it) }
    val owners = held.get()
    val deadline = System.nanoTime() + 5_000_000_000L
    while (owners.any { !it.isClosed } && System.nanoTime() < deadline) Thread.sleep(5)
    for (owner in owners) {
        check(owner.isClosed)
        try {
            owner.get()
            error("Dead-thread owner was accepted")
        } catch (error: LeanBridgeException) {
            check(error.status() == 4)
        }
    }
    Reference.reachabilityFence(owners); Reference.reachabilityFence(worker)
    println("callback-thread-owners-closed")
}
