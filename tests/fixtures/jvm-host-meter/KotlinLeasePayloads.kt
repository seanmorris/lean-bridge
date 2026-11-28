import org.leanbridge.workshop.RejectBoxError
import org.leanbridge.workshop.Result
import org.leanbridge.workshop.kotlin.Api

fun main() {
    LeasePayloads.run()
    val meter = Meter(37)
    val saved: RejectBoxError = Api.bindHosts(Meter::class).use { api ->
        val answer: Result<Meter,Meter> = api.chooseBox(meter,false)
        check(answer is Result.Err && answer.error() === meter)
        try { api.rejectBox(meter); error("expected RejectBoxError") }
        catch (e: RejectBoxError) { e }
    }
    val original: Meter = saved.payload(Meter::class.java)
    check(original === meter && original.read() == 37L)
    println("Java and Kotlin: typed leased values and declared errors retain identity after close")
}
