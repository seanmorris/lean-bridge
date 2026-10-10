import java.math.BigInteger
import org.leanbridge.checkedrecords.kotlin.*
import org.leanbridge.checkedrecords.kotlin.Triple
private var checks = 0
private fun check(value: Boolean) { if (!value) throw AssertionError("checked-record assertion failed"); checks++ }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
// BEGIN CHECKED INPUT HELPERS
private fun rejected(message: String, call: () -> Any?): Boolean =
    try { call(); false } catch (error: IllegalArgumentException) { error.message == message }
// END CHECKED INPUT HELPERS
fun main() {
        val big = BigInteger.ONE.shiftLeft(100)
        // BEGIN CHECKED INPUT CASES
        val good = Interval(n(3), n(10))
        val bad = Interval(n(9), n(3))
        val values = arrayOf<BigInteger>(n(9), n(2), n(4))
        val triple = Triple(values)
        check(Api.width(good) == n(7))
        check(Api.width(Interval(n(1), n(1))) == n(0))
        check(Api.width(Interval(big, big.add(n(9)))) == n(9))
        check(Api.span(good, Interval(n(5), n(20))) == n(17))
        check(rejected("value0 was rejected by CheckedRecords.mkInterval") { Api.width(bad) })
        check(rejected("value0 was rejected by CheckedRecords.mkInterval") { Api.span(bad, good) })
        check(rejected("value1 was rejected by CheckedRecords.mkInterval") { Api.span(good, bad) })
        check(Api.total(triple) == n(15))
        check(Api.firstOf(triple) == n(9))
        check(Api.smallest(triple) == n(2))
        check(triple.data().contentEquals(arrayOf<BigInteger>(n(9), n(2), n(4))) && values.contentEquals(arrayOf<BigInteger>(n(9), n(2), n(4))))
        check(Api.scale(n(3), triple).data().contentEquals(arrayOf<BigInteger>(n(27), n(6), n(12))))
        check(triple.data().contentEquals(arrayOf<BigInteger>(n(9), n(2), n(4))) && values.contentEquals(arrayOf<BigInteger>(n(9), n(2), n(4))))
        check(rejected("value0 was rejected by CheckedRecords.mkTriple") { Api.total(Triple(arrayOf<BigInteger>())) })
        check(rejected("value0 was rejected by CheckedRecords.mkTriple") { Api.firstOf(Triple(arrayOf<BigInteger>(n(1), n(2)))) })
        check(rejected("value0 was rejected by CheckedRecords.sortedTriple") { Api.smallest(Triple(arrayOf<BigInteger>(n(4), n(3), n(2), n(1)))) })
        check(rejected("value1 was rejected by CheckedRecords.mkTriple") { Api.scale(n(3), Triple(arrayOf<BigInteger>(n(1), n(2)))) })
        check(Api.complement(Percent(n(0))) == n(100))
        check(Api.complement(Percent(n(100))) == n(0))
        check(rejected("value0 was rejected by CheckedRecords.mkPercent") { Api.complement(Percent(n(101))) })
        check(rejected("value0 was rejected by CheckedRecords.mkPercent") { Api.complement(Percent(big)) })
        for (i in 0 until 1000) {
            check(rejected("value0 was rejected by CheckedRecords.mkInterval") { Api.width(Interval(n(i.toLong() + 1), n(i.toLong()))) })
            check(Api.width(Interval(n(i.toLong()), n(i.toLong() + 7))) == n(7))
            check(rejected("value0 was rejected by CheckedRecords.mkTriple") { Api.total(Triple(arrayOf<BigInteger>(n(1), n(2)))) })
            check(Api.total(triple) == n(15))
            check(rejected("value0 was rejected by CheckedRecords.sortedTriple") { Api.smallest(Triple(arrayOf<BigInteger>(n(4), n(3), n(2), n(1)))) })
            check(Api.smallest(triple) == n(2))
            check(rejected("value0 was rejected by CheckedRecords.mkPercent") { Api.complement(Percent(n(101))) })
            check(Api.complement(Percent(n(100))) == n(0))
        }
        check(triple.data().contentEquals(arrayOf<BigInteger>(n(9), n(2), n(4))) && values.contentEquals(arrayOf<BigInteger>(n(9), n(2), n(4))) && good.lo() == n(3) && good.hi() == n(10) && bad.lo() == n(9) && bad.hi() == n(3))
        // END CHECKED INPUT CASES
        check(Api.repeated(big).data().contentEquals(arrayOf(big, big, big)))
        val first = Api.repeated(n(7))
        val second = Api.repeated(n(7))
        first.data()[0] = n(99)
        check(second.data().contentEquals(arrayOf<BigInteger>(n(7), n(7), n(7))))
        for (i in 0 until 1000) {
            check(Api.repeated(n(i.toLong())).data().contentEquals(arrayOf<BigInteger>(n(i.toLong()), n(i.toLong()), n(i.toLong()))))
        }
        println("checked-record-ok:$checks")
}
