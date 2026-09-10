# Java

Resolve Alpha from a Maven repository and call its public Java API. The JAR carries compiled Lean libraries and uses JDK 22's finalized Foreign Function and Memory API.

## Use a prepared release

### Prerequisites

Use JDK 22 and Maven on x86-64 Linux with glibc 2.38 or newer. Check `java -version`, `javac -version`, `mvn -version`, and `ldd --version`; Maven must also run on JDK 22. The [support contract](../consumer-support.v1.json) records this JVM profile.

This example uses `org.leanbridge:lean-alpha:0.0.0`, the Alpha interoperability package. Follow [Use a prepared release](receive-package.md) to obtain and authenticate its Maven release. Set `LEAN_BRIDGE_MAVEN_RELEASE` to the absolute release directory containing `repository/org/leanbridge/lean-alpha/0.0.0/`. Keep the repository's POM and JAR together. No Maven Central publication is assumed.

### Resolve the package

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

### Type conversions

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

Invalid unsigned values raise `IllegalArgumentException`. This Alpha release exposes no `Nat`, `Int`, floating-point, optional, or asynchronous operations; its `long` mapping is specifically for `UInt32`, not arbitrary Lean integers.

### Types, callbacks, and cleanup

The JVM API represents Lean `UInt32` as a `long` in the range `0..0xffff_ffffL`. It rejects negative or larger input values with `IllegalArgumentException`. Java bytes are signed, so use `(byte)255` to supply the byte `0xff`. `Payload` copies input arrays and returns copies from its array accessors.

Alpha's `roundTrip` flips the Boolean and increments the count while preserving its other fields. `withCallback(40, value -> value + 2)` returns `44`: Lean calls the callback with `41`, receives `43`, and adds one. Callbacks run synchronously. `makeAdder(2)` returns an owned Lean callable.

`Box` and `OwnedTransform` implement `AutoCloseable`. Use try-with-resources so an exception still releases both. Repeated `close()` is harmless; a later operation raises `DisposedResourceException`. `Box.identity()` returns the original wrapper.

### Errors and troubleshooting

- Callback failures raise `CallbackThrewException`; `getCause()` retains the original Java exception. The example verifies that cause.
- Other reported Lean/native failures raise `LeanBridgeException` or its generated subclasses.
- `UnsupportedClassVersionError` means the running JVM is older than the JAR's target. Check the executables used by Maven, `javac`, and `java`.
- Keep `--enable-native-access=ALL-UNNAMED` on the application launch command. This example uses the classpath, not a named Java module.
- A native-load failure can indicate glibc older than 2.38, an unsupported architecture, or an unwritable temporary directory used to extract the bundled libraries. Leave `LEAN_BRIDGE_NATIVE_ROOT` unset to use those libraries.
- A Maven resolution failure often means `LEAN_BRIDGE_MAVEN_RELEASE` points at `repository/` rather than its parent. The command appends `/repository`.

## Start from a raw Lean package

For Alpha, [build the managed Maven package](../contributing/testing.md#managed-packages) to produce the release repository containing its JAR and POM. Set `LEAN_BRIDGE_MAVEN_RELEASE` to that output and follow [Resolve the package](#resolve-the-package).

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Related workflows and acceptance

The same JAR has a separate [Kotlin guide](kotlin.md). Alpha's JVM surface uses the [managed target profile](../architecture/adr/23-managed-runtime-target-profiles.md).

Contributors can [build the managed examples](../contributing/testing.md#managed-packages) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [managed acceptance evidence](../evidence/managed-consumer-acceptance.md).

### Publish this package

See [Publish to Maven repositories](../publish/maven.md) for package preparation, distribution, and verification after upload.
