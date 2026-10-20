// Installed Kotlin acceptance for directional callback Subtypes.
import java.math.BigInteger
import org.leanbridge.callbacksubtypes.FnNatNatToNatHost
import org.leanbridge.callbacksubtypes.FnNatToNatHost
import org.leanbridge.callbacksubtypes.LeanBridgeException
import org.leanbridge.callbacksubtypes.WithRecovery
import org.leanbridge.callbacksubtypes.kotlin.Api

private var checks = 0
private var calls = 0
private fun n(value: Long) = BigInteger.valueOf(value)
private fun check(value: Boolean, label: String) {
    if (!value) error(label)
    checks++
}
private inline fun <reified T : Throwable> reject(operation: () -> Unit): T {
    try { operation() } catch (error: Throwable) {
        if (error is T) return error
        throw error
    }
    error("expected ${T::class.java.name}")
}

fun main() {
    val increment = FnNatToNatHost { value -> calls++; value + BigInteger.ONE }
    check(Api.callHost(WithRecovery(increment, BigInteger.ONE)) == n(2), "valid host result")
    val before = calls
    val recovery = reject<LeanBridgeException> { Api.callHost(WithRecovery(increment, BigInteger.ZERO)) }
    check(recovery.status() == 1, "invalid recovery status")
    check(calls == before, "invalid recovery stops callback")
    val result = reject<LeanBridgeException> {
        Api.callHost(WithRecovery(FnNatToNatHost { BigInteger.ZERO }, BigInteger.ONE))
    }
    check(result.status() == 1, "invalid host result status")
    val sentinel = IllegalStateException("callback failed")
    check(reject<IllegalStateException> {
        Api.callHost(WithRecovery(FnNatToNatHost { throw sentinel }, BigInteger.ONE))
    } === sentinel, "callback exception identity")
    check(Api.callHost(WithRecovery(FnNatToNatHost { it }, BigInteger.ONE)) == BigInteger.ONE, "host recovery reuse")
    check(Api.callHostMixed(WithRecovery(FnNatNatToNatHost { marker, value -> marker - n(5) + value }, BigInteger.ONE)) == n(3), "mixed host result")

    Api.makeClosure(n(9)).use { closure ->
        check(closure.invoke(n(2)) == n(2), "closure result")
        check(reject<LeanBridgeException> { closure.invoke(BigInteger.ZERO) }.status() == 1, "closure argument status")
        check(closure.invoke(n(3)) == n(3), "closure recovery")
        closure.close(); closure.close()
        check(closure.isClosed, "closure closes idempotently")
    }
    Api.makeMixedClosure(BigInteger.ZERO).use { mixed ->
        check(mixed.invoke(n(9), n(2)) == n(2), "mixed closure result")
        check(reject<LeanBridgeException> { mixed.invoke(n(9), BigInteger.ZERO) }.status() == 1, "mixed closure argument status")
        check(mixed.invoke(n(9), n(3)) == n(3), "mixed closure recovery")
    }
    println("callback-subtype-remaining-ok:$checks")
}
