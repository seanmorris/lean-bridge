# Java and Kotlin primitive callbacks and returned Lean functions

Java passes 66,683 assertions and Kotlin passes 66,655 on each source path.
Each installed consumer repeats those checks twice without a compiler, alongside
six compiler-rejected callers per language. The independent copied-value corpus
has 204 executed catalog cases and 44 compiler rejections on each source path,
plus 144 supplemental runtime-rejection checks on the ordinary-source path.

The [acceptance record](jvm-callables-20260919.json) binds the independent
Java and Kotlin consumers to installed Maven JAR/POM archives, compiled public
signatures, compiler diagnostics, native libraries and runtime-only deployments.
Both ordinary-source and compiler-checked reviewed packages use the unchanged
private C callable ABI and shared native Lean runtime.

## Public API

The 63-export fixture covers all nineteen primitives, mixed callback signatures,
multiple callbacks in one call, captured values, and sixteen-argument callbacks
and returned functions. Each signature has a typed functional interface such as
`FnUInt32ToUInt32`. Its nested `LeanClosure` implements that interface and
`AutoCloseable`, exposing `invoke`, `isClosed` and `close`.

Java and Kotlin pass lambdas directly. UInt8/UInt16 use checked int/Int; UInt32
uses checked long/Long. UInt64, Nat and Int keep `java.math.BigInteger`. Char is
a checked Unicode scalar code point. Unit arguments use the generated enum;
Unit results return void in Java and Unit in Kotlin. The public API contains no
FFM segments, native pointers or marshalling declarations.

## Checks

- Signed and unsigned endpoints, 31/32/53/64-bit boundaries and 16,385-bit
  integers survive host calls and both branches of captured closures.
- Floating-point checks preserve signed zero, subnormals and infinities and
  compare NaNs by classification. Text includes embedded NUL, supplementary
  characters, combining marks and noncharacters. Byte arrays include all values.
- The adapter contains every callback `Throwable` inside its FFM upcall, then
  rethrows the same object after cleanup, preserving stack and suppressed
  exceptions. Checked exceptions, runtime exceptions and Errors are tested.
  [Java 22's Linker contract](https://docs.oracle.com/en/java/javase/22/docs/api/java.base/java/lang/foreign/Linker.html#upcallStub(java.lang.invoke.MethodHandle,java.lang.foreign.FunctionDescriptor,java.lang.foreign.Arena,java.lang.foreign.Linker.Option...))
  requires upcall handlers not to let exceptions escape.
- Later callbacks do not run after the first failure. Nested calls and recovery
  after the native reentry limit preserve the original exception behavior.
- Forced GC during callbacks preserves the upcall target. Retained callback
  arguments are independent copies. An expired host-function borrow rejects.
- Wrong-thread calls, including after the creator exits, reject. Cross-thread
  close defers release while a call is active. Closed objects and saved method
  references reject further invocation. Java checks Cleaner recovery, registry
  exhaustion and repeated reuse; both languages check 8,192 successive leases.
- Virtual threads reject callable operations before invocation. A separately
  compiled production-state test checks active-call cleanup and a simulated PID
  change. It substitutes a controlled PID; it does not fork a running JVM.
- Null, negative Nat, invalid unsigned ranges, surrogate code points, malformed
  UTF-16 and oversized copies reject. Six invalid source files per language
  check callback parameter/result types, async results, closure result/argument
  types and inaccessible constructors with exact source-located diagnostics.

Each consumer installs into an empty Maven repository and home, using only
the prepared JAR/POM and a hashed author-supplied build-plugin closure. After
compiling the caller, the harness deletes its source tree and Maven cache and
runs twice on a relocated `jlink` image containing only `java.base`. Kotlin
ships its separately hashed standard-library JAR beside the caller. Native
libraries must come from the original JAR, match their recorded identities,
and disappear from the private extraction directory on normal exit.

The Maple/Cedar regression suite checks reproducible JAR/POM archives, nested
copied values, concurrency, tamper rejection, isolated class loaders, and two
components sharing one runtime. It also checks cross-package callbacks and
closures, nested exception identity, and atomic compiler failure. Independent
Shop/Telemetry Lean oracles check both source paths in both languages.

```sh
LEAN_BRIDGE_JVM_CALLABLE_TEST=1 node --test tests/jvm-callables.test.mjs
node --test tests/jvm-callable-contract.test.mjs
LEAN_BRIDGE_NATIVE_JVM_TEST=1 node --test tests/native-jvm.test.mjs
npm run test:type-corpus:jvm
LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=java,kotlin node --test tests/type-corpus-reviewed-native.test.mjs
```

Local acceptance uses JDK 22.0.2, Kotlin 2.2.0, Maven 3.9.11, GCC 12.2.0 and
glibc 2.36. The declared package and CI floor remains glibc 2.38. Invocation
requires the creating platform thread; close may run on another thread. The
64-invocation limit is per native adapter on a thread; the shared runtime has
4,096 closure identities. The 16 MiB conversion budget does not bound Lean or
JVM heap allocation. Compound callable arguments, identity-bearing resources,
asynchronous delivery and other hosts are outside this milestone.
