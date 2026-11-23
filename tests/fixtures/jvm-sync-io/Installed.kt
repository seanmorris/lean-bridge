import java.math.BigInteger
import org.leanbridge.journal.kotlin.Api
import org.leanbridge.journal.ChooseError
import org.leanbridge.journal.LeanIOException
import org.leanbridge.journal.Result
import org.leanbridge.clock.kotlin.Api as Clock

fun main(args: Array<String>) {
    if (args[0] == "peer-first") check(Clock.read() == 71L)
    val original = "λ\u0000🦊"
    val big = BigInteger.ONE.shiftLeft(12000)
    check(Api.rtNat(big) == big && Api.rtInt(-big) == -big)
    val ok: Result<String, Long> = Api.choose(false, true, original)
    check(ok is Result.Ok && ok.value() == original)
    try { Api.choose(true, false, original); error("missing EIO") }
    catch (failed: ChooseError) {
        val payload: Result<String, Long> = failed.payload()
        check(payload is Result.Err && payload.error() == 37L)
    }
    val file = args[1]; Api.store(file, original); check(Api.read(file) == original)
    try { Api.read(file + ".missing"); error("missing IO failure") }
    catch (failed: LeanIOException) { check(failed.declaration() == "Journal.read") }
    check(Api.owner().substringBefore(' ') == Clock.owner().substringBefore(' '))
    check(Api.bump(1) == 1L && Api.count() == 1L)
    println("Kotlin: non-null scalar and result types, typed EIO payload, direct file IO, shared owner")
}
