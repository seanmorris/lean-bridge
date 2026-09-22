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

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package). Kotlin `List<T>` and boxed `Array<Long>` do not replace a required `LongArray`. Calls preserve empty Lists, order, duplicates and nesting, and return independent copies. Elements and containers are non-nullable. The [Java List conversion rules](java.md#lists) cover validation, budgets and cleanup. [Installed checks](../evidence/kotlin-collections-20260922.md) compile the Kotlin API consumer independently against the same prepared JAR as Java. List callback payloads remain unsupported.

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

### Alpha interoperability example

The remaining example uses the authenticated `org.leanbridge:lean-alpha:0.0.0` fixture to demonstrate identity-bearing resources, which ordinary-source Maven builds do not yet admit. Set `LEAN_BRIDGE_MAVEN_RELEASE` to the Alpha release directory containing `repository/`.

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

## Values and cleanup

### Type conversions

Profiles: Kotlin. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

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
| `Array α` | `Primitive array or Array<T>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Primitive arrays retain their scalar mappings; nested/reference arrays preserve their types. Calls deep-copy values and reject nested nulls. Primitive arrays and `Array<T>` retain exact non-nullable Kotlin types through 24 tested levels. Element order, empty rows, duplicates and records are preserved. Invalid element types and depths fail compilation. Returned arrays have independent storage. Foreign nulls, invalid native buffers and over-budget copies reject. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `Option<T>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Generated sealed interface with None/Some branches (Java records or final Kotlin classes), none()/some(value) factories, isSome() and guarded value(). Boxed primitive payloads preserve JVM generic types. Some(None) and Some(Some(Unit)) remain distinct. Null containers and payloads reject. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Result<T, E>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Lean `Except E T` uses success-first `Result<T, E>.ok(value)` or `.err(error)`. Generated sealed Ok/Err branches support exhaustive matching. isOk() selects guarded value()/error(). Domain errors return Err; bridge failures throw exceptions. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Pair<A, B> (nested binary products)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exactly two statically typed generated Pair elements, preserving binary nesting. Kotlin uses the generated covariant class, not kotlin.Pair. Inputs are copied; returned arrays own independent storage. Generated records compare and hash nested array contents. Arrays remain mutable; do not mutate them while a containing record is a map key or set member. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated Kotlin class or Java record` (input, result, field); `Generated Kotlin class with typed val properties` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | The companion Kotlin API exposes final classes with typed val properties and deep array equality. The original Java records and accessors remain available in the same JAR. Results own independent copied storage. Generated final Kotlin classes expose typed val properties and named accessors, preserve record identity and compare nested array contents. The companion Java API remains available. Fields preserve declared order and types. Returned buffers have independent storage. Invalid foreign values reject; partial conversions close their arenas and clear native outputs once. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Kotlin target value; named Lean contract in Maven metadata and Java source docs` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Aliases retain exact target ranges and copied storage. Nat rejects negative BigInteger while Int accepts it; UInt32 uses range-checked long/Long. Generic compound payloads box primitives; arrays retain primitive storage. Generated Unit inputs and void outputs stay distinct. The original List/Array identities, nested Option/Result presence and copy limits remain unchanged. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `sealed Kotlin interface with named constructor classes (Java API also available)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Construct named Kotlin classes or Java records and match exhaustively with Java switch or Kotlin when. Empty constructors and Unit payloads stay distinct. Numeric tags and native union layouts remain private. Only the active payload is converted; invalid native tags reject before union reads. Scoped arenas and native output guards release partial conversions on errors. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Typed Fn...To... functional interface` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Typed synchronous functional interfaces accept Java and Kotlin lambdas. Call-scoped native stubs retain their targets. Callback failures preserve the same Throwable, stack and suppressed exceptions after cleanup. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `primitive arrays or Array<T>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Typed JVM arrays preserve empty Lists, order, duplicates and nesting. Primitive elements retain primitive array storage; Kotlin uses LongArray for List UInt32, for example. Returned arrays and mutable payloads own independent storage. Nulls, invalid payloads and oversized copies reject. Native lengths, missing buffers and alignment are checked before allocation or reads; scoped arenas and native output clears run on conversion failure. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `Int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Use an integer code point, not a UTF-16 char. A checked Unicode scalar code point including NUL and supplementary values. Surrogates and out-of-range integers reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact BigInteger for the 64-bit compiled Lean target, checked in 0..2^64-1. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `Long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Signed JVM value for the 64-bit compiled Lean target; both endpoints are preserved. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
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

## Start from a raw Lean package

Follow [the Kotlin build-and-publish guide](../publish/maven.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Related workflows and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/maven.md).
