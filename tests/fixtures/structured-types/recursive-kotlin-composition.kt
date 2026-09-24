import org.leanbridge.graph_one.kotlin.Api as One
import org.leanbridge.graph_one.kotlin.Parcel
import org.leanbridge.graph_one.kotlin.VDone
import org.leanbridge.graph_one.kotlin.VNext
import org.leanbridge.graph_two.kotlin.Api as Two
import org.leanbridge.graph_two.kotlin.Parcel as ParcelTwo
import org.leanbridge.graph_two.kotlin.VDone as DoneTwo
import org.leanbridge.graph_two.kotlin.VNext as NextTwo
import org.leanbridge.graph_peer.kotlin.Api as Peer

fun main(args: Array<String>) {
    val first = Parcel(VNext(VDone(41)))
    val second = ParcelTwo(NextTwo(DoneTwo(43)))
    if (args[0] == "peer-first") check(Peer.value() == 42L)
    val retained = One.echo(first)
    check(retained == first); check(retained !== first)
    check(Two.echo(second) == second); check(Peer.value() == 42L)
    java.util.concurrent.Executors.newFixedThreadPool(4).use { pool ->
        val futures = (0 until 64).map {
            pool.submit {
                check(One.echo(first) == first)
                check(Two.echo(second) == second)
                check(Peer.value() == 42L)
            }
        }
        futures.forEach { it.get() }
    }
    Loading.snapshot("graph_one", 3)
    Loading.retire("graph_one")
    Loading.unavailable { One.echo(first) }
    Loading.unavailable { Two.echo(second) }
    Loading.unavailable { Peer.value() }
    check(retained == first); check(((retained.node as VNext).value as VDone).value == 41L)
    Loading.finish("kotlin-" + args[0])
}
