# Java and Kotlin receiver acceptance

The receiver milestone adds nominal whole-value owners, JavaBean getters and
Kotlin read-only properties. Methods preserve the original receiver or declared
argument anchor, consuming calls invalidate the original owner before Lean
runs, and independent retains survive that handoff.

The acceptance command is:

```sh
LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-jvm-receivers
```

Runtime probes cover ordinary configuration and reviewed IR, aggregate and
recursive values, callback reentry, typed closure results, allocation failures,
whole-owner collection and thread exit. Separate resource-only cases omit
callback and result-anchor capabilities; another pair retains callbacks while
omitting result anchors.

The Maven checks use an installed CLI, independent producer builds, package
reassembly, offline consumer installation and runtime-only relocation. Java and
Kotlin consumers compile without the generator, reject invalid calls and run
the documentation examples. Native asset checks cover missing and changed
libraries with cold and already-loaded packages. Resource-only packages built
through the native API explicitly disable callback transport and check that
callback artifacts are neither required nor advertised. The general CLI enables
callback/copy transport; the full aggregate packages exercise that path.

The external-client preflight uses the production JVM compiler. Receiver
format version 4 retains Kotlin's finite type-table metadata; removing that
compiler option invalidates the package. Existing scalar and callback package
profiles have separate production-compiler regression tests.

The complete gate passed all fifteen tests without skips or cancellations.
Each compiler path passed 650 Java and 642 Kotlin direct checks. Installed
consumers passed 229 Java and 221 Kotlin checks, repeated after relocation.
Resource-only packages passed eleven checks per language without consuming
inputs and thirteen with consumption, also repeated after relocation. Four
compiled semantic mutations and invalid public-client programs must fail.

The [source-bound receipt](owned-jvm-receivers-20261001.json) includes all twelve
reports, the complete gate log and exact predecessor edits. The reviewed build
also installs C++, Rust, Python, Ruby and C# consumers from the same seven-target
release. No support-matrix cells are promoted by this milestone. Callback
result anchors, dedicated optimized nominal-receiver GC checks and the final
cross-language container audit remain separate work under VO 1219.
