// Independent Kotlin caller for proof-erased checked records with value indices.
import java.lang.reflect.InvocationTargetException
import java.math.BigInteger
import org.leanbridge.checkedrecordvalueindices.kotlin.*

private var checks = 0
private var calls = 0
private var rejections = 0
private var recoveries = 0
private const val PREFIX = "ROUTE_PREFIX"

private fun n(value: Long) = BigInteger.valueOf(value)
private fun huge() = BigInteger.ONE.shiftLeft(128) + BigInteger.ONE

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("failed: $label")
    checks++
}

// BEGIN FULL_ONLY
private fun rejected(constructor: String) =
    "$PREFIX was rejected by CheckedRecordValueIndices.$constructor"

private fun refused(call: () -> Unit, expected: String): Boolean {
    calls++
    try { call() }
    catch (error: IllegalArgumentException) {
        return error::class.java == IllegalArgumentException::class.java
            && error.message == expected
    }
    return false
}

private fun shapeRefused(call: () -> Unit): Boolean {
    calls++
    try { call() }
    catch (error: IllegalArgumentException) {
        return error::class.java == IllegalArgumentException::class.java
            && error.message == "Nat cannot be negative"
    }
    return false
}

private fun nullRefused(): Boolean {
    calls++
    try {
        Api::class.java.getMethod("trueBoolIndex", On::class.java).invoke(null, null)
    } catch (error: InvocationTargetException) {
        val cause = error.cause
        // Kotlin inserts its own non-null parameter guard before the bridge.
        // Its diagnostic text is runtime-version detail; the exact NPE is the
        // stable host-boundary behavior being checked here.
        return cause?.javaClass == NullPointerException::class.java
    }
    return false
}

private fun recover(): Boolean {
    val value = ZeroToken(n(99))
    calls++
    if (Api.zeroNatIndex(value) != n(99) || value.count != n(99)) return false
    recoveries++
    return true
}
// END FULL_ONLY

fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty()) throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"calls\":$calls,\"checks\":$checks,\"recoveries\":$recoveries,"
        + "\"rejections\":$rejections}")
}

private fun runChecks() {
    val huge = huge()
    // BEGIN FULL_ONLY
    val on = On(n(0))
    val off = Off(n(1))
    val ab = Ab(n(2))
    val empty = EmptyToken(n(9))
    val unicode = UnicodeToken(n(10))
    val sized = EmptySized(emptyArray())
    val zero = ZeroToken(n(11))
    val wide = WideToken(huge)
    calls++; check(Api.trueBoolIndex(on) == n(0) && on.count == n(0), "true Bool index")
    calls++; check(Api.falseBoolIndex(off) == n(1) && off.count == n(1), "false Bool index")
    calls++; check(Api.abStringIndex(ab) == n(2) && ab.size == n(2), "String index")
    calls++; check(Api.emptyStringIndex(empty) == n(9) && empty.count == n(9), "empty String index")
    calls++; check(Api.unicodeStringIndex(unicode) == n(10) && unicode.count == n(10), "Unicode String index")
    calls++; check(Api.emptySizedIndex(sized) == n(0) && sized.data.isEmpty(), "zero Nat index")
    calls++; check(Api.zeroNatIndex(zero) == n(11) && zero.count == n(11), "zero Token index")
    calls++; check(Api.wideNatIndex(wide) == huge && wide.count == huge
        && zero::class.java != wide::class.java, "129-bit Nat index keeps nominal identity")

    val invalidAb = Ab(n(1))
    check(refused({ Api.abStringIndex(invalidAb) }, rejected("mkAb"))
        && invalidAb.size == n(1), "String-index refusal preserves input")
    rejections++; check(recover(), "recover after String-index refusal")
    val invalidSized = EmptySized(arrayOf(n(1)))
    check(refused({ Api.emptySizedIndex(invalidSized) }, rejected("mkEmptySized"))
        && invalidSized.data.size == 1 && invalidSized.data[0] == n(1),
        "Nat-index refusal preserves array input")
    rejections++; check(recover(), "recover after Nat-index refusal")
    val invalidOn = On(n(1))
    check(refused({ Api.trueBoolIndex(invalidOn) }, rejected("mkOn"))
        && invalidOn.count == n(1), "true-index refusal preserves input")
    rejections++; check(recover(), "recover after true-index refusal")
    val invalidOff = Off(n(0))
    check(refused({ Api.falseBoolIndex(invalidOff) }, rejected("mkOff"))
        && invalidOff.count == n(0), "false-index refusal preserves input")
    rejections++; check(recover(), "recover after false-index refusal")
    val negativeOn = On(n(-1))
    check(shapeRefused { Api.trueBoolIndex(negativeOn) }
        && negativeOn.count == n(-1), "negative Nat field preserves input")
    rejections++; check(recover(), "recover after first shape refusal")
    val invalidZero = ZeroToken(n(-1))
    check(shapeRefused { Api.zeroNatIndex(invalidZero) }
        && invalidZero.count == n(-1), "negative Token field preserves input")
    rejections++; check(recover(), "recover after second shape refusal")
    check(nullRefused(), "null checked-record input is refused by the host boundary")
    rejections++; check(recover(), "recover after null host refusal")
    // END FULL_ONLY

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
