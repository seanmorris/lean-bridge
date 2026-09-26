import java.math.BigInteger
import java.util.concurrent.atomic.AtomicReference
import org.leanbridge.structured.kotlin.*
object RecursiveChecks {

private var checks = 0
private fun verify(condition: Boolean) { ++checks; if (!condition) throw AssertionError("recursive Kotlin $checks") }
private fun reject(type: Class<out Throwable>, action: () -> kotlin.Unit) {
    try { action() } catch (error: Throwable) { verify(type.isInstance(error)); return }
    throw AssertionError("Expected ${type.name}")
}
private fun tree(seed: Int): Tree = TreeBranch(arrayOf(TreeLeaf(BigInteger.ONE.shiftLeft(128 + seed)),
    TreeBranch(arrayOf(TreeLeaf(BigInteger.valueOf(seed.toLong())), TreeBranch(emptyArray())))))

@JvmStatic fun main(args: Array<String>) {
    repeat(24) { seed ->
        val input = tree(seed); val replacement = tree(seed + 1)
        var called = 0; val retained = AtomicReference<Tree>()
        val actual = Api.callRecursive(input) {
            ++called; verify(it !== input); verify(it == input); retained.set(it); System.gc(); replacement
        }
        verify(called == 1); verify(actual !== replacement); verify(actual == replacement)
        (input as TreeBranch).children[0] = TreeLeaf(BigInteger.ZERO)
        (replacement as TreeBranch).children[0] = TreeLeaf(BigInteger.ONE)
        verify(retained.get() == tree(seed)); verify(actual == tree(seed + 1))
        called = 0
        val twice = Api.twiceRecursive(tree(seed)) { verify(it == tree(seed + called)); tree(seed + ++called) }
        verify(called == 2); verify(twice == tree(seed + 2))
        Api.makeRecursive(tree(seed)).use { owned ->
            verify(!owned.isClosed())
            verify(owned.invoke(true, tree(seed + 1)) == tree(seed))
            verify(owned.invoke(false, tree(seed + 1)) == tree(seed + 1))
            val failure = AtomicReference<Throwable>()
            Thread.ofPlatform().start { try { owned.invoke(true, tree(seed)) } catch (error: Throwable) { failure.set(error) } }.join()
            verify(failure.get() is IllegalStateException)
            Thread.ofPlatform().start(owned::close).join(); verify(owned.isClosed())
            reject(IllegalStateException::class.java) { owned.invoke(true, tree(seed)) }
        }
        for (marker in arrayOf(IllegalStateException("marker"), OutOfMemoryError("marker"), AssertionError("marker"))) {
            called = 0
            try { Api.twiceRecursive(tree(seed)) { ++called; throw marker }; verify(false) }
            catch (error: Throwable) { verify(error === marker) }
            verify(called == 1); verify(Api.callRecursive(tree(seed)) { it } == tree(seed))
        }
        verify(Api.callRecursive(tree(seed)) { outer -> Api.callRecursive(outer) { it } } == tree(seed))
    }
    val children: Array<Tree> = arrayOf(TreeLeaf(BigInteger.ZERO)); val cyclic = TreeBranch(children); children[0] = cyclic
    reject(IllegalArgumentException::class.java) { Api.callRecursive(cyclic) { throw AssertionError("invalid input reached callback") } }
    reject(IllegalArgumentException::class.java) { Api.callRecursive(tree(0)) { cyclic } }
    var deep: Tree = TreeLeaf(BigInteger.ZERO)
    repeat(70) { deep = TreeBranch(arrayOf(deep)) }
    reject(IllegalArgumentException::class.java) { Api.makeRecursive(deep) }
    reject(IllegalArgumentException::class.java) { Api.callRecursive(TreeLeaf(BigInteger.valueOf(-1))) { it } }
    val failure = AtomicReference<Throwable>()
    Thread.ofVirtual().start { try { Api.makeRecursive(tree(0)) } catch (error: Throwable) { failure.set(error) } }.join()
    verify(failure.get() is IllegalStateException)
    val payload = Payload("nested\u0000λ", arrayOf(Option.some("a"),Option.none()), BigInteger.TEN, Option.none())
    verify(Api.callNestedAlias(payload) { it } == "nested\u0000λ<none>nested\u0000λ")
    verify(Api.callNestedPlain(payload) { it } == "nested\u0000λ<none>nested\u0000λ")
    Api.makeNestedAlias(payload).use { alias ->
        Api.makeNestedPlain(payload).use { plain ->
            verify(alias.invoke(emptyArray()).size == 3); verify(plain.invoke(emptyArray()).size == 3)
            verify(alias.invoke(emptyArray())[0].value() == payload)
        }
    }
    println("{\"profile\":\"kotlin\",\"recursiveChecks\":$checks}")
}

}
