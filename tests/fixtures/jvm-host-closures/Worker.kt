import kotlinx.coroutines.runBlocking
import org.leanbridge.workshop.kotlin.Api

fun main(args: Array<String>) = runBlocking {
    check(args.single() == "normal")
    Api.bindHosts(Installed.Box::class).use { a ->
        val x=a.make(4); val y=a.make(7)
        a.remember(x).use { f -> check(a.relay(y, f::invoke) === x) }
    }
    println("ok WorkerKt normal")
}
