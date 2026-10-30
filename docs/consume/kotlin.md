# Kotlin

Use the generated Kotlin API from the prepared Maven JAR. The JAR also contains the Java API. Both share the bundled Lean runtime.

## Use a prepared release

### Prerequisites

Use JDK 22, the Kotlin 2.2.0 JVM compiler and runner, and Maven on x86-64 Linux with glibc 2.38 or newer. Check `java -version`, `kotlinc -version`, `kotlin -version`, `mvn -version`, and `ldd --version`. Run all JVM tools with JDK 22. The [support contract](../consumer-support.v1.json) records the shared JVM profile.

Follow [Use a prepared release](receive-package.md) to authenticate the JAR and POM.

### Call an ordinary Lean package

Use the [Java installation commands](java.md#call-an-ordinary-lean-package) to install the local `com.acme:maple-api:2.0.0-rc.1` acceptance package and set `LEAN_BRIDGE_JAR`. Save `Example.kt`:

```kotlin
import java.math.BigInteger
import org.leanbridge.maple.kotlin.Api

fun main() {
    println(Api.echoNat(BigInteger.ONE.shiftLeft(200)))
    println(Api.echoText("Lean λ🌿"))
    println(Api.matrix(longArrayOf(1, 2, 3))[1][2])
}
```

```sh
kotlinc -classpath "$LEAN_BRIDGE_JAR" -d classes Example.kt
kotlin -J--enable-native-access=ALL-UNNAMED \
  -classpath "classes:$LEAN_BRIDGE_JAR" ExampleKt
```

UInt8 and UInt16 use `Int`, UInt32 uses `Long`, and UInt64/Nat/Int use `java.math.BigInteger`, with runtime range checks. Signed integers use `Byte`, `Short`, `Int` and `Long`; floats use `Float` and `Double`. Primitive arrays use their Kotlin array types, such as `LongArray`; records and nested arrays use `Array<T>`. ByteArray maps to Kotlin `ByteArray`.

Unit arguments use the generated Java enum. Import it with an alias, such as `import org.leanbridge.maple.Unit as LeanUnit`, then pass `LeanUnit.INSTANCE`. A Lean Unit result returns Kotlin `Unit`. The Kotlin API has non-nullable signatures; foreign JVM calls also encounter runtime null checks. Native loading, copying, limits and cleanup follow the [Java rules](java.md#call-an-ordinary-lean-package).

### Arrays and records

New ordinary Maven packages include a Kotlin API in a `.kotlin` subpackage.
It carries Kotlin type metadata, including deeply nested arrays, alongside the
original Java API. These signatures avoid the Kotlin compiler's expansion of
deeply nested Java platform types. Maven and
Gradle resolve the declared Kotlin standard library dependency automatically.

For the `org.leanbridge:collections:1.0.0` acceptance archive, save `Example.kt`:

```kotlin
import org.leanbridge.collections.kotlin.Api
import org.leanbridge.collections.kotlin.Single
import java.math.BigInteger

fun main() {
    val rows: Array<LongArray> = arrayOf(longArrayOf(1, 2, 3), longArrayOf())
    val reversed: Array<LongArray> = Api.arrayReverseUint32(rows)
    println(reversed.contentDeepToString())
    reversed[1][0] = 99
    println(rows[0][2])
    println(Api.recordSingle(Single(BigInteger.valueOf(41))).value)
}
```

The output is `[[], [3, 2, 1]]`, `3`, then `42`. Use the
[prepared JAR compilation commands](#call-an-ordinary-lean-package).
Generated final Kotlin classes expose typed `val` properties and named
accessors. They compare nested array contents and preserve nominal record
identity. Returned arrays and record contents have independent storage.
Use `contentEquals` or `contentDeepEquals` for standalone arrays.

Generated fields and parameters are non-nullable. Foreign JVM calls that bypass
Kotlin's type checks still encounter runtime validation. Primitive ranges,
Unicode validation, the 32-level type limit and the 16 MiB conversion budget
follow the [Java array and record rules](java.md#arrays-and-records).

The [Kotlin acceptance record](../evidence/kotlin-collections-20260922.md)
covers all nineteen primitive types, seven record shapes, 24 nested array
levels, compiler rejections and conversion-failure cleanup. It also records
installed checks of the companion Kotlin APIs for Lists, aliases, options,
results, products, variants and primitive callables.

### Lists

Lean Lists use the same array types as Lean arrays. `List UInt32` uses `LongArray`, `List Nat` uses `Array<BigInteger>`, and `List (List UInt32)` uses `Array<LongArray>`. Lists can nest with records, arrays, options, results and products. List and Array retain distinct Lean and Binding IR identities.

For the `org.leanbridge:lists:1.0.0` acceptance archive, save `Example.kt`:

```kotlin
import org.leanbridge.lists.kotlin.Api

fun main() {
    val input = longArrayOf(1, 2, 2, 3)
    val reversed: LongArray = Api.reverseUint32(input)
    println(reversed.contentToString()) // [3, 2, 2, 1]
    reversed[0] = 99 // input is unchanged
    println(Api.reverseUint32(longArrayOf()).size) // 0
}
```

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package). Kotlin `List<T>` and boxed `Array<Long>` do not replace a required `LongArray`. Calls preserve empty Lists, order, duplicates and nesting, and return independent copies. Elements and containers are non-nullable. The [Java List conversion rules](java.md#lists) cover validation, budgets and cleanup. [Installed checks](../evidence/kotlin-collections-20260922.md) compile the Kotlin API consumer independently against the same prepared JAR as Java. Acyclic Lists also work in [callbacks and returned closures](#structured-callback-values).

### Named copied aliases

Use Kotlin target types when calling an aliased Lean API: UInt32 uses checked
`Long`, Nat uses `BigInteger`, and `Array (List UInt32)` uses `Array<LongArray>`.
The shared Maven JAR preserves alias names, targets and chains in its manifest,
README and generated Java source documentation. Lean aliases use their target
Kotlin types without extra wrapper classes or alias declarations.

For the `org.leanbridge:aliases:1.0.0` acceptance archive, save `Example.kt`:

```kotlin
import java.math.BigInteger
import org.leanbridge.aliases.kotlin.Api

fun main() {
    val count: Long = Api.make()
    println(Api.increment(count)) // 42
    println(Api.echoNat(BigInteger.ONE.shiftLeft(200)))
    val rows: Array<LongArray> = Api.reverseRows(arrayOf(longArrayOf(1, 2, 3), longArrayOf()))
    println(rows[0][0]) // 3
}
```

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package).
Aliasing preserves target constraints, including nonnegative Nat and UInt32's
`0..4294967295` range. Returned arrays and mutable record contents own independent
copies. Alias values are non-nullable. See the
[installed Kotlin checks](../evidence/kotlin-collections-20260922.md).

### Options, results and products

Java and Kotlin use the same prepared JAR on either source path. Its generated `Option<T>`, `Result<T, E>` and `Pair<A, B>` types preserve nested options, error branches and binary products. These types compose with arrays, Lists and copied records. Import `Pair` explicitly to distinguish it from `kotlin.Pair`, and alias the generated Unit enum.

For the `org.leanbridge:compounds:1.0.0` acceptance archive, save `Example.kt`:

```kotlin
import org.leanbridge.compounds.kotlin.Api
import org.leanbridge.compounds.kotlin.Option
import org.leanbridge.compounds.kotlin.Pair
import org.leanbridge.compounds.Unit as LeanUnit

fun main() {
    val present = Api.optionUint32(Option.some(42L))
    println(present.value()) // 42
    println(Api.classify(Option.some(Option.none<LeanUnit>()))) // 1
    println(Api.tupleUint32(Pair(1L, 2L)).first()) // 2
    when (present) {
        is Option.None -> println("absent")
        is Option.Some -> println(present.value())
    }
    val result = Api.duplicate(Option.none())
    if (!result.isOk()) println(result.error()) // empty
}
```

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package). The sealed Kotlin branches support exhaustive `when` expressions. `Option.none<LeanUnit>()`, `Option.some(LeanUnit.INSTANCE)` and an outer `Some` containing `None` stay distinct. Lean `Except E T` maps to the generated `Result<T, E>`, not `kotlin.Result`; factories are `Result.ok` and `Result.err`. Domain errors are values, while bridge failures throw exceptions.

Primitive generic payloads use their Kotlin names, such as `Option<Long>`, with JVM boxing. Lean Unit payloads always use `LeanUnit.INSTANCE`. The immutable compound wrappers use covariant type parameters. Payloads and containers are non-nullable, with runtime checks for foreign JVM callers. Inactive payload access throws `IllegalStateException`. Generated records and compound wrappers compare nested array contents with `==` and produce matching hash codes. Copy limits and ownership follow the [Java compound rules](java.md#options-results-and-products). The [installed checks](../evidence/kotlin-collections-20260922.md) include a fully typed 24-level `Option` caller.

Standalone arrays retain JVM reference equality. Use `contentEquals` for primitive arrays and `contentDeepEquals` for nested arrays. Generated value equality follows Java floating-point rules: NaNs compare equal and positive and negative zero differ. Do not mutate nested arrays while a containing value is a map key or set member.

### Tagged variants

Kotlin uses sealed interfaces and named constructor classes with typed `val` fields.
`when` expressions can match every permitted constructor without an `else`.
You do not supply numeric tags or write FFM code.

For the `org.leanbridge:variants:1.0.0` acceptance archive, save `Example.kt`:

```kotlin
import org.leanbridge.variants.kotlin.*

fun main() {
    val result: Signal = Api.next(SignalData(42, "ready"))
    val label = when (result) {
        is SignalIdle -> "idle"
        is SignalStopped -> "stopped"
        is SignalData -> "${result.count()}: ${result.label()}"
        is SignalMarker -> "marker"
    }
    println(label) // 43: ready!
}
```

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package).
Named accessors retain their generated names. Import the generated
`Unit` and `Pair` explicitly, or alias them, when constructor payloads use those
types. A Unit payload needs the generated enum's `INSTANCE`, not `kotlin.Unit`.

Payloads support the same primitives, copied containers, records and nested
variants as Java. Signatures are non-nullable; foreign JVM calls reject null cases
and active null fields. Results copy array contents. Generated records compare
nested contents and keep each constructor's identity distinct.
The [Java conversion and ownership rules](java.md#tagged-variants) apply to both
languages. [Installed checks](../evidence/kotlin-collections-20260922.md) compile each
consumer independently and run it without an installed compiler.

### Recursive values

The prepared JAR exposes separate Kotlin classes for recursive records and
sealed constructor families. Fields use their declared Kotlin types and remain
non-nullable. For the `org.leanbridge:recursive:1.0.0` acceptance archive, save
`Example.kt`:

```kotlin
import org.leanbridge.recursive.kotlin.*

fun main() {
    val input: Spine = SpineNext(SpineLeaf(41))
    val copy = Api.spine(input)
    println(copy == input)  // true
    println(copy === input) // false
    val trees = arrayOf(Api.empty())
    val copies = Api.forest(trees)
    println(copies !== trees)       // true
    println(copies[0] !== trees[0]) // true
}
```

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package).
Kotlin metadata retains nested array types. Primitive arrays use their native
Kotlin forms; nominal values use `Array<T>`. Recursive Java and Kotlin values are
distinct types, so use the API and value classes from the same subpackage.

Generated `val` fields cannot be reassigned, but arrays remain mutable. Native
results own independently copied arrays. Constructors exceeding the JVM
argument-slot limit use typed builders, with every field required before
`build()`. The [recursive Java budgets and validation rules](java.md#recursive-values)
apply to both APIs, including cycle rejection and the 128-level value limit.

The [recursive Maven checks](../contributing/testing.md#recursive-java-and-kotlin-packages)
execute this example on both compiler source paths. [Installed recursive acceptance](../evidence/recursive-managed-acceptance-20260924.md) covers copied inputs, results and fields. [Recursive callbacks](#recursive-callback-values) also have installed-package checks. For values containing resources, use the [owned profile](#owned-resources-and-aggregates).

### Callbacks and returned Lean functions

Use Kotlin lambdas with the generated Java functional interfaces. Add these calls to the Maple example's `main` function:

```kotlin
println(Api.callWord(40) { value -> value + 1 }) // applies twice: 42
Api.makeWord(2).use { addTwo ->
    println(addTwo.invoke(40))                 // 42
    println(Api.callWord(40, addTwo))           // 44
}
```

All nineteen primitive types retain their Kotlin mappings in callbacks and returned functions. The returned `FnUInt32ToUInt32.LeanClosure` implements its callback interface and `AutoCloseable`; `use` closes it. Other signatures have their own typed `Fn...To...` interfaces. `isClosed()` reports explicit closure, and saved function references share the same lifetime.

Callback failures return as the original `Throwable`, including checked Java exceptions, with their stack and suppressed exceptions preserved. Copied arguments may be retained; the host callback itself borrows only the enclosing synchronous call. Invoke a returned function on its creating platform thread. Virtual threads reject before callable execution, and coroutine suspension or dispatcher changes are not supported. Closing from another thread is safe and defers native release until active invocation finishes.

The [Java lifetime and conversion rules](java.md#callbacks-and-returned-lean-functions) also apply to Kotlin. Both languages consume the same JAR; neither needs FFM code or a separate Lean installation. The [installed callable checks](../evidence/jvm-callables-20260919.md) compile and execute independent consumers in both languages.

### Structured callback values

Use the companion `.kotlin` API and its copied value types for structured
callbacks. Arrays, Lists, options, results, binary products, records, variants
and aliases can carry acyclic copied payloads. Lambdas retain their parameter
and result types; no reflection or FFM declarations are needed. The
[installed checks](../evidence/jvm-structured-callables-20260925.md) cover both
authoring paths and cleanup after failed conversions.

For the `org.leanbridge:structured:1.0.0` acceptance archive, save
`StructuredExample.kt`:

```kotlin
import java.math.BigInteger
import org.leanbridge.structured.kotlin.Api
import org.leanbridge.structured.kotlin.Option
import org.leanbridge.structured.kotlin.Payload

object StructuredExample {
    @JvmStatic
    fun main(args: Array<String>) {
        val rows: Array<Option<String>> = arrayOf(Option.none(), Option.some("row"))
        val input = Payload("source", rows, BigInteger.ONE.shiftLeft(200), Option.none())
        val copied = Api.callRecord(input) { value ->
            Payload("copied", value.rows, value.count, value.nested)
        }
        println(copied.text) // copied
        Api.makeRecord(input).use { held ->
            rows[0] = Option.some("edited")
            println(held.invoke(true, input).rows[0].isSome()) // false
        }
        println(Api.callArray(rows) { it }.size) // 2
    }
}
```

Use the [prepared JAR commands](#call-an-ordinary-lean-package), substituting
`StructuredExample.kt` and the main class `StructuredExample`. The
[author recipe](../publish/maven.md#structured-callback-values) defines this API.

Callback arguments, results and closure captures own independent copies of
nested arrays. Generated value references are non-nullable; foreign JVM inputs
and callback results also undergo runtime validation. Java's records and
Kotlin's companion classes remain distinct, so import values from the same API
as the function you call. Both adapters share the native loader and closure
leases. Use `use` to close returned functions and keep invocation on the
creating platform thread. Recursive callable payloads, resources inside copied
aggregates, suspend functions and retained host callbacks remain unsupported.

### Recursive callback values

Use the prepared JAR's `.kotlin` API and its Kotlin value classes for recursive
callbacks. The signatures preserve non-null types, nested arrays and constructor
cases. For the `org.leanbridge:structured:1.0.0` acceptance package, save
`RecursiveExample.kt`:

```kotlin
import java.math.BigInteger
import org.leanbridge.structured.kotlin.*

object RecursiveExample {
    private fun first(tree: Tree): BigInteger =
        ((tree as TreeBranch).children[0] as TreeLeaf).value

    @JvmStatic
    fun main(args: Array<String>) {
        val children = arrayOf<Tree>(TreeLeaf(BigInteger.valueOf(20)))
        val input: Tree = TreeBranch(children)
        val result = Api.callRecursive(input) {
            TreeBranch(arrayOf(TreeLeaf(BigInteger.valueOf(42))))
        }
        println(first(result)) // 42
        Api.makeRecursive(input).use { held ->
            children[0] = TreeLeaf(BigInteger.valueOf(99))
            println(first(held.invoke(true, result)))  // 20
            println(first(held.invoke(false, result))) // 42
        }
    }
}
```

Use the [prepared JAR commands](#call-an-ordinary-lean-package), substituting
`RecursiveExample.kt` and the main class `RecursiveExample`. The
[author recipe](../publish/maven.md#recursive-callback-values) defines the API.
Maven and Gradle resolve Kotlin's runtime dependency; the JAR loads its bundled
Lean libraries automatically.

Arguments, returned values and closure captures have independent copied
storage. `use` closes the returned function even when the block throws. Invoke
it on its creating platform thread. Suspending callbacks, dispatcher changes
and virtual-thread invocation are unsupported. Java and Kotlin value classes
remain distinct; import the API and values from the same package.

The [Java recursive callback limits and failure rules](java.md#recursive-callback-values)
apply to both languages. Host exceptions retain their identity after native
cleanup. Resources and callable identities inside copied aggregates, retained
host callbacks and asynchronous delivery remain unsupported.

[Installed recursive callback checks](../evidence/jvm-recursive-callables-20260926.md)
cover both authoring paths and compile this example against the original JAR.

Selected `Subtype` and checked-record callback results use the generated
`WithRecovery` class described in the [Java callback rules](java.md#recursive-callback-values).
Kotlin uses the generated proof-free checked-record class for both the callback
result and its recovery. Returned Lean closures validate checked-record inputs
before invocation and remain usable after rejection. The
[remaining-host workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/callback-checked-record-remaining.yml)
runs the ordinary and reviewed Kotlin packages beside their Java projections.

### Owned resources and aggregates

Import the companion `.kotlin` API and value types from the prepared owned-value
JAR. Records expose non-null `val` properties; resources and returned functions
implement `AutoCloseable` and work with `use`.

For a package without borrowed-result declarations, save `OwnedExample.kt`:

```kotlin
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Payload

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "demo").use { ticket ->
        val input = Bundle(ticket, Option.none(), emptyArray(), emptyArray(),
            Payload(BigInteger.ZERO, byteArrayOf()))
        val output = Api.callbackRecord(input) { borrowed -> borrowed }
        output.primary.use { println(Api.serial(it)) } // 42
    }
}
```

Use the [prepared JAR commands](#call-an-ordinary-lean-package), substituting
`OwnedExample.kt` and `OwnedExampleKt`. The
[author recipe](../publish/maven.md#owned-resources-and-aggregates) defines this API.
Maven resolves the Kotlin standard library; native loading is automatic.

Containers do not close their resource leaves. Close each returned owner or
retain it explicitly when extending its lifetime. Callbacks borrow their
resource and closure arguments only for the callback. `retain()` creates an
independent owner, and `asCallback()` passes a returned Lean function back to
Lean without changing its identity.

The [Java ownership, thread and conversion rules](java.md#owned-resources-and-aggregates)
apply to Kotlin. Keep an owner on its creating platform thread for calls and
retains. Coroutine suspension or dispatcher changes do not transfer ownership.
Do not mix Java values with the companion Kotlin API.

#### Consuming inputs

The generated KDoc names arguments that consume resource ownership. Pass the
ordinary value. For the [transfer-enabled example](../publish/maven.md#transfer-input-ownership),
save `OwnedTransferExample.kt`:

```kotlin file=kotlin/OwnedTransferExample.kt
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "task").use { original ->
        original.retain().use { kept ->
            Api.retainTicket(original).use { received ->
                check(original.isClosed)
                check(Api.serial(received).intValueExact() == 42)
                check(Api.serial(kept).intValueExact() == 42)
                println("transferred")
            }
        }
    }
}
```

Every alias sharing the consumed lease closes, including sibling resources from
the same returned aggregate. Independent retains survive. Two consuming arguments
cannot share a lease, and callback borrows must be retained before transfer.
Validation failures preserve ownership; failures after the native handoff leave
the input consumed. The [Java transfer rules](java.md#consuming-inputs) also apply
to Kotlin. `use` can close an already consumed wrapper safely.

#### Borrowed results and whole owners

Packages with parameter-anchored results return `Value<T>` for resource-bearing
values. `get()` checks the owner; `share()` adds a guard on the same owner;
`retain()` creates an independent owner. Closing the last shared guard or
transferring that owner expires its borrowed descendants, including empty values.

For the owned-aggregates package with `retainTicket` anchored to its input, save
`OwnedBorrowExample.kt`:

```kotlin file=kotlin/OwnedBorrowExample.kt
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "order").use { owner ->
        Api.retainTicket(owner).use { view ->
            view.retain().use { kept ->
                owner.close()
                check(view.isClosed)
                println(Api.serial(kept.get()))
            }
        }
    }
}
```

Use `Api.copyValue(raw)` where the erased JVM type selects one Lean type, or a
declaration-specific factory such as `Api.copyEchoArrayResult(raw)` or
`Api.copyEchoListResult(raw)`. In these packages, consuming arguments accept
whole owners. Borrowed results cannot be consumed; call `retain()` first when
independent ownership is needed. Raw resource views do not keep their whole
owner alive. Resource equality uses native identity and rejects expired views;
owners and resources cannot be hash keys. The [Java lifetime rules](java.md#borrowed-results-and-whole-owners)
also apply to Kotlin.

#### Methods and properties

Receiver declarations add methods and read-only properties to nominal owners
such as `TicketValue` and `BundleValue`. Both extend `Value<T>`; `share()` and
`retain()` preserve their nominal type. Static `Api` functions remain available.

For the owned-aggregates package with `serial` declared as a property and
`retainTicket` as a receiver-anchored method, save `OwnedReceiverExample.kt`:

```kotlin file=kotlin/OwnedReceiverExample.kt
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "order").use { owner ->
        owner.retainTicket().use { view ->
            view.retain().use { kept ->
                println(owner.serial)
                owner.close()
                check(view.isClosed)
                println(kept.serial)
            }
        }
    }
}
```

This prints `42` twice. The declared receiver anchor makes `view` expire with
`owner`; the independently retained `kept` value survives. A method anchored to
another argument follows that argument's lifetime. Raw resource views expose
only members that do not borrow from or consume the receiver. Consuming methods
invalidate the original owner and its aliases before Lean or its callbacks run.

Callback results anchored to a callback argument remain unsupported.

#### Receiver lifetimes and garbage collection

Keep the whole owner or one of its `share()` wrappers reachable while using
borrowed results. Raw values and borrowed descendants do not keep that owner
alive. Independent retains remain valid after the original owner is collected.
Methods and property getters keep their receiver alive for the call, including
after JIT optimization. A saved callable that
captures an owner keeps it reachable until you release the callable.

Use `use` for prompt cleanup. The [Java garbage-collection rules](java.md#receiver-lifetimes-and-garbage-collection)
also apply to Kotlin owners and their creating threads.

#### Callback-result owners (unreleased)

This profile is under development. These examples target the callback-result
owned-aggregates fixture, whose returned callable borrows its result from the
whole invocation argument. Use the package and generated API for that contract;
ordinary leased callback results have different signatures.

Pass the original whole owner to the returned native closure. Closing that owner
expires the callback result and its borrowed descendants. Retain the result
before closing the original when an independent lifetime is needed.

```kotlin file=kotlin/OwnedCallbackResultExample.kt
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.*

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "callback-owner").use { seed ->
        val input = Bundle(seed.get(), Option.none(), emptyArray(), emptyArray(),
            Payload(BigInteger.ZERO, byteArrayOf()))
        Api.echoRecord(input).use { original ->
            Api.makeRecordCallback(input).use { closureOwner ->
                closureOwner.get().invoke(original).use { borrowed ->
                    borrowed.retain().use { independent ->
                        original.close()
                        check(borrowed.isClosed && !independent.isClosed)
                        check(Api.serial(independent.get().primary).intValueExact() == 42)
                        try {
                            borrowed.get()
                            error("Expired callback result was accepted")
                        } catch (failure: LeanBridgeException) {
                            check(failure.status() == 4)
                        }
                    }
                }
            }
        }
    }
    println("callback-result-retained")
}
```

Host-enabled packages accept `CallbackResult.value(raw)` or
`CallbackResult.owner(wholeOwner)` from synchronous callbacks. The bridge copies
the reply before the callback argument frame expires. This host-reply example
requires the host-enabled profile; the native-only profile omits those callback
interfaces and `CallbackResult`.

```kotlin file=kotlin/OwnedCallbackReplyExample.kt
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.*

fun main() {
    Api.newTicket(BigInteger.valueOf(42), "callback-reply").use { seed ->
        val input = Bundle(seed.get(), Option.none(), emptyArray(), emptyArray(),
            Payload(BigInteger.ZERO, byteArrayOf()))
        Api.echoRecord(input).use { replyOwner ->
            Api.callbackRecord(input, ApplyTwiceArgument1ClosureCallback {
                CallbackResult.value(it)
            }).use { raw ->
                Api.callbackRecord(input, ApplyTwiceArgument1ClosureCallback {
                    CallbackResult.owner(replyOwner)
                }).use { whole ->
                    replyOwner.close()
                    check(Api.serial(raw.get().primary).intValueExact() == 42)
                    check(Api.serial(whole.get().primary).intValueExact() == 42)
                }
            }
        }
    }
    println("callback-replies-copied")
}
```

#### Callback owners and creator-thread exit (unreleased)

Callback-result owners and independent retains still belong to their creating
platform thread. The next example keeps all wrappers and the `Thread` reachable
after that thread exits, checks `isClosed`, and verifies status 4 on later reads.
It uses only the installed public API.

```kotlin file=kotlin/OwnedCallbackThreadExample.kt
import java.lang.ref.Reference
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicReference
import org.leanbridge.owned_aggregates.kotlin.*

fun main() {
    val held = AtomicReference<Array<Value<*>>>()
    val failure = AtomicReference<Throwable>()
    val worker = Thread {
        try {
            val seed = Api.newTicket(BigInteger.valueOf(42), "callback-thread")
            val input = Bundle(seed.get(), Option.none(), emptyArray(), emptyArray(),
                Payload(BigInteger.ZERO, byteArrayOf()))
            val original = Api.echoRecord(input)
            val closureOwner = Api.makeRecordCallback(input)
            val borrowed = closureOwner.get().invoke(original)
            val descendant = closureOwner.get().invoke(borrowed)
            val independent = descendant.retain()
            held.set(arrayOf(seed, original, closureOwner, borrowed, descendant, independent))
        } catch (error: Throwable) { failure.set(error) }
    }
    worker.start(); worker.join(10000)
    check(!worker.isAlive)
    failure.get()?.let { throw AssertionError(it) }
    val owners = held.get()
    val deadline = System.nanoTime() + 5_000_000_000L
    while (owners.any { !it.isClosed } && System.nanoTime() < deadline) Thread.sleep(5)
    for (owner in owners) {
        check(owner.isClosed)
        try {
            owner.get()
            error("Dead-thread owner was accepted")
        } catch (error: LeanBridgeException) {
            check(error.status() == 4)
        }
    }
    Reference.reachabilityFence(owners); Reference.reachabilityFence(worker)
    println("callback-thread-owners-closed")
}
```

These public checks establish wrapper expiry. Neither thread joining nor
`isClosed` proves completion of native TLS cleanup. The direct JVM process probes
wait for the native exit counter and check restored allocation and identity
counts separately. Installed packages expose no runtime-retirement operation;
retirement checks use private test instrumentation. These checks make no general
JVM fork-support claim.

### Alpha interoperability example

The remaining example uses the separate authenticated `org.leanbridge:lean-alpha:0.0.0` fixture API. Set `LEAN_BRIDGE_MAVEN_RELEASE` to the Alpha release directory containing `repository/`.

## Resolve the JAR

Run these commands in an empty application directory:

```sh
export LEAN_BRIDGE_MAVEN_RELEASE=/absolute/path/to/maven-release
export LEAN_BRIDGE_M2="$PWD/.m2"
mvn --batch-mode --quiet \
  "-Dmaven.repo.local=$LEAN_BRIDGE_M2" \
  org.apache.maven.plugins:maven-dependency-plugin:3.8.1:get \
  -Dartifact=org.leanbridge:lean-alpha:0.0.0 \
  "-DremoteRepositories=lean-bridge::default::file://$LEAN_BRIDGE_MAVEN_RELEASE/repository" \
  -Dtransitive=false
export LEAN_BRIDGE_JAR="$LEAN_BRIDGE_M2/org/leanbridge/lean-alpha/0.0.0/lean-alpha-0.0.0.jar"
```

Maven needs network access to retrieve its dependency plugin on the first run. Alpha itself comes from the authenticated local release.

### Write the application

Save the complete program as `Consumer.kt`:

```kotlin file=kotlin/Consumer.kt
import org.leanbridge.alpha.Alpha
import org.leanbridge.alpha.Box
import org.leanbridge.alpha.CallbackThrewException
import org.leanbridge.alpha.DisposedResourceException
import org.leanbridge.alpha.Payload

fun main() {
    Box(42L).use { box ->
        check(box.read() == 42L && box.identity() === box) { "Box identity" }
        println("Box: ${box.read()}")

        val payload = Alpha.roundTrip(Payload(
            true, 41L, "Lean λ", byteArrayOf(0, 255.toByte()), longArrayOf(0L, 0xffff_ffffL)))
        check(!payload.enabled() && payload.count() == 42L && payload.label() == "Lean λ"
            && payload.bytes().contentEquals(byteArrayOf(0, 255.toByte()))
            && payload.values().contentEquals(longArrayOf(0L, 0xffff_ffffL))) { "Payload" }
        println("Payload count: ${payload.count()}")

        val callback = Alpha.withCallback(40L) { value -> value + 2L }
        check(callback == 44L) { "Callback result" }
        println("Callback: $callback")

        Alpha.makeAdder(2L).use { adder ->
            check(adder.apply(40L) == 42L) { "Returned callable" }
            println("Callable: ${adder.apply(40L)}")
            try {
                Alpha.withCallback(40L) { throw IllegalStateException("callback marker") }
                error("Callback failure was accepted")
            } catch (error: CallbackThrewException) {
                check(error.cause is IllegalStateException && error.cause?.message == "callback marker")
            }

            adder.close()
            adder.close()
            try {
                adder.apply(40L)
                error("Closed callable was accepted")
            } catch (expected: DisposedResourceException) { }
        }

        box.close()
        box.close()
        try {
            box.read()
            error("Closed Box was accepted")
        } catch (expected: DisposedResourceException) { }
        println("Errors and cleanup: passed")
    }
}
```

### Compile and run

```sh
mkdir -p classes
kotlinc -classpath "$LEAN_BRIDGE_JAR" -d classes Consumer.kt
kotlin -J--enable-native-access=ALL-UNNAMED -classpath "classes:$LEAN_BRIDGE_JAR" ConsumerKt
```

Expected output:

```text
Box: 42
Payload count: 42
Callback: 44
Callable: 42
Errors and cleanup: passed
```

### Bounded integers

A Lean `Fin n` parameter or result is a `java.math.BigInteger`, the same as `Nat`. For `Library.mirror (value : Fin 10) : Fin 10`, `Api.mirror(BigInteger.valueOf(3))` returns 6. `Api.mirror(BigInteger.TEN)` throws `IllegalArgumentException` with the message `arg0 is not below its Fin 10 bound`. A negative value throws the `IllegalArgumentException` that `Nat` throws. The package checks the bound before it calls Lean, so caller data is unchanged and a later valid call still works. `Fin 0` parameters reject every value, and bounds wider than 64 bits are compared exactly. The package README states each bound. Top-level parameters and results are supported, including inside `Array`, `List` and `Option` (for example `Array (Fin 10)` or `Option (List (Fin 10))`): every element is checked before Lean is called, an empty array or `none` is valid even for `Fin 0`, and a rejection names the parameter and the bound of the element that failed. Both ordinary-source and independently reviewed packages also check Fin inside pairs, active `Except` branches and plain record or variant fields, including Array/List/Option compositions. The [hosted product and field checks](../evidence/fin-native-hosted-20261010/receipt.json) exercise those shapes through the installed Kotlin API. `Fin` in callback signatures is rejected at build time. See the [installed checks](../evidence/native-fin-hosts-20261006.md) and the [container checks](../evidence/native-fin-containers-20261006.md).

The separate [scalar entry-counter receipt](../evidence/jvm-fin-dispatch-20261009/receipt.json) records ordinary-source and reviewed-IR JARs after source removal, offline installation and relocation, with Java and Kotlin callers in separate processes. Rejected `mirror`, `impossible` and `label` calls entered neither the Lean source nor its C adapter. Valid calls, including those after rejected ones, entered their own source and adapter once. Both Kotlin consumers passed 2,022 checks on Kotlin 2.2.0 compiling for OpenJDK 22.0.2 with GDB 13.1 on x86-64 Linux and a glibc 2.36 package floor. GDB counted the entries in the one verified directory the JAR extracted, without changing the generated loader or the extracted files. It covers these top-level scalar calls, not containers, nested refinements or other platforms.

## Values and cleanup

### Checked records

Prepared packages expose checked Lean records as generated records containing
only runtime payload fields. Pass those fields without proofs. Lean runs the
constructor selected for each parameter; it can reject or normalize the input.
A rejected call leaves your record unchanged and names the parameter and
constructor. Results contain copied payloads with proofs erased.

The [installed checked-record tests](../evidence/checked-record-native-promotion-20261011.md)
cover ordinary-source and independently reviewed packages, including packages
that only return checked records. They test `Interval`, `Sized 3` and
`Bounded 0 101`. Nested records, callbacks, owned values and general dependent
payloads are not included.

The [recursive checked-record acceptance](../evidence/recursive-checked-record-promotion-20261018.md) separately covers the tested finite self-recursive `Packet` and mutually recursive `Envelope`/`Step` graphs in Kotlin on both source routes. The retained full and result-only Maven packages preserve aliases, arrays, options and active sealed variants; validate checked `Nat` and `Fin 3` fields; erase proofs; preserve rejected values; recover on the next valid call; and return constructor-free copied results. Other recursive graph shapes, generic checked records, value-carrying receiver-dependent fields, other index kinds, open dependent or zero-payload combinations, callbacks, owned forms, retained identity and cyclic host objects remain separate work.

A proof-only checked record remains a real nominal object. Construct the
generated zero-property class, such as `Witness()`, rather than treating it as
Kotlin `Unit`, `null`, an omitted argument or another empty class. A record
with a Lean `Unit` field keeps the generated member, so `Token` takes
`Token(LeanUnit.INSTANCE)`. Options still distinguish `None` from
`Some(Witness())`, arrays retain their lengths, and variant cases remain
distinct. The [hosted Java/Kotlin archive](../evidence/zero-payload-checked-record-jvm-20261021.md)
checks those forms in ordinary and reviewed full/result-only Maven packages,
including exact constructor rejection, null rejection, unchanged caller
values, recovery, source-free installation and relocation.

### Checked values

Independently reviewed packages support top-level primitive-base `Subtype`
parameters and results. The [reviewed native checks](../evidence/reviewed-subtype-native-promotion-20261010.md)
ran twelve exports with 2,023 checks. They verify constructor selection,
normalization, rejection recovery and replay after moving the installed package.
Error messages use the parameter names in the reviewed API. These earlier runs cover top-level parameters and results and did not measure
dispatch counts.

A Lean `Subtype` parameter or result over a primitive base, such as `{ value : String // value.length > 0 }`, uses the base's usual type. The package runs the author's checked constructor from the export contract before the exported function; a rejected value fails the call with the same invalid-argument error as a `Fin` bound, with the message naming the parameter and constructor (`arg0 was rejected by Library.checkedWord`), and caller data stays unchanged. The exported function receives the constructed value, which a normalizing constructor may change. The package README names each constructor. These earlier checks cover top-level parameters and results; see the [installed checks](../evidence/native-subtype-20261007.md).

### Arrays of generic records

Ordinary-source packages also accept Array-valued fields and arrays of alias-named generic records. Use the generated record types and the array representation listed below; no Lean type arguments are passed at runtime. The [native Array acceptance](../evidence/generic-record-array-rollout-20261009.md) covers round trips, empty arrays, invalid members and recovery while retaining the original List, Option and specialization checks. These are local installed-package results; the page records their exact runtime scope.

### Subtypes inside containers

Ordinary-source and reviewed packages also accept checked `Subtype` leaves
inside `Array`, `List`, `Option`, products and `Except`. Use the base value
inside each generated host container listed in the conversion table. The package
runs the selected Lean constructor for each present leaf; absent options, empty
containers and inactive branches need no value or proof. Accepted normalization
reaches the Lean export. Rejection leaves the caller's input unchanged, and a
subsequent valid call can use the same package.

The [installed structural checks](../evidence/structural-subtype-promotion-20261011.md)
cover primitive `Nat`, `String` and `UInt8` bases, mixed `Fin`, transparent
aliases with distinct constructor choices, and one closed `List` specialization.
They cover both author routes.

### Subtypes in copied records

Ordinary-source and reviewed packages accept the tested `Nat` Subtype fields
inside acyclic copied records, variants and aliases. Use the generated records
and sealed variant cases with `BigInteger` payloads; do not provide proof fields.
Each input site keeps its selected Lean constructor, including different
normalizing constructors for two uses of the same record. Rejected values leave
caller data unchanged, and subsequent valid calls succeed.

Copied results need no input constructor. Standalone result-only packages also
return these records and variants, including exact 100-bit `Nat` values.

The [installed Java/Kotlin checks](../evidence/nominal-subtype-jvm-20261013.md)
use JDK 22.0.2 and Kotlin 2.2.0 on Linux x64/glibc 2.36. Each package reproduces
from two author roots, installs offline, and runs in both languages after
relocation and after deleting consumer sources. Separate compiled probes check
invalid callers and Kotlin nullability.

The [nineteen-base installed checks](../evidence/nominal-primitive-subtype-jvm-20261015/index.json)
extend the same records, sealed variant cases and constructor-free results to
all nineteen primitive bases: `Unit`, `Bool`, unsigned and signed fixed-width
integers, `Nat`, `Int`, `Float32`, `Float`, `String`, `ByteArray`, `Char`,
`USize` and `ISize`. A checked field takes its primitive's Kotlin value: the
generated `Unit` singleton, `Boolean`, `Int` for `UInt8` and `UInt16`, `Long`
for `UInt32`, `BigInteger` for `UInt64`, `Nat`, `Int` and `USize`, `Byte`,
`Short`, `Int` and `Long` for the signed fixed-width integers, `Long` for
`ISize`, `Float` and `Double`, `String`, `ByteArray`, and `Int`
Unicode scalars for `Char`. The packages use 64-bit machine words. A Lean record
named `Pair` is generated as `PacketPair` so it does not collide with the
generated tuple class. Both author routes and API modes reproduce the Maven
package from two author roots, install offline after author removal, and run
Java and Kotlin callers after relocation and again from a source-free
deployment. The full API checks per-site constructor selection and
normalization, fixed-width wrapping, signed zero, refused non-finite floats,
Unicode scalars, binary bytes, active branches, mixed `Fin` guards, host
conversion refusals, exact rejection paths, caller snapshots and recovery. The
runs use JDK 22.0.2 and Kotlin 2.2.0 on Linux x64/glibc 2.36 with an explicit
2.36 package floor and a local load-admission ceiling of 8.

The [required JVM workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-jvm.yml)
runs those four selections. The local archive does not establish its hosted
glibc 2.38 result. Refined callbacks, owned, recursive and dependent Subtypes,
plus generic Subtypes beyond the closed `GenericNat` alias, still need acceptance. These runs do not
measure constructor/source entry counts or memory.

The [hosted generic-Subtype matrix](../evidence/generic-subtype-promotion-20261023.md) installs the closed `GenericNat` alias of `GenericCarrier Nat` on ordinary-source and reviewed-IR packages across the sixteen non-PHP-Wasm consumer profiles. Its selected `Positive` field crosses as a proof-erased value beside a retained `Nat` marker, and the two named specializations keep their distinct `plusOne` and `plusTwo` constructors. Rejection preserves the caller record, a later valid call recovers, and copied results carry no constructor. PHP-Wasm, open generic host types, arbitrary type arguments or predicates, generic `Fin` fields, callback and owned positions, recursive generic graphs, dispatch cost and memory remain outside this evidence.

### Nested checked records

The [nested Java/Kotlin archive](../evidence/nested-checked-record-jvm-20261016/index.json)
adds a nested `Packet` whose `digit` is `Fin 10` and whose `word` is a checked
`Nat` subtype. Kotlin receives a proof-free `Packet` class with two `BigInteger`
fields. The full API carries it through direct and repeated parameters, arrays,
lists, options, tuples, both result branches, `Holder.packet`, and the active
`ChoicePacket` branch. The generated adapter runs the selected record and word
constructors at each present input site. Rejected graphs preserve every caller
value, and later valid calls recover. Separate result-only packages return
packet arrays and options without input-constructor metadata.

Both author routes and API modes reproduce the complete Maven package, remove
the author sources before offline installation, and run Java and Kotlin callers
after relocation and again from a source-free deployment. Compiler probes check
the generated API, Java and Kotlin unit classes, Kotlin function references,
and nullable results. The local runs use JDK 22.0.2 and Kotlin 2.2.0 on Linux
x64/glibc 2.36 with a package floor of 2.36 and a load-admission ceiling of 12.
The [required JVM workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-jvm.yml)
rebuilds all four selections on Ubuntu 24.04 with the glibc 2.38 floor.

The [hosted value-index matrix](../evidence/checked-record-value-index-matrix-promotion-20261020.md) retains ordinary-source and reviewed Maven packages for closed `Bool`, `String`, and `Nat` indexed records. Indices remain metadata; callers pass only generated proof-free Kotlin records with `BigInteger` payloads.

### Type conversions

Profiles: Kotlin. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

[Hosted zero-payload checked-record acceptance](../evidence/zero-payload-checked-record-matrix-closure-20261022.md) covers Kotlin in all four ordinary/reviewed full/result-only package routes from the independently retained host archives that name those profiles. The tested copied parameters and results distinguish proof-only Witness, Unit-bearing Token, plain empty Marker, Option presence, arrays and both Mark branches. Fields, callback positions, owned positions and other zero-payload shapes remain outside this evidence.

[Hosted dependent checked-record acceptance](../evidence/dependent-checked-record-promotion.md) covers Kotlin in all four ordinary/reviewed full/result-only package routes from the independently retained host archives that name those profiles. The proof-free host value carries the tested runtime bound and bounded value. Full packages validate inputs with the selected dependent constructor before Lean execution; standalone result-only packages expose Lean-produced values without checked-input metadata. Fields, callbacks, owned positions, other dependent field kinds, nested or recursive dependent records and open or opaque indices remain outside this evidence.

[Complete hosted dependent-signature acceptance](../evidence/dependent-signatures-hosted-20261028/index.json) covers Kotlin in installed ordinary-source and independently reviewed packages. The tested declaration takes an explicit `Nat` bound followed by `Fin bound`; the host passes both through its ordinary Nat representation, and the generated adapter rejects a value at or above the live earlier bound before Lean entry. The retained matrix covers this direct copied parameter dependency only. Dependent results, fields, callbacks, owned values, later or non-Nat bounds, arbitrary index expressions, and open dependent structures remain outside this evidence.

[Hosted synchronous callback Subtype acceptance](../evidence/callback-subtype-promotion-20261022.md) covers Kotlin on ordinary-source and reviewed-IR packages. A selected Subtype produced by Lean crosses as its proof-erased base value. A host callback reply uses the generated exact typed recovery wrapper, and a returned Lean closure checks its selected Subtype input before entering the closure body. Missing or invalid recovery prevents callback entry, preserves caller values and does not prevent a later valid call. Retained or asynchronous callbacks, arbitrary predicates, checked-record or owned callback positions, recursive or generic refined payloads, dispatch cost and peak memory remain outside this evidence.

[Hosted owned Subtype acceptance](../evidence/owned-subtype-promotion-20261023.md) covers Kotlin on ordinary-source and reviewed-IR packages. The tested acyclic Bundle carries one selected Nat Subtype field beside explicit resource identities. Its constructor validates host input before a successful ownership transfer; rejection leaves ownership with the caller. Leased or retained results preserve their owner lifetime, explicit close or release performs cleanup, and later valid calls recover. Recursive owned graphs, owned checked-record fields, owned callback positions, arbitrary predicates, dispatch cost and peak memory remain outside this evidence. PHP-Wasm keeps its separately audited owned-Subtype boundary.

[Complete hosted HostNull acceptance](../evidence/host-null-complete-20261029/index.json) covers Kotlin in installed ordinary-source and independently reviewed packages. `HostNull.null` uses the target's declared null carrier; `HostNull.value x` carries `x` directly. This rule applies only to explicit `HostNull`: `Option.none`, `Unit`, erased proofs, and omitted or default arguments retain separate representations. The retained matrix exercises parameters, results, record fields, and synchronous callback parameters and results. Owned or asynchronous values and generic or dependent HostNull combinations remain outside this evidence.

[Complete hosted direct proof-erasure acceptance](../evidence/direct-proof-erasure-hosted-20261030/index.json) covers Kotlin in installed ordinary-source and independently reviewed packages. Proof-only parameters, fields, callback arguments and callback results occupy no host slot; public signatures omit them. A declaration whose runtime result is itself a proof is refused instead of being represented by null, Unit, a default or fabricated evidence. Lean metadata retains theorem identity and assumptions, while runtime payloads and refinement checks remain intact. The retained matrix covers exactly these six direct positions; proof-bearing data structures, dependent runtime payloads and propositions that require host evidence keep their separate contracts.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `Generated Java Unit enum` (input, field, callback input); `Unit` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Alias the generated Java Unit enum and pass its INSTANCE. Lean Unit results return Kotlin Unit. Pass the generated Java Unit.INSTANCE enum (alias it as LeanUnit); Unit callback results return Kotlin Unit. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `Boolean` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `Int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Checked nonnegative integer, at most 255. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `Int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Checked nonnegative integer, at most 65535. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Checked nonnegative long, at most 4294967295. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | BigInteger in 0..18446744073709551615. Invalid sign or width throws before narrowing. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `Byte` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `Short` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `Int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `Long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact BigInteger magnitude; negative input throws. Exact java.math.BigInteger. Negative Nat values and callback results reject; captured values retain every bit. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact signed BigInteger with no narrowing. Signed exact java.math.BigInteger without fixed-width or floating-point narrowing. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `Float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `Double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Strict Unicode conversion preserves embedded NUL. Null and malformed UTF-16 throw. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `ByteArray` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Copied mutable byte array with independent returned storage. Null throws. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Primitive array or Array<T>` (input, result, field); `Primitive arrays or Array<T> with independently copied contents` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Primitive arrays retain their scalar mappings; nested/reference arrays preserve their types. Calls deep-copy values and reject nested nulls. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Primitive arrays and `Array<T>` retain exact non-nullable Kotlin types through 24 tested levels. Element order, empty rows, duplicates and records are preserved. Invalid element types and depths fail compilation. Returned arrays have independent storage. Foreign nulls, invalid native buffers and over-budget copies reject. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `Option<T>` (input, result, field); `Option<T> via Option.none() or Option.some(value)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated sealed interface with None/Some branches (Java records or final Kotlin classes), none()/some(value) factories, isSome() and guarded value(). Boxed primitive payloads preserve JVM generic types. Some(None) and Some(Some(Unit)) remain distinct. Null containers and payloads reject. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Result<T, E>` (input, result, field); `Result<T, E> via Result.ok(value) or Result.err(error)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean `Except E T` uses success-first `Result<T, E>.ok(value)` or `.err(error)`. Generated sealed Ok/Err branches support exhaustive matching. isOk() selects guarded value()/error(). Domain errors return Err; bridge failures throw exceptions. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Pair<A, B> (nested binary products)` (input, result, field); `Generated Pair<A, B> (nested binary products)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly two statically typed generated Pair elements, preserving binary nesting. Kotlin uses the generated covariant class, not kotlin.Pair. Inputs are copied; returned arrays own independent storage. Generated records compare and hash nested array contents. Arrays remain mutable; do not mutate them while a containing record is a map key or set member. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated Kotlin class or Java record` (input, result, field); `Generated Kotlin class with structural equality` (callback input, callback result); `Generated Kotlin class with typed val properties` (input, result, field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The companion Kotlin API exposes final classes with typed val properties and deep array equality. The original Java records and accessors remain available in the same JAR. Results own independent copied storage. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Generated final Kotlin classes expose typed val properties and named accessors, preserve record identity and compare nested array contents. The companion Java API remains available. Fields preserve declared order and types. Returned buffers have independent storage. Invalid foreign values reject; partial conversions close their arenas and clear native outputs once. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Kotlin target value; named Lean contract in Maven metadata and Java source docs` (input, result, field); `Kotlin typealias for the copied target` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Aliases retain exact target ranges and copied storage. Nat rejects negative BigInteger while Int accepts it; UInt32 uses range-checked long/Long. Generic compound payloads box primitives; arrays retain primitive storage. Generated Unit inputs and void outputs stay distinct. The original List/Array identities, nested Option/Result presence and copy limits remain unchanged. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `sealed Kotlin interface with named constructor classes (Java API also available)` (input, result, field); `Sealed Kotlin interface with constructor classes` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Construct named Kotlin classes or Java records and match exhaustively with Java switch or Kotlin when. Empty constructors and Unit payloads stay distinct. Numeric tags and native union layouts remain private. Only the active payload is converted; invalid native tags reject before union reads. Scoped arenas and native output guards release partial conversions on errors. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Typed Fn...To... functional interface` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Typed synchronous functional interfaces accept Java and Kotlin lambdas. Call-scoped native stubs retain their targets. Callback failures preserve the same Throwable, stack and suppressed exceptions after cleanup. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `primitive arrays or Array<T>` (input, result, field); `Primitive arrays or Array<T> with independently copied contents` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Typed JVM arrays preserve empty Lists, order, duplicates and nesting. Primitive elements retain primitive array storage; Kotlin uses LongArray for List UInt32, for example. Returned arrays and mutable payloads own independent storage. Nulls, invalid payloads and oversized copies reject. Native lengths, missing buffers and alignment are checked before allocation or reads; scoped arenas and native output clears run on conversion failure. Generated values preserve option presence, domain branches, constructor identity and independent storage. Java and Kotlin keep distinct public value types. Callback exceptions retain their identity after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `Int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Use an integer code point, not a UTF-16 char. A checked Unicode scalar code point including NUL and supplementary values. Surrogates and out-of-range integers reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact BigInteger for the 64-bit compiled Lean target, checked in 0..2^64-1. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `Long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Signed JVM value for the 64-bit compiled Lean target; both endpoints are preserved. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | `java.math.BigInteger checked against the declared bound` (input); `BigInteger below the declared bound` (result); `java.math.BigInteger checked against the field's closed bound` (field); `The target's Nat representation, checked against the declared bound before a returned Lean closure or host callback consumes it` (callback input); `The target's Nat representation, checked against the declared bound before a host reply is reconstructed or projected from Lean` (callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Use BigInteger with the exact closed bound, including inside Array/List/Option/Prod/Except compositions, plain records and active variant fields. Empty containers, absent options and inactive Fin 0 branches are valid; present Fin 0 values are rejected. Rejections preserve caller values and name the failing path and bound. Host-produced Nat carriers are checked against the compiler-derived bound before Lean reconstructs Fin. Lean-produced Fin values cross as their proof-erased Nat carriers. Rejection never synthesizes a default Fin value or proof. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | `BigInteger, String and byte[] or BigInteger, String and ByteArray, checked by the exported Lean validator and constructed by the adapter before dispatch; also in generated structural containers; also in tested acyclic records and variants` (input); `the base value projected from the proof-backed Lean result; also in generated structural containers; also in tested acyclic records and variants` (result); `corresponding Java or Kotlin primitive value in generated records and sealed variant cases across all nineteen tested bases; no proof field; the closed GenericNat record carries its proof-erased Positive value beside a retained Nat marker; the tested acyclic owned Bundle preserves this checked field beside explicit resource identities` (field); `base values checked by the selected constructor in returned-closure inputs` (callback input); `base values from a host callback checked by Lean with an explicit typed recovery` (callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass the primitive base value, including inside Array, List, Option, Prod and Except containers using their generated host representations. Each present Subtype leaf uses the selected checked Lean constructor; accepted normalization reaches the export. A rejected leaf fails the call without changing the input; later valid calls still work. Results expose the proof-backed base values. Transparent aliases and the tested closed List specialization keep their constructor choices. In Java and Kotlin, checked nominal fields preserve all nineteen tested primitive representations with 64-bit machine words: the generated Unit singleton, boolean, int for UInt8 and UInt16, long for UInt32, BigInteger for UInt64, Nat, Int and USize, byte, short, int and long for the signed fixed-width integers, long for ISize, float and double including signed zero, String, byte[] for ByteArray and int Unicode scalars for Char. Generated records and sealed variant cases carry the payloads without proof fields; the Lean Pair record is renamed PacketPair to avoid the generated tuple class. Host conversions reject out-of-range unsigned values, negative Nat values, surrogate characters, invalid UTF-16 text and null payloads before Lean runs. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor. In Java and Kotlin, checked nominal fields preserve all nineteen tested primitive representations with 64-bit machine words: the generated Unit singleton, boolean, int for UInt8 and UInt16, long for UInt32, BigInteger for UInt64, Nat, Int and USize, byte, short, int and long for the signed fixed-width integers, long for ISize, float and double including signed zero, String, byte[] for ByteArray and int Unicode scalars for Char. Generated records and sealed variant cases carry the payloads without proof fields; the Lean Pair record is renamed PacketPair to avoid the generated tuple class. Host conversions reject out-of-range unsigned values, negative Nat values, surrogate characters, invalid UTF-16 text and null payloads before Lean runs. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor. GenericNat is the concrete GenericCarrier Nat alias: its value field crosses without a proof, each named specialization retains its selected plusOne or plusTwo constructor, and copied results carry no constructor. In the tested acyclic owned Bundle, the selected constructor validates the checked field before a successful transferred-input handoff; rejection leaves ownership unchanged, and later valid calls recover. .NET and JVM use generated WithRecovery values; native PHP uses with_recovery(callback, value); WIT typed registration takes an owned copied recovery. Recovery is validated before application execution and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body. Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Checked records and closed Nat indices` | `Generated Kotlin API record with BigInteger and Array<BigInteger> payload fields; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free Envelope/Step mutually recursive graph with nominal identities and active variants preserved; Nominal zero-property Kotlin Witness class; Token keeps its generated Unit property and Marker remains a distinct zero-property class; borrowed or transferred Booking/Claim payload with a live Ticket owner` (input); `Generated Kotlin API record with BigInteger and Array<BigInteger> payload fields; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free Envelope/Step mutually recursive graph with nominal identities and active variants preserved; Nominal zero-property Kotlin Witness result; Token keeps its generated Unit property and Marker remains a distinct zero-property class; leased proof-free Booking/Claim payload; standalone result-only Claim` (result); `Generated Kotlin Packet class with BigInteger digit and word fields nested inside Holder and ChoicePacket; no proof field; also carries the tested proof-free inherited Span, Ticket and Stamped record chain with nested parent subobjects preserved; also carries the tested proof-free Envelope/Step mutually recursive graph with nominal identities and active variants preserved; copied checked Window field inside the resource-bearing owned Booking` (field); `generated proof-free record values checked by the selected constructor in returned-closure inputs; proof-free Claim with a live Ticket owner at synchronous host arguments and checked returned-closure inputs` (callback input); `generated proof-free record values from a host callback checked by Lean through an explicit typed recovery; checked host Claim reply or proof-free returned Lean closure result with the Ticket owner retained` (callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass the generated record's runtime payload fields, without proof values. The selected Lean constructor checks each input and may normalize it; rejection identifies the parameter and constructor and preserves caller data. Results contain copied payload fields with proofs erased. Both ordinary and independently reviewed packages, including standalone result-only packages, passed installed checks. The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated Java and Kotlin adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, array, list, option, tuple, result, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. Closed Bool, String and Nat indices remain authenticated type metadata rather than host fields. The generated C/GMP, C++ multiprecision, C# BigInteger, Java BigInteger and Kotlin BigInteger records expose only proof-free payloads. Full packages validate all eight indexed inputs through the exact selected Lean constructors, preserve rejected caller values, recover on the next valid call and return all eight proof-free results. Standalone result-only packages expose the same results without checked-input metadata. Proof-only Witness crosses as a nominal, non-null JVM object with no application payload: Java exposes a zero-component record and Kotlin a zero-property class. Token keeps its generated Unit member, plain empty Marker remains a distinct nominal type, Option presence stays explicit, arrays retain length and independent elements, and active or inactive Mark branches remain distinct. Full packages validate nullary checked constructors and exact rejection and recovery. Result-only packages project Lean-produced proof-erased values without input-constructor metadata. The proof-free host value carries bound and below as payload fields. Full packages validate each host input through the selected DependentRecords.mkDependent constructor, which rejects below >= bound before Lean code runs, preserve rejected caller values and return the exact proof-free result. Standalone result-only packages expose Lean-produced results without checked-input metadata. Independent owned checked-record acceptance adds the acyclic Booking/Window and Ticket/Claim forms only. Host-produced inputs use the selected mkWindow or mkClaim before ownership transfer or Lean entry; Lean-produced values omit proofs. Full packages also check synchronous host replies and returned-closure inputs, preserve rejected caller values and recover on later valid calls. Standalone result-only packages expose Claim results without input-constructor, transfer or callback metadata. Earlier composition limits still apply to those earlier fixtures. Pass the generated record's runtime payload fields, without proof values. The selected Lean constructor checks each input and may normalize it; rejection identifies the parameter and constructor and preserves caller data. Results contain copied payload fields with proofs erased. Both ordinary and independently reviewed packages, including standalone result-only packages, passed installed checks. The tested Packet carries a Fin 10 digit and a checked Nat Subtype word as BigInteger values. Holder nests Packet, and ChoicePacket carries it in the active Choice branch. Generated Java and Kotlin adapters apply the exact Packet and nested Word constructors selected at each direct, repeated, array, list, option, tuple, result, Holder and Choice input site. Rejected calls preserve the complete caller graph and later valid calls recover. Packet arrays and options returned by Lean contain proof-free payloads without input-constructor selections. The tested Span, Ticket and Stamped inheritance chain remains a chain of nested parent subobjects rather than flattened fields. Generated adapters preserve the parent aliases and public nominal identities, erase the ordered, linked and stamped proof fields, apply the exact per-site Span, Word, Ticket and Stamped constructors in dependency order, retain independent choices for repeated parameters, check the nested Fin 8 mark, preserve rejected caller values and recover on the next valid call. Full packages check inputs and proof-free results; result-only packages project the same inherited payloads without input-constructor metadata. The tested checked-record graphs preserve nominal identity through a self-recursive Packet and a mutually recursive Envelope ↔ Step pair, including aliases, Array and Option wrappers, active variant branches, exact Nat Subtype constructors and Fin 3 fields. Generated adapters validate every selected input site in dependency order, erase proof fields, expose constructor-free copied results, preserve rejected caller graphs and recover on the next valid call. Independent owned checked-record acceptance adds the acyclic Booking/Window and Ticket/Claim forms only. Host-produced inputs use the selected mkWindow or mkClaim before ownership transfer or Lean entry; Lean-produced values omit proofs. Full packages also check synchronous host replies and returned-closure inputs, preserve rejected caller values and recover on later valid calls. Standalone result-only packages expose Claim results without input-constructor, transfer or callback metadata. Earlier composition limits still apply to those earlier fixtures. .NET and JVM use generated WithRecovery values; native PHP uses with_recovery(callback, value); WIT typed registration owns a copied recovery record. Recovery is checked before callback entry or application execution and is never successful output. Returned Lean closures apply the selected record and nested field constructors before their body. Independent owned checked-record acceptance adds the acyclic Booking/Window and Ticket/Claim forms only. Host-produced inputs use the selected mkWindow or mkClaim before ownership transfer or Lean entry; Lean-produced values omit proofs. Full packages also check synchronous host replies and returned-closure inputs, preserve rejected caller values and recover on later valid calls. Standalone result-only packages expose Claim results without input-constructor, transfer or callback metadata. Earlier composition limits still apply to those earlier fixtures. Required: Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs. |
| `Dependent parameters and results` | `the profile's ordinary Nat values for the bound and Fin payload; payload < the live earlier bound` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass the bound and Fin payload through the profile's ordinary Nat representation. The adapter enforces payload < the live earlier bound before Lean entry; no proof value crosses the host boundary. Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named non-null Kotlin records and sealed cases; typed arrays and generated Option, Result and Pair` (input, result, field); `Named Kotlin value classes and constructors, non-null typed arrays, SAM callbacks and AutoCloseable LeanClosure values` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated non-null Kotlin classes preserve recursive families without widening to Any. Wide constructors use typed builders. Arrays remain mutable; results own independent storage. Foreign JVM nulls, cycles and invalid cases reject. The shared Java conversion engine enforces 128 value levels, 262,144 visited values and separate 16 MiB copy budgets. Recursive records, variants and aliases retain distinct typed Java and Kotlin representations and independently copied storage. Reply scopes retain buffers until native copying finishes. Throwable identity survives cleanup. Malformed native output retires the shared runtime. Owned closures defer release during active calls and Cleaner reclamation releases abandoned identities. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Concrete static JVM method for each configured specialization, called from Java and Kotlin` (signature); `A concrete exported function over the selected named record, List or Option specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Each configured type application becomes a distinct monomorphic host function. The unspecialized Lean declaration is absent. Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures. Array-valued fields and arrays of alias-named records use the host's ordinary array representation with recursive element checks. Call the concrete export with its selected value; Lean fixes the configured type before compilation and no runtime type token crosses the host boundary. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | `Concrete host signature with no runtime type argument` (signature); `A concrete exported host signature whose implicit Lean type argument was fixed before compilation` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean elaboration supplies configured type arguments before native compilation; the host passes no placeholder value. Call the concrete export with its selected value; Lean fixes the configured type before compilation and no runtime type token crosses the host boundary. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | `Concrete host signature with the Lean-selected instance dictionary erased` (signature); `A concrete exported function whose selected type-class dictionary is compiled into the specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean synthesizes the selected dictionary before native compilation. The host cannot provide or replace it. Call the concrete export normally; the configured dictionary is already selected and no dictionary token crosses the host boundary. Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | `erased; no host argument` (input); `no runtime result; a proof-valued export is refused` (result); `erased; no host field` (field); `erased; no host callback argument` (callback input); `erased; no host callback result` (callback result); `proof-free public signature` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Proof-only parameters, fields and synchronous callback positions consume no host storage; public signatures omit them, and proof-valued exports are rejected rather than represented by null, Unit, defaults or fabricated proofs. Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | `Typed parameter with the Lean-declared Kotlin default` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Omit the argument to select the authenticated Lean default. Supplying the default explicitly remains a supplied value; Option.none, Unit and explicit host null keep their own representations and validation. Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | `T?; Option<T> remains explicit None/Some` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | T?; Option<T> remains explicit None/Some. Only the declared HostNull null constructor uses the nullable branch; source Option, Unit, erased proofs and omitted/default arguments retain their own representations. Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `Signature-specific LeanClosure (AutoCloseable)` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | The signature-specific LeanClosure implements its functional interface and AutoCloseable. Invoke on the creating platform thread. Use invoke, isClosed and close; saved method references share its lifetime. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

Kotlin consumes the generated Java API, so its types follow that API rather than Kotlin-specific unsigned wrappers.

| Lean type | Kotlin type | Conversion rules |
| --- | --- | --- |
| `Bool` | `Boolean` | Native Boolean value. |
| `UInt32` | `Long` | Range `0L..0xffff_ffffL`; pass `42L`, not a Kotlin `UInt`. |
| `String` | `String` | Encoded as UTF-8 across the native boundary; the Java API rejects `null`. |
| `ByteArray` | `ByteArray` | Signed bytes preserve their bits; `255.toByte()` represents `0xff`. |
| `Array UInt32` | `LongArray` | Use `longArrayOf`; each element must be in the `UInt32` range. |
| `Payload` | `Payload` | Java record with methods such as `count()`; constructor and array accessors copy buffers. |
| `Box` | `Box` | `AutoCloseable` resource; `identity()` returns the same wrapper. Use `use`. |
| `UInt32 → UInt32` callback | `Transform` via a `(Long) -> Long` lambda | Kotlin converts the lambda to the Java functional interface; invocation is synchronous. |
| Returned Lean closure | `OwnedTransform` | `AutoCloseable` resource with `apply(Long)`; use `use`. |

Kotlin coroutines do not change the synchronous contract of these calls.

### Kotlin types and resource scopes

Use `Long` for Lean `UInt32` values, with range `0L..0xffff_ffffL`. The Java API expects `Long`, not Kotlin `UInt`. Use `longArrayOf` for integer arrays and `byteArrayOf` for byte buffers; `255.toByte()` represents `0xff`.

`Payload` is a Java record with accessor methods such as `count()` and `values()`. It copies incoming arrays and returns array copies. Alpha's `roundTrip` flips `enabled` and increments `count`, preserving the remaining fields.

Kotlin lambdas satisfy the generated synchronous transform interface. `withCallback(40L) { it + 2L }` returns `44L` because Lean adds one before and after invoking the callback. A returned `OwnedTransform` uses `apply`.

Both `Box` and `OwnedTransform` implement `AutoCloseable`. Kotlin's `use` releases them even when the body throws. The explicit closes in the example verify idempotent cleanup and rejection of later calls. `box.identity() === box` checks wrapper identity.

## Errors and troubleshooting

- Invalid unsigned values raise `IllegalArgumentException` at the Java API boundary.
- A callback exception becomes `CallbackThrewException`; its `cause` retains the original Kotlin exception. Closed resources raise `DisposedResourceException`.
- If Kotlin cannot find `Alpha` or `Box`, verify that `LEAN_BRIDGE_JAR` points at the JAR in the application-local Maven cache, and pass the classpath at both compile and run time.
- `UnsupportedClassVersionError` indicates an older JVM. The Kotlin runner must launch JDK 22, not just the Java compiler.
- Pass `-J--enable-native-access=ALL-UNNAMED` to `kotlin`; the `-J` prefix forwards the option to its JVM.
- Native loading requires the documented glibc and architecture, plus a writable temporary directory for bundled-library extraction. Leave `LEAN_BRIDGE_NATIVE_ROOT` unset.

## Owned checked records

[Hosted owned checked-record acceptance](../evidence/owned-checked-record-promotion-20261026-aligned.md) covers Kotlin on ordinary Lean-source and independently reviewed package routes. The tested forms are `Booking`, whose `Window` field is copied and checked, and `Claim`, whose `Ticket` resource stays owned while its quota is checked. Proof fields do not cross the boundary.

Use the generated record carriers and keep the `Ticket` owner alive for the call. A borrowed call leaves the caller's owner intact. A transferred call validates the record before moving that owner; rejected inputs remain usable. Leased results require the cleanup described by this language's ownership API. Synchronous callbacks exchange proof-free `Claim` values: host-produced replies and inputs to a returned Lean closure are checked, while Lean-produced arguments and results are projected without proof fields.

Full packages exercise inputs, results, the nested `Window` field, synchronous callbacks and returned Lean closures. Standalone result-only packages expose Lean-produced `Claim` results without checked-input, transfer or callback metadata. A successful result-only package is not evidence for those input or callback paths.

This acceptance does not cover `Grant` and its nested Subtype, arbitrary owned containers, recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch cost or peak memory. Earlier copied, generic and dependent-record receipts retain their own narrower scopes.

## Start from a raw Lean package

Follow [the Kotlin build-and-publish guide](../publish/maven.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Related workflows and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/maven.md).
