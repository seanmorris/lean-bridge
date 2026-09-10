# Kotlin

Use Alpha's Java API directly from Kotlin. The package is the same Maven JAR used by Java consumers; no separate Kotlin binding is required.

## Use a prepared release

### Prerequisites

Use JDK 22, the Kotlin JVM command-line compiler and runner, and Maven on x86-64 Linux with glibc 2.38 or newer. Check `java -version`, `kotlinc -version`, `kotlin -version`, `mvn -version`, and `ldd --version`. Run all JVM tools with JDK 22. The [support contract](../consumer-support.v1.json) records the shared JVM profile; the pinned consumer environment supplies Kotlin.

Follow [Use a prepared release](receive-package.md) for the authenticated Alpha Maven release, `org.leanbridge:lean-alpha:0.0.0`. Set `LEAN_BRIDGE_MAVEN_RELEASE` to the absolute directory containing its `repository/` directory. No Gradle project or registry publication is required for this example.

### Resolve the JAR

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

### Type conversions

Profiles: Kotlin. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `Boolean` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Long` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -128..127; reject overflow before narrowing. |
| `Int16` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `ByteArray` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `LongArray` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Payload` (input, result) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Transform / lambda` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
| `Lean function returned to the host` | `OwnedTransform` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
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

### Errors and troubleshooting

- Invalid unsigned values raise `IllegalArgumentException` at the Java API boundary.
- A callback exception becomes `CallbackThrewException`; its `cause` retains the original Kotlin exception. Closed resources raise `DisposedResourceException`.
- If Kotlin cannot find `Alpha` or `Box`, verify that `LEAN_BRIDGE_JAR` points at the JAR in the application-local Maven cache, and pass the classpath at both compile and run time.
- `UnsupportedClassVersionError` indicates an older JVM. The Kotlin runner must launch JDK 22, not just the Java compiler.
- Pass `-J--enable-native-access=ALL-UNNAMED` to `kotlin`; the `-J` prefix forwards the option to its JVM.
- Native loading requires the documented glibc and architecture, plus a writable temporary directory for bundled-library extraction. Leave `LEAN_BRIDGE_NATIVE_ROOT` unset.

## Start from a raw Lean package

For Alpha, [build the managed Maven package](../contributing/testing.md#managed-packages). Kotlin consumes the same JAR and POM as Java; use that completed release with [Resolve the JAR](#resolve-the-jar).

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Related workflows and acceptance

The [Java guide](java.md) documents the shared Maven coordinates. Alpha uses the [managed target profile](../architecture/adr/23-managed-runtime-target-profiles.md).

Contributors can [build the managed examples](../contributing/testing.md#managed-packages) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [managed acceptance evidence](../evidence/managed-consumer-acceptance.md).

### Publish this package

See [Publish to Maven repositories](../publish/maven.md) for package preparation, distribution, and verification after upload.
