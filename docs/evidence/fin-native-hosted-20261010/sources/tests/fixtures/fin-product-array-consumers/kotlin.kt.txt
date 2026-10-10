import java.math.BigInteger
import org.leanbridge.finproductarrays.Api
import org.leanbridge.finproductarrays.Pair
import org.leanbridge.finproductarrays.Result

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
private fun rejected(parameter: String, bound: String, action: () -> Any?): Boolean =
    try { action(); false }
    catch (error: IllegalArgumentException) { error.message == parameter + " is not below its Fin " + bound + " bound" }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private val huge = BigInteger.ONE.shiftLeft(100)
// (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
private fun valid(): Array<Pair<BigInteger, Result<BigInteger, BigInteger>>> = arrayOf(Pair(n(0), Result.ok(huge))
    , Pair(n(2), Result.err(n(5))), Pair(n(3), Result.ok(n(6))))

fun main() {
    val expected = huge.add(n(1016))
    // An empty array is valid, in and out.
    check(Api.rows(arrayOf()) == n(0), "empty rows")
    check(Api.reversed(arrayOf()).isEmpty(), "empty reversed")
    val rows = valid()
    check(Api.rows(rows) == expected, "valid rows")
    // A component at its bound is rejected in the first, middle and last element.
    for (k in 0 until 3) {
        rows[k] = Pair(n(4), rows[k].second())
        val before = rows.copyOf()
        check(rejected("arg0", "4") { Api.rows(rows) } && rows.contentEquals(before), "component at $k")
        rows[k] = valid()[k]
    }
    // The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
    rows[1] = Pair(n(2), Result.err(n(6)))
    val before = rows.copyOf()
    check(rejected("arg0", "6") { Api.rows(rows) } && rows.contentEquals(before), "error branch at bound")
    rows[1] = valid()[1]
    // A valid call recovers.
    check(rows.contentEquals(valid()), "caller rows unchanged")
    check(Api.rows(rows) == expected, "recovery")
    // Lean returns the rows reversed, each below its bounds.
    check(Api.reversed(rows).contentEquals(valid().reversedArray()), "reversed")
    for (i in 0L until 1000L) {
        check(Api.rows(rows) == expected, "round")
        val bad = valid(); bad[2] = Pair(n(4 + i), bad[2].second())
        check(rejected("arg0", "4") { Api.rows(bad) } && bad[2].first() == n(4 + i), "rejection round")
    }
    println("fin-product-array-ok:$checks")
}
