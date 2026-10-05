// Kotlin's own metadata-backed API and values from the original installed JAR.
import java.lang.reflect.Array as ReflectArray
import java.lang.reflect.Modifier
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.Unit
import org.leanbridge.structured.kotlin.*

private var checks = 0
private var calls = 0
private var rejected = 0
private class Marker : RuntimeException()
private class Held<T>(val invoke: (Boolean, T) -> T, val isClosed: () -> Boolean, val dispose: () -> Unit) : AutoCloseable {
    override fun close() = dispose()
}
private fun verify(condition: Boolean) {
    ++checks
    if (!condition) throw AssertionError("structured Kotlin check $checks")
}
private fun reject(type: Class<out Throwable>, action: () -> Unit) {
    ++rejected
    try { action() }
    catch (failure: Throwable) { verify(type.isInstance(failure)); return }
    throw AssertionError("Expected ${type.name}")
}
private fun same(expected: Any, actual: Any, detached: Boolean = false) {
    verify(expected.javaClass == actual.javaClass)
    if (expected.javaClass.isArray) {
        val length = ReflectArray.getLength(expected)
        verify(length == ReflectArray.getLength(actual))
        if (detached && length != 0) verify(expected !== actual)
        repeat(length) { same(ReflectArray.get(expected, it), ReflectArray.get(actual, it), detached) }
    } else if (expected.javaClass.name.startsWith("org.leanbridge.structured.kotlin.")) {
        if (detached) verify(expected !== actual)
        expected.javaClass.fields.filter { !Modifier.isStatic(it.modifiers) }.forEach {
            same(it.get(expected), it.get(actual), detached)
        }
        verify(expected == actual)
        verify(expected.hashCode() == actual.hashCode())
    } else verify(expected == actual)
}
private fun mutate(value: Any) {
    when (value) {
        is ByteArray -> if (value.isNotEmpty()) value[0] = (value[0].toInt() xor 255).toByte()
        is Array<*> -> if (value.isNotEmpty()) {
            when (value.javaClass.componentType) {
                String::class.java -> ReflectArray.set(value, 0, "changed")
                Option::class.java -> ReflectArray.set(value, 0, Option.some("changed"))
                Result::class.java -> ReflectArray.set(value, 0, Result.err<Any, String>("changed"))
            }
        }
        else -> if (value.javaClass.name.startsWith("org.leanbridge.structured.kotlin.")) {
            value.javaClass.fields.filter { !Modifier.isStatic(it.modifiers) }.forEach { mutate(it.get(value)) }
        }
    }
}
private fun <T : Any> cases(value: (Int) -> T, call: (T, (T) -> T) -> T,
    twice: (T, (T) -> T) -> T, make: (T) -> Held<T>) {
    repeat(24) { seed ->
        val input = value(seed)
        val replacement = value(seed + 1)
        val retained = AtomicReference<T>()
        var invoked = 0
        val output = call(input) { argument ->
            ++invoked
            same(input, argument, true)
            retained.set(argument)
            System.gc()
            replacement
        }
        ++calls
        verify(invoked == 1)
        same(replacement, output, true)
        mutate(input)
        mutate(replacement)
        same(value(seed), retained.get())
        same(value(seed + 1), output)
        invoked = 0
        same(value(seed + 2), twice(value(seed)) { argument ->
            same(value(seed + invoked), argument)
            value(seed + ++invoked)
        })
        ++calls
        verify(invoked == 2)
        val copiedInput = value(seed)
        same(value(seed + 1), call(copiedInput) { argument -> mutate(argument); value(seed + 1) })
        ++calls
        same(value(seed), copiedInput)
        make(copiedInput).use { owned ->
            ++calls
            verify(!owned.isClosed())
            mutate(copiedInput)
            val alias = owned.invoke
            same(value(seed), alias(true, value(seed + 1)))
            same(value(seed + 1), alias(false, value(seed + 1)))
            mutate(alias(true, value(seed + 1)))
            same(value(seed), alias(true, value(seed + 2)))
            calls += 4
            System.gc()
            same(value(seed), alias(true, value(seed + 3)))
            ++calls
            val failure = AtomicReference<Throwable>()
            Thread.ofPlatform().start {
                try { alias(true, value(seed)) } catch (caught: Throwable) { failure.set(caught) }
            }.join()
            verify(failure.get() is IllegalStateException)
            owned.close()
            owned.close()
            verify(owned.isClosed())
            reject(IllegalStateException::class.java) { alias(false, value(seed)) }
        }
        for (failure in arrayOf(Marker(), OutOfMemoryError("callback"), AssertionError("callback"))) {
            invoked = 0
            try { twice(value(seed)) { ++invoked; throw failure }; verify(false) }
            catch (caught: Throwable) { verify(caught === failure) }
            verify(invoked == 1)
            ++rejected
            same(value(seed), call(value(seed)) { it })
            ++calls
        }
        same(value(seed), call(value(seed)) { outer -> call(outer) { it } })
        calls += 2
        val marker = Marker()
        same(value(seed), call(value(seed)) { outer ->
            try { call(outer) { throw marker }; verify(false) }
            catch (caught: Marker) { verify(caught === marker) }
            outer
        })
        calls += 2
    }
    make(value(1)).use { owned ->
        Thread.ofPlatform().start(owned::close).join()
        verify(owned.isClosed())
        reject(IllegalStateException::class.java) { owned.invoke(true, value(1)) }
    }
    val failure = AtomicReference<Throwable>()
    Thread.ofVirtual().start {
        try { call(value(1)) { it } } catch (caught: Throwable) { failure.set(caught) }
    }.join()
    verify(failure.get() is IllegalStateException)
}
private fun <T : Any> invalid(input: T, valid: T, error: Class<out Throwable>,
    call: (T, (T) -> T) -> T, twice: (T, (T) -> T) -> T, make: (T) -> Held<T>) {
    var invoked = 0
    reject(error) { call(input) { ++invoked; it } }
    verify(invoked == 0)
    reject(error) { make(input) }
    reject(error) { call(valid) { input } }
    reject(error) { twice(valid) { ++invoked; input } }
    verify(invoked == 1)
    make(valid).use { owned ->
        reject(error) { owned.invoke(false, input) }
        same(valid, owned.invoke(true, valid))
    }
    same(valid, call(valid) { it })
}
fun main() {
    cases(StructuredValues::array, { v, f -> Api.callArray(v) { f(it) } },
        { v, f -> Api.twiceArray(v) { f(it) } },
        { v -> val owned = Api.makeArray(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::list, { v, f -> Api.callList(v) { f(it) } },
        { v, f -> Api.twiceList(v) { f(it) } },
        { v -> val owned = Api.makeList(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::option, { v, f -> Api.callOption(v) { f(it) } },
        { v, f -> Api.twiceOption(v) { f(it) } },
        { v -> val owned = Api.makeOption(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::result, { v, f -> Api.callResult(v) { f(it) } },
        { v, f -> Api.twiceResult(v) { f(it) } },
        { v -> val owned = Api.makeResult(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::tuple, { v, f -> Api.callTuple(v) { f(it) } },
        { v, f -> Api.twiceTuple(v) { f(it) } },
        { v -> val owned = Api.makeTuple(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::record, { v, f -> Api.callRecord(v) { f(it) } },
        { v, f -> Api.twiceRecord(v) { f(it) } },
        { v -> val owned = Api.makeRecord(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::variant, { v, f -> Api.callVariant(v) { f(it) } },
        { v, f -> Api.twiceVariant(v) { f(it) } },
        { v -> val owned = Api.makeVariant(v); Held(owned::invoke, owned::isClosed, owned::close) })
    cases(StructuredValues::record, { v, f -> Api.callAlias(v) { f(it) } },
        { v, f -> Api.twiceAlias(v) { f(it) } },
        { v -> val owned = Api.makeAlias(v); Held(owned::invoke, owned::isClosed, owned::close) })
    val malformed = StructuredValues.array(1)
    malformed[1] = Option.some("\ud800")
    invalid(malformed, StructuredValues.array(1), IllegalArgumentException::class.java,
        { v, f -> Api.callArray(v) { f(it) } }, { v, f -> Api.twiceArray(v) { f(it) } },
        { v -> val owned = Api.makeArray(v); Held(owned::invoke, owned::isClosed, owned::close) })
    val original = StructuredValues.record(1)
    invalid(Payload(original.text, original.rows, BigInteger.valueOf(-1), original.nested),
        original, IllegalArgumentException::class.java,
        { v, f -> Api.callRecord(v) { f(it) } }, { v, f -> Api.twiceRecord(v) { f(it) } },
        { v -> val owned = Api.makeRecord(v); Held(owned::invoke, owned::isClosed, owned::close) })
    var invoked = 0
    Api.retainRecord { ++invoked; it }.use { expired ->
        reject(IllegalArgumentException::class.java) { expired.invoke(original) }
        verify(invoked == 0)
    }
    val marker = Marker()
    try { Api.afterFailure(original) { throw marker }; verify(false) }
    catch (caught: Marker) { verify(caught === marker) }
    verify(Api.afterFailure(original) { it } == original.text)
    @Suppress("UNCHECKED_CAST")
    val huge = arrayOfNulls<Option<String>>(600_000) as Array<Option<String>>
    reject(IllegalArgumentException::class.java) { Api.callArray(huge) { it } }
    reject(IllegalArgumentException::class.java) { Api.callArray(StructuredValues.array(1)) { huge } }
    same(original, Api.callRecord(original) { it })
    Wire.result("structured/assertions", Wire.integer(checks), true)
    Wire.result("structured/calls", Wire.integer(calls), true)
    Wire.result("structured/rejections", Wire.integer(rejected), true)
    Wire.finish("kotlin", "Structured", KotlinVersion.CURRENT.toString(), Api::class.java)
}
