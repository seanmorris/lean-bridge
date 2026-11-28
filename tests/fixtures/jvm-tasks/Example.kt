import java.math.BigInteger
import kotlinx.coroutines.flow.count
import kotlinx.coroutines.runBlocking
import org.leanbridge.timers.kotlin.Api

fun main() = runBlocking {
    println(Api.immediate(BigInteger.valueOf(41)))
    println(Api.units(BigInteger.TWO).count())
}
