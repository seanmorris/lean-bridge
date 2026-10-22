// Independent Kotlin caller for proof-erased dependent checked records.
import java.lang.reflect.Modifier
import java.math.BigInteger
import org.leanbridge.dependentrecords.kotlin.*

private var checks = 0
private var calls = 0
private var rejections = 0
private var recoveries = 0
private var snapshots = 0
private const val PREFIX = "arg0"

private fun n(value: Long): BigInteger = BigInteger.valueOf(value)

private fun check(condition: Boolean, label: String) {
    if (!condition) throw IllegalStateException("dependent-record assertion failed: $label")
    checks++
}

private fun record(bound: BigInteger, below: BigInteger) = Dependent(bound, below)

private fun snapshot(value: Dependent) = "${value.bound}/${value.below}"

private fun produced(seed: BigInteger, label: String) {
    calls++
    val value = Api.dependentResult(seed)
    check(snapshot(value) == snapshot(record(seed + BigInteger.ONE, seed)), "$label exact result")
    snapshots++
}

private fun total(value: Dependent, expected: BigInteger, label: String): BigInteger {
    val before = snapshot(value)
    calls++
    val actual = Api.dependentTotal(value)
    check(actual == expected, "$label exact result")
    check(snapshot(value) == before, "$label preserves caller input")
    snapshots++
    return actual
}

private fun roundtrip(value: Dependent, label: String): Dependent {
    val before = snapshot(value)
    calls++
    val actual = Api.dependentRoundtrip(value)
    check(snapshot(actual) == before && actual == value, "$label exact result")
    check(snapshot(value) == before, "$label preserves caller input")
    snapshots++
    return actual
}

private fun refuse(value: Dependent, label: String) {
    val before = snapshot(value)
    calls++
    var refused = false
    try { Api.dependentTotal(value) }
    catch (error: IllegalArgumentException) {
        check(error::class.java == IllegalArgumentException::class.java
            && error.message == "$PREFIX was rejected by DependentRecords.mkDependent"
            , "$label exact checked-record refusal")
        check(true, "$label refuses invalid input")
        refused = true
    }
    if (!refused) throw IllegalStateException("Accepted invalid dependent record: $label")
    check(snapshot(value) == before, "$label preserves rejected input")
    rejections++
    snapshots++
}

private fun recover() {
    total(record(n(2), n(1)), n(3), "recovery")
    recoveries++
}

fun main(arguments: Array<String>) {
    if (arguments.isNotEmpty())
        throw IllegalStateException("Unexpected caller arguments")
    runChecks()
    println("{\"calls\":$calls,\"checks\":$checks,\"recoveries\":$recoveries,"
        + "\"rejections\":$rejections,\"snapshots\":$snapshots}")
}

private fun runChecks() {
    val exported = Api::class.java.declaredMethods
        .filter { Modifier.isPublic(it.modifiers) }.map { it.name }.toSet()
    var full = false
    full = true
    check(("dependentTotal" in exported) == full, "dependentTotal export selection")
    check(("dependentRoundtrip" in exported) == full, "dependentRoundtrip export selection")
    check("dependentResult" in exported, "dependentResult export selection")

    for (index in 0 until 512) produced(n(index.toLong()), "result $index")
    val huge = BigInteger.ONE.shiftLeft(130)
    produced(huge, "huge result")
    var totals = intArrayOf(calls, checks, recoveries, rejections, snapshots)
    var expected = intArrayOf(513, 516, 0, 0, 513)

    total(record(n(3), n(2)), n(5), "valid total")
    refuse(record(n(2), n(2)), "equal fields")
    recover()
    refuse(record(n(0), n(0)), "zero bound")
    recover()
    val valid = record(n(3), n(2))
    roundtrip(valid, "roundtrip")
    val below = huge - BigInteger.ONE
    total(record(huge, below), huge + below, "huge total")
    val hugeRecord = record(huge, below)
    roundtrip(hugeRecord, "huge roundtrip")
    for (index in 0 until 256) {
        val bound = n(index + 1L)
        total(record(bound, n(index.toLong())), n(2L * index + 1), "loop total $index")
        refuse(record(bound, bound), "loop refusal $index")
        recover()
    }
    totals = intArrayOf(calls, checks, recoveries, rejections, snapshots)
    expected = intArrayOf(1289, 2326, 258, 258, 1289)

    if (!totals.contentEquals(expected))
        throw IllegalStateException("dependent-record exact caller totals: "
            + totals.contentToString() + " != " + expected.contentToString())
}
