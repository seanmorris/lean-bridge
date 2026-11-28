import org.leanbridge.journal.kotlin.Api
import org.leanbridge.journal.ChooseError
import org.leanbridge.journal.Result

fun main(args: Array<String>) {
    Api.store(args[0], "ready")
    println(Api.read(args[0]))
    try {
        Api.choose(true, false, "unused")
    } catch (e: ChooseError) {
        val payload: Result<String, Long> = e.payload()
        if (payload is Result.Err) println(payload.error())
    }
}
