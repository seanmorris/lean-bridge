# Optimized Java and Kotlin receiver lifetimes

VO node: 1219. Machine receipt:
[`owned-jvm-receiver-gc-20261001.json`](./owned-jvm-receiver-gc-20261001.json).

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-jvm-receiver-gc
```

The ordinary-source and reviewed-IR cases compile Lean and generate the Java
and Kotlin bindings. Each case runs 10,627 checks per language, collects eight
nominal owners per language, and forces 100 collections inside receiver getter
calls. Both cases finish without live native allocations or identities.

The probes cover resources, records, empty and nonempty variants, recursive
values, and a result borrowed from another argument. Borrowed descendants and
raw views expire when the original owner is collected. Independent retains
remain usable. A bound method keeps its receiver alive until the method
reference is released.

HotSpot's compiler log records C2 compilation of both languages' resource and
aggregate getters and both ephemeral-receiver callers. The test separately
removes Java and Kotlin reachability fences, compiles each changed binding,
and requires the optimized getter assertion to reject it. Each negative run
retains its own C2 records for the affected getter and caller. The original
generated sources are then restored, compiled and tested again.

The receipt binds both reports, the test log, compiler inputs, generated source
hashes, probe hashes and negative variants to the repository sources. Its
verifier regenerates the bindings and rejects missing collections, incomplete
compiler records, missing variants, leaked owners and unsupported claims.

Native and container CI run the same two-test gate and retain its log and both
reports. This local receipt records direct generated-binding execution, not
installed Maven packages or a container run. Installed receiver-package
acceptance remains in the
[JVM receiver receipt](./owned-jvm-receivers-20261001.md). Callback-result
lifetimes and installed support promotions are not part of this GC milestone.
