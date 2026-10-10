# JVM Fin container edge instrumentation

The Java and Kotlin source controls execute the complete original-plus-edge consumers against real compiled Lean and the generated Java API. Java retains 14,089 assertions; Kotlin retains 14,088. Each process records 12,046 calls through the six measured public methods, with exact per-call adapter/source counts and exception categories. Kotlin uses its existing Java interop consumer; this does not test the separate Kotlin facade.

GDB observes six typed adapters and the non-inlined `present` and `flatten` source functions. The four inlined identity source functions remain unmeasured. `Option.some(null)` throws during argument construction, before calling `optionalDigits`; its original assertion remains in both consumers but is not counted as an API entry.

The production JAR loader is unchanged. Each JVM extracts into its own fresh temporary parent. The observer authenticates the private extraction directory, every native filename and file hash, defining addresses, and loaded Java class locations. It keeps read-only file descriptors until process exit, then checks the extracted bytes and their unlink state. Foreign directories, changed bytes, missing counters, nonempty startup counters, altered process identities, missing source/adapter increments, and instrumentation failures are refusal controls.

The source fixture now links its bundled libraries with origin-relative runtime paths, matching the packaged layout. Its earlier compiler-directory runtime path loaded another native copy and correctly triggered the observer's refusal.

## Verification and remaining acceptance

The source gate passed all three tests with zero failures or skips in 225.463 seconds. Both languages repeated the complete transcript in two fresh processes. Final counts were `[1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]`.

```sh
LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST=1 \
node --test --test-concurrency=1 tests/fin-container-edge-jvm.test.mjs
```

Original local TAP: `/app/build/vo1454-jvm-observer-r4.tap`, SHA-256 `3cf9e9663dc8f08d1610127a453c7203dd186cf62997a3961eebf63e9386f251`.

The guarded observer is now wired into the canonical edge runner. Its source gate also passed all three tests, with zero failures or skips, in 324.303 seconds. It checks the original JAR, extracted inspection tree, model, selected tool binaries, and probe files before and after execution, including failure paths. Both languages repeat their complete observed consumers in fresh processes. Negative controls refuse a changed JAR, a wrong model identity, missing guarded context, an unspecified compiler, and a probe directory inside the installed package.

Guarded-observer local TAP: `/app/build/vo1454-jvm-observer-r6.tap`, SHA-256 `3fbceeaba2c010a26bb07b3d1e3f8f5ae1e3fc0e3c6e2326ed798e4836b50fda`.

The complete 15-root edge source regression at `7c3129d0ef5e06b1b4d00563cfb8f6d56f9c81f4` passed 87 tests with zero failures and one canonical installed-package skip in 1,092.845 seconds. This includes the C/C++, Python, Rust, Ruby, PHP and JVM source observers and the managed installation guards. The new .NET public observer was not part of that run. Original TAP: `/app/build/vo1454-jvm-observer-full-r1.tap`, SHA-256 `7e1ccf92d2e93067b9281996106795348d511e32d1b9f6f4cf130a471d623b21`.

These tests use a synthetic receipt-bearing JAR around real Lean and generated wrappers. They do not establish canonical two-root package acceptance, hosted acceptance, or diagnostic-path integration. The complete canonical matrix and integration with the current nested diagnostics remain separate work. No support-table claim changes.
