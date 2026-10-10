import java.math.BigInteger
import java.util.Objects
import org.leanbridge.finrecords.Api
import org.leanbridge.finrecords.Gate
import org.leanbridge.finrecords.GateClosed
import org.leanbridge.finrecords.GateNever
import org.leanbridge.finrecords.Late
import org.leanbridge.finrecords.Nest
import org.leanbridge.finrecords.Option
import org.leanbridge.finrecords.Pair
import org.leanbridge.finrecords.Result
import org.leanbridge.finrecords.Shape
import org.leanbridge.finrecords.ShapeCircle
import org.leanbridge.finrecords.ShapeEmpty
import org.leanbridge.finrecords.ShapeLabel
import org.leanbridge.finrecords.Slot
import org.leanbridge.finrecords.Tile

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
// A rejected call names the parameter and the failed leaf's bound.
private fun rejected(parameter: String, bound: String, action: () -> Any?): Boolean =
    try { action(); false }
    catch (error: IllegalArgumentException) { error.message == parameter + " is not below its Fin " + bound + " bound" }
// The input and an independently built snapshot exist before the call; they are compared
// immediately after the rejection, before the caller changes anything back.
private fun <T> refused(bound: String, build: () -> T, call: (T) -> Any?): Boolean {
    val input = build()
    val before = build()
    return rejected("arg0", bound) { call(input) } && Objects.deepEquals(input, before)
}
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)
private fun tile(digit: BigInteger, count: BigInteger) = Tile(digit, count)
private fun tile(digit: Long, count: Long) = tile(n(digit), n(count))
private fun late(digit: Long) = Late("ab", arrayOf(n(1), n(2)), n(digit))
private fun row(): Array<Tile> = arrayOf(tile(0, 1), tile(4, 2), tile(1, 0))
// Each element position in turn: the rejected sequence is compared with an independently
// built snapshot immediately after the rejection, then the caller restores the element.
private fun sequence(label: String, call: (Array<Tile>) -> BigInteger) {
    val values = row()
    check(call(arrayOf()) == n(0), "$label empty")
    check(call(values) == n(8), "$label valid")
    for (k in 0 until 3) {
        val kept = values[k]
        values[k] = tile(n(5), kept.count())
        val before = row()
        before[k] = tile(n(5), kept.count())
        check(rejected("arg0", "5") { call(values) } && Objects.deepEquals(values, before), "$label element $k")
        values[k] = kept
    }
    check(call(values) == n(8), "$label recovery")
}

fun main() {
    val huge = BigInteger.ONE.shiftLeft(100)
    // Tile: the digit is Fin 5; any count is valid.
    for (d in 0L until 5L) check(Api.tileSum(tile(d, 10)) == n(d + 10), "tile valid")
    check(Api.tileSum(tile(n(3), huge)) == huge.add(n(3)), "unbounded count")
    check(refused("5", { tile(n(5), huge) }) { Api.tileSum(it) }, "tile at bound")
    check(refused("5", { tile(BigInteger.ONE.shiftLeft(70), huge) }) { Api.tileSum(it) }, "tile beyond 64 bits")
    // Nest: the inner record's own bound and the outer bound are both checked.
    check(Api.nestSum(Nest(tile(4, 6), n(2))) == n(210), "nest valid")
    check(refused("5", { Nest(tile(5, 6), n(2)) }) { Api.nestSum(it) }, "nest inner at bound")
    check(refused("3", { Nest(tile(4, 6), n(3)) }) { Api.nestSum(it) }, "nest tag at bound")
    check(Api.nestSum(Nest(tile(4, 6), n(2))) == n(210), "nest recovery")
    // Late: heap fields precede the bound; a rejection leaves them as the caller built them.
    check(Api.lateSum(late(4)) == n(4005), "late valid")
    check(refused("5", { late(5) }) { Api.lateSum(it) }, "late at bound")
    check(Api.lateSum(late(4)) == n(4005), "late recovery")
    // Slot: Option (Fin 0) is valid only when absent.
    check(Api.slotCount(Slot(Option.none(), n(8))) == n(8), "slot absent")
    check(refused("0", { Slot(Option.some(n(0)), n(8)) }) { Api.slotCount(it) }, "slot present")
    // Shape: only the active case is checked.
    check(Api.shapeSize(ShapeCircle(n(9))) == n(9), "circle valid")
    check(refused<Shape>("10", { ShapeCircle(n(10)) }) { Api.shapeSize(it) }, "circle at bound")
    check(Api.shapeSize(ShapeLabel("abc")) == n(1003), "label")
    check(Api.shapeSize(ShapeEmpty()) == n(7), "empty")
    // Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
    check(Api.gateOpen(GateClosed()) == n(1), "gate closed")
    check(refused<Gate>("0", { GateNever(n(0)) }) { Api.gateOpen(it) }, "gate never")
    // Array Tile and List Tile: every element's fields; the empty sequence is valid.
    sequence("tiles") { Api.tiles(it) }
    sequence("list") { Api.tileList(it) }
    // Tile × Shape: both components; the inactive circle of a label is never read.
    check(Api.tilePair(Pair(tile(4, 6), ShapeCircle(n(9)))) == n(19), "pair valid")
    check(refused("5", { Pair<Tile, Shape>(tile(5, 6), ShapeCircle(n(9))) }) { Api.tilePair(it) }, "pair tile at bound")
    check(refused("10", { Pair<Tile, Shape>(tile(4, 6), ShapeCircle(n(10))) }) { Api.tilePair(it) }, "pair circle at bound")
    check(Api.tilePair(Pair(tile(4, 6), ShapeCircle(n(9)))) == n(19), "pair recovery")
    check(Api.tilePair(Pair(tile(1, 1), ShapeLabel("ab"))) == n(1004), "pair label")
    // Except Shape Tile: the ok record or the error variant, only the active branch.
    check(Api.tileExcept(Result.ok(tile(3, 4))) == n(7), "except ok")
    check(refused("5", { Result.ok<Tile, Shape>(tile(5, 4)) }) { Api.tileExcept(it) }, "except ok at bound")
    check(Api.tileExcept(Result.err(ShapeCircle(n(9)))) == n(509), "except error circle")
    check(refused("10", { Result.err<Tile, Shape>(ShapeCircle(n(10))) }) { Api.tileExcept(it) }, "except error at bound")
    check(Api.tileExcept(Result.err(ShapeLabel("x"))) == n(1501), "except error label")
    check(Api.tileExcept(Result.ok(tile(3, 4))) == n(7), "except recovery")
    // Option Shape: absent, a valid present circle, then an invalid one.
    check(Api.maybeShape(Option.none()) == n(99), "maybe absent")
    check(Api.maybeShape(Option.some(ShapeCircle(n(3)))) == n(3), "maybe circle")
    check(refused("10", { Option.some<Shape>(ShapeCircle(n(10))) }) { Api.maybeShape(it) }, "maybe circle at bound")
    // Results carrying bounds are produced by Lean and arrive below them.
    check(Api.bump(tile(4, 9)) == tile(0, 10), "bump")
    check(refused("5", { tile(5, 9) }) { Api.bump(it) }, "bump at bound")
    check(Api.makeShape(n(4)) == ShapeCircle(n(4)), "make circle")
    check(Api.makeShape(n(23)) == ShapeLabel("23"), "make label")
    for (i in 0L until 1000L) {
        check(Api.tileSum(tile(i % 5, i)) == n(i % 5 + i), "round")
        check(refused("5", { tile(5 + i, i) }) { Api.tileSum(it) }, "rejection round")
    }
    println("fin-record-ok:$checks")
}
