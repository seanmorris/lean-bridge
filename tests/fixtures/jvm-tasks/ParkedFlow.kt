import java.math.BigInteger
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import org.leanbridge.timers.kotlin.Api
import org.leanbridge.alarm.kotlin.Api as Alarm

fun main(args: Array<String>) = runBlocking {
    withTimeout(45_000) {
        if (args.single() == "peer-first") Alarm.reset()
        Api.reset(); Alarm.reset()
        check(Api.later(BigInteger.ONE) == BigInteger.valueOf(3)); Observe.drained()
        val fds = Observe.descriptors()
        for (cooperative in listOf(false, true)) {
            Api.reset()
            val one = BigInteger.ONE; val pulls = Api.pulls(); val closes = Api.closes()
            var items = 0; var normalEnd = false; var caught: CancellationException? = null
            val reader = launch(start = CoroutineStart.UNDISPATCHED) {
                try {
                    Api.series(BigInteger.ZERO, one, BigInteger.TEN, true, cooperative, false, "late").collect { ++items }
                    normalEnd = true
                } catch (e: CancellationException) { caught = e; throw e }
            }
            while (Api.state() != 1L) delay(5)
            check(reader.isActive && items == 0 && Api.pulls() == pulls + one && Api.closes() == closes)
            reader.cancel(CancellationException("application stopped collecting")); reader.join()
            check(reader.isCancelled && caught?.message == "application stopped collecting" && !normalEnd)
            check(Api.closes() == closes + one && items == 0)
            if (cooperative) {
                while (Api.state() != 2L) delay(5)
            } else {
                check(Api.state() == 1L && Alarm.owner().isNotEmpty())
                Api.release(); while (Api.state() != 3L) delay(5)
            }
            Observe.drained()
            check(items == 0 && !normalEnd && Api.closes() == closes + one && Api.pulls() == pulls + one)
        }
        Observe.until { Observe.descriptors() == fds }; check(Observe.snapshot()[3] == 0)
    }
    println("Kotlin " + args.single() + ": collecting job cancelled once, close before late worker, no emissions, zero live owners and descriptor delta")
}
