import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.*

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "callback-reply").use { seed ->
        val input = Bundle(seed.get(), Option.none(), emptyArray(), emptyArray(),
            Payload(BigInteger.ZERO, byteArrayOf()))
        Api.echoRecord(input).use { replyOwner ->
            Api.callbackRecord(input, ApplyTwiceArgument1ClosureCallback {
                CallbackResult.value(it)
            }).use { raw ->
                Api.callbackRecord(input, ApplyTwiceArgument1ClosureCallback {
                    CallbackResult.owner(replyOwner)
                }).use { whole ->
                    replyOwner.close()
                    check(Api.serial(raw.get().primary).intValueExact() == 42)
                    check(Api.serial(whole.get().primary).intValueExact() == 42)
                }
            }
        }
    }
    println("callback-replies-copied")
}
