// Installed Kotlin acceptance for directional callback checked records.
import java.math.BigInteger
import org.leanbridge.callbackcheckedrecords.*
import org.leanbridge.callbackcheckedrecords.kotlin.Api
import org.leanbridge.callbackcheckedrecords.kotlin.Interval
import org.leanbridge.callbackcheckedrecords.kotlin.Option
import org.leanbridge.callbackcheckedrecords.kotlin.Result
import org.leanbridge.callbackcheckedrecords.kotlin.Weighted

private var checks = 0
private var calls = 0
private fun n(value: Long) = BigInteger.valueOf(value)
private fun interval(lo: Long, hi: Long) = Interval(n(lo), n(hi))
private fun weighted(weight: Long, limit: Long) = Weighted(n(weight), n(limit))
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
    val widen = KotlinFnCallback96775311ba874014bff2 { value ->
        calls++
        if (value != interval(1, 3)) error("proof-free host argument")
        interval(1, 4)
    }
    check(Api.callHost(WithRecovery(widen, interval(1, 3))) == n(3), "valid host reply")
    var before = calls
    check(refusesInput {
        Api.callHost(WithRecovery(widen, interval(3, 1)))
    }, "invalid recovery status")
    check(calls == before, "invalid recovery stops callback")
    check(refusesResult {
        Api.callHost(WithRecovery(KotlinFnCallback96775311ba874014bff2 { interval(5, 2) }, interval(1, 3)))
    }, "invalid host reply status")
    check(calls == before, "invalid reply does not use counted callback")
    check(Api.callHost(WithRecovery(widen, interval(1, 3))) == n(3), "host recovery reuse")
    val sentinel = IllegalStateException("callback failed")
    check(reject<IllegalStateException> {
        Api.callHost(WithRecovery(KotlinFnCallback96775311ba874014bff2 { throw sentinel }, interval(1, 3)))
    } === sentinel, "callback exception identity")
    check(Api.callHostMixed(WithRecovery(KotlinFnCallback44d43ec6a49b0f13f8ab { marker, value ->
        Interval(value.lo, value.hi + marker - n(5))
    }, interval(1, 3))) == n(4), "mixed host reply")

    Api.makeClosure(n(9)).use { closure ->
        check(closure.invoke(interval(2, 5)) == n(3), "closure result")
        check(refusesInput { closure.invoke(interval(5, 2)) },
            "closure argument status")
        check(closure.invoke(interval(3, 3)) == BigInteger.ZERO, "closure recovery")
        closure.close(); closure.close()
        check(closure.isClosed, "closure closes idempotently")
    }
    Api.makeMixedClosure(BigInteger.ZERO).use { mixed ->
        check(mixed.invoke(n(9), interval(2, 5)) == interval(2, 5), "mixed closure result")
        check(refusesInput { mixed.invoke(n(9), interval(5, 2)) },
            "mixed closure argument status")
        check(mixed.invoke(n(9), interval(3, 4)) == interval(3, 4), "mixed closure recovery")
    }

    val none = Option.none<Interval>()
    val containerRecovery = Result.ok<Option<Interval>, String>(none)
    check(Api.callHostContainer(WithRecovery(KotlinFnCallback115f6922f8f3e5b91c8e {
        Result.ok<Option<Interval>, String>(Option.some(interval(1, 4)))
    }, containerRecovery)) == n(3), "container host reply")
    check(refusesResult {
        Api.callHostContainer(WithRecovery(KotlinFnCallback115f6922f8f3e5b91c8e {
            Result.ok<Option<Interval>, String>(Option.some(interval(4, 1)))
        }, containerRecovery))
    }, "container host reply status")
    Api.makeContainerClosure(BigInteger.ZERO).use { container ->
        check(!container.invoke(arrayOf(none, Option.some(interval(2, 5)))).isSome(),
            "container closure result")
        check(refusesInput {
            container.invoke(arrayOf(Option.some(interval(5, 2))))
        }, "container closure argument status")
        check(!container.invoke(emptyArray()).isSome(), "container closure recovery")
    }

    var reply = weighted(2, 5)
    val reweigh = KotlinFnCallbackb782f62c1be9d8b0085a { value ->
        calls++
        if (value != weighted(1, 2)) error("proof-free weighted argument")
        reply
    }
    check(Api.callHostNested(WithRecovery(reweigh, weighted(1, 2))) == n(3), "weighted host reply")
    reply = weighted(0, 5)
    check(refusesResult {
        Api.callHostNested(WithRecovery(reweigh, weighted(1, 2)))
    }, "zero weight status")
    reply = weighted(6, 5)
    check(refusesResult {
        Api.callHostNested(WithRecovery(reweigh, weighted(1, 2)))
    }, "weight above limit status")
    before = calls
    check(refusesInput {
        Api.callHostNested(WithRecovery(reweigh, weighted(0, 2)))
    }, "invalid weighted recovery status")
    check(calls == before, "invalid weighted recovery stops callback")
    reply = weighted(2, 5)
    check(Api.callHostNested(WithRecovery(reweigh, weighted(1, 2))) == n(3), "weighted host recovery")
    Api.makeNestedClosure(BigInteger.ZERO).use { nested ->
        check(nested.invoke(weighted(2, 5)) == n(3), "weighted closure result")
        check(refusesInput { nested.invoke(weighted(0, 5)) },
            "weighted closure zero status")
        check(refusesInput { nested.invoke(weighted(6, 5)) },
            "weighted closure bound status")
        check(nested.invoke(weighted(5, 5)) == BigInteger.ZERO, "weighted closure recovery")
    }
    println("callback-checked-record-remaining-ok:$checks")
}
