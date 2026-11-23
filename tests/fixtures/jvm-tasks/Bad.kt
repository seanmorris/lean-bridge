import org.leanbridge.timers.kotlin.Api
import kotlinx.coroutines.flow.Flow
import java.math.BigInteger
fun invalid() {
    Api.compute("not in coroutine")
    val wrong: Flow<String> = Api.units(BigInteger.ONE)
}
