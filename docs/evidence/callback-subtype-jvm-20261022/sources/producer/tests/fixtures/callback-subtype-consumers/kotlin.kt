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
private fun refusesInput(operation: () -> Unit) =
    reject<IllegalArgumentException>(operation).message == "Invalid native copied input"
private fun refusesResult(operation: () -> Unit): Boolean {
    val error = reject<LeanBridgeException>(operation)
    return error.status() == 1 && error.message == "Host callback result failed its Lean constructor"
}

fun main() {
    val increment = FnNatToNatHost { value -> calls++; value + BigInteger.ONE }
    check(Api.callHost(WithRecovery(increment, BigInteger.ONE)) == n(2), "valid host result")
    val before = calls
    check(refusesInput { Api.callHost(WithRecovery(increment, BigInteger.ZERO)) }, "invalid recovery status")
    check(calls == before, "invalid recovery stops callback")
    check(refusesResult {
        Api.callHost(WithRecovery(FnNatToNatHost { BigInteger.ZERO }, BigInteger.ONE))
    }, "invalid host result status")
    val sentinel = IllegalStateException("callback failed")
    check(reject<IllegalStateException> {
        Api.callHost(WithRecovery(FnNatToNatHost { throw sentinel }, BigInteger.ONE))
    } === sentinel, "callback exception identity")
    check(Api.callHost(WithRecovery(FnNatToNatHost { it }, BigInteger.ONE)) == BigInteger.ONE, "host recovery reuse")
    check(Api.callHostMixed(WithRecovery(FnNatNatToNatHost { marker, value -> marker - n(5) + value }, BigInteger.ONE)) == n(3), "mixed host result")

    Api.makeClosure(n(9)).use { closure ->
        check(closure.invoke(n(2)) == n(2), "closure result")
        check(refusesInput { closure.invoke(BigInteger.ZERO) }, "closure argument status")
        check(closure.invoke(n(3)) == n(3), "closure recovery")
        closure.close(); closure.close()
        check(closure.isClosed, "closure closes idempotently")
    }
    Api.makeMixedClosure(BigInteger.ZERO).use { mixed ->
        check(mixed.invoke(n(9), n(2)) == n(2), "mixed closure result")
        check(refusesInput { mixed.invoke(n(9), BigInteger.ZERO) }, "mixed closure argument status")
        check(mixed.invoke(n(9), n(3)) == n(3), "mixed closure recovery")
    }
    println("callback-subtype-remaining-ok:$checks")
}
