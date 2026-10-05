package consumer

import java.math.BigInteger
import java.lang.reflect.Modifier
import org.leanbridge.owned_aggregates.kotlin.*
import org.leanbridge.owned_aggregates.kotlin.Unit

private var checks = 0
private fun verify(value: Boolean) { check(value); checks++ }
private fun rejected(action: () -> kotlin.Unit) {
    try { action() } catch (_: IllegalArgumentException) { checks++; return }
    error("Expected a bounded-value rejection")
}
private fun types(outer: DispatchResultClosure, inner: CallbackRecordArgument1Closure, bundle: Bundle) {
    val callback: CallbackRecordArgument1ClosureCallback = CallbackRecordArgument1ClosureCallback { it }
    val first: Bundle = outer.invoke(callback)
    val second: Bundle = outer.asCallback().invoke(inner)
    val third: Bundle = inner.invoke(bundle)
    check(first.primary === second.primary || third.primary === bundle.primary)
}
fun main() {
    val a = Payload(BigInteger.ONE.negate(), byteArrayOf(0, -1, 1))
    val b = Payload(BigInteger.ONE.negate(), byteArrayOf(0, -1, 1))
    verify(a == b); verify(a.hashCode() == b.hashCode()); verify(a.bytes !== b.bytes)
    verify(a.toString().isNotEmpty())
    verify(ChoiceEmpty() == ChoiceEmpty())
    verify(ChainStop() == ChainStop())
    val none: Option<Option<Boolean>> = Option.none()
    val nested: Option<Option<Boolean>> = Option.some(Option.none())
    val present: Option<Option<Boolean>> = Option.some(Option.some(false))
    verify(none != nested); verify(nested != present); verify(!present.value().value())
    verify(Option.some(Unit.INSTANCE) != Option.none<Unit>())
    val success: Result<Payload, String> = Result.ok(a)
    val failure: Result<Payload, String> = Result.err("domain")
    verify(success.isOk()); verify(!failure.isOk()); verify(failure.error() == "domain")
    verify(Pair(a, b) == Pair(b, a))
    var left: Tree = TreeBranch(emptyArray())
    var right: Tree = TreeBranch(emptyArray())
    repeat(40) { left = TreeBranch(arrayOf(left)); right = TreeBranch(arrayOf(right)) }
    verify(left == right); verify(left.hashCode() == right.hashCode())
    val cycle = arrayOf<Tree>(TreeBranch(emptyArray()))
    cycle[0] = TreeBranch(cycle)
    rejected { cycle[0].hashCode() }
    verify(Ticket::class.java.declaredConstructors.filterNot { it.isSynthetic }.all { Modifier.isPrivate(it.modifiers) })
    verify(Ticket::class.java.fields.none { it.name == "handle" })
    verify(AutoCloseable::class.java.isAssignableFrom(Ticket::class.java))
    verify(MakeRecordResultClosure::class.java.methods.single { it.name == "invoke" }.parameterTypes.contentEquals(arrayOf(Boolean::class.javaPrimitiveType, Bundle::class.java)))
    verify(DispatchResultClosure::class.java.methods.single { it.name == "invoke" }.parameterTypes.contentEquals(arrayOf(CallbackRecordArgument1ClosureCallback::class.java)))
    println(checks)
}
