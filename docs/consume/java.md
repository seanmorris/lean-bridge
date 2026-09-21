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

UInt8 and UInt16 use range-checked `int`; UInt32 uses range-checked `long`. UInt64, Nat and Int use `BigInteger`. Signed integers and floating-point values use their corresponding Java primitives. Arrays and Lists use typed Java arrays, ByteArray uses `byte[]`, and copied structures become Java records. Unit inputs use the generated `Unit.INSTANCE`; Unit results return `void`.

Calls copy nested inputs and outputs. Null, negative Nat, out-of-range unsigned values and malformed UTF-16 throw. Native input and output conversions share a 16 MiB budget; the Java input scratch budget is also bounded. An oversized result throws after Lean returns. Scoped native memory and deep owned results are released on failure. The loader checks bundled native hashes, shares a compatible runtime and removes its private extracted files at normal JVM shutdown.

### Lists

Lean `List T` uses a typed Java array in inputs, results and record fields. Primitive elements use primitive arrays, such as `long[]` for `List UInt32`. Reference elements use arrays such as `BigInteger[]` for `List Nat`. Lists can nest with arrays, records, options, results and products. Lean List and Array retain distinct contract identities.

For the `org.leanbridge:lists:1.0.0` acceptance archive, save `Example.java`:

```java
import java.util.Arrays;
import org.leanbridge.lists.Api;

class Example {
    public static void main(String[] args) {
        long[] input = {1, 2, 2, 3};
        long[] reversed = Api.reverseUint32(input);
        System.out.println(Arrays.toString(reversed)); // [3, 2, 2, 1]
        reversed[0] = 99; // input is unchanged
        System.out.println(Api.reverseUint32(new long[0]).length); // 0
    }
}
```

