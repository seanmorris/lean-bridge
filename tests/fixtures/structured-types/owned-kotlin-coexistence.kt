import java.math.BigInteger
import org.leanbridge.owned_one.kotlin.Api as One
import org.leanbridge.owned_one.kotlin.Parcel as FirstParcel
import org.leanbridge.owned_two.kotlin.Api as Two
import org.leanbridge.owned_two.kotlin.Parcel as SecondParcel
import org.leanbridge.graph_one.kotlin.Api as Graph
import org.leanbridge.graph_one.kotlin.Parcel as GraphParcel
import org.leanbridge.graph_one.kotlin.VDone
import org.leanbridge.graph_peer.kotlin.Api as Peer

private fun exercise() {
    val huge = BigInteger.ONE.shiftLeft(201) + BigInteger.valueOf(17)
    One.ticket(huge).use { first ->
        val input = FirstParcel(first, byteArrayOf(0, -1, 3))
        val result = One.through(input) { borrowed ->
            check(One.read(borrowed.ticket) == huge)
            Two.ticket(huge).use { second ->
                val peer = SecondParcel(second, byteArrayOf(7, 8))
                val output = Two.through(peer) { value ->
                    val copied = GraphParcel(VDone(41))
                    check(Graph.echo(copied) == copied && Peer.value() == 42L)
                    check(One.read(borrowed.ticket) == huge)
                    check(Two.read(value.ticket) == huge)
                    value
                }
                output.ticket.use {
                    check(Two.read(it) == huge && output.bytes.contentEquals(peer.bytes))
                }
            }
            borrowed
        }
        result.ticket.use {
            check(it !== first && !first.isClosed && One.read(it) == huge)
            check(result.bytes.contentEquals(input.bytes) && result.bytes !== input.bytes)
        }
    }
}
private fun scenario(mode: String) {
    when (mode) {
        "owned-first" -> check(One.value() == 44L)
        "second-owned-first" -> check(Two.value() == 45L)
        "graph-first" -> check(Graph.value() == 41L)
        "peer-first" -> check(Peer.value() == 42L)
        else -> error("Unknown mode")
    }
    exercise()
    java.util.concurrent.Executors.newFixedThreadPool(4).use { pool ->
        val futures = (0 until 64).map { pool.submit { exercise() } }
        futures.forEach { it.get() }
    }
}
fun main(args: Array<String>) {
    val failure = arrayOfNulls<Throwable>(1)
    val creator = Thread {
        try { scenario(args[0]) } catch (error: Throwable) { failure[0] = error }
    }
    creator.start(); creator.join(30000)
    check(!creator.isAlive)
    failure[0]?.let { throw AssertionError("Creator failed", it) }
    val deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(5)
    while (true) {
        try { Loading.snapshot("owned_one", 4); break }
        catch (error: AssertionError) {
            if (System.nanoTime() >= deadline) throw error
            Thread.sleep(10)
        }
    }
    Loading.retire("graph_one")
    Loading.unavailable { One.value() }
    Loading.unavailable { Two.value() }
    Loading.unavailable { Graph.value() }
    Loading.unavailable { Peer.value() }
    Loading.finish("kotlin-" + args[0])
    java.lang.ref.Reference.reachabilityFence(creator)
}
