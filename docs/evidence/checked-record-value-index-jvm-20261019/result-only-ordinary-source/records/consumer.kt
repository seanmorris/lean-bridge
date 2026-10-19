// Independent Kotlin caller for proof-erased checked records with value indices.
import java.lang.reflect.InvocationTargetException
import java.math.BigInteger
import org.leanbridge.checkedrecordvalueindices.kotlin.*

private var checks = 0
private var calls = 0
private var rejections = 0
private var recoveries = 0
private const val PREFIX = "arg0"

private fun n(value: Long) = BigInteger.valueOf(value)
private fun huge() = BigInteger.ONE.shiftLeft(128) + BigInteger.ONE

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("failed: $label")
    checks++
}


fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"calls\":$calls,\"checks\":$checks,\"recoveries\":$recoveries,"
        + "\"rejections\":$rejections}")
}

private fun runChecks() {
    val huge = huge()

    calls++; check(Api.produceTrueBool().count == n(0), "produce true Bool")
    calls++; check(Api.produceFalseBool().count == n(1), "produce false Bool")
    calls++; check(Api.produceAb().size == n(2), "produce String index")
    var value = n(23)
    calls++; check(Api.produceEmptyString(value).count == value, "produce empty String index")
    value = n(24)
    calls++; check(Api.produceUnicodeString(value).count == value, "produce Unicode String index")
    calls++; check(Api.produceEmptySized().data.isEmpty(), "produce zero-sized record")
    value = n(25)
    calls++; check(Api.produceZeroNat(value).count == value, "produce zero Nat index")
    calls++; check(Api.produceWideNat(huge).count == huge, "produce 129-bit Nat index")
    check(calls == (if (rejections == 0) 8 else 30)
        && recoveries == rejections && (rejections == 0 || rejections == 7),
        "exact totals")
}
