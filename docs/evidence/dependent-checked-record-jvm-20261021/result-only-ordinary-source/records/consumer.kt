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
    check(("dependentTotal" in exported) == full, "dependentTotal export selection")
    check(("dependentRoundtrip" in exported) == full, "dependentRoundtrip export selection")
    check("dependentResult" in exported, "dependentResult export selection")

    for (index in 0 until 512) produced(n(index.toLong()), "result $index")
    val huge = BigInteger.ONE.shiftLeft(130)
    produced(huge, "huge result")
    var totals = intArrayOf(calls, checks, recoveries, rejections, snapshots)
    var expected = intArrayOf(513, 516, 0, 0, 513)


    if (!totals.contentEquals(expected))
        throw IllegalStateException("dependent-record exact caller totals: "
            + totals.contentToString() + " != " + expected.contentToString())
}
