# Recursive Java and Kotlin packages

Recursive Maven releases contain both a Java API and a Kotlin API. The
[execution record](jvm-recursive-packages-20260923.json) binds their generated
sources, original package artifacts, independent consumers and runtime-only
executions. Final acceptance still requires shared-backend regressions,
source-lineage verification and the complete repository suite.

## Installed behavior

Ordinary Lean source and independently reviewed IR each produce an 18-function
Maven-only release. The native adapter does not add a public C or GMP facade.
Typed Java records and sealed cases have corresponding Kotlin classes with
non-null metadata. Both APIs use one iterative conversion engine, scalar codecs
and authenticated native loader.

Each language installs the original JAR and POM into its own empty offline Maven
repository. Maven resolves the declared Kotlin standard library. Independent
consumers check public signatures, all nineteen scalar representations,
recursive copies, mutual recursion, nested options and results, the 128-level
value limit, wide constructors and 256 concurrent calls. Invalid values of the
uninhabited `Never` family reject before entering Lean.

Each profile rejects four invalid consumer programs with source-located compiler
diagnostics. The installed tests also compile and execute the exact recursive
examples from the [Java](../consume/java.md#recursive-values) and
[Kotlin](../consume/kotlin.md#recursive-values) guides.

The test deletes author sources, the consumer project, handoff and local Maven
repository before executing the relocated application. The runtime contains
only `java.base`, without compilers or Maven. Two executions must produce the
same observations, map the expected native libraries and remove extracted assets
at normal shutdown. The original installed JAR stays unchanged.

## Identity and reproducibility

The package gate rejects changes to the graph-layout receipt and re-signed
generated adapter sources, including the JVM cleanup shim. Tampering with each
of the four bundled native assets must fail before native mapping.

Compiler-free repackaging must reproduce the original JAR and POM. A separate
gate builds both source paths again in fresh directories and compares complete
artifact identities, native binaries, Binding IR, finite layouts and models
with the packages exercised by installed consumers.

## Shared runtime

The composition test installs two recursive packages and an ordinary package.
One recursive release also targets C++. Independent Java and Kotlin callers
exercise both loading orders and 192 concurrent cross-package calls. The broker
must report one runtime initialization and three component initializations.
Retiring the shared runtime through the first recursive package makes all three APIs unavailable;
previously copied values remain usable.

The conflict test installs two genuine builds of one Lean component coordinate.
Separate class loaders admit identical builds without extracting another native
copy. Conflicting builds reject before mapping, and the first component remains
usable. Both languages exercise duplicate and conflict cases in both orders.
The probes hash actual process mappings and compare them with the original
package receipts.

## Reproduction

```sh
LEAN_BRIDGE_JVM_GRAPH_PACKAGE_TEST=1 \
LEAN_BRIDGE_JVM_GRAPH_INSTALLED_TEST=1 \
  node --test tests/jvm-graph-package.test.mjs

LEAN_BRIDGE_JVM_GRAPH_REPRO_TEST=1 \
LEAN_BRIDGE_JVM_GRAPH_LOADING_TEST=1 \
  node --test tests/jvm-graph-package.test.mjs
```

Run the installed gate before reproduction. CI retains all five package reports
under `build/recursive/`, alongside the separate Java native-conversion and
Kotlin metadata reports. Structured callable payloads and explicitly owned
resource-containing aggregates remain later implementation work.
