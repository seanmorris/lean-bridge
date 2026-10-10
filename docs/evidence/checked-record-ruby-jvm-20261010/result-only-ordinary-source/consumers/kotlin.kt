import java.math.BigInteger
import org.leanbridge.checkedrecords.kotlin.*
import org.leanbridge.checkedrecords.kotlin.Triple
private var checks = 0
private fun check(value: Boolean) { if (!value) throw AssertionError("checked-record assertion failed"); checks++ }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
fun main() {
        val big = BigInteger.ONE.shiftLeft(100)
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
