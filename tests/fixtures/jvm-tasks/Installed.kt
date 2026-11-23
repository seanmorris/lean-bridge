import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.math.BigInteger
import org.leanbridge.timers.Result
import org.leanbridge.timers.kotlin.Api
import org.leanbridge.alarm.kotlin.Api as Alarm

private val zero = BigInteger.ZERO
private val one = BigInteger.ONE

fun main(args: Array<String>) = runBlocking {
    withTimeout(45_000) {
        if (args.single() == "peer-first") Alarm.reset()
        val exact: BigInteger = Api.immediate(one.shiftLeft(300))
        check(exact == one.shiftLeft(300) + one && Api.compute("λ") == "λ!")
        check(Api.owner().substringBefore(' ') == Alarm.owner().substringBefore(' '))
        val data: Result<BigInteger, String> = Api.startChecked(false, true, "data")
        check(data == Result.Err<BigInteger, String>("data"))
        try { Api.startChecked(true, false, "factory"); error("accepted factory error") }
        catch (e: org.leanbridge.timers.StartCheckedError) { val text: String = e.payload(); check(text == "factory") }
        try { Api.finalIo(true); error("lost terminal IO error") }
        catch (e: org.leanbridge.timers.TaskIOException) { check(e.declaration() == "Timers.finalIO") }
        Api.reset()
        val job = launch(start = CoroutineStart.UNDISPATCHED) { Api.openTask(true, "cancel"); error("cancelled coroutine resumed normally") }
        while (Api.state() != 1L) delay(5)
        job.cancelAndJoin(); while (Api.state() != 2L) delay(5)
        val before = Api.pulls(); val closes = Api.closes()
        val numbers: Flow<Result<BigInteger, String>> = Api.series(zero, one + one, BigInteger.TEN, false, true, false, "item")
        check(Api.pulls() == before)
        check(numbers.take(1).single() == Result.Ok<BigInteger, String>(zero))
        check(Api.pulls() == before + one && Api.closes() == closes + one)
        check(numbers.toList() == listOf(Result.Ok<BigInteger, String>(zero), Result.Err<BigInteger, String>("item")))
        val units: Flow<Unit> = Api.units(one); check(units.toList() == listOf(Unit))
        try { Api.series(zero, one, zero, false, true, false, "step").toList(); error("lost step error") }
        catch (e: org.leanbridge.timers.SeriesStepError) { check(e.payload() == "step") }
        Api.reset()
        val collector = launch(start = CoroutineStart.UNDISPATCHED) {
            Api.series(zero, one, one, true, true, false, "held").collect { error("cancelled flow emitted a value") }
        }
        while (Api.state() != 1L) delay(5)
        collector.cancelAndJoin(); while (Api.state() != 2L) delay(5)
        Alarm.reset(); val peer = async(start = CoroutineStart.UNDISPATCHED) { Alarm.wait_(43) }
        check(!peer.isCompleted); Alarm.release(); check(peer.await() == 43L)
    }
    Observe.drained()
    val snapshot = Observe.snapshot()
    check(snapshot.contentEquals(intArrayOf(1,2,2,0)))
    println("Kotlin: cancellable suspend functions, cold Flow, backpressure, early collection exit, typed errors and zero native identities")
    println("""{"runtimeInits":${snapshot[0]},"componentInits":${snapshot[1]},"attached":${snapshot[2]},"live":${snapshot[3]}}""")
}
