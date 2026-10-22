import java.math.BigInteger
import org.leanbridge.owned_checked_records_result_only.kotlin.Api

fun main() {
    var checks = 0
    Api.newTicket(BigInteger.valueOf(17), "result-only").use { ticket ->
        check(Api.serial(ticket) == BigInteger.valueOf(17)); checks++
        val claim = Api.claimFor(ticket)
        check(claim.isSome() && claim.value().quota == BigInteger.ZERO); checks++
        check(Api.serial(claim.value().holder) == BigInteger.valueOf(17)); checks++
        claim.value().holder.close(); checks++
    }
    println("owned-checked-record-result-only-kotlin:$checks")
}
