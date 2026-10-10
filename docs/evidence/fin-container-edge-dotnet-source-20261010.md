# .NET Fin container edge instrumentation

The C# source control executes the complete original-plus-edge consumer against actual compiled Lean and the production-generated C# API. It retains all 14,089 assertions and records 12,047 calls through six measured public methods. Each row includes the outcome and all eight native entry counters.

GDB measures the six typed adapters and the non-inlined `present` and `flatten` Lean functions. Four inlined identity source functions remain unmeasured. The C# `Option<T>.Some` constructor permits a null payload, so `OptionalDigits(Some(null))` reaches the public API and rejects before native dispatch. Its measured row distinguishes C# from the Java consumer, whose constructor rejects the payload earlier.

The probe changes only six caller-local forwarding sites and startup authentication. It preserves the original assertions, public signatures, exception types, messages, and stack-preserving rethrows. Negative Nat values, null carriers, rejected Fin bounds, nested positions, empty values, and 1,000 rejection/recovery cycles remain in the consumer.

## Package and runtime checks

The ordinary consumer first installs the synthetic NuGet package, executes, and relocates. The observer then compiles the complete instrumented consumer in a separate guarded deployment from that exact original archive. It authenticates both installations, including the feed, package cache, restore/build inputs, managed assembly, deployed native libraries, and model. It checks these identities before and after each observed run, including failures.

The generated managed and native loaders remain unchanged. The probe checks the loaded public assembly's location; GDB checks the actual native definitions and their addresses. Startup checks bind the counter record to its process, nonce, configuration, columns, and empty initial state. The explicitly selected .NET SDK and shared framework remain trusted toolchains.

The source gate refuses missing instrumentation, a wrong model, missing guarded context, a probe inside the original installation, a changed managed assembly, dropped source or adapter increments, extra increments, nonempty initial counters, altered nonce/configuration, forged manifests, and observer arming/write failures. Successful observations repeat in fresh processes with distinct process IDs and nonces. Final counters are `[1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]`.

## Verification and remaining acceptance

```sh
LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST=1 \
node --test --test-concurrency=1 tests/fin-container-edge-dotnet.test.mjs
```

All three tests passed with zero failures or skips in 195.691 seconds. Original local TAP: `/app/build/vo1454-dotnet-observer-r2.tap`, SHA-256 `4ebb61c5b504f8ed85872038082d47de13e5b721130f67af7b6483cba6d88899`. The observed stdout SHA-256 is `b0e53b09e5888149c0053e343f87500cfc9a4be572c23ce32706a8bf5e8706dd`. Focused lint and checked JavaScript also passed.

The first run stopped because the fixture supplied a symlinked SDK path while the guarded installer retained its resolved path. The fixture now resolves its selected tool path. No installer check was relaxed.

The observer is wired into the canonical edge runner. These source controls use synthetic receipts around actual Lean and generated wrappers; they do not establish canonical two-root package acceptance, hosted acceptance, or integration with the current indexed diagnostics. WIT observation, the complete canonical matrix, source-history integration, and the remaining scope audit still need completion. No support-table claim changes.
