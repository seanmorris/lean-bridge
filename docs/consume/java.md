# Java

Install a prepared Maven JAR and call its generated Java API. The JAR carries the compiled Lean component and shared runtime. Consumers need Java, not Lean or handwritten native conversions.

## Use a prepared release

### Prerequisites

Use JDK 22 and Maven on x86-64 Linux with glibc 2.38 or newer. Check `java -version`, `javac -version`, `mvn -version`, and `ldd --version`; Maven must also run on JDK 22. The [support contract](../consumer-support.v1.json) records this JVM profile.

Follow [Use a prepared release](receive-package.md) to obtain and authenticate the package. Keep its POM and JAR together. No Maven Central publication is assumed.

### Call an ordinary Lean package

The package README names its Maven coordinate, Java package and functions. The local acceptance package uses `com.acme:maple-api:2.0.0-rc.1` and `org.leanbridge.maple.Api`. These coordinates identify a test archive, not a Maven Central release.

Install the original JAR and POM into your local Maven repository:

```sh
export LEAN_BRIDGE_MAVEN_RELEASE=/absolute/path/to/maple-release
export LEAN_BRIDGE_M2="$PWD/.m2"
mvn --batch-mode --quiet "-Dmaven.repo.local=$LEAN_BRIDGE_M2" \
  org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file \
  "-Dfile=$LEAN_BRIDGE_MAVEN_RELEASE/archives/maple-api-2.0.0-rc.1.jar" \
  "-DpomFile=$LEAN_BRIDGE_MAVEN_RELEASE/archives/maple-api-2.0.0-rc.1.pom"
export LEAN_BRIDGE_JAR="$LEAN_BRIDGE_M2/com/acme/maple-api/2.0.0-rc.1/maple-api-2.0.0-rc.1.jar"
```

Maven downloads its install plugin on the first run. The Lean package comes from the supplied archives. Save `Example.java`:

```java
import java.math.BigInteger;
import org.leanbridge.maple.Api;

class Example {
    public static void main(String[] args) {
        System.out.println(Api.echoNat(BigInteger.ONE.shiftLeft(200)));
        System.out.println(Api.echoText("Lean λ🌿"));
        System.out.println(Api.matrix(new long[] {1, 2, 3})[1][2]);
    }
}
```

```sh
javac --release 22 -encoding UTF-8 -cp "$LEAN_BRIDGE_JAR" Example.java
java --enable-native-access=ALL-UNNAMED -cp ".:$LEAN_BRIDGE_JAR" Example
```

UInt8 and UInt16 use range-checked `int`; UInt32 uses range-checked `long`. UInt64, Nat and Int use `BigInteger`. Signed integers and floating-point values use their corresponding Java primitives. Arrays use typed Java arrays, ByteArray uses `byte[]`, and copied structures become Java records. Unit inputs use the generated `Unit.INSTANCE`; Unit results return `void`.

Calls copy nested inputs and outputs. Null, negative Nat, out-of-range unsigned values and malformed UTF-16 throw. Native input and output conversions share a 16 MiB budget; the Java input scratch budget is also bounded. An oversized result throws after Lean returns. Scoped native memory and deep owned results are released on failure. The loader checks bundled native hashes, shares a compatible runtime and removes its private extracted files at normal JVM shutdown.

### Alpha interoperability example

The remaining example uses `org.leanbridge:lean-alpha:0.0.0`. It exercises resources and callbacks through the separate Alpha fixture API. Ordinary-source Maven builds currently admit pure copied values only. Set `LEAN_BRIDGE_MAVEN_RELEASE` to the authenticated Alpha release directory containing `repository/org/leanbridge/lean-alpha/0.0.0/`.

## Resolve the package

Run these commands from an empty application directory. Maven downloads its pinned dependency plugin, then resolves Alpha from the local release into an application-local cache:

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

If you already use Maven, the dependency coordinates are:

```xml
<dependency>
  <groupId>org.leanbridge</groupId>
  <artifactId>lean-alpha</artifactId>
  <version>0.0.0</version>
</dependency>
```

Configure your application's repository to use the authenticated release location. The commands above are the complete runnable example and do not require a `pom.xml`.

### Write the application

Save this complete class as `Consumer.java` in the same directory:

```java file=java/Consumer.java
import java.util.Arrays;
import org.leanbridge.alpha.Alpha;
import org.leanbridge.alpha.Box;
import org.leanbridge.alpha.CallbackThrewException;
import org.leanbridge.alpha.DisposedResourceException;
import org.leanbridge.alpha.OwnedTransform;
import org.leanbridge.alpha.Payload;

public final class Consumer {
    private static void check(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }

    public static void main(String[] args) {
        try (Box box = new Box(42L); OwnedTransform adder = Alpha.makeAdder(2L)) {
            check(box.read() == 42L && box.identity() == box, "Box identity");
            System.out.println("Box: " + box.read());

            Payload payload = Alpha.roundTrip(new Payload(
                true, 41L, "Lean λ", new byte[]{0, (byte)255}, new long[]{0L, 0xffff_ffffL}));
            check(!payload.enabled() && payload.count() == 42L && payload.label().equals("Lean λ")
                && Arrays.equals(payload.bytes(), new byte[]{0, (byte)255})
                && Arrays.equals(payload.values(), new long[]{0L, 0xffff_ffffL}), "Payload");
            System.out.println("Payload count: " + payload.count());

            long callback = Alpha.withCallback(40L, value -> value + 2L);
            check(callback == 44L, "Callback result");
            System.out.println("Callback: " + callback);
            check(adder.apply(40L) == 42L, "Returned callable");
            System.out.println("Callable: " + adder.apply(40L));

            try {
                Alpha.withCallback(40L, value -> { throw new IllegalStateException("callback marker"); });
                throw new IllegalStateException("Callback failure was accepted");
            } catch (CallbackThrewException error) {
                check(error.getCause() instanceof IllegalStateException
                    && error.getCause().getMessage().equals("callback marker"), "Callback cause");
            }

            adder.close();
            adder.close();
            box.close();
            box.close();
            try {
                box.read();
                throw new IllegalStateException("Closed Box was accepted");
            } catch (DisposedResourceException expected) { }
            try {
                adder.apply(40L);
                throw new IllegalStateException("Closed callable was accepted");
            } catch (DisposedResourceException expected) { }
            System.out.println("Errors and cleanup: passed");
        }
    }
}
```

