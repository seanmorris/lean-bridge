import java.math.BigInteger
import java.util.concurrent.atomic.AtomicInteger
import org.leanbridge.recursive.kotlin.*
import org.leanbridge.recursive.kotlin.Pair
import org.leanbridge.recursive.kotlin.Unit

private val checks = AtomicInteger()
private fun verify(value: Boolean) { checks.incrementAndGet(); check(value) { "check ${checks.get()}" } }
private fun reject(call: () -> kotlin.Unit) {
    try { call() } catch (_: IllegalArgumentException) { checks.incrementAndGet(); return }
    error("Invalid copied graph accepted")
}
private fun scalar() = Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE),
    Byte.MIN_VALUE, Short.MIN_VALUE, Int.MIN_VALUE, Long.MIN_VALUE,
    BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE), BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE).negate(),
    1.5f, -2.25, "A\u0000\ud83c\udf31", byteArrayOf(0, -1, 1), 0x1f331, BigInteger.valueOf(4294967295L), Int.MIN_VALUE.toLong())
private fun tree(): Tree = TreeBranch(arrayOf(TreeLeaf(scalar()), TreeBranch(emptyArray())))

fun main() {
    // SIGNATURES
    reject { Api.wordMax(BigInteger.ONE.negate()) }; reject { Api.wordMax(BigInteger.ONE.shiftLeft(64)) }
    verify(System.getProperties().keys.none { it.toString().startsWith("lean.bridge.jvm.native-library-v1.") })
    verify(Api.inspect(scalar())); verify(Api.scalars(scalar()) == scalar())
    verify(Api.wordMax(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE))); verify(!Api.wordMax(BigInteger.ZERO))
    verify(Api.signedMin(Long.MIN_VALUE)); verify(!Api.signedMin(0))
    val original = tree(); val copy = Api.tree(original)
    verify(copy == original); verify(copy !== original); verify(copy.hashCode() == original.hashCode())
    verify(Api.empty() == TreeBranch(emptyArray()))
    verify(Api.joinTrees(original, original) == TreeBranch(arrayOf(original, original)))
    val forest = Array(128) { original }; val output = Api.forest(forest)
    verify(output !== forest); verify(output.size == forest.size)
    for (value in output) { verify(value == original); verify(value !== original) }
    val mutable = tree() as TreeBranch; val copied = Api.tree(mutable) as TreeBranch
    (mutable.children[0] as TreeLeaf).payload.bytes[0] = 9
    verify((copied.children[0] as TreeLeaf).payload.bytes[0].toInt() == 0)
    mutable.children[0] = TreeBranch(emptyArray()); verify(copied.children[0] is TreeLeaf)
    for (marker in listOf(Option.none<Option<Unit>>(), Option.some(Option.none<Unit>()), Option.some(Option.some(Unit.INSTANCE))))
    for (result in listOf(Result.ok<Pair<Tree, Tree>, String>(Pair(original, original)), Result.err<Pair<Tree, Tree>, String>("error\u0000\ud83c\udf31"))) {
        val value = Envelope(original, arrayOf(emptyArray(), arrayOf(original)), Option.none(), result, marker)
        val next = Api.envelope(value); verify(next == value); verify(next !== value); verify(next.alternatives !== value.alternatives)
    }
    val left = LeftTreeNext(RightTreeMany(arrayOf(LeftTreeLeaf(17))))
    verify(Api.left(left) == left); val right = RightTreeMany(arrayOf(left)); verify(Api.right(right) == right)
    var spine: Spine = SpineLeaf(41); repeat(127) { spine = SpineNext(spine) }
    var current = spine; var spineCopy = Api.spine(spine)
    repeat(127) { verify(current !== spineCopy); current = (current as SpineNext).value; spineCopy = (spineCopy as SpineNext).value }
    verify((spineCopy as SpineLeaf).value == 41L)
    reject { Api.grow(spine) }; reject { Api.spine(SpineNext(spine)) }
    verify(Api.grow(SpineLeaf(1)) == SpineNext(SpineLeaf(1)))
    val builder = WideNext.builder()
    // WIDE_SETTERS
    var wide: Wide = WideLeaf(17); repeat(127) { wide = builder.child(wide).build() }
    val wideCopy = Api.wide(wide); verify(wideCopy == wide); verify(wideCopy !== wide)
    for (marker in listOf(MarkerEmpty(), MarkerUnit(Unit.INSTANCE), MarkerNext(MarkerEmpty()))) verify(Api.marker(marker) == marker)
    verify(Api.emptyRecord(EmptyRecord()) == EmptyRecord())
    val units = Array(123) { Unit.INSTANCE }; val unitsCopy = Api.units(units)
    verify(unitsCopy !== units); verify(unitsCopy.contentEquals(units))
    val cyclic = arrayOf<Tree>(TreeBranch(emptyArray())); val cycle = TreeBranch(cyclic); cyclic[0] = cycle
    reject { Api.tree(cycle) }; reject { cycle == cycle }; reject { cycle.hashCode() }; reject { cycle.toString() }
    verify(Api.tree(original) == original)
    java.util.concurrent.Executors.newFixedThreadPool(4).use { pool ->
        val futures = List(256) { pool.submit { val result = Api.tree(original); verify(result == original); verify(result !== original) } }
        futures.forEach { it.get() }
    }
    verify(Api::class.java.declaredMethods.size == 18)
    // DOCUMENTATION
    Wire.result("recursive/checks", Wire.integer(checks.get()), true)
    Wire.result("recursive/concurrent-calls", Wire.integer(256), true)
    Wire.finish("kotlin", "org.leanbridge.recursive.kotlin", KotlinVersion.CURRENT.toString(), Api::class.java)
}
