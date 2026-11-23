import kotlinx.coroutines.runBlocking
import org.leanbridge.feedback.kotlin.Api

fun main() = runBlocking {
    val answer: Long = Api.once(40L) { n -> n + 2 }
    println(answer)
}