### Compile and run

```sh
mkdir -p classes
javac --release 22 -encoding UTF-8 -cp "$LEAN_BRIDGE_JAR" -d classes Consumer.java
java --enable-native-access=ALL-UNNAMED -cp "classes:$LEAN_BRIDGE_JAR" Consumer
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

Profiles: Java. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `Unit` (input, field); `void` (result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Pass Unit.INSTANCE; Unit results return void. Unit fields and array elements use the generated enum. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `boolean` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Checked nonnegative integer, at most 255. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Checked nonnegative integer, at most 65535. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected | Checked nonnegative long, at most 4294967295. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `BigInteger` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | BigInteger in 0..18446744073709551615. Invalid sign or width throws before narrowing. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `byte` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `short` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `long` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `BigInteger` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Exact BigInteger magnitude; negative input throws. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `BigInteger` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Exact signed BigInteger with no narrowing. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Inspected: no host mapping | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Strict Unicode conversion preserves embedded NUL. Null and malformed UTF-16 throw. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `byte[]` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Copied mutable byte array with independent returned storage. Null throws. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Typed Java array` (input, result, field); `long[]` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Primitive arrays retain their scalar mappings; nested/reference arrays preserve their types. Calls deep-copy values and reject nested nulls. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated Java record` (input, result, field); `Payload` (input, result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Generated Java records preserve field order through compiler-owned accessors. Nested arrays in results are independent copies. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Transform` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | `int` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Use an integer code point, not a UTF-16 char. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
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

These mappings describe the prepared Alpha JAR's `org.leanbridge.alpha` API.

| Lean type | Java type | Conversion rules |
| --- | --- | --- |
| `Bool` | `boolean` | Primitive Boolean, not nullable `Boolean`. |
| `UInt32` | `long` | Range `0L..0xffff_ffffL`. A Java `int` cannot represent the upper half as positive values. |
| `String` | `String` | Encoded as UTF-8 across the native boundary; `null` is rejected. |
| `ByteArray` | `byte[]` | Signed Java bytes preserve their eight bits; `(byte)255` represents `0xff`. |
| `Array UInt32` | `long[]` | Every element must be in the `UInt32` range. |
| `Payload` | `Payload` | Java record; constructor and array accessors copy buffers. |
| `Box` | `Box` | `AutoCloseable` resource; `identity()` returns the same wrapper. |
| `UInt32 → UInt32` callback | `Transform` | Generated functional interface with `long apply(long)`; accepts a synchronous lambda. |
| Returned Lean closure | `OwnedTransform` | `AutoCloseable` resource with `apply(long)`; use try-with-resources. |

Invalid unsigned values raise `IllegalArgumentException`. Its `long` mapping is specifically for `UInt32`, not arbitrary Lean integers.

## Types, callbacks, and cleanup

The JVM API represents Lean `UInt32` as a `long` in the range `0..0xffff_ffffL`. It rejects negative or larger input values with `IllegalArgumentException`. Java bytes are signed, so use `(byte)255` to supply the byte `0xff`. `Payload` copies input arrays and returns copies from its array accessors.

Alpha's `roundTrip` flips the Boolean and increments the count while preserving its other fields. `withCallback(40, value -> value + 2)` returns `44`: Lean calls the callback with `41`, receives `43`, and adds one. Callbacks run synchronously. `makeAdder(2)` returns an owned Lean callable.

`Box` and `OwnedTransform` implement `AutoCloseable`. Use try-with-resources so an exception still releases both. Repeated `close()` is harmless; a later operation raises `DisposedResourceException`. `Box.identity()` returns the original wrapper.

## Errors and troubleshooting

- Callback failures raise `CallbackThrewException`; `getCause()` retains the original Java exception. The example verifies that cause.
- Other reported Lean/native failures raise `LeanBridgeException` or its generated subclasses.
- `UnsupportedClassVersionError` means the running JVM is older than the JAR's target. Check the executables used by Maven, `javac`, and `java`.
- Keep `--enable-native-access=ALL-UNNAMED` on the application launch command. This example uses the classpath, not a named Java module.
- A native-load failure can indicate glibc older than 2.38, an unsupported architecture, or an unwritable temporary directory used to extract the bundled libraries. Leave `LEAN_BRIDGE_NATIVE_ROOT` unset to use those libraries.
- A Maven resolution failure often means `LEAN_BRIDGE_MAVEN_RELEASE` points at `repository/` rather than its parent. The command appends `/repository`.

## Start from a raw Lean package

Follow [the Java build-and-publish guide](../publish/maven.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Related workflows and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/maven.md).
