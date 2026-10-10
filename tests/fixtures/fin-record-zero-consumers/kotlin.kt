import java.math.BigInteger
import java.util.Objects
import org.leanbridge.finrecordzero.Api
import org.leanbridge.finrecordzero.Fields
import org.leanbridge.finrecordzero.Zero
private var checks = 0
private fun check(value: Boolean) { if (!value) throw AssertionError("check $checks"); checks++ }
private fun n(value: Long) = BigInteger.valueOf(value)
private fun fields(member: String = "", digit: BigInteger = n(0)) = Fields("kept", arrayOf(n(7), BigInteger.ONE.shiftLeft(100)),
    if (member == "array") arrayOf(digit) else emptyArray(), if (member == "list") arrayOf(digit) else emptyArray())
private fun row() = arrayOf(fields(), fields(), fields())
private fun <T> refused(call: (T) -> Any?, build: () -> T, path: String): Boolean {
    val value = build(); val before = build()
    return try { call(value); false }
    catch (error: IllegalArgumentException) { error.message == "$path is not below its Fin 0 bound" && Objects.deepEquals(value, before) }
}
fun main() {
    for (call in listOf<(Array<Zero>) -> Array<Zero>>(Api::arrayRecords, Api::listRecords)) {
        check(call(emptyArray()).isEmpty())
        for (digit in listOf(n(0), n(1), BigInteger.ONE.shiftLeft(100)))
            check(refused(call, { arrayOf(Zero(digit)) }, "arg0[0].digit"))
        check(call(emptyArray()).isEmpty())
    }
    check(Api.fieldCollections(fields()) == fields())
    for (member in listOf("array", "list")) for (digit in listOf(n(0), n(1), BigInteger.ONE.shiftLeft(100)))
        check(refused(Api::fieldCollections, { fields(member, digit) }, "arg0.$member[0]"))
    check(Api.fieldCollections(fields()) == fields())
    for (call in listOf<(Array<Fields>) -> Array<Fields>>(Api::arrayFields, Api::listFields)) {
        check(call(emptyArray()).isEmpty())
        check(Objects.deepEquals(call(row()), row()))
        for (index in 0 until 3) for (member in listOf("array", "list")) {
            check(refused(call, { row().also { it[index] = fields(member) } }, "arg0[$index].$member[0]"))
            check(Objects.deepEquals(call(row()), row()))
        }
    }
    for (index in 0L until 1000L) {
        check(Api.fieldCollections(fields()) == fields())
        val member = if (index % 2L == 0L) "array" else "list"
        check(refused(Api::fieldCollections, { fields(member, n(index)) }, "arg0.$member[0]"))
    }
    println("fin-record-zero-ok:$checks")
}
