import org.leanbridge.journal.kotlin.Api
import org.leanbridge.journal.Result

fun invalid() {
    Api.rtString(null)
    val wrong: Result<Int, Long> = Api.choose(false, true, "x")
    println(wrong)
}
