import org.leanbridge.workshop.kotlin.Api
import org.leanbridge.workshop_peer.kotlin.Api as Peer

class Meter(var level: Long) {
    fun read(): Long = level
    fun identity(): Meter = this
}

fun main(args: Array<String>) {
    val early = if (args.single() == "peer-first") Peer.bindHosts(Consumer.Box::class) else null
    Api.bindHosts(Consumer.Box::class).use { a ->
        (early ?: Peer.bindHosts(Consumer.Box::class)).use { b ->
            val x: Consumer.Box = a.make(11)
            check(b.identity(x) === x)
            check(b.update(x, 19) == 19L && a.read(x) == 19L)
            b.keep(x)
            check(a.identity(b.held()) === x)
            b.forget()
        }
    }
    Api.bindHosts(Meter::class).use { api ->
        val meter: Meter = api.make(21)
        api.update(meter, 34)
        check(api.identity(meter) === meter && meter.level == 34L)
    }
    Api.bindHosts(Consumer.Box::class).use { a ->
        Peer.bindHosts(Consumer.Box::class).use { b -> verifyKotlinErrors(a, b) }
    }
    println("Kotlin: last-owner error updated to 42 and collected; validation, original and mapped errors, retirement")
}
