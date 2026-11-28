import java.nio.file.Files
import java.nio.file.Path
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.runBlocking
import org.leanbridge.workshop.kotlin.Api

fun main() = runBlocking {
    val path = Path.of("state")
    Api.bindHosts(EffectClient.Box::class).use { a ->
        check(a.read(EffectClient.Box(41)) == 41L && a.readBoot() == "from-app")
        Files.writeString(path, "open")
        check(a.observe(path.toString()) == 37L && Api.worker(path.toString()) == 37L)
        val stream: Flow<Long> = Api.walk(path.toString())
        var count = 0
        stream.take(2).collect { item ->
            if (++count == 1) {
                check(item == 37L); Files.writeString(path, "changed")
            } else {
                check(item == 0L && Files.readString(path) == "changed")
            }
        }
        check(count == 2); EffectClient.awaitClose(path)
    }
    println("Kotlin suspend, Flow demand and early finalization passed")
}