Compile and run using the [prepared JAR commands](#call-an-ordinary-lean-package). Pass arrays, not `java.util.List`, boxed numeric arrays or streams. Copies preserve order, duplicates and every nesting level; returned mutable values have independent storage. Nulls, invalid payloads and oversized copies throw. Native sequence lengths and buffer alignment are checked before allocation or element reads. The existing budgets and 32-level type limit apply. [Installed List checks](../evidence/jvm-lists-20260920.md) cover both source paths, compiler rejections, cleanup and runtime-only deployment. List callback payloads remain unsupported.

### Named copied aliases

Copied Lean aliases use ordinary Java target types. An alias of UInt32 uses
checked `long`, an alias of Nat uses `BigInteger`, and an alias of
`Array (List UInt32)` uses `long[][]`. The prepared JAR retains alias names,
original targets and chains in its manifest, README and generated Java source
documentation. Parameters, results and record components retain their contract
names. Aliases add no wrapper classes.

For the `org.leanbridge:aliases:1.0.0` acceptance archive, save `Example.java`:

```java
import java.math.BigInteger;
import org.leanbridge.aliases.Api;

class Example {
    public static void main(String[] args) {
        long count = Api.make();
        System.out.println(Api.increment(count)); // 42
        System.out.println(Api.echoNat(BigInteger.ONE.shiftLeft(200)));
        long[][] rows = Api.reverseRows(new long[][] {{1, 2, 3}, {}});
        System.out.println(rows[0][0]); // 3
    }
}
```

Use the [prepared JAR compilation commands](#call-an-ordinary-lean-package).
Nat still rejects negative `BigInteger` values while Int accepts them; UInt32
rejects values outside `0..4294967295`. Arrays and record contents remain copied.
See the [installed alias checks](../evidence/jvm-aliases-20260921.md).

### Options, results and products

Ordinary-source and reviewed Maven packages support `Option`, `Except` and nested binary products, including mixtures with arrays, Lists and copied records. The JAR supplies sealed `Option<T>` and `Result<T, E>` interfaces with record branches, plus a `Pair<A, B>` record.

For the `org.leanbridge:compounds:1.0.0` acceptance archive, save `Example.java`:

```java
import org.leanbridge.compounds.Api;
import org.leanbridge.compounds.Option;
import org.leanbridge.compounds.Pair;
import org.leanbridge.compounds.Unit;

class Example {
    public static void main(String[] args) {
        var present = Api.optionUint32(Option.some(42L));
        System.out.println(present.value()); // 42
        System.out.println(Api.classify(Option.some(Option.<Unit>none()))); // 1
        System.out.println(Api.tupleUint32(new Pair<>(1L, 2L)).first()); // 2
        var result = Api.duplicate(Option.none());
        if (!result.isOk()) System.out.println(result.error()); // empty
    }
}
```

Compile and run using the [prepared JAR commands](#call-an-ordinary-lean-package). Generic payloads use boxed Java primitives: `Option<Long>` for `Option UInt32`, for example. `ByteArray` remains `byte[]`, and arbitrary integers retain `BigInteger`.

`Option.none()` and `Option.some(Unit.INSTANCE)` are different values. Nested options retain every branch. Read `value()` when `isSome()` is true. `Result.ok(value)` and `Result.err(error)` preserve Lean `Except E T` as `Result<T, E>`; read `value()` when `isOk()` is true, otherwise `error()`. An inactive accessor throws `IllegalStateException`. Domain errors return `Err`; bridge failures throw exceptions. Both sealed hierarchies support exhaustive Java switches.

Factories and record constructors reject null payloads; calls reject null containers. A `Pair` always has two typed elements and retains product nesting. Returned arrays own independent copies. Java record equality compares array fields by reference, so use content comparisons for arrays. The 32-level type limit and existing copy budgets apply to compounds. See the [installed Java/Kotlin checks](../evidence/jvm-compounds-20260920.md).

### Tagged variants

Concrete copied Lean inductives use a sealed Java interface and one named record
per constructor. The compiler checks exhaustive switches over these cases.
Numeric tags and native layouts stay inside the package.

For the `org.leanbridge:variants:1.0.0` acceptance archive, save `Example.java`:

```java
import org.leanbridge.variants.*;

class Example {
    public static void main(String[] args) {
        Signal result = Api.next(new SignalData(42, "ready"));
        String label = switch (result) {
            case SignalIdle idle -> "idle";
            case SignalStopped stopped -> "stopped";
            case SignalData data -> data.count() + ": " + data.label();
            case SignalMarker marker -> "marker";
        };
        System.out.println(label); // 43: ready!
    }
}
```

Use the [prepared JAR commands](#call-an-ordinary-lean-package). Constructor
names use PascalCase; payload accessors use camelCase. Java keywords gain a
trailing underscore, and existing trailing underscores remain when they
distinguish source names. Name collisions reject during generation.

Payloads can contain all nineteen primitives, copied records, arrays, Lists,
options, results, products and other admitted variants. Only the active case
is converted. Empty cases and cases carrying `Unit.INSTANCE` remain distinct.
Calls reject null cases, active null fields and invalid primitive values.

Record components are final, but contained arrays remain mutable. Results own
independent copied storage. Java record equality compares array references;
compare their contents when checking copied values. The existing 32-level type
limit and managed/native copy budgets apply. Scoped arenas and native output
guards release partial conversions on failure. See the
[installed variant checks](../evidence/jvm-variants-20260921.md).
Recursive, callable and identity-bearing payloads remain separate work.

### Callbacks and returned Lean functions

Ordinary-source and compiler-checked reviewed Maven packages support synchronous callbacks and returned functions across all nineteen primitives. Generated functional interfaces carry the exact parameter and result types. Pass a Java lambda directly:

```java
System.out.println(Api.callWord(40, value -> value + 1)); // applies twice: 42
try (var addTwo = Api.makeWord(2)) {
    System.out.println(addTwo.invoke(40));              // 42
    System.out.println(Api.callWord(40, addTwo));        // 44
}
```

Add these calls to the Maple example's `main` method. `makeWord` returns `FnUInt32ToUInt32.LeanClosure`, which implements the same functional interface as the callback parameter and `AutoCloseable`. Other signatures use corresponding `Fn...To...` interfaces. Primitive mappings do not change: UInt64, Nat and Int still use `BigInteger`, and a Unit result returns `void`.

Callbacks borrow one synchronous call. Their copied arguments remain valid afterward, but Lean must not retain the host function; invoking an expired borrow throws. Exceptions and errors from a callback return to the caller as the same `Throwable`, with the original stack and suppressed exceptions. Later callbacks in that failed call do not run. This includes checked exceptions thrown by Kotlin callbacks; the Java signatures do not declare checked exceptions.

Call `invoke` on the closure's creating platform thread. Java virtual threads are rejected for callable operations because they can move between native threads. `close` is idempotent, may run on another thread, and defers native release while a call is active. All references and saved method references reject invocation after closing. `isClosed` reports explicit closure; a Cleaner releases abandoned leases as a fallback. Use try-with-resources for deterministic cleanup.

Callbacks accept one to sixteen primitive arguments. Calls share a 16 MiB conversion budget. Each native adapter allows 64 nested callable invocations on a thread; the shared runtime allows 4,096 live closure identities. These limits do not bound Lean or JVM heap allocation. Use a fresh process after fork. Futures, suspend functions, retained host callbacks, compound callable arguments and resources are outside this profile. Do not start detached work that uses a borrowed function. See the [installed JVM callable checks](../evidence/jvm-callables-20260919.md).

### Alpha interoperability example

The remaining example uses `org.leanbridge:lean-alpha:0.0.0`. Its separate fixture API also demonstrates identity-bearing resources, which ordinary-source Maven builds do not yet admit. Set `LEAN_BRIDGE_MAVEN_RELEASE` to the authenticated Alpha release directory containing `repository/org/leanbridge/lean-alpha/0.0.0/`.

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
| `Unit` | `Unit` (input, field, callback input); `void` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Pass Unit.INSTANCE; Unit results return void. Unit fields and array elements use the generated enum. Pass Unit.INSTANCE; Unit callback results return void. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `boolean` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Checked nonnegative integer, at most 255. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Checked nonnegative integer, at most 65535. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Checked nonnegative long, at most 4294967295. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | BigInteger in 0..18446744073709551615. Invalid sign or width throws before narrowing. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `byte` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `short` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Exact BigInteger magnitude; negative input throws. Exact java.math.BigInteger. Negative Nat values and callback results reject; captured values retain every bit. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Exact signed BigInteger with no narrowing. Signed exact java.math.BigInteger without fixed-width or floating-point narrowing. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Strict Unicode conversion preserves embedded NUL. Null and malformed UTF-16 throw. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `byte[]` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Copied mutable byte array with independent returned storage. Null throws. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Typed Java array` (input, result, field); `long[]` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Primitive arrays retain their scalar mappings; nested/reference arrays preserve their types. Calls deep-copy values and reject nested nulls. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `Option<T>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Generated sealed interface with None/Some record branches, none()/some(value) factories, isSome() and guarded value(). Boxed primitive payloads preserve JVM generic types. Some(None) and Some(Some(Unit)) remain distinct. Null containers and payloads reject. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Result<T, E>` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Lean `Except E T` uses success-first `Result<T, E>.ok(value)` or `.err(error)`. Generated sealed Ok/Err records support exhaustive matching. isOk() selects guarded value()/error(). Domain errors return Err; bridge failures throw exceptions. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Pair<A, B> (nested binary products)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exactly two statically typed generated Pair elements, preserving binary nesting. Kotlin uses this generated record, not kotlin.Pair. Inputs are copied; returned arrays own independent storage. Record equality compares array fields by reference. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated Java record` (input, result, field); `Payload` (input, result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Generated Java records preserve field order through compiler-owned accessors. Nested arrays in results are independent copies. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Java target value; named Lean contract in Maven metadata and Java source docs` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Aliases retain exact target ranges and copied storage. Nat rejects negative BigInteger while Int accepts it; UInt32 uses range-checked long/Long. Generic compound payloads box primitives; arrays retain primitive storage. Generated Unit inputs and void outputs stay distinct. The original List/Array identities, nested Option/Result presence and copy limits remain unchanged. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `sealed Java interface with named constructor records` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Construct named records and match exhaustively with Java switch or Kotlin when. Empty constructors and Unit payloads stay distinct. Numeric tags and native union layouts remain private. Only the active payload is converted; invalid native tags reject before union reads. Scoped arenas and native output guards release partial conversions on errors. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Typed Fn...To... functional interface` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Typed synchronous functional interfaces accept Java and Kotlin lambdas. Call-scoped native stubs retain their targets. Callback failures preserve the same Throwable, stack and suppressed exceptions after cleanup. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `T[] (primitive arrays for primitive elements)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Typed JVM arrays preserve empty Lists, order, duplicates and nesting. Primitive elements retain primitive array storage; Kotlin uses LongArray for List UInt32, for example. Returned arrays and mutable payloads own independent storage. Nulls, invalid payloads and oversized copies reject. Native lengths, missing buffers and alignment are checked before allocation or reads; scoped arenas and native output clears run on conversion failure. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Use an integer code point, not a UTF-16 char. A checked Unicode scalar code point including NUL and supplementary values. Surrogates and out-of-range integers reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Exact BigInteger for the 64-bit compiled Lean target, checked in 0..2^64-1. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Signed JVM value for the 64-bit compiled Lean target; both endpoints are preserved. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
