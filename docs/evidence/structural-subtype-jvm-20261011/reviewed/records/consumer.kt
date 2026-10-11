import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.math.BigInteger
import org.leanbridge.structuralsubtypes.kotlin.Api
import org.leanbridge.structuralsubtypes.kotlin.Option
import org.leanbridge.structuralsubtypes.kotlin.Pair
import org.leanbridge.structuralsubtypes.kotlin.Result

private var checks = 0
private var rejections = 0
private var snapshotControls = 0
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private fun s(value: BigInteger): Option<BigInteger> = Option.some(value)
private fun p(a: BigInteger, b: BigInteger): Option<Pair<BigInteger, BigInteger>> = Option.some(Pair(a, b))
private fun b(a: Int, value: BigInteger): Option<Pair<Int, BigInteger>> = Option.some(Pair(a, value))
private fun check(condition: Boolean, label: String) {
    if (!condition) throw AssertionError("failed: $label")
    checks++
}
// Independent snapshots retain all branches, array shapes and full UTF-16 payloads.
private fun writeSnapshot(out: DataOutputStream, value: Any?) {
    if (value == null) { out.writeUTF("null"); return }
    out.writeUTF(value.javaClass.name)
    when (value) {
        is BigInteger -> { val bytes = value.toByteArray(); out.writeInt(bytes.size); out.write(bytes) }
        is Int -> out.writeInt(value)
        is String -> { out.writeInt(value.length); for (unit in value) out.writeChar(unit.code) }
        is Array<*> -> { out.writeInt(value.size); for (item in value) writeSnapshot(out, item) }
        is Option<*> -> { out.writeBoolean(value.isSome()); if (value.isSome()) writeSnapshot(out, value.value()) }
        is Result<*, *> -> { out.writeBoolean(value.isOk()); writeSnapshot(out, if (value.isOk()) value.value() else value.error()) }
        is Pair<*, *> -> { writeSnapshot(out, value.first()); writeSnapshot(out, value.second()) }
        else -> throw AssertionError("unsupported snapshot: " + value.javaClass)
    }
}
private fun snapshot(value: Any): ByteArray {
    val bytes = ByteArrayOutputStream()
    DataOutputStream(bytes).use { writeSnapshot(it, value) }
    return bytes.toByteArray()
}
private fun same(left: Any, right: Any): Boolean = snapshot(left).contentEquals(snapshot(right))
private fun subtype(path: String, constructor: String) = "$path was rejected by StructuralSubtypes.$constructor"
private fun fin(path: String, bound: BigInteger) = "$path is not below its Fin $bound bound"
private fun refused(input: Any, expected: String, call: () -> Any?) {
    val before = snapshot(input); var accepted = true
    try { call() } catch (error: IllegalArgumentException) {
        check(error.javaClass == IllegalArgumentException::class.java && error.message == expected, "exact refusal: $expected; got $error")
        accepted = false
    }
    if (accepted) throw AssertionError("accepted: $expected")
    check(snapshot(input).contentEquals(before), "complete rejected inputs unchanged"); rejections++
}
fun main() {
    val huge = BigInteger.ONE.shiftLeft(100)
    val wide = n(10).shiftLeft(64) + n(10)
    val originalFirst = arrayOf(s(huge), Option.none())
    val originalSecond = arrayOf(Option.some(Pair(255, "a\u0000tail")))
    val original = Pair(originalFirst, originalSecond)
    val changed = arrayOf(
        Pair(arrayOf(s(huge + n(1)), Option.none()), originalSecond),
        Pair(arrayOf(Option.none<BigInteger>(), Option.none<BigInteger>()), originalSecond),
        Pair(arrayOf(s(huge), Option.none(), Option.none()), originalSecond),
        Pair(originalFirst, arrayOf(Option.some(Pair(254, "a\u0000tail")))),
        Pair(originalFirst, arrayOf(Option.some(Pair(255, "a\u0000changed")))),
        Pair(originalFirst, arrayOf(Option.none<Pair<Int, String>>()))
    )
    for (mutation in changed) { check(!same(mutation, original), "snapshot mutation control"); snapshotControls++ }
    check(Api.scalar(huge) == huge, "wide scalar")
    refused(n(0), subtype("value0", "checkedPositive")) { Api.scalar(n(0)) }
    for (name in arrayOf("arrays", "lists", "specialized")) {
        val call: (Array<BigInteger>) -> Array<BigInteger> = when (name) {
            "arrays" -> { value -> Api.arrays(value) }
            "lists" -> { value -> Api.lists(value) }
            else -> { value -> Api.specialized(value) }
        }
        check(call(emptyArray()).isEmpty(), "$name empty")
        val input = arrayOf(n(1), huge, n(3))
        check(same(call(input), input), "$name wide values")
        for (position in 0..2) {
            val bad = input.copyOf(); bad[position] = n(0)
            refused(bad, subtype("value0[$position]", "checkedPositive")) { call(bad) }
        }
        check(same(call(input), input), "$name recovery")
    }
    check(!Api.options(Option.none()).isSome(), "absent option")
    check(same(Api.options(s(huge)), s(huge)), "present option")
    refused(s(n(0)), subtype("value0?", "checkedPositive")) { Api.options(s(n(0))) }
    val text = "héllo\u0000tail🙂"
    check(same(Api.product(Pair(huge, text)), Pair(huge, text)), "Unicode and complete NUL suffix")
    refused(Pair(n(0), text), subtype("value0.0", "checkedPositive")) { Api.product(Pair(n(0), text)) }
    refused(Pair(huge, ""), subtype("value0.1", "checkedWord")) { Api.product(Pair(huge, "")) }
    val ok = Result.ok<BigInteger, String>(huge); val error = Result.err<BigInteger, String>(text)
    check(same(Api.branch(ok), ok), "active ok"); check(same(Api.branch(error), error), "active error")
    val badOk = Result.ok<BigInteger, String>(n(0)); val badError = Result.err<BigInteger, String>("")
    refused(badOk, subtype("value0.ok", "checkedPositive")) { Api.branch(badOk) }
    refused(badError, subtype("value0.error", "checkedWord")) { Api.branch(badError) }
    val bytes = arrayOf(Option.none(), b(255, huge))
    check(same(Api.byteBranches(bytes), bytes), "UInt8 and Nat")
    val badByte = arrayOf(Option.none(), b(0, huge)); val badNat = arrayOf(Option.none(), b(1, n(0)))
    refused(badByte, subtype("value0[1]?.0", "checkedByte")) { Api.byteBranches(badByte) }
    refused(badNat, subtype("value0[1]?.1", "checkedPositive")) { Api.byteBranches(badNat) }
    val nested = arrayOf(arrayOf(Option.none(), p(huge, wide - n(1))), emptyArray(), arrayOf(p(n(2), n(3))))
    check(Api.nested(nested) == n(3), "nested valid")
    for (row in 0..2) for (column in 0..2) {
        val rows = Array(3) { Array(3) { p(huge, wide - n(1)) } }
        rows[row][column] = p(n(0), wide)
        refused(rows, fin("value0[$row][$column]?.1", wide)) { Api.nested(rows) }
        rows[row][column] = p(n(0), wide - n(1))
        refused(rows, subtype("value0[$row][$column]?.0", "checkedPositive")) { Api.nested(rows) }
        rows[row][column] = p(n(1), wide - n(1)); check(Api.nested(rows) == n(3), "nested recovery")
    }
    val first = arrayOf(s(n(1)), Option.none(), s(huge)); val second = arrayOf(s(huge), s(n(3)), Option.none())
    val normalized = arrayOf(s(huge + n(1)), s(n(4)), Option.none()); val joined = first + normalized
    check(same(Api.aliasPair(Pair(first, second)), Pair(first, normalized)), "per-site alias constructors")
    check(same(Api.aliasArguments(first, second), joined), "per-parameter constructors")
    check(Api.plainFin(arrayOf(Option.none(), s(n(0)), s(n(9)))) == n(3), "Fin endpoints")
    val badFin = arrayOf(s(n(10)))
    refused(badFin, fin("value0[0]?", n(10))) { Api.plainFin(badFin) }
    for (position in 0..2) {
        val left = arrayOf(s(n(1)), s(huge), s(n(3))); val right = arrayOf(s(huge), s(n(3)), s(n(4)))
        left[position] = s(n(0))
        refused(Pair(left, second), subtype("value0.0[$position]?", "checkedPositive")) { Api.aliasPair(Pair(left, second)) }
        right[position] = s(n(0))
        refused(Pair(first, right), subtype("value0.1[$position]?", "normalizePositive")) { Api.aliasPair(Pair(first, right)) }
    }
    repeat(1000) { round ->
        val late = arrayOf(s(huge), s(n(3)), s(n(4))); val position = round % 3; late[position] = s(n(0))
        refused(Pair(first, late), subtype("value1[$position]?", "normalizePositive")) { Api.aliasArguments(first, late) }
        val before = snapshot(Pair(first, second))
        check(same(Api.aliasArguments(first, second), joined), "late recovery")
        check(snapshot(Pair(first, second)).contentEquals(before), "normalization does not mutate either input")
    }
    println("{\"checks\":$checks,\"rejections\":$rejections,\"snapshotControls\":$snapshotControls}")
}
