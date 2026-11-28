import org.leanbridge.feedback.kotlin.Api

fun notSuspend() {
    Api.once(3L) { it }
}
suspend fun wrongCallback() {
    Api.once(3L) { "not a UInt32" }
}
