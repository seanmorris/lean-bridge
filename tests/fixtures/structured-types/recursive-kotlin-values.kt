import java.math.BigInteger
import org.leanbridge.recursive.KotlinProbe
import org.leanbridge.recursive.kotlin.*
import org.leanbridge.recursive.kotlin.Pair
import org.leanbridge.recursive.kotlin.Unit

private var checks = 0
private fun verify(condition: Boolean) { checks++; check(condition) { "check $checks" } }
private fun rejects(action: () -> kotlin.Unit) {
    try { action() } catch (_: IllegalArgumentException) { checks++; return }
    error("Expected invalid copied value")
}
private inline fun <reified T : Any> copied(value: T): T = KotlinProbe.copy(T::class.java, value) as T
private fun scalar(): Scalars = Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L,
    BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Byte.MIN_VALUE, Short.MIN_VALUE, Int.MIN_VALUE, Long.MIN_VALUE,
    BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE), BigInteger.ONE.shiftLeft(160).negate(),
    Float.NaN, -0.0, "A\u0000\ud83c\udf31", byteArrayOf(0, -1, 1), 0x1f331, BigInteger.ONE, -9L)
private fun tree(): Tree = TreeBranch(arrayOf(TreeLeaf(scalar()), TreeBranch(emptyArray())))
private fun match(value: Marker): Int = when (value) {
    is MarkerEmpty -> 0
    is MarkerUnit -> if (value.value == Unit.INSTANCE) 1 else -1
    is MarkerNext -> 2 + match(value.value)
}

fun main() {
    verify(scalar() == scalar()); verify(scalar().hashCode() == scalar().hashCode())
    verify(copied(scalar()) == scalar())
    val tree = tree(); val copy = copied<Tree>(tree)
    verify(tree == copy); verify(tree !== copy); verify(tree.hashCode() == copy.hashCode())
    verify((tree as TreeBranch).children !== (copy as TreeBranch).children)
    val first = tree.children[0] as TreeLeaf
    first.payload.bytes[0] = 12
    verify(((copy.children[0] as TreeLeaf).payload.bytes[0]).toInt() == 0)
    tree.children[0] = TreeBranch(emptyArray()); verify(copy.children[0] is TreeLeaf)
    val original = tree()
    for (marker in listOf(Option.none<Option<Unit>>(), Option.some(Option.none<Unit>()), Option.some(Option.some(Unit.INSTANCE))))
    for (result in listOf(Result.ok<Pair<Tree, Tree>, String>(Pair(original, original)), Result.err<Pair<Tree, Tree>, String>("error\u0000\ud83c\udf31"))) {
        val value = Envelope(original, arrayOf(emptyArray(), arrayOf(original)), Option.none(), result, marker)
        verify(copied(value) == value); verify(copied(value).hashCode() == value.hashCode())
    }
    verify(Option.none<Unit>() != Option.some(Unit.INSTANCE))
    verify(Option.none<Option<Unit>>() != Option.some(Option.none<Unit>()))
    verify(Option.some(Option.none<Unit>()) != Option.some(Option.some(Unit.INSTANCE)))
    val markers: Array<Marker> = arrayOf(MarkerEmpty(), MarkerUnit(Unit.INSTANCE), MarkerNext(MarkerEmpty()))
    for (value in markers) { verify(copied<Marker>(value) == value); verify(value == value) }
    verify(markers.map(::match) == listOf(0, 1, 2))
    verify(MarkerEmpty() as Marker != MarkerUnit(Unit.INSTANCE))
    verify(copied(EmptyRecord()) == EmptyRecord())
    val left: LeftTree = LeftTreeNext(RightTreeMany(arrayOf(LeftTreeLeaf(17))))
    verify(copied<LeftTree>(left) == left)
    val right = RightTreeMany(arrayOf(left)); verify(copied<RightTree>(right) == right)
    val linked = Link(Option.some(Link(Option.none()))); verify(copied(linked) == linked)
    val resultLink = ResultLink(Result.ok(ResultLink(Result.err("stop")))); verify(copied(resultLink) == resultLink)
    var spine: Spine = SpineLeaf(41)
    repeat(128) {
        val value = copied<Spine>(spine)
        verify(value == spine); verify(value !== spine); verify(value.hashCode() == spine.hashCode())
        spine = SpineNext(spine)
    }
    rejects { copied<Spine>(spine) }; rejects { spine.hashCode() }; rejects { spine.toString() }
    val builder = WideNext.builder()
    // WIDE_SETTERS
    var wide: Wide = WideLeaf(17)
    repeat(127) { wide = builder.child(wide).build() }
    val wideCopy = copied<Wide>(wide)
    verify(wideCopy == wide); verify(wideCopy !== wide); verify(wideCopy.hashCode() == wide.hashCode())
    var missing = false
    try { WideNext.builder().child(WideLeaf(0)).build() } catch (_: IllegalStateException) { missing = true }
    verify(missing)
    val cyclicChildren = arrayOf<Tree>(TreeBranch(emptyArray()))
    val cyclic: Tree = TreeBranch(cyclicChildren); cyclicChildren[0] = cyclic
    rejects { copied<Tree>(cyclic) }; rejects { cyclic == cyclic }; rejects { cyclic.hashCode() }; rejects { cyclic.toString() }
    val shared = tree(); val acyclic: Tree = TreeBranch(arrayOf(shared, shared))
    verify(copied<Tree>(acyclic) == acyclic)
    verify(SpineLeaf(1).toString().isNotBlank())
    val nominal: Any = EmptyRecord(); verify(nominal != MarkerEmpty())
    val nullable: Tree? = null; verify(tree() != nullable)
    // DEPTH_AND_SLOTS
    println("{\"checks\":$checks,\"nativeCalls\":0,\"wideFields\":256,\"maximumSpineDepth\":127}")
}
